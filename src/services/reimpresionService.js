const prisma = require("../prisma/cliente");
const ErrorApp = require("../utils/error");
const generarPdf = require("../utils/generarPdf");
const dayjs = require("dayjs");
const { formatNumber, formatNumeroDocumento } = require("../utils/format");
const { rucParaKude } = require("../utils/facturacion");
const { IMPRESORA_TICKETS } = require("../utils/impresoraTickets");
const { esCancelado, esRechazado } = require("../utils/sifen/estadoHistorico");

/**
 * Reimpresión del ticket (KuDE) de un documento YA emitido, a la impresora del despliegue on-prem.
 *
 * Existe porque la impresión de la emisión es deliberadamente "best effort": `generarPdf` se traga el
 * error de impresión para que un atasco de papel no voltee una factura ya firmada (ver el comentario
 * en utils/generarPdf.js). El precio de esa decisión es que la cajera puede quedarse sin ticket con la
 * venta perfectamente emitida, y hasta ahora no había forma de recuperarlo. Esto es esa forma.
 *
 * NO reemite ni vuelve a tocar SIFEN: rearma el mismo reporte JasperReports desde lo que hay en la
 * base y lo manda a la impresora. Dos propiedades que hacen que eso sea seguro:
 *
 *   1. **No se pisa el PDF archivado.** `generarPdf` corre en modo `soloImprimir`, que saltea el
 *      export. El archivo en /public es el KuDE original — el que se le mandó por mail al cliente y el
 *      que linkea el listado — y no puede quedar reescrito con lo que la base dice HOY.
 *   2. **Se preserva la fecha de emisión.** Se pasa `fecha_creacion` como `fechaHora`; si no, el ticket
 *      saldría fechado el día de la reimpresión, contradiciendo la fecha embebida en el CDC.
 *
 * Límite conocido y aceptado: las condiciones de crédito (tipo, cantidad de cuotas, periodicidad,
 * descripción del plazo) NO se persisten en ningún lado — sólo viven en el body de la emisión. Un
 * documento CREDITO reimpreso sale con la condición de venta correcta pero sin ese subbloque (los
 * .jrxml guardan el `!= null` que evita que eso rompa el fill). Los demás campos del KuDE (timbrado,
 * plantilla) se leen de la Empresa, así que si cambiaron desde la emisión el ticket reimpreso los
 * refleja actualizados. Por eso el original archivado es el que manda, y por eso no se lo sobrescribe.
 */

// Tasa almacenada (enum Prisma) -> literal que usan los ítems del PDF. Inversa exacta del mapeo que
// hacen emitirFactura/emitirNotaDeCredito al persistir el detalle.
const TASA_PDF = { T0: "0%", T5: "5%", T10: "10%" };

// Reconstruye los ítems tal como los arma la emisión: mismo shape, mismo formateo y misma regla de
// "columna por tasa" (cada ítem aporta su total a exentas / iva5 / iva10 según su tasa).
const construirItemsPdf = (detalles) =>
  detalles.map((detalle) => {
    const tasa = TASA_PDF[detalle.tasa];
    const total = formatNumber(detalle.total);
    return {
      precioUnitario: formatNumber(detalle.precio_unitario),
      iva5: tasa === "5%" ? total : "0",
      iva10: tasa === "10%" ? total : "0",
      exentas: tasa === "0%" ? total : "0",
      descripcion: detalle.descripcion,
      // `cantidad` es Decimal(10,4): Prisma la devuelve como Prisma.Decimal y String() daría "1.5000".
      // Number() primero, mismo criterio que normalizarCantidadDetalles en los GET.
      cantidad: String(Number(detalle.cantidad)),
    };
  });

// Desglose del pie del KuDE. Se suma `impuesto` por tasa (no el total del ítem) — es exactamente lo
// que hace emitirFactura, incluido el caso de exentas, donde el impuesto siempre es 0.
const construirTotales = (detalles) => {
  let totalExenta = 0;
  let totalIva5 = 0;
  let totalIva10 = 0;

  detalles.forEach((detalle) => {
    if (detalle.tasa === "T0") totalExenta += detalle.impuesto;
    else if (detalle.tasa === "T5") totalIva5 += detalle.impuesto;
    else totalIva10 += detalle.impuesto;
  });

  return { totalExenta, totalIva5, totalIva10 };
};

// Datos de cabecera del emisor, idénticos a los que arma la emisión.
const construirDatosEmpresa = (empresa) => ({
  plantilla: empresa.plantilla_pdf,
  empresaLogo: empresa.logo,
  empresaRuc: empresa.ruc,
  empresaTimbrado: empresa.timbrado,
  empresaVigenteDesde: dayjs(empresa.vigente_desde).format("YYYY-MM-DD"),
  empresaNombre: empresa.nombre_empresa,
  empresaDireccion: empresa.direccion,
  empresaTelefono: empresa.telefono,
  empresaCiudad: empresa.ciudad,
  empresaCorreoElectronico: empresa.email,
});

// Validaciones comunes a Factura y NotaCredito. Se corren ANTES de tocar JasperReports.
const validarReimprimible = (documento, etiqueta) => {
  // Sin xml_firmado/linkqr el documento todavía no pasó por la firma: no hay QR que imprimir (el KuDE
  // lo exige) y el ticket no sería un comprobante válido. Es el estado normal de un documento recién
  // creado que quedó a mitad de camino, no un error de quien reimprime.
  if (!documento.linkqr || !documento.xml_firmado) {
    throw new ErrorApp(`${etiqueta} todavía no fue firmada, no hay ticket para imprimir`, 400);
  }

  if (esCancelado(documento)) {
    throw new ErrorApp(`${etiqueta} está cancelada, no se puede reimprimir`, 400);
  }

  if (esRechazado(documento)) {
    throw new ErrorApp(`${etiqueta} fue rechazada por SIFEN, no se puede reimprimir`, 400);
  }
};

// El número impreso se reconstruye desde la caja + su establecimiento. Un documento legacy con
// caja_id NULL no puede reconstruirlo, y un ticket sin número no sirve como comprobante: mejor
// rechazar con un mensaje claro que gastar papel con el campo en blanco.
const numeroImpreso = (caja, numero, etiqueta) => {
  const establecimiento = caja && caja.establecimiento ? caja.establecimiento.codigo : null;
  const formateado = formatNumeroDocumento(establecimiento, caja ? caja.codigo : null, numero);

  if (!formateado) {
    throw new ErrorApp(`No se puede reconstruir el número impreso de ${etiqueta} (no tiene caja asociada)`, 400);
  }

  return formateado;
};

// La impresora es del servidor, no del request: el caller nunca elige a qué impresora se manda (ver
// utils/impresoraTickets). En la nube la variable está vacía y la función simplemente no existe.
const impresoraConfigurada = () => {
  if (!IMPRESORA_TICKETS) {
    throw new ErrorApp("La impresión de tickets no está configurada en este servidor", 400);
  }

  return IMPRESORA_TICKETS;
};

/**
 * Reimprime el ticket de una Factura.
 * @param {Object} datos
 * @param {number} datos.facturaId - Id interno de la Factura
 * @param {number} datos.empresaId - `req.usuario.empresaId`, scoping multi-tenant
 */
const reimprimirFactura = async ({ facturaId, empresaId }) => {
  try {
    const impresora = impresoraConfigurada();

    // Acotado a la empresa del usuario autenticado por el mismo motivo que reenviarFactura: sin esto
    // se podría mandar a imprimir el KuDE de una factura de otra empresa.
    const factura = await prisma.factura.findFirst({
      where: {
        id: facturaId,
        usuario: { empresa_id: empresaId },
      },
      include: {
        detalles: true,
        cliente_empresa: { include: { cliente: true, empresa: true } },
        caja: { include: { establecimiento: true } },
      },
    });

    if (!factura) {
      throw new ErrorApp("La factura no existe", 404);
    }

    validarReimprimible(factura, "La factura");

    const { cliente, empresa } = factura.cliente_empresa;
    const { totalExenta, totalIva5, totalIva10 } = construirTotales(factura.detalles);

    if (factura.condicion_venta === "CREDITO") {
      // Ver el límite documentado arriba. Se loguea para que un ticket sin el subbloque de crédito no
      // parezca un bug silencioso.
      console.log(`[reimpresion] factura ${factura.id} es a CRÉDITO: el ticket sale sin el detalle de cuotas/plazo (no se persiste)`);
    }

    await generarPdf({
      ...construirDatosEmpresa(empresa),
      facturaId: numeroImpreso(factura.caja, factura.numero_factura, "la factura"),
      fechaHora: dayjs(factura.fecha_creacion).format("YYYY-MM-DD HH:mm:ss"),
      condicionVenta: factura.condicion_venta,
      // Mismo criterio que la emisión: innominada -> "X". Ver rucParaKude en utils/facturacion.js.
      ruc: rucParaKude(cliente),
      razonSocial: cliente.razon_social,
      correoElectronico: cliente.email,
      total: factura.total,
      totalIva: factura.total_iva,
      totalExenta,
      totalIva5,
      totalIva10,
      moneda: "PYG",
      items: construirItemsPdf(factura.detalles),
      uuid: factura.factura_uuid,
      linkqr: factura.linkqr,
      cdc: factura.cdc,
      tipoDocumento: "FACTURA ELECTRÓNICA",
      tipoDocumentoTop: "KuDE de Factura Electrónica",
      impresora,
      soloImprimir: true,
    });

    return {
      id: factura.id,
      numeroFactura: factura.numero_factura,
      impresora,
    };
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al reimprimir la factura");
  }
};

/**
 * Reimprime el ticket de una Nota de Crédito.
 * @param {Object} datos
 * @param {number} datos.notaDeCreditoId - Id interno de la NotaCredito
 * @param {number} datos.empresaId - `req.usuario.empresaId`, scoping multi-tenant
 */
const reimprimirNotaDeCredito = async ({ notaDeCreditoId, empresaId }) => {
  try {
    const impresora = impresoraConfigurada();

    const notaDeCredito = await prisma.notaCredito.findFirst({
      where: {
        id: notaDeCreditoId,
        usuario: { empresa_id: empresaId },
      },
      include: {
        nota_credito_detalle: true,
        factura: { include: { cliente_empresa: { include: { cliente: true, empresa: true } } } },
        caja: { include: { establecimiento: true } },
      },
    });

    if (!notaDeCredito) {
      throw new ErrorApp("La nota de crédito no existe", 404);
    }

    validarReimprimible(notaDeCredito, "La nota de crédito");

    const { cliente, empresa } = notaDeCredito.factura.cliente_empresa;
    const { totalExenta, totalIva5, totalIva10 } = construirTotales(notaDeCredito.nota_credito_detalle);

    await generarPdf({
      ...construirDatosEmpresa(empresa),
      facturaId: numeroImpreso(notaDeCredito.caja, notaDeCredito.numero_nota_credito, "la nota de crédito"),
      fechaHora: dayjs(notaDeCredito.fecha_creacion).format("YYYY-MM-DD HH:mm:ss"),
      // La NC no tiene condición de venta propia: la emisión imprime CONTADO fijo, se replica igual.
      condicionVenta: "CONTADO",
      // Mismo criterio que la emisión: innominada -> "X". Ver rucParaKude en utils/facturacion.js.
      ruc: rucParaKude(cliente),
      razonSocial: cliente.razon_social,
      correoElectronico: cliente.email,
      total: notaDeCredito.total,
      totalIva: notaDeCredito.total_iva,
      totalExenta,
      totalIva5,
      totalIva10,
      moneda: "PYG",
      items: construirItemsPdf(notaDeCredito.nota_credito_detalle),
      uuid: notaDeCredito.nota_credito_uuid,
      linkqr: notaDeCredito.linkqr,
      cdc: notaDeCredito.cdc,
      tipoDocumento: "NOTA DE CRÉDITO ELECTRÓNICA",
      tipoDocumentoTop: "KuDE de Nota de crédito Electrónica",
      impresora,
      soloImprimir: true,
    });

    return {
      id: notaDeCredito.id,
      numeroNotaCredito: notaDeCredito.numero_nota_credito,
      impresora,
    };
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al reimprimir la nota de crédito");
  }
};

module.exports = {
  reimprimirFactura,
  reimprimirNotaDeCredito,
};
