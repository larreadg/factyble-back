const dayjs = require("dayjs");
const prisma = require("../prisma/cliente");
const ErrorApp = require("../utils/error");
const { calcularImpuesto } = require("../utils/facturacion");
const generarPdf = require("../utils/generarPdf");
const { v4: uuidv4 } = require("uuid");
const { formatNumber, formatNumberWithLeadingZeros } = require("../utils/format");
const { enviarFactura } = require("./correoService");
const { construirCdc } = require("../utils/sifen/cdc");
const loteService = require("./sifen/loteService");
const eventoService = require("./sifen/eventoService");
const { esAprobado, esCancelado } = require("../utils/sifen/estadoHistorico");

// tipoDocumento SIFEN para el CDC (MIGRATION_PLAN.md §1.3) — 1=Factura, ver xmlBuilderService.js
const CDC_TIPO_DOCUMENTO_FACTURA = 1;
const CDC_TIPO_EMISION_NORMAL = 1;
const CDC_TIPO_CONTRIBUYENTE = { FISICA: 1, JURIDICA: 2 };

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

    //Buscar si existe cliente
    let cliente = await prisma.cliente.findFirst({
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

    //Verificar cálculos
    let total = 0;
    let totalIva = 0;
    let totalIva5 = 0;
    let totalIva10 = 0;
    let totalExenta = 0;

    datos.items.forEach((e) => {
      const impuesto = calcularImpuesto(e.cantidad, e.precioUnitario, e.tasa);
      if (Number(e.impuesto) != impuesto) {
        throw new ErrorApp("Datos proporcionados incorrectos", 400);
      }

      if (Number(e.total) != Number(e.cantidad) * Number(e.precioUnitario)) {
        throw new ErrorApp("Datos proporcionados incorrectos", 400);
      }

      if (e.tasa == "0%") {
        totalExenta += e.impuesto;
      } else if (e.tasa == "5%") {
        totalIva5 += e.impuesto;
      } else {
        totalIva10 += e.impuesto;
      }

      total += Number(e.total);
      totalIva += Number(e.impuesto);
    });

    if (total != Number(datos.total) || totalIva != Number(datos.totalIva)) {
      throw new ErrorApp("Datos proporcionados incorrectos", 400);
    }

    //Datos adicionales
    const facturaUuid = uuidv4();

    // Se usa transacción y FOR UPDATE para bloquear la tabla al crear el número de factura por si hay concurrencia.
    // La firma nativa (SIFEN, MIGRATION_PLAN.md Fase 5) participa de la misma transacción: si falla
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

      // CDC calculado localmente (MIGRATION_PLAN.md §1.3) — ya no lo devuelve la API PHP legacy.
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
      //misma transacción; `xml`/`linkqr`/`sifen_estado` legacy quedan sin escribir, ver MIGRATION_PLAN.md §2.2)
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
      // SIFEN es asíncrono por lote, ver "Conflictos detectados" en MIGRATION_PLAN.md). Devuelve la
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
    // rellenado a 7 dígitos) — se reutiliza acá para no duplicar el criterio de formateo.
    const numeroFacturaFormateada = `${datos.establecimiento}-${datos.caja}-${formatNumberWithLeadingZeros(factura.numero_factura)}`;

    // Se espera la generación del PDF (antes era fire-and-forget) para poder devolver su nombre de
    // archivo al caller — lo necesita /factura/simple para que el bot de WhatsApp lo descargue apenas
    // responde la API, y de paso deja de tragarse en silencio un eventual error de JasperReports.
    await generarPdf({
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

const getFacturas = async (page = 1, itemsPerPage = 10, filter = null, empresaId) => {
  try {
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

      // 3) Match por número de factura (solo si filter es entero “normal”)
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
      items: facturas,
      page,
      itemsPerPage,
      totalItems,
    };
  } catch (error) {
    console.log(error)
    ErrorApp.handleServiceError(error, "Error al obtener facturas");
  }
};

const getFacturaById = async (id) => {
  try {
    const factura = await prisma.factura.findFirst({
      where: {
        id: Number(id),
      },
      include: {
        detalles: true,
        eventos_sifen: true,
      },
    });

    if (!factura) {
      throw new ErrorApp(`Factura con ID ${id} no encontrado`, 404);
    }

    return factura;
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

const reenviarFactura = async ({ email, facturaId }) => {
  // No se filtra por estado_sifen en la query: para una Factura histórica (emitida antes del corte a
  // este pipeline) ese campo es siempre NULL, y el dato real de aprobación vive en `sifen_estado`
  // (texto legacy) — el chequeo dual lo hace `esAprobado` (AUD-001, STATIC_AUDIT_FINDINGS.json).
  const factura = await prisma.factura.findFirst({
    where: { id: facturaId },
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

    // Cancelación síncrona contra SIFEN (MIGRATION_PLAN.md §3.2) — eventoService valida por su cuenta
    // que la Factura esté APROBADA, arma+firma+envía el evento, y actualiza estado_sifen a CANCELADO.
    return await eventoService.cancelarFactura({ facturaId: datos.facturaId, motivo: datos.motivo });

  } catch (error) {
    // console.log(error);
    ErrorApp.handleServiceError(error)
  }

}

module.exports = {
  emitirFactura,
  getFacturas,
  getFacturaById,
  getMontoTotalPorCdc,
  reenviarFactura,
  cancelarFactura
};
