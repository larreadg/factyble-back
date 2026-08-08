const dayjs = require("dayjs");
const prisma = require("../prisma/cliente");
const ErrorApp = require("../utils/error");
const { calcularImpuesto, calcularTotalItem, normalizarCantidadDetalles } = require("../utils/facturacion");
const { v4: uuidv4 } = require("uuid");
const generarPdf = require("../utils/generarPdf");
const { formatNumber, formatNumeroDocumento } = require("../utils/format");
const { separarCajaEstablecimiento } = require("../utils/documento");
const { parsearFields, proyectar } = require("../utils/fields");
const { enviarNotaDeCredito } = require("./correoService");
const { construirCdc } = require("../utils/sifen/cdc");
const loteService = require("./sifen/loteService");
const eventoService = require("./sifen/eventoService");
const { esAprobado, esCancelado, esRechazado } = require("../utils/sifen/estadoHistorico");

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

// tipoDocumento SIFEN para el CDC (MIGRATION_PLAN.md §1.3) — 5=Nota de Credito, ver xmlBuilderService.js
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
    // La firma nativa (SIFEN, MIGRATION_PLAN.md Fase 5) participa de la misma transacción: si falla
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

      // CDC calculado localmente (MIGRATION_PLAN.md §1.3) — ya no lo devuelve la API PHP legacy.
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
      // en esta misma transacción; `xml`/`linkqr`/`sifen_estado` legacy quedan sin escribir, ver
      // MIGRATION_PLAN.md §2.2)
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
      // SIFEN es asíncrono por lote, ver "Conflictos detectados" en MIGRATION_PLAN.md).
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
          factura: true,
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
      const factura = await prisma.factura.findFirst({
        skip,
        take,
        orderBy: {
          fecha_creacion: "desc",
        },
        where: {
          OR: [
            { cdc: filter },
            { numero_factura: !isNaN(filter) && String(filter).length <= 7 ? Number(filter) : 0 },
          ],
        },
      });

      if (factura) {
        notasCredito = await prisma.notaCredito.findMany({
          where: {
            factura_id: factura.id,
          },
          include: {
            factura: true,
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
            factura_id: factura.id,
          },
        });
      }
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
        // cantidad de cada detalle vuelve a number (columna Decimal -> Prisma.Decimal) para no cambiar el contrato.
        detalles: normalizarCantidadDetalles(notaCredito.detalles),
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

    // Cancelación síncrona contra SIFEN (MIGRATION_PLAN.md §3.2) — eventoService valida por su cuenta
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
 * @param {Object} datos
 * @param {string} datos.caja - Código de caja (3 dígitos), el punto de expedición SIFEN
 * @param {number} datos.notaCredito - Número de nota de crédito (`numero_nota_credito`), no el id interno
 * @param {Object} datosUsuario - `req.usuario`, para el scoping multi-tenant
 */
const reintentarEnvioSifen = async (datos, datosUsuario) => {
  try {
    const notaDeCredito = await prisma.notaCredito.findFirst({
      where: {
        numero_nota_credito: datos.notaCredito,
        caja: {
          codigo: datos.caja,
          establecimiento: { empresa_id: datosUsuario.empresaId },
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
        factura: true,
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
      // cantidad de cada detalle vuelve a number (columna Decimal -> Prisma.Decimal) para no cambiar el contrato.
      detalles: normalizarCantidadDetalles(notaDeCredito.detalles),
      // Expone caja y establecimiento como campos hermanos del documento.
      ...separarCajaEstablecimiento(notaDeCredito.caja),
    }, campos);
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al obtener datos de nota de crédito");
  }
};

module.exports = {
  reenviarNotaDeCredito,
  emitirNotaDeCredito,
  getNotasDeCredito,
  getNotaDeCreditoByIdExterno,
  cancelarNotaDeCredito,
  reintentarEnvioSifen,
  CAMPOS_NOTA_CREDITO
};
