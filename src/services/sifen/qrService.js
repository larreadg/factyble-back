const qrgen = require("facturacionelectronicapy-qrgen").default;
const xml2js = require("xml2js");
const ErrorApp = require("../../utils/error");

const SIFEN_ENV = process.env.SIFEN_ENV === "prod" ? "prod" : "test";

/**
 * Inyecta el link de consulta pública QR (`rDE > gCamFuFD > dCarQR`) en un XML ya firmado.
 * Reemplaza por completo el string-splicing frágil de la API PHP legacy
 * (`agregarLinkXML.php`): `qrgen.generateQR` parsea el XML con xml2js, arma el `preLinkQR`
 * (CDC/fecha/receptor/totales/cantidad de items/DigestValue de la firma/IdCSC), calcula
 * `cHashQR` (SHA-256 plano de `preLink + CSC` — pese al nombre "HMAC-SHA256" que usa el manual
 * de SIFEN, no es un HMAC real, se replica tal cual) y reserializa el XML completo con
 * `xml2js.Builder`. Requiere que el XML ya tenga el nodo `Signature` (post-firma, ver
 * `firmadorService.js`) — `qrgen` lanza si no lo encuentra.
 * Verificado ad-hoc (sin test runner en el repo, mismo patrón que `cdc.js`/`firmadorService.js`/
 * `xmlBuilderService.js`): round-trip con un XML `rDE` de muestra ya firmado, confirmando que
 * `gCamFuFD.dCarQR` queda como string plano (sin wrapper `{ _ }`) al reparsear con xml2js.
 * @param {Object} datos
 * @param {string} datos.xmlFirmado - XML del DE (o evento) ya firmado por `firmadorService`
 * @param {string} datos.idCSC - `Empresa.csc_id`
 * @param {string} datos.csc - `Empresa.csc` (Código de Seguridad del Contribuyente, ya descifrado)
 * @returns {Promise<{xmlConQr: string, linkQr: string}>} - XML firmado con el QR ya inyectado
 *   (para `xml_firmado`), y el link del QR aparte como string plano (para la columna `linkqr`,
 *   que hoy alimenta `generarPdf.js`/KUDE como URL, no como XML — ver `facturaService.js`)
 */
const generarQr = async ({ xmlFirmado, idCSC, csc }) => {
  if (!idCSC || !csc) {
    throw new ErrorApp("La empresa no tiene CSC/CSC ID configurados, no se puede generar el QR", 400);
  }
  try {
    const xmlConQr = await qrgen.generateQR(xmlFirmado, idCSC, csc, SIFEN_ENV);
    const parseado = await xml2js.parseStringPromise(xmlConQr);
    const linkQr = parseado.rDE.gCamFuFD[0].dCarQR[0];
    return { xmlConQr, linkQr };
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al generar el QR del documento");
  }
};

module.exports = {
  generarQr,
};
