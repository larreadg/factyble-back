// Construcción del XML propio de Factyble para un Recibo de dinero.
//
// IMPORTANTE: un recibo de dinero NO es un documento electrónico SIFEN. No existe un tipo de DE para
// recibos, así que este XML NO es un `rDE`/`DE` de SET: es una representación propia (namespace propio),
// pensada para ser firmada como XML-DSig enveloped genérico (ver utils/firmaXml.js) con el certificado de
// la empresa. Por eso NO se reusa services/sifen/xmlBuilderService.js (que mapea al esquema DE) ni
// firmadorService.firmarXmlDocumento (que está atado al nodo `rDE`/`DE`, revienta con cualquier otra raíz).
//
// El nodo firmable es `Recibo`, con atributo `Id` (xsd:ID) al que apunta la Reference de la firma.

const NS_RECIBO = "https://factyble.com/xsd/recibo/v1";
const VERSION_FORMATO = "1";

// Escapa texto para contenido/atributos XML. Se hace a mano (sin libs) para no depender de un builder
// externo y mantener el módulo puro y testeable en Node sin el bridge Java.
const esc = (valor) => {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

// Monto guaraní: entero sin decimales (mismo criterio que el resto del pipeline PYG, pygDecimals=0).
const montoEntero = (valor) => String(Math.round(Number(valor) || 0));

// Fecha de emisión en formato local `YYYY-MM-DDTHH:mm:ss` (sin zona). Se usan getters locales a propósito
// —igual que utils/sifen/cdc.js— para que refleje el día/hora real de emisión en Paraguay; el caller debe
// pasar un Date cuyos campos locales ya sean los correctos.
const formatearFecha = (fecha) => {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const p = (n, len = 2) => String(n).padStart(len, "0");
  return (
    `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
};

/**
 * Arma el XML (sin firmar) de un recibo.
 *
 * @param {Object} datos
 * @param {string} datos.reciboUuid - UUID del recibo (usado para el atributo Id del nodo firmable)
 * @param {string} datos.reciboId - Número compuesto formateado (ej. "001-001-0000007")
 * @param {Date}   datos.fechaEmision - Fecha/hora de emisión (campos locales = día real en PY)
 * @param {string} [datos.concepto]
 * @param {Object} datos.emisor - { ruc, nombre, direccion, ciudad, telefono, email, timbrado }
 * @param {Object} datos.receptor - { ruc, razonSocial, email }
 * @param {Array<{tipoDocumento:string,numeroDocumento:string,montoAplicado:number}>} datos.documentos
 * @param {Array<{banco:string,numeroReferencia:string,monto:number}>} datos.cheques
 * @param {Array<{banco:string,numeroReferencia:string,monto:number}>} datos.transferencias
 * @param {number} datos.totalEfectivo
 * @param {number} datos.totalCheques
 * @param {number} datos.totalTransferencias
 * @param {number} datos.total
 * @param {string} datos.totalLetras
 * @returns {string} XML del recibo, sin firmar
 */
const construirXmlRecibo = (datos) => {
  const {
    reciboUuid,
    reciboId,
    fechaEmision,
    concepto,
    emisor = {},
    receptor = {},
    documentos = [],
    cheques = [],
    transferencias = [],
    totalEfectivo,
    totalCheques,
    totalTransferencias,
    total,
    totalLetras,
  } = datos;

  const idNodo = `Recibo_${reciboUuid}`;

  const docsXml = documentos
    .map(
      (d) =>
        `      <gDocApli>` +
        `<dTipoDoc>${esc(d.tipoDocumento)}</dTipoDoc>` +
        `<dNumDoc>${esc(d.numeroDocumento)}</dNumDoc>` +
        `<dMontoApli>${montoEntero(d.montoAplicado)}</dMontoApli>` +
        `</gDocApli>`
    )
    .join("\n");

  const chequesXml = cheques
    .map(
      (c) =>
        `      <gCheque>` +
        `<dBanco>${esc(c.banco)}</dBanco>` +
        `<dNumCheque>${esc(c.numeroReferencia)}</dNumCheque>` +
        `<dMontoCheque>${montoEntero(c.monto)}</dMontoCheque>` +
        `</gCheque>`
    )
    .join("\n");

  const transfXml = transferencias
    .map(
      (t) =>
        `      <gTransfer>` +
        `<dBanco>${esc(t.banco)}</dBanco>` +
        `<dNumRef>${esc(t.numeroReferencia)}</dNumRef>` +
        `<dMontoTransf>${montoEntero(t.monto)}</dMontoTransf>` +
        `</gTransfer>`
    )
    .join("\n");

  const efectivoXml =
    Number(totalEfectivo) > 0
      ? `      <gEfectivo><dMontoEfec>${montoEntero(totalEfectivo)}</dMontoEfec></gEfectivo>\n`
      : "";

  const mediosPago = `${efectivoXml}${[chequesXml, transfXml].filter(Boolean).join("\n")}`;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rRecibo xmlns="${NS_RECIBO}">\n` +
    `  <Recibo Id="${esc(idNodo)}">\n` +
    `    <dVerFor>${VERSION_FORMATO}</dVerFor>\n` +
    `    <gDatGralRec>\n` +
    `      <dNumRec>${esc(reciboId)}</dNumRec>\n` +
    `      <dUuidRec>${esc(reciboUuid)}</dUuidRec>\n` +
    `      <dFeEmiRec>${esc(formatearFecha(fechaEmision))}</dFeEmiRec>\n` +
    (concepto ? `      <dConcep>${esc(concepto)}</dConcep>\n` : "") +
    `    </gDatGralRec>\n` +
    `    <gEmisor>\n` +
    `      <dRucEmi>${esc(emisor.ruc)}</dRucEmi>\n` +
    `      <dNomEmi>${esc(emisor.nombre)}</dNomEmi>\n` +
    (emisor.direccion ? `      <dDirEmi>${esc(emisor.direccion)}</dDirEmi>\n` : "") +
    (emisor.ciudad ? `      <dCiuEmi>${esc(emisor.ciudad)}</dCiuEmi>\n` : "") +
    (emisor.telefono ? `      <dTelEmi>${esc(emisor.telefono)}</dTelEmi>\n` : "") +
    (emisor.email ? `      <dEmailEmi>${esc(emisor.email)}</dEmailEmi>\n` : "") +
    (emisor.timbrado ? `      <dTimbrado>${esc(emisor.timbrado)}</dTimbrado>\n` : "") +
    `    </gEmisor>\n` +
    `    <gReceptor>\n` +
    `      <dRucRec>${esc(receptor.ruc)}</dRucRec>\n` +
    `      <dNomRec>${esc(receptor.razonSocial)}</dNomRec>\n` +
    (receptor.email ? `      <dEmailRec>${esc(receptor.email)}</dEmailRec>\n` : "") +
    `    </gReceptor>\n` +
    `    <gDocumentos>\n` +
    (docsXml ? `${docsXml}\n` : "") +
    `    </gDocumentos>\n` +
    `    <gMediosPago>\n` +
    (mediosPago ? `${mediosPago}\n` : "") +
    `    </gMediosPago>\n` +
    `    <gTotales>\n` +
    `      <dTotEfec>${montoEntero(totalEfectivo)}</dTotEfec>\n` +
    `      <dTotCheque>${montoEntero(totalCheques)}</dTotCheque>\n` +
    `      <dTotTransf>${montoEntero(totalTransferencias)}</dTotTransf>\n` +
    `      <dTotRec>${montoEntero(total)}</dTotRec>\n` +
    `      <dTotEnLetras>${esc(totalLetras)}</dTotEnLetras>\n` +
    `    </gTotales>\n` +
    `  </Recibo>\n` +
    `</rRecibo>`
  );
};

module.exports = { construirXmlRecibo, NS_RECIBO };
