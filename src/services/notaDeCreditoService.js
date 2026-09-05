const dayjs = require("dayjs");
const prisma = require("../prisma/cliente");
const ErrorApp = require("../utils/error");
const { calcularImpuesto, calcularTotalItem, normalizarCantidadDetalles } = require("../utils/facturacion");
const { v4: uuidv4 } = require("uuid");
const generarPdf = require("../utils/generarPdf");
const { formatNumber, formatNumeroDocumento, parseNumeroDocumento } = require("../utils/format");
const { formatearFechaCalendario } = require("../utils/fechaCalendario");
const { separarCajaEstablecimiento, parseNumeroCompuesto } = require("../utils/documento");
const { parsearFields, proyectar } = require("../utils/fields");
const { indexarPorIdExterno, armarRespuestaConsultaLote } = require("../utils/consultaLote");
const { enviarNotaDeCredito } = require("./correoService");
const { construirCdc } = require("../utils/sifen/cdc");
const loteService = require("./sifen/loteService");
const eventoService = require("./sifen/eventoService");
const { esAprobado, esCancelado, esRechazado, resolverEstado } = require("../utils/sifen/estadoHistorico");

// Lista cerrada de atributos de PRIMER NIVEL que el query param `fields` de los GET puede pedir para
// una Nota de Crédito. Columnas escalares + relaciones incluidas por los GET (factura, eventos_sifen,
// nota_credito_detalle, caja) + campos sintetizados en la respuesta (establecimiento).
// Cualquier field fuera de esta lista => 400. Ver src/utils/fields.js.
const CAMPOS_NOTA_CREDITO = [
  "id", "numero_nota_credito", "factura_id", "nota_credito_uuid", "usuario_id",
  "total_iva", "total", "cdc", "fuente", "id_externo", "xml", "linkqr", "sifen_estado",
  "sifen_estado_mensaje", "xml_firmado", "estado_sifen", "sifen_cod_respuesta", "sifen_num_transaccion",
  "fecha_firma", "fecha_envio_sifen", "fecha_respuesta_sifen", "intentos_firma", "lote_id",
  "codigo_seguridad", "fecha_creacion", "fecha_modificacion", "caja_id",
  "factura", "eventos_sifen", "nota_credito_detalle", "caja", "establecimiento",
];

// Lista cerrada de atributos que `fields` puede pedir en POST /nota-credito/id-externo/consultar-lote.
// Subconjunto deliberadamente más chico que CAMPOS_NOTA_CREDITO: el endpoint resuelve hasta 100
// documentos por request, así que deja afuera las relaciones (factura, eventos_sifen,
// nota_credito_detalle) y las columnas TEXT/MEDIUMTEXT pesadas (xml, xml_firmado). Quien necesite la
// nota completa tiene el GET unitario por id_externo. `estado` es sintetizado (no es una columna):
// ver resolverEstado en utils/sifen/estadoHistorico.js.
// NO incluye `sifen_estado`: ese es el campo legacy congelado (texto libre de la API PHP, sin
// escrituras desde el corte y marcado en el schema para dropear en el apagado). El estado autoritativo
// es `estado_sifen`, y el histórico donde ese es NULL ya queda cubierto por `estado`. Exponer el
// legacy en un contrato nuevo lo ataría a una columna condenada — ver el par legacy/nativo en CLAUDE.md.
// Sin `fields` se devuelven todos estos atributos. Ver src/utils/fields.js.
const CAMPOS_CONSULTA_LOTE_NOTA_CREDITO = [
  "id", "numero_nota_credito", "id_externo", "cdc", "estado", "estado_sifen",
  "sifen_estado_mensaje", "sifen_cod_respuesta", "factura_id", "total", "total_iva", "fuente",
  "lote_id", "linkqr", "fecha_creacion", "fecha_firma", "fecha_envio_sifen", "fecha_respuesta_sifen",
];

// Columnas que trae la consulta en lote. Es un `select` explícito (no un `include`) para que el
// payload quede acotado a CAMPOS_CONSULTA_LOTE_NOTA_CREDITO aun cuando no se pase `fields`. `caja` y
// `sifen_estado` entran solo como insumo —la primera para formatear el número impreso, el segundo para
// resolver `estado` en el histórico— y las dos se descartan del objeto de respuesta.
const SELECT_CONSULTA_LOTE_NOTA_CREDITO = {
  id: true,
  numero_nota_credito: true,
  id_externo: true,
  cdc: true,
  estado_sifen: true,
  sifen_estado: true,
  sifen_estado_mensaje: true,
  sifen_cod_respuesta: true,
  factura_id: true,
  total: true,
  total_iva: true,
  fuente: true,
  lote_id: true,
  linkqr: true,
  fecha_creacion: true,
  fecha_firma: true,
  fecha_envio_sifen: true,
  fecha_respuesta_sifen: true,
  caja: {
    select: {
      codigo: true,
      establecimiento: { select: { codigo: true } },
    },
  },
};

// Columnas de la Factura vinculada que exponen los GET de Nota de Crédito. Se seleccionan explícito
// para dejar afuera xml / linkqr / xml_firmado (TEXT/MEDIUMTEXT): con `factura: true` el XML firmado
// completo de la factura viajaba dentro de CADA ítem del listado paginado. El resto de las columnas
// se mantiene tal cual venía, para no romper el contrato del front.
const SELECT_FACTURA_VINCULADA = {
  id: true,
  numero_factura: true,
  factura_uuid: true,
  usuario_id: true,
  cliente_empresa_id: true,
  fecha_creacion: true,
  fecha_modificacion: true,
  condicion_venta: true,
  total_iva: true,
  total: true,
  cdc: true,
  fuente: true,
  id_externo: true,
  sifen_estado: true,
  sifen_estado_mensaje: true,
  estado_sifen: true,
  sifen_cod_respuesta: true,
  sifen_num_transaccion: true,
  fecha_firma: true,
  fecha_envio_sifen: true,
  fecha_respuesta_sifen: true,
  intentos_firma: true,
  lote_id: true,
  codigo_seguridad: true,
  caja_id: true,
  // Solo para poder formatear numero_factura como se imprime; se descarta en mapearFacturaVinculada.
  caja: { select: { codigo: true, establecimiento: { select: { codigo: true } } } },
};

// Normaliza la Factura vinculada al mismo contrato que el documento padre: numero_factura formateado
// como se imprime (establecimiento-caja-numero, relleno a 7 dígitos) y sin el objeto caja anidado, que
// solo se trajo para armar ese número. Cae al número crudo cuando no se puede formatear (facturas
// legacy con caja_id NULL), igual que el documento padre. Se usa la caja DE LA FACTURA, no la de la
// NC: son caja_id independientes y pueden diferir.
const mapearFacturaVinculada = (factura) => {
  if (!factura) return factura;
  const { caja, ...resto } = factura;
  return {
    ...resto,
    numero_factura:
      formatNumeroDocumento(
        caja?.establecimiento?.codigo,
        caja?.codigo,
        factura.numero_factura
      ) ?? factura.numero_factura,
  };
};

// tipoDocumento SIFEN para el CDC — 5=Nota de Credito, ver xmlBuilderService.js
const CDC_TIPO_DOCUMENTO_NOTA_CREDITO = 5;
const CDC_TIPO_EMISION_NORMAL = 1;
const CDC_TIPO_CONTRIBUYENTE = { FISICA: 1, JURIDICA: 2 };

const emitirNotaDeCredito = async (datos, datosUsuario) => {
  try {
    // Buscar establecimiento
    const establecimiento = await prisma.establecimiento.findFirst({
      where: {
        codigo: datos.establecimiento,
        empresa_id: datosUsuario.empresaId,
      },
    });

    if (!establecimiento) {
      throw new ErrorApp("No se encontró establecimiento", 404);
    }

    // Buscar caja para establecimiento
    const caja = await prisma.caja.findFirst({
      where: {
        codigo: datos.caja,
        establecimiento_id: establecimiento.id,
      },
    });

    if (!caja) {
      throw new ErrorApp("No se encontró caja", 404);
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

    // Buscar factura y verificar condicion_venta = CONTADO y no este Cancelado. No se filtra por
    // estado_sifen en la query (para una Factura histórica ese campo es siempre NULL, ver AUD-001 y
    // AUD-007 en STATIC_AUDIT_FINDINGS.json) — los chequeos de cancelado/aprobado se hacen explícitos
    // debajo con esCancelado/esAprobado, que sí cubren el caso histórico.
    const factura = await prisma.factura.findFirst({
      where: {
        cdc: datos.cdc,
        // Acotado a la empresa del usuario autenticado (mismo criterio que getMontoTotalPorCdc): sin
        // esto se podía emitir una NC contra una factura de otra empresa pasando su CDC, filtrando los
        // datos del cliente ajeno y acreditando un documento que no es de la empresa (IDOR).
        cliente_empresa: { empresa_id: datosUsuario.empresaId },
      },
      include: {
        cliente_empresa: {
          include: {
            cliente: true,
          },
        },
      },
    });

    if(!factura) {
      throw new ErrorApp('No se encontró cdc', 404)
    }

    if (esCancelado(factura)) {
      throw new ErrorApp('La factura se encuentra cancelada', 400)
    }

    if(!esAprobado(factura)){
      throw new ErrorApp('La factura aún no se ha aprobado', 400)
    }

    // Calcular totales en el backend a partir de cantidad, precio unitario y tasa de cada item.
    // El caller ya no envía total/totalIva ni impuesto/total por item (mismo criterio que /nota-credito/simple):
    // se computan acá y se asignan sobre cada item para el detalle y el PDF.
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

    // Buscar si ya hay nota de crédito vigente (no cancelada/rechazada) para la factura dada. No se
    // filtra por estado_sifen en la query (mismo motivo que el guard de arriba: para una NotaCredito
    // histórica ese campo es siempre NULL, y la semántica de `notIn` de Prisma ante NULL no está
    // confirmada — AUD-007, STATIC_AUDIT_FINDINGS.json) — se trae todo y se filtra explícito, así el
    // cálculo de crédito ya emitido incluye también las notas de crédito históricas, sin lo cual se
    // podría sobre-acreditar una Factura histórica con notas de crédito legacy ya aplicadas.
    const notasDeCreditoDeFactura = await prisma.notaCredito.findMany({
      where: { factura_id: factura.id },
    });
    const notasDeCredito = notasDeCreditoDeFactura.filter((nc) => !esCancelado(nc) && !esRechazado(nc));

    // Verificar que el total de las notas de crédito anteriores más el de ahora no supere el total de la factura
    if (notasDeCredito && notasDeCredito.length > 0) {
      let totalNotasDeCredito = total;
      notasDeCredito.forEach((e) => {
        totalNotasDeCredito += Number(e.total);
      });

      if (totalNotasDeCredito > factura.total) {
        throw new ErrorApp(
          "El total de las notas de crédito supera el valor total de la factura",
          400
        );
      }
    }

    // Datos adicionales
    const notaDeCreditoUuid = uuidv4();

    // Se usa transacción y FOR UPDATE para bloquear la tabla al crear el número de factura por si hay concurrencia.
    // La firma nativa (SIFEN) participa de la misma transacción: si falla
    // (certificado vencido/ausente, datos fiscales incompletos de la empresa), todo se revierte junto
    // con la numeración recién asignada — no queda un número de Nota de Crédito "quemado".
    const notaDeCredito = await prisma.$transaction(async (tx) => {
      const secuencia =
        await tx.$queryRaw`SELECT valor FROM secuencia_nota_credito WHERE caja_id = ${caja.id} FOR UPDATE`;

      if (!secuencia || secuencia.length === 0) {
        throw new ErrorApp("Secuencia no encontrada", 404);
      }

      const numeroNotaDeCredito = Number(secuencia[0].valor) + 1;
      await tx.$executeRaw`UPDATE secuencia_nota_credito SET valor = ${numeroNotaDeCredito} WHERE caja_id = ${caja.id}`;

      const codigosSeguridadRaw = await tx.notaCredito.findMany({
        select: {
          codigo_seguridad: true,
        },
        where: {
          caja_id: caja.id,
        },
      });

      const codigosSeguridad = codigosSeguridadRaw.map(
        (e) => e.codigo_seguridad
      );

      let codigoSeguridadAleatorio = generarCodigoSeguridad();

      while (codigosSeguridad.includes(codigoSeguridadAleatorio)) {
        codigoSeguridadAleatorio = generarCodigoSeguridad();
      }

      // CDC calculado localmente — ya no lo devuelve la API PHP legacy.
      const [rucSinDv, dvEmisor] = usuario.empresa.ruc.split('-');
      const cdc = construirCdc({
        tipoDocumento: CDC_TIPO_DOCUMENTO_NOTA_CREDITO,
        rucSinDv,
        dvEmisor,
        establecimiento: establecimiento.codigo,
        punto: caja.codigo,
        numero: numeroNotaDeCredito,
        tipoContribuyente: CDC_TIPO_CONTRIBUYENTE[usuario.empresa.tipo_contribuyente],
        fechaEmision: new Date(),
        tipoEmision: CDC_TIPO_EMISION_NORMAL,
        codigoSeguridad: codigoSeguridadAleatorio,
      });

      // Crear nota de crédito (estado_sifen: GENERADO — el pipeline nativo la firma a continuación,
      // en esta misma transacción; `xml`/`linkqr`/`sifen_estado` legacy quedan sin escribir)
      const notaDeCredito = await tx.notaCredito.create({
        data: {
          factura_id: factura.id,
          nota_credito_uuid: notaDeCreditoUuid,
          usuario_id: usuario.id,
          total_iva: datos.totalIva,
          total: datos.total,
          cdc,
          estado_sifen: 'GENERADO',
          fuente: datos.fuente || 'APP',
          id_externo: datos.idExterno || null,
          codigo_seguridad: codigoSeguridadAleatorio,
          numero_nota_credito: numeroNotaDeCredito,
          caja_id: caja.id,
        },
      });

      // Agregar detalles de nota de crédito
      const datosNotaDeCreditoDetalle = datos.items.map((e) => ({
        nota_credito_id: notaDeCredito.id,
        cantidad: Number(e.cantidad),
        precio_unitario: e.precioUnitario,
        tasa: e.tasa == "0%" ? "T0" : e.tasa == "5%" ? "T5" : "T10",
        impuesto: e.impuesto,
        total: e.total,
        descripcion: e.descripcion,
      }));

      await tx.notaCreditoDetalle.createMany({
        data: datosNotaDeCreditoDetalle,
      });

      // Firma + QR sincrónicos (mismo comportamiento que ya tenía la API PHP legacy — solo el envío a
      // SIFEN es asíncrono por lote).
      return loteService.firmarDocumentoRecienCreado('NOTA_CREDITO', notaDeCredito.id, tx);
    });

    // Crear PDF
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

    // Mismo formato que el número impreso en el PDF (establecimiento-caja-numero, con el número
    // rellenado a 7 dígitos) — se reutiliza el helper compartido para no duplicar el criterio de formateo.
    const numeroNotaCreditoFormateada = formatNumeroDocumento(datos.establecimiento, datos.caja, notaDeCredito.numero_nota_credito);

    // Se espera la generación del PDF (antes era fire-and-forget) para poder devolver su nombre de
    // archivo al caller, mismo criterio que facturaService.emitirFactura.
    await generarPdf({
      plantilla: usuario.empresa.plantilla_pdf,
      // Duplicado 2-up del KuDE en A4 horizontal (solo plantillas de hoja — ver
      // utils/imponerDuplicadoPdf.js). `empresaId` va únicamente para el log del post-proceso.
      duplicarDoc: usuario.empresa.duplicar_doc,
      empresaId: usuario.empresa.id,
      empresaLogo: usuario.empresa.logo,
      empresaRuc: usuario.empresa.ruc,
      empresaTimbrado: usuario.empresa.timbrado,
      // Fechas-calendario del timbrado: van por `formatearFechaCalendario` (dayjs.utc), NO por
      // `dayjs()` local. Se guardan como medianoche UTC y leerlas con los getters locales las corre un
      // día hacia atrás en UTC-3 — el mismo error que causó el rechazo SIFEN 1107 en `dFeIniT`.
      // El helper además devuelve null cuando la columna está vacía (`vigente_hasta` es nullable), así
      // que no hay forma de imprimir "Invalid Date" en el KuDE.
      empresaVigenteDesde: formatearFechaCalendario(usuario.empresa.vigente_desde),
      empresaVigenteHasta: formatearFechaCalendario(usuario.empresa.vigente_hasta),
      empresaNombre: usuario.empresa.nombre_empresa,
      empresaDireccion: usuario.empresa.direccion,
      empresaTelefono: usuario.empresa.telefono,
      empresaCiudad: usuario.empresa.ciudad,
      empresaCorreoElectronico: usuario.empresa.email,
      // Solo la descripción, sin el código: el KuDE la imprime como texto suelto, sin etiqueta.
      empresaActEc1: usuario.empresa.desc_actividad_principal,
      empresaActEc2: usuario.empresa.desc_actividad_secundaria,
      facturaId: numeroNotaCreditoFormateada,
      condicionVenta: 'CONTADO',
      ruc: factura.cliente_empresa.cliente.ruc,
      razonSocial: factura.cliente_empresa.cliente.razon_social,
      correoElectronico: factura.cliente_empresa.cliente.email,
      total: datos.total,
      totalIva: datos.totalIva,
      totalExenta,
      totalIva5,
      totalIva10,
      moneda: "PYG",
      items: itemsPdf,
      uuid: notaDeCreditoUuid,
      linkqr: notaDeCredito.linkqr,
      cdc: notaDeCredito.cdc,
      tipoDocumento: 'NOTA DE CRÉDITO ELECTRÓNICA',
      tipoDocumentoTop: 'KuDE de Nota de crédito Electrónica'
    });

    return {
      ...notaDeCredito,
      pdfNombre: `${notaDeCreditoUuid}.pdf`,
      numeroNotaCreditoFormateada,
      clienteNombre: factura.cliente_empresa.cliente.razon_social,
      clienteDocumento: factura.cliente_empresa.cliente.ruc,
    };

  } catch (error) {
    console.log(error);
    ErrorApp.handleServiceError(error);
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

const getNotasDeCredito = async (
  page = 1,
  itemsPerPage = 10,
  filter = null,
  empresaId,
  fields = null
) => {
  try {
    const campos = parsearFields(fields);
    const skip = (page - 1) * itemsPerPage;
    const take = itemsPerPage;

    const establecimientos = await prisma.establecimiento.findMany({
      where: {
        empresa_id: empresaId,
      },
      include: {
        cajas: true,
      },
    });

    const cajasIds = [];

    for (const establecimiento of establecimientos) {
      for (const caja of establecimiento.cajas) {
        cajasIds.push(caja.id);
      }
    }

    let notasCredito = [];
    let totalItems = 0;

    if (filter === null) {
      notasCredito = await prisma.notaCredito.findMany({
        skip,
        take,
        orderBy: {
          fecha_creacion: "desc",
        },
        where: {
          caja_id: {
            in: cajasIds,
          },
        },
        include: {
          factura: { select: SELECT_FACTURA_VINCULADA },
          eventos_sifen: true,
          nota_credito_detalle: true,
          caja: {
            include: {
              establecimiento: true,
            },
          },
        },
      });

      totalItems = await prisma.notaCredito.count({
        where: {
          caja_id: {
            in: cajasIds,
          },
        },
      });
    } else {
      const or = [];

      // 1) Número compuesto propio de la NC: establecimiento-caja-numero (ej. "001-001-0000023"), tal como
      // se imprime/muestra. Se resuelve contra la relación caja/establecimiento + numero_nota_credito.
      const compuesto = parseNumeroCompuesto(filter);
      if (compuesto) {
        or.push({
          numero_nota_credito: compuesto.numero,
          caja: {
            codigo: compuesto.caja,
            establecimiento: { codigo: compuesto.establecimiento },
          },
        });
      }

      // 2) Número simple propio de la NC (sólo si el filtro es un entero “normal”).
      const isIntegerString = /^[0-9]+$/.test(filter);
      if (isIntegerString && String(filter).length <= 18) {
        const n = Number(filter);
        if (Number.isSafeInteger(n)) {
          or.push({ numero_nota_credito: { equals: n } });
        }
      }

      // 3) Compatibilidad histórica: NCs cuya factura vinculada matchea por CDC o número de factura.
      const facturaOr = [{ cdc: { contains: filter } }];
      if (isIntegerString && String(filter).length <= 18) {
        const n = Number(filter);
        if (Number.isSafeInteger(n)) {
          facturaOr.push({ numero_factura: { equals: n } });
        }
      }
      or.push({ factura: { OR: facturaOr } });

      // Siempre acotado a las cajas de la empresa (evita fugas entre empresas).
      const whereNc = { caja_id: { in: cajasIds }, OR: or };

      notasCredito = await prisma.notaCredito.findMany({
        skip,
        take,
        orderBy: {
          fecha_creacion: "desc",
        },
        where: whereNc,
        include: {
          factura: { select: SELECT_FACTURA_VINCULADA },
          eventos_sifen: true,
          nota_credito_detalle: true,
          caja: {
            include: {
              establecimiento: true,
            },
          },
        },
      });

      totalItems = await prisma.notaCredito.count({
        where: whereNc,
      });
    }

    return {
      items: notasCredito.map((notaCredito) => proyectar({
        ...notaCredito,
        // Número tal como se imprime en el PDF (establecimiento-caja-numero, relleno a 7 dígitos).
        // Cae al número crudo cuando no se puede formatear (documentos legacy con caja_id NULL).
        numero_nota_credito: formatNumeroDocumento(
          notaCredito.caja?.establecimiento?.codigo,
          notaCredito.caja?.codigo,
          notaCredito.numero_nota_credito
        ) ?? notaCredito.numero_nota_credito,
        // cantidad de cada detalle vuelve a number (columna Decimal -> Prisma.Decimal) para no cambiar
        // el contrato. OJO: en NotaCredito la relación se llama `nota_credito_detalle`, no `detalles`
        // como en Factura — apuntar a `detalles` normalizaba undefined y dejaba las cantidades como
        // string en la respuesta.
        nota_credito_detalle: normalizarCantidadDetalles(notaCredito.nota_credito_detalle),
        // Factura vinculada con numero_factura formateado y sin los TEXT pesados.
        factura: mapearFacturaVinculada(notaCredito.factura),
        // Expone caja y establecimiento como campos hermanos del documento.
        ...separarCajaEstablecimiento(notaCredito.caja),
      }, campos)),
      page,
      itemsPerPage,
      totalItems,
    };
  } catch (error) {
    console.log(error);
    ErrorApp.handleServiceError(error, "Error al obtener notas de crédito");
  }
};

const cancelarNotaDeCredito = async (datos, datosUsuario) => {
  try {

    const notaDeCredito = await prisma.notaCredito.findFirst({
      where: {
        AND: [
          { id: datos.notaDeCreditoId },
          {
            usuario: {
              empresa_id: datosUsuario.empresaId
            }
          }
        ]
      }
    });

    if (!notaDeCredito) {
      throw new ErrorApp('Nota de crédito no encontrada', 404)
    }

    // esCancelado cubre también el caso histórico (estado_sifen NULL + sifen_estado='Cancelado' legacy)
    // — AUD-001, STATIC_AUDIT_FINDINGS.json.
    if (esCancelado(notaDeCredito)) {
      throw new ErrorApp('La nota de crédito ya se encuentra con estado Cancelado', 400)
    }

    // Cancelación síncrona contra SIFEN — eventoService valida por su cuenta
    // que la Nota de Crédito esté APROBADA, arma+firma+envía el evento, y actualiza estado_sifen a CANCELADO.
    return await eventoService.cancelarNotaCredito({ notaCreditoId: datos.notaDeCreditoId, motivo: datos.motivo });

  } catch (error) {
    // console.log(error);
    ErrorApp.handleServiceError(error)
  }
}

const reenviarNotaDeCredito = async ({ email, notaDeCreditoId, empresaId }) => {
  // No se filtra por estado_sifen en la query — ver mismo criterio que facturaService.reenviarFactura
  // (AUD-001, STATIC_AUDIT_FINDINGS.json). El chequeo dual lo hace esAprobado.
  // Acotado a la empresa del usuario autenticado (usuario.empresa_id): sin esto se podía reenviar por
  // email el KuDE/XML de una nota de crédito de otra empresa a una dirección arbitraria (IDOR + fuga).
  const notaDeCredito = await prisma.notaCredito.findFirst({
    where: {
      id: notaDeCreditoId,
      usuario: { empresa_id: empresaId },
    },
    include: {
      factura: {
        include: {
          cliente_empresa: { include: { cliente: true, empresa: true } },
        }
      },
      usuario: true,
    },
  });

  if (!notaDeCredito || !esAprobado(notaDeCredito)) {
    throw new ErrorApp("La nota de crédito no existe", 404);
  }

  const { cliente, empresa } = notaDeCredito.factura.cliente_empresa;

  await enviarNotaDeCredito({
    cdc: notaDeCredito.cdc,
    cliente: cliente.tipo_identificacion === "RUC" ? cliente.razon_social : `${cliente.nombres} ${cliente.apellidos}`,
    email,
    uuid: notaDeCredito.nota_credito_uuid,
    nroNotaDeCredito: notaDeCredito.numero_nota_credito,
    empresa: empresa.nombre_empresa,
    emailEmpresa: empresa.email,
    xmlFirmado: notaDeCredito.xml_firmado,
  });
};

/**
 * Reintenta manualmente el envío a SIFEN de una Nota de Crédito que quedó en `estado_sifen: ERROR` o
 * `RECHAZADO` — ver `loteService.reintentarEnvioDocumento` para las reglas de negocio completas.
 *
 * Se identifica el documento por caja + número de nota de crédito (no por id interno), mismo criterio
 * que `facturaService.reintentarEnvioSifen`: `numero_nota_credito` no es único por sí solo, por eso el
 * filtro va siempre `caja.codigo` + `caja.establecimiento.empresa_id` (scoping multi-tenant) + `numero_nota_credito`.
 *
 * `notaCredito` se acepta de dos formas: el número impreso completo "EEE-PPP-NNNNNNN" (ej.
 * "001-002-0000062"), con la caja embebida, o el secuencial entero + `caja` aparte (contrato histórico).
 * @param {Object} datos
 * @param {string} [datos.caja] - Código de caja (3 dígitos), el punto de expedición SIFEN. Opcional si
 *   `notaCredito` viene con el formato completo "EEE-PPP-NNNNNNN".
 * @param {number|string} datos.notaCredito - Número de nota de crédito (`numero_nota_credito`, no el id
 *   interno) o el número impreso completo "EEE-PPP-NNNNNNN"
 * @param {Object} datosUsuario - `req.usuario`, para el scoping multi-tenant
 */
const reintentarEnvioSifen = async (datos, datosUsuario) => {
  try {
    // Cuando viene el string completo también acotamos por establecimiento.codigo: la caja (punto de
    // expedición) no es única entre establecimientos de una misma empresa, así que sin ese filtro
    // findFirst podría matchear otro documento.
    const parseado = parseNumeroDocumento(datos.notaCredito);
    const codigoCaja = parseado ? parseado.caja : datos.caja;
    const numeroNotaCredito = parseado ? parseado.numero : Number(datos.notaCredito);
    const establecimiento = parseado
      ? { empresa_id: datosUsuario.empresaId, codigo: parseado.establecimiento }
      : { empresa_id: datosUsuario.empresaId };

    const notaDeCredito = await prisma.notaCredito.findFirst({
      where: {
        numero_nota_credito: numeroNotaCredito,
        caja: {
          codigo: codigoCaja,
          establecimiento,
        },
      },
    });

    if (!notaDeCredito) {
      throw new ErrorApp('Nota de crédito no encontrada', 404);
    }

    return await loteService.reintentarEnvioDocumento("NOTA_CREDITO", notaDeCredito.id, datosUsuario.empresaId);
  } catch (error) {
    ErrorApp.handleServiceError(error);
  }
};

// Búsqueda por id_externo (identificador de correlación con un sistema externo) ACOTADA a la empresa
// del usuario autenticado (usuario.empresa_id). id_externo no es único: si hubiera varias notas de
// crédito con el mismo valor se devuelve la más reciente (orderBy id desc).
const getNotaDeCreditoByIdExterno = async (idExterno, empresaId, fields = null) => {
  try {
    const campos = parsearFields(fields);
    const notaDeCredito = await prisma.notaCredito.findFirst({
      where: {
        id_externo: idExterno,
        usuario: { empresa_id: empresaId },
      },
      include: {
        // Se incluye el cliente de la factura vinculada para que el consumidor (ej. el bot,
        // al reconciliar una NC por idExterno) pueda resolver nombre/RUC del receptor.
        factura: {
          include: {
            cliente_empresa: { include: { cliente: true } },
            // Solo para formatear numero_factura; mapearFacturaVinculada la descarta después.
            caja: { select: { codigo: true, establecimiento: { select: { codigo: true } } } },
          },
        },
        eventos_sifen: true,
        nota_credito_detalle: true,
        caja: {
          include: {
            establecimiento: true,
          },
        },
      },
      orderBy: { id: "desc" },
    });

    if (!notaDeCredito) {
      throw new ErrorApp(`Nota de crédito con id externo ${idExterno} no encontrada`, 404);
    }

    return proyectar({
      ...notaDeCredito,
      // Número tal como se imprime en el PDF (establecimiento-caja-numero, relleno a 7 dígitos).
      // Cae al número crudo cuando no se puede formatear (documentos legacy con caja_id NULL).
      numero_nota_credito: formatNumeroDocumento(
        notaDeCredito.caja?.establecimiento?.codigo,
        notaDeCredito.caja?.codigo,
        notaDeCredito.numero_nota_credito
      ) ?? notaDeCredito.numero_nota_credito,
      // cantidad de cada detalle vuelve a number (columna Decimal -> Prisma.Decimal) para no cambiar
      // el contrato — ver el comentario homólogo en getNotasDeCredito sobre el nombre de la relación.
      nota_credito_detalle: normalizarCantidadDetalles(notaDeCredito.nota_credito_detalle),
      // Factura vinculada con numero_factura formateado (conserva cliente_empresa/cliente).
      factura: mapearFacturaVinculada(notaDeCredito.factura),
      // Expone caja y establecimiento como campos hermanos del documento.
      ...separarCajaEstablecimiento(notaDeCredito.caja),
    }, campos);
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al obtener datos de nota de crédito");
  }
};

// Versión en lote de getNotaDeCreditoByIdExterno: resuelve hasta 100 `id_externo` en una sola
// consulta. Devuelve un ítem por cada valor pedido, en el MISMO orden y conservando duplicados; los
// que no existen (o son de otra empresa) vienen con `encontrado: false` en vez de cortar la respuesta
// con un 404 — un id_externo inexistente no puede tumbar la consulta de los otros.
// Ver utils/consultaLote.js.
const consultarNotasDeCreditoPorIdExterno = async (numeros, empresaId, fields = null) => {
  try {
    const campos = parsearFields(fields);
    // Se consulta una sola vez con el set único; el orden y los duplicados de la request se
    // reconstruyen después sobre el índice.
    const unicos = [...new Set(numeros)];

    const notasDeCredito = await prisma.notaCredito.findMany({
      where: {
        id_externo: { in: unicos },
        // Mismo acotamiento por empresa que getNotaDeCreditoByIdExterno (usuario.empresa_id): sin
        // esto un ADMIN podría leer notas de crédito de otra empresa mandando ids externos al azar.
        usuario: { empresa_id: empresaId },
      },
      // ASC a propósito: ante varias notas con el mismo id_externo (la columna no es única), el
      // último `set` del índice gana, y ese es el de mayor id — la misma nota que devuelve el GET
      // unitario con su `orderBy: { id: "desc" }`.
      orderBy: { id: "asc" },
      select: SELECT_CONSULTA_LOTE_NOTA_CREDITO,
    });

    const indice = indexarPorIdExterno(
      // `sifen_estado` se destructura afuera a propósito: se consulta para calcular `estado` pero no
      // forma parte de la respuesta (ver CAMPOS_CONSULTA_LOTE_NOTA_CREDITO). Sin esto se colaría igual
      // en el caso sin `fields`, donde `proyectar` devuelve el objeto entero.
      notasDeCredito.map(({ caja, sifen_estado, ...notaDeCredito }) => ({
        ...notaDeCredito,
        // Número tal como se imprime en el PDF (establecimiento-caja-numero, relleno a 7 dígitos).
        // Cae al número crudo cuando no se puede formatear (documentos legacy con caja_id NULL).
        numero_nota_credito: formatNumeroDocumento(
          caja?.establecimiento?.codigo,
          caja?.codigo,
          notaDeCredito.numero_nota_credito
        ) ?? notaDeCredito.numero_nota_credito,
        // Lectura dual nativo/legacy resuelta del lado del servidor: para el histórico anterior al
        // corte `estado_sifen` es NULL y el dato vive en `sifen_estado` (texto libre, congelado). Este
        // campo es lo que el consumidor lee en vez del legacy.
        estado: resolverEstado({ estado_sifen: notaDeCredito.estado_sifen, sifen_estado }),
      }))
    );

    return armarRespuestaConsultaLote(numeros, indice, campos);
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al consultar notas de crédito por id externo");
  }
};

module.exports = {
  reenviarNotaDeCredito,
  emitirNotaDeCredito,
  getNotasDeCredito,
  getNotaDeCreditoByIdExterno,
  consultarNotasDeCreditoPorIdExterno,
  cancelarNotaDeCredito,
  reintentarEnvioSifen,
  CAMPOS_NOTA_CREDITO,
  CAMPOS_CONSULTA_LOTE_NOTA_CREDITO
};
