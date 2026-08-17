const dayjs = require("dayjs");
const prisma = require("../prisma/cliente");
const ErrorApp = require("../utils/error");
const { calcularImpuesto, calcularTotalItem, normalizarCantidadDetalles } = require("../utils/facturacion");
const generarPdf = require("../utils/generarPdf");
const { v4: uuidv4 } = require("uuid");
const { formatNumber, formatNumeroDocumento } = require("../utils/format");
const { separarCajaEstablecimiento, parseNumeroCompuesto } = require("../utils/documento");
const { parsearFields, proyectar } = require("../utils/fields");
const { enviarFactura } = require("./correoService");
const { construirCdc } = require("../utils/sifen/cdc");
const loteService = require("./sifen/loteService");
const eventoService = require("./sifen/eventoService");
const { esAprobado, esCancelado } = require("../utils/sifen/estadoHistorico");
const { buscarPorRucConFallback } = require("./padronRucPersistenciaService");
const { bloqueaEmision } = require("../utils/sifen/estadoPadronRuc");
const { consultarCedula } = require("./cedulaService");

// Lista cerrada de atributos de PRIMER NIVEL que el query param `fields` de los GET puede pedir para
// una Factura. Incluye las columnas escalares + las relaciones que los GET incluyen (detalles,
// cliente_empresa, eventos_sifen, caja) + los campos sintetizados en la respuesta (establecimiento).
// Cualquier field fuera de esta lista => 400. Ver src/utils/fields.js.
const CAMPOS_FACTURA = [
  "id", "numero_factura", "factura_uuid", "usuario_id", "cliente_empresa_id",
  "fecha_creacion", "fecha_modificacion", "condicion_venta", "total_iva", "total", "cdc",
  "fuente", "id_externo", "xml", "linkqr", "sifen_estado", "sifen_estado_mensaje", "xml_firmado",
  "estado_sifen", "sifen_cod_respuesta", "sifen_num_transaccion", "fecha_firma", "fecha_envio_sifen",
  "fecha_respuesta_sifen", "intentos_firma", "lote_id", "codigo_seguridad", "caja_id",
  "detalles", "cliente_empresa", "eventos_sifen", "caja", "establecimiento",
];

// tipoDocumento SIFEN para el CDC — 1=Factura, ver xmlBuilderService.js
const CDC_TIPO_DOCUMENTO_FACTURA = 1;
const CDC_TIPO_EMISION_NORMAL = 1;
const CDC_TIPO_CONTRIBUYENTE = { FISICA: 1, JURIDICA: 2 };

// Datos del Cliente sentinela para facturas innominadas (consumidor final no identificado). Es un
// único registro global reutilizado por todas las empresas (enlazado a cada una vía su propio
// ClienteEmpresa), igual que un cliente compartido por RUC. El receptor innominado real
// (iTipIDRec=5, dNomRec="Sin Nombre") lo materializa xmlBuilderService.mapearCliente a partir de
// tipo_identificacion=INNOMINADO; estos valores solo satisfacen el modelo Prisma y el KuDE/PDF.
const CLIENTE_INNOMINADO = {
  ruc: "0",
  documento: "0",
  razon_social: "Sin Nombre",
  tipo_identificacion: "INNOMINADO",
  situacion_tributaria: "NO_CONTRIBUYENTE",
  nombres: "Sin Nombre",
  apellidos: "",
  pais: "PRY",
};

// Devuelve el Cliente sentinela innominado, creándolo la primera vez. Una eventual carrera entre dos
// emisiones innominadas concurrentes solo podría crear un segundo sentinela idéntico (mismo XML), sin
// impacto funcional — por eso no se usa transacción/upsert aquí. El `orderBy` fija cuál se devuelve de
// forma estable (siempre el más antiguo) aunque llegaran a existir varios.
const obtenerClienteInnominado = async () => {
  const existente = await prisma.cliente.findFirst({
    where: { tipo_identificacion: "INNOMINADO" },
    orderBy: { id: "asc" },
  });
  if (existente) return existente;
  return prisma.cliente.create({ data: CLIENTE_INNOMINADO });
};

const emitirFactura = async (datos, datosUsuario) => {
  try {
    // Buscar establecimiento
    const establecimiento = await prisma.establecimiento.findFirst({
      where: {
        codigo: datos.establecimiento,
        empresa_id: datosUsuario.empresaId
      }
    })

    if (!establecimiento) {
      throw new ErrorApp('No se encontró establecimiento', 404)
    }

    // Buscar caja para establecimiento
    const caja = await prisma.caja.findFirst({
      where: {
        codigo: datos.caja,
        establecimiento_id: establecimiento.id
      }
    })

    if (!caja) {
      throw new ErrorApp('No se encontró caja', 404)
    }

    //Buscar datos del usuario
    const usuario = await prisma.usuario.findFirst({
      where: { id: datosUsuario.id },
      include: {
        empresa: true,
      },
    });

    if (!usuario) {
      throw new ErrorApp("Usuario no encontrado", 404);
    }

    // Validar el RUC del receptor contra el padrón de contribuyentes antes de armar/emitir el DE
    // (Manual Técnico SIFEN v150, validaciones D206b/c/d) — sin esto SIFEN rechaza el documento
    // recién después de armado y enviado, con el RUC ya guardado como Cliente.
    // No aplica a facturas innominadas: no hay receptor identificado que validar y los datos de
    // receptor que pudieran venir en el body se ignoran (ver rama `datos.innominado === true` abajo).
    if (datos.innominado !== true && datos.situacionTributaria === "CONTRIBUYENTE") {
      const [rucBaseRaw, dvInformado] = datos.ruc.includes("-") ? datos.ruc.split("-") : [datos.ruc, undefined];

      if (!dvInformado) {
        throw new ErrorApp(`El RUC ${datos.ruc} es inválido: debe incluir el dígito verificador con el formato "NNNNNNN-D"`, 400);
      }

      if (!/^\d+$/.test(rucBaseRaw)) {
        throw new ErrorApp(`El RUC ${datos.ruc} es inválido: la parte numérica ("${rucBaseRaw}") debe contener solo dígitos`, 400);
      }

      // El padrón guarda el RUC como número crudo sin ceros a la izquierda; normalizamos la base
      // recibida para que "018219823" matchee la fila "18219823". (?=\d) evita dejar la cadena vacía
      // si la base fuese "0".
      const rucBase = rucBaseRaw.replace(/^0+(?=\d)/, "");

      // padron_ruc es la única autoridad del dígito verificador: NO calculamos por módulo 11, porque
      // ese cálculo sugería un DV/RUC que puede no existir en el padrón real. Primero se verifica que
      // el RUC exista, luego que el DV coincida con el de la tabla (Manual Técnico SIFEN v150,
      // validaciones D206b/c/d). Si no está en el padrón local, se consulta el servicio externo
      // (ruc.com.py) y, si existe allí, se inserta en padron_ruc para continuar el flujo normal.
      const registroPadron = await buscarPorRucConFallback(rucBase);

      if (!registroPadron) {
        throw new ErrorApp(`El RUC ${datos.ruc} no existe en el padrón. Verificá el número con el cliente.`, 400);
      }

      if (String(dvInformado) !== String(registroPadron.digitoVerificador)) {
        throw new ErrorApp(`El RUC ${datos.ruc} es inválido: el dígito verificador informado ("${dvInformado}") no corresponde al RUC ${rucBase}. El dígito verificador correcto es ${registroPadron.digitoVerificador} (${rucBase}-${registroPadron.digitoVerificador})`, 400);
      }

      if (bloqueaEmision(registroPadron.estado)) {
        throw new ErrorApp(`El RUC ${datos.ruc} se encuentra en estado "${registroPadron.estado}" y no puede recibir documentos electrónicos`, 400);
      }
    }

    // Validar la cédula del receptor contra el registro de identificaciones antes de emitir —
    // mismo motivo que la validación de RUC de arriba. Solo aplica a NO_CONTRIBUYENTE con
    // documento tipo CEDULA: pasaporte/carné de residencia no tienen un registro local contra el
    // que validar, y NO_DOMICILIADO es por definición un extranjero sin cédula paraguaya.
    if (datos.innominado !== true && datos.situacionTributaria === "NO_CONTRIBUYENTE" && datos.tipoIdentificacion === "CEDULA") {
      const datosCedula = await consultarCedula(datos.ruc);

      if (!datosCedula) {
        throw new ErrorApp(`La cédula ${datos.ruc} no existe en el registro de identificaciones`, 404);
      }
    }

    // Resolver el Cliente receptor. Para una factura innominada (consumidor final no identificado) no
    // hay datos de cliente que validar ni persistir: se reutiliza el Cliente sentinela global. Para el
    // resto se busca/crea/actualiza a partir de los datos del body.
    let cliente;

    if (datos.innominado === true) {
      cliente = await obtenerClienteInnominado();
    } else {
      //Buscar si existe cliente
      cliente = await prisma.cliente.findFirst({
        where: { ruc: datos.ruc },
      });

      const nombres = datos.razonSocial.includes(",") ? (datos.razonSocial.split(",")[1] ? datos.razonSocial.split(",")[1].trim() : datos.razonSocial) : datos.razonSocial;
      const apellidos = datos.razonSocial.includes(",") ? (datos.razonSocial.split(",")[0] ? datos.razonSocial.split(",")[0].trim() : "") : "";

      //Crear cliente si no existe
      if (!cliente) {

        cliente = await prisma.cliente.create({
          data: {
            ruc: datos.ruc,
            razon_social: datos.razonSocial,
            documento: datos.ruc,
            tipo_identificacion: datos.situacionTributaria === "CONTRIBUYENTE" ? "RUC" : datos.tipoIdentificacion,
            situacion_tributaria: datos.situacionTributaria,
            dv: datos.ruc.includes("-") ? Number(datos.ruc.split("-")[1]) : null,
            nombres,
            apellidos,
            direccion: datos.direccion,
            email: datos.email,
            telefono: datos.telefono,
            pais: datos.situacionTributaria === "CONTRIBUYENTE" || datos.pais === '' ? "PRY" : datos.pais
          },
        });
      }

      //Actualizar datos de cliente
      if (datos.tipoIdentificacion !== cliente.tipo_identificacion
        || datos.situacionTributaria !== cliente.situacion_tributaria
        || nombres !== cliente.nombres
        || apellidos !== cliente.apellidos
        || datos.direccion !== cliente.direccion
        || datos.email !== cliente.email
        || datos.telefono !== cliente.telefono
        || datos.pais !== cliente.pais) {
        await prisma.cliente.update({
          data: {
            tipo_identificacion: datos.tipoIdentificacion ? datos.tipoIdentificacion : cliente.tipo_identificacion,
            situacion_tributaria: datos.situacionTributaria ? datos.situacionTributaria : cliente.situacion_tributaria,
            nombres: nombres ? nombres : cliente.nombres,
            apellidos: apellidos ? apellidos : cliente.apellidos,
            direccion: datos.direccion ? datos.direccion : cliente.direccion,
            email: datos.email ? datos.email : cliente.email,
            telefono: datos.telefono ? datos.telefono : cliente.telefono,
            pais: datos.pais ? datos.pais : cliente.pais,
          },
          where: { id: cliente.id },
        });

        cliente.direccion = datos.direccion ? datos.direccion : cliente.direccion;
        cliente.email = datos.email ? datos.email : cliente.email;
      }
    }

    //Buscar en cliente_empresa
    let clienteEmpresa = await prisma.clienteEmpresa.findFirst({
      where: {
        AND: [{ cliente_id: cliente.id }, { empresa_id: usuario.empresa_id }],
      },
    });

    //Agregar cliente a empresa
    if (!clienteEmpresa) {
      clienteEmpresa = await prisma.clienteEmpresa.create({
        data: {
          cliente_id: cliente.id,
          empresa_id: usuario.empresa_id,
        },
      });
    }

    //Calcular totales en el backend a partir de cantidad, precio unitario y tasa de cada item.
    //El caller ya no envía total/totalIva ni impuesto/total por item (mismo criterio que /factura/simple):
    //se computan acá y se asignan sobre cada item para el detalle y el PDF.
    let total = 0;
    let totalIva = 0;
    let totalExenta = 0;
    let totalIva5 = 0;
    let totalIva10 = 0;

    datos.items.forEach((e) => {
      e.impuesto = calcularImpuesto(e.cantidad, e.precioUnitario, e.tasa);
      e.total = calcularTotalItem(e.cantidad, e.precioUnitario);

      // Desglose por tasa para el pie del KuDE (mismo criterio que antes de mover el cálculo al backend).
      if (e.tasa == "0%") {
        totalExenta += e.impuesto;
      } else if (e.tasa == "5%") {
        totalIva5 += e.impuesto;
      } else {
        totalIva10 += e.impuesto;
      }

      total += e.total;
      totalIva += e.impuesto;
    });

    datos.total = total;
    datos.totalIva = totalIva;

    //Datos adicionales
    const facturaUuid = uuidv4();

    // Se usa transacción y FOR UPDATE para bloquear la tabla al crear el número de factura por si hay concurrencia.
    // La firma nativa (SIFEN) participa de la misma transacción: si falla
    // (certificado vencido/ausente, datos fiscales incompletos de la empresa), todo se revierte junto
    // con la numeración recién asignada — no queda un número de Factura "quemado".
    const factura = await prisma.$transaction(async (tx) => {
      const secuencia = await tx.$queryRaw`SELECT valor FROM secuencia_factura WHERE caja_id = ${caja.id} FOR UPDATE`

      if (!secuencia || secuencia.length === 0) {
        throw new ErrorApp('Secuencia no encontrada', 404);
      }

      const numeroFactura = Number(secuencia[0].valor) + 1;
      await tx.$executeRaw`UPDATE secuencia_factura SET valor = ${numeroFactura} WHERE caja_id = ${caja.id}`;

      const codigosSeguridadRaw = await tx.factura.findMany({
        select: {
          codigo_seguridad: true,
        },
        where: {
          caja_id: caja.id
        }
      });

      const codigosSeguridad = codigosSeguridadRaw.map((e) => e.codigo_seguridad);

      let codigoSeguridadAleatorio = generarCodigoSeguridad();

      while (codigosSeguridad.includes(codigoSeguridadAleatorio)) {
        codigoSeguridadAleatorio = generarCodigoSeguridad();
      }

      // CDC calculado localmente — ya no lo devuelve la API PHP legacy.
      const [rucSinDv, dvEmisor] = usuario.empresa.ruc.split('-');
      const cdc = construirCdc({
        tipoDocumento: CDC_TIPO_DOCUMENTO_FACTURA,
        rucSinDv,
        dvEmisor,
        establecimiento: establecimiento.codigo,
        punto: caja.codigo,
        numero: numeroFactura,
        tipoContribuyente: CDC_TIPO_CONTRIBUYENTE[usuario.empresa.tipo_contribuyente],
        fechaEmision: new Date(),
        tipoEmision: CDC_TIPO_EMISION_NORMAL,
        codigoSeguridad: codigoSeguridadAleatorio,
      });

      //Crear factura (estado_sifen: GENERADO — el pipeline nativo la firma a continuación, en esta
      //misma transacción; `xml`/`linkqr`/`sifen_estado` legacy quedan sin escribir)
      const factura = await tx.factura.create({
        data: {
          numero_factura: numeroFactura,
          factura_uuid: facturaUuid,
          usuario_id: usuario.id,
          cliente_empresa_id: clienteEmpresa.id,
          condicion_venta: datos.condicionVenta,
          total_iva: datos.totalIva,
          total: datos.total,
          cdc,
          estado_sifen: 'GENERADO',
          fuente: datos.fuente || 'APP',
          id_externo: datos.idExterno || null,
          codigo_seguridad: codigoSeguridadAleatorio,
          caja_id: caja.id
        },
      });

      //Agregar detalles de factura
      const datosFacturaDetalle = datos.items.map((e) => ({
        id_factura: factura.id,
        cantidad: Number(e.cantidad),
        precio_unitario: e.precioUnitario,
        tasa: e.tasa == "0%" ? "T0" : e.tasa == "5%" ? "T5" : "T10",
        impuesto: e.impuesto,
        total: e.total,
        descripcion: e.descripcion,
      }));

      await tx.facturaDetalle.createMany({
        data: datosFacturaDetalle,
      });

      // Firma + QR sincrónicos (mismo comportamiento que ya tenía la API PHP legacy — solo el envío a
      // SIFEN es asíncrono por lote). Devuelve la
      // Factura ya con `xml_firmado`/`linkqr`/`estado_sifen: FIRMADO`.
      return loteService.firmarDocumentoRecienCreado('FACTURA', factura.id, tx);
    })

    const itemsPdf = datos.items.map((e) => {
      const exentas = e.tasa == "0%" ? formatNumber(e.total) : "0";
      const iva5 = e.tasa == "5%" ? formatNumber(e.total) : "0";
      const iva10 = e.tasa == "10%" ? formatNumber(e.total) : "0";
      return {
        precioUnitario: formatNumber(e.precioUnitario),
        iva5,
        iva10,
        exentas,
        descripcion: e.descripcion,
        cantidad: String(e.cantidad),
      };
    });

    let creditoExtras = {}

    if (datos.condicionVenta === 'CREDITO' && datos.tipoCredito === 'CUOTA') {
      creditoExtras = {
        tipoCredito: 'CUOTA',
        creditoCuotaCantidad: datos.cantidadCuota,
        creditoCuotaPeriodicidad: datos.periodicidad
      }
    } else if (datos.condicionVenta === 'CREDITO' && datos.tipoCredito === 'A_PLAZO') {
      creditoExtras = {
        tipoCredito: 'A PLAZO',
        creditoAPlazoDescripcion: datos.plazoDescripcion
      }
    }

    // Mismo formato que el número impreso en el PDF (establecimiento-caja-numero, con el número
    // rellenado a 7 dígitos) — se reutiliza el helper compartido para no duplicar el criterio de formateo.
    const numeroFacturaFormateada = formatNumeroDocumento(datos.establecimiento, datos.caja, factura.numero_factura);

    // Se espera la generación del PDF (antes era fire-and-forget) para poder devolver su nombre de
    // archivo al caller — lo necesita /factura/simple para que el bot de WhatsApp lo descargue apenas
    // responde la API, y de paso deja de tragarse en silencio un eventual error de JasperReports.
    await generarPdf({
      plantilla: usuario.empresa.plantilla_pdf,
      empresaLogo: usuario.empresa.logo,
      empresaRuc: usuario.empresa.ruc,
      empresaTimbrado: usuario.empresa.timbrado,
      empresaVigenteDesde: dayjs(usuario.empresa.vigente_desde).format(
        "YYYY-MM-DD"
      ),
      empresaNombre: usuario.empresa.nombre_empresa,
      empresaDireccion: usuario.empresa.direccion,
      empresaTelefono: usuario.empresa.telefono,
      empresaCiudad: usuario.empresa.ciudad,
      empresaCorreoElectronico: usuario.empresa.email,
      facturaId: numeroFacturaFormateada,
      condicionVenta: datos.condicionVenta,
      ruc: cliente.ruc,
      razonSocial: cliente.razon_social,
      correoElectronico: cliente.email,
      total: datos.total,
      totalIva: datos.totalIva,
      totalExenta,
      totalIva5,
      totalIva10,
      moneda: "PYG",
      items: itemsPdf,
      uuid: facturaUuid,
      linkqr: factura.linkqr,
      cdc: factura.cdc,
      tipoDocumento: 'FACTURA ELECTRÓNICA',
      tipoDocumentoTop: 'KuDE de Factura Electrónica',
      tipoCredito: datos.tipoCredito,
      cantidadCuota: String(datos.cantidadCuota),
      periodicidad: datos.periodicidad,
      plazoDescripcion: datos.plazoDescripcion
    });

    return {
      ...factura,
      pdfNombre: `${facturaUuid}.pdf`,
      numeroFacturaFormateada,
      clienteNombre: cliente.razon_social,
      clienteDocumento: cliente.ruc,
    };

  } catch (error) {
    console.log(error);
    ErrorApp.handleServiceError(error, "Error al crear factura");
  }
};

const generarCodigoSeguridad = (length = 9) => {
  let result = "";
  const characters = "0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const getFacturas = async (page = 1, itemsPerPage = 10, filter = null, empresaId, fields = null) => {
  try {
    const campos = parsearFields(fields);
    const skip = (page - 1) * itemsPerPage;
    const take = itemsPerPage;

    const clienteEmpresas = await prisma.clienteEmpresa.findMany({
      where: {
        cliente: {
          ...(filter && {
            OR: [
              { ruc: { contains: filter } },
              { documento: { contains: filter } },
              { nombres: { contains: filter } },
              { apellidos: { contains: filter } },
              { razon_social: { contains: filter } },
              { email: { contains: filter } },
            ],
          }),
        },
        empresa_id: empresaId
      },
      select: {
        id: true,
      },
    });

    const clienteEmpresaIds = clienteEmpresas.map((ce) => ce.id);

    // --- Construcción segura del where ---
    const whereFacturas = (() => {
      // Siempre restringir por empresa (recomendado, evita “fugas”)
      const base = { cliente_empresa: { empresa_id: empresaId } };

      if (!filter) {
        // Sin filtro: todas las facturas de la empresa (vía relación)
        return base;
      }

      const or = [];

      // 1) Match por cliente (si hay ids)
      if (clienteEmpresaIds.length > 0) {
        or.push({ cliente_empresa_id: { in: clienteEmpresaIds } });
      }

      // 2) Match por CDC (string)
      or.push({ cdc: { contains: filter } });

      // 3) Match por número compuesto establecimiento-caja-numero (ej. "001-001-0000023"), tal como se
      // imprime/muestra el documento. Se resuelve contra la relación caja/establecimiento + numero_factura.
      const compuesto = parseNumeroCompuesto(filter);
      if (compuesto) {
        or.push({
          numero_factura: compuesto.numero,
          caja: {
            codigo: compuesto.caja,
            establecimiento: { codigo: compuesto.establecimiento },
          },
        });
      }

      // 4) Match por número de factura (solo si filter es entero “normal”)
      // Acepta únicamente dígitos y además limita tamaño para que entre en Int64
      const isIntegerString = /^[0-9]+$/.test(filter);
      if (isIntegerString) {
        // 19 dígitos puede exceder int64; int64 max = 9223372036854775807 (19 dígitos pero límite)
        // Para evitar edge cases, limitamos a 18 dígitos o validamos contra MAX_SAFE_INTEGER y/o BigInt.
        if (filter.length <= 18) {
          const n = Number(filter);
          if (Number.isSafeInteger(n)) {
            or.push({ numero_factura: { equals: n } });
          }
        }
      }

      return { ...base, OR: or };
    })();

    const facturas = await prisma.factura.findMany({
      skip,
      take,
      orderBy: {
        fecha_creacion: "desc",
      },
      where: whereFacturas,
      include: {
        detalles: true,
        cliente_empresa: {
          include: {
            cliente: true,
          },
        },
        eventos_sifen: true,
        caja: {
          include: {
            establecimiento: true,
          },
        },
      },
    });

    const totalItems = await prisma.factura.count({
      where: {
        cliente_empresa_id: {
          in: clienteEmpresaIds,
        },
      },
    });

    return {
      items: facturas.map((factura) => proyectar({
        ...factura,
        // Número tal como se imprime en el PDF (establecimiento-caja-numero, relleno a 7 dígitos).
        // Cae al número crudo cuando no se puede formatear (documentos legacy con caja_id NULL).
        numero_factura: formatNumeroDocumento(
          factura.caja?.establecimiento?.codigo,
          factura.caja?.codigo,
          factura.numero_factura
        ) ?? factura.numero_factura,
        // cantidad de cada detalle vuelve a number (columna Decimal -> Prisma.Decimal) para no cambiar el contrato.
        detalles: normalizarCantidadDetalles(factura.detalles),
        // Expone caja y establecimiento como campos hermanos del documento.
        ...separarCajaEstablecimiento(factura.caja),
      }, campos)),
      page,
      itemsPerPage,
      totalItems,
    };
  } catch (error) {
    console.log(error)
    ErrorApp.handleServiceError(error, "Error al obtener facturas");
  }
};

const getFacturaById = async (id, empresaId, fields = null) => {
  try {
    const campos = parsearFields(fields);
    // Búsqueda EXACTA por id (no LIKE/contains) y ACOTADA a la empresa del usuario autenticado
    // (vía la relación usuario.empresa_id) — sin este filtro un ADMIN podría leer facturas de otra
    // empresa por id (IDOR).
    const factura = await prisma.factura.findFirst({
      where: {
        id: Number(id),
        usuario: {
          empresa_id: empresaId,
        },
      },
      include: {
        detalles: true,
        eventos_sifen: true,
        cliente_empresa: {
          include: {
            cliente: true,
          },
        },
        caja: {
          include: {
            establecimiento: true,
          },
        },
      },
    });

    if (!factura) {
      throw new ErrorApp(`Factura con ID ${id} no encontrado`, 404);
    }

    return proyectar({
      ...factura,
      // Número tal como se imprime en el PDF (establecimiento-caja-numero, relleno a 7 dígitos).
      // Cae al número crudo cuando no se puede formatear (documentos legacy con caja_id NULL).
      numero_factura: formatNumeroDocumento(
        factura.caja?.establecimiento?.codigo,
        factura.caja?.codigo,
        factura.numero_factura
      ) ?? factura.numero_factura,
      // Expone caja y establecimiento como campos hermanos del documento.
      ...separarCajaEstablecimiento(factura.caja),
    }, campos);
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al obtener datos de factura");
  }
};

// Búsqueda por id_externo (identificador de correlación con un sistema externo) ACOTADA a la empresa
// del usuario autenticado (usuario.empresa_id). id_externo no es único: si hubiera varias facturas con
// el mismo valor se devuelve la más reciente (orderBy id desc).
const getFacturaByIdExterno = async (idExterno, empresaId, fields = null) => {
  try {
    const campos = parsearFields(fields);
    const factura = await prisma.factura.findFirst({
      where: {
        id_externo: idExterno,
        usuario: { empresa_id: empresaId },
      },
      include: {
        detalles: true,
        eventos_sifen: true,
        cliente_empresa: {
          include: {
            cliente: true,
          },
        },
        caja: {
          include: {
            establecimiento: true,
          },
        },
      },
      orderBy: { id: "desc" },
    });

    if (!factura) {
      throw new ErrorApp(`Factura con id externo ${idExterno} no encontrada`, 404);
    }

    return proyectar({
      ...factura,
      // Número tal como se imprime en el PDF (establecimiento-caja-numero, relleno a 7 dígitos).
      // Cae al número crudo cuando no se puede formatear (documentos legacy con caja_id NULL).
      numero_factura: formatNumeroDocumento(
        factura.caja?.establecimiento?.codigo,
        factura.caja?.codigo,
        factura.numero_factura
      ) ?? factura.numero_factura,
      // Expone caja y establecimiento como campos hermanos del documento.
      ...separarCajaEstablecimiento(factura.caja),
    }, campos);
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al obtener datos de factura");
  }
};

const getMontoTotalPorCdc = async (cdc, empresaId) => {
  const factura = await prisma.factura.findFirst({
    where: {
      cdc,
      cliente_empresa: { empresa_id: empresaId },
    },
    select: {
      cdc: true,
      total: true,
      total_iva: true,
    },
  });

  if (!factura) {
    throw new ErrorApp("No se encontró factura con ese cdc", 404);
  }

  return {
    cdc: factura.cdc,
    total: factura.total,
    totalIva: factura.total_iva,
  };
};

const reenviarFactura = async ({ email, facturaId, empresaId }) => {
  // No se filtra por estado_sifen en la query: para una Factura histórica (emitida antes del corte a
  // este pipeline) ese campo es siempre NULL, y el dato real de aprobación vive en `sifen_estado`
  // (texto legacy) — el chequeo dual lo hace `esAprobado` (AUD-001, STATIC_AUDIT_FINDINGS.json).
  // Acotado a la empresa del usuario autenticado (usuario.empresa_id): sin esto se podía reenviar por
  // email el KuDE/XML de una factura de otra empresa a una dirección arbitraria (IDOR + fuga de datos).
  const factura = await prisma.factura.findFirst({
    where: {
      id: facturaId,
      usuario: { empresa_id: empresaId },
    },
    include: {
      cliente_empresa: { include: { cliente: true, empresa: true } },
      usuario: true,
    },
  });

  if (!factura || !esAprobado(factura)) {
    throw new ErrorApp("La factura no existe", 404);
  }

  const { cliente, empresa } = factura.cliente_empresa;

  await enviarFactura({
    cdc: factura.cdc,
    cliente: cliente.tipo_identificacion === "RUC" ? cliente.razon_social : `${cliente.nombres} ${cliente.apellidos}`,
    email,
    uuid: factura.factura_uuid,
    nroFactura: factura.numero_factura,
    empresa: empresa.nombre_empresa,
    emailEmpresa: empresa.email,
    xmlFirmado: factura.xml_firmado,
  });
};

const cancelarFactura = async (datos, datosUsuario) => {

  try {

    const factura = await prisma.factura.findFirst({
      where: {
        AND: [
          { id: datos.facturaId },
          {
            usuario: {
              empresa_id: datosUsuario.empresaId
            }
          }
        ]
      }
    });

    if (!factura) {
      throw new ErrorApp('Factura no encontrada', 404)
    }

    // esCancelado cubre también el caso histórico (estado_sifen NULL + sifen_estado='Cancelado' legacy)
    // — AUD-001, STATIC_AUDIT_FINDINGS.json.
    if (esCancelado(factura)) {
      throw new ErrorApp('La Factura ya se encuentra con estado Cancelado', 400)
    }

    // Se busca notas de crédito vinculadas a la factura que sigan vigentes (no canceladas). No se
    // filtra por estado_sifen en la query: para una NotaCredito histórica ese campo es siempre NULL, y
    // el comportamiento de Prisma `not`/`notIn` sobre un campo nullable ante NULL no está confirmado
    // (AUD-007, STATIC_AUDIT_FINDINGS.json) — se trae todo y se filtra explícito con esCancelado, que
    // sí resuelve el caso histórico.
    const notaDeCreditosDeFactura = await prisma.notaCredito.findMany({
      where: { factura_id: datos.facturaId }
    })
    const notaDeCreditos = notaDeCreditosDeFactura.filter((nc) => !esCancelado(nc))

    if (notaDeCreditos && notaDeCreditos.length > 0) {
      const error = notaDeCreditos.length > 1 ? `La Factura cuenta con ${notaDeCreditos.length} notas de crédito aprobadas`
        : 'La Factura cuenta con 1 nota de crédito aprobada'
      throw new ErrorApp(error, 400)
    }

    // Cancelación síncrona contra SIFEN — eventoService valida por su cuenta
    // que la Factura esté APROBADA, arma+firma+envía el evento, y actualiza estado_sifen a CANCELADO.
    return await eventoService.cancelarFactura({ facturaId: datos.facturaId, motivo: datos.motivo });

  } catch (error) {
    // console.log(error);
    ErrorApp.handleServiceError(error)
  }

}

/**
 * Reintenta manualmente el envío a SIFEN de una Factura que quedó en `estado_sifen: ERROR` (agotó los
 * reintentos automáticos del cron, típicamente por una caída/inestabilidad de SIFEN) o `RECHAZADO` (p. ej.
 * un rechazo generado por una falla interna del motor de validaciones de SIFEN, no un rechazo de negocio
 * real sobre el contenido) — ver `loteService.reintentarEnvioDocumento` para las reglas de negocio
 * completas (por qué es el mismo número/mismo documento, nunca uno nuevo, el límite de 720h de
 * transmisión extemporánea, y el criterio para cuándo reintentar un RECHAZADO es seguro).
 *
 * Se identifica el documento por caja + número de factura (no por id interno) porque es lo que el
 * usuario tiene a mano cuando SIFEN rechaza/falla — el mismo criterio de búsqueda que usa `emitirFactura`
 * para resolver caja. `numero_factura` no es único por sí solo (se repite entre cajas), por eso el
 * filtro va siempre `caja.codigo` + `caja.establecimiento.empresa_id` (scoping multi-tenant) + `numero_factura`.
 * @param {Object} datos
 * @param {string} datos.caja - Código de caja (3 dígitos), el punto de expedición SIFEN
 * @param {number} datos.factura - Número de factura (`numero_factura`), no el id interno
 * @param {Object} datosUsuario - `req.usuario`, para el scoping multi-tenant
 */
const reintentarEnvioSifen = async (datos, datosUsuario) => {
  try {
    const factura = await prisma.factura.findFirst({
      where: {
        numero_factura: datos.factura,
        caja: {
          codigo: datos.caja,
          establecimiento: { empresa_id: datosUsuario.empresaId },
        },
      },
    });

    if (!factura) {
      throw new ErrorApp('Factura no encontrada', 404);
    }

    return await loteService.reintentarEnvioDocumento("FACTURA", factura.id, datosUsuario.empresaId);
  } catch (error) {
    ErrorApp.handleServiceError(error);
  }
};

module.exports = {
  emitirFactura,
  getFacturas,
  getFacturaById,
  getFacturaByIdExterno,
  getMontoTotalPorCdc,
  reenviarFactura,
  cancelarFactura,
  reintentarEnvioSifen,
  CAMPOS_FACTURA
};
