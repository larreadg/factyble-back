const xmlsign = require("facturacionelectronicapy-xmlsign").default;
const ErrorApp = require("../../utils/error");

/**
 * Decisión de diseño (ver MIGRATION_PLAN.md, "Estado de implementación" §Fase 0 spike #2):
 * `xmlsign` tiene dos vías de firma intercambiables por este flag. La vía Java
 * (activada al omitirlo o pasar un valor falsy) arma un comando de shell por
 * interpolación de string sin escapar la contraseña del P12 — inyección de comandos
 * clásica — y además requiere JDK/JRE instalado en el servidor. Por eso se fuerza
 * siempre la vía Node puro (`xml-crypto` + `node-forge`, sin `child_process`).
 * No pasar `false`/`undefined` nunca, ni omitir el parámetro en las llamadas de abajo.
 */
const FIRMAR_CON_NODEJS = true;

/**
 * Firma el nodo `DE` de un XML de Factura o Nota de Crédito (XML-DSig enveloped,
 * RSA-SHA256, C14N exclusivo).
 * @param {Object} datos
 * @param {string} datos.xml - XML sin firmar (generado por xmlBuilderService)
 * @param {string} datos.certificadoPath - Path del archivo .p12 en filesystem
 * @param {string} datos.certificadoPassword - Contraseña del .p12, ya descifrada por certificadoService
 * @returns {Promise<string>} - XML firmado
 */
const firmarXmlDocumento = async ({ xml, certificadoPath, certificadoPassword }) => {
  try {
    return await xmlsign.signXML(xml, certificadoPath, certificadoPassword, FIRMAR_CON_NODEJS);
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al firmar el XML del documento");
  }
};

/**
 * Firma el nodo `rEve` de un XML de evento SIFEN (p. ej. cancelación).
 * @param {Object} datos
 * @param {string} datos.xml - XML de evento sin firmar (generado por xmlBuilderService)
 * @param {string} datos.certificadoPath - Path del archivo .p12 en filesystem
 * @param {string} datos.certificadoPassword - Contraseña del .p12, ya descifrada por certificadoService
 * @returns {Promise<string>} - XML de evento firmado
 */
const firmarXmlEvento = async ({ xml, certificadoPath, certificadoPassword }) => {
  try {
    return await xmlsign.signXMLEvento(xml, certificadoPath, certificadoPassword, FIRMAR_CON_NODEJS);
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al firmar el XML del evento");
  }
};

/**
 * Lee la vigencia (no antes de / no después de) de un certificado .p12, para que
 * `certificadoService` pueda hacer el chequeo proactivo de vencimiento que la API
 * PHP nunca hizo (causa raíz documentada del error 0142).
 * @param {Object} datos
 * @param {string} datos.certificadoPath - Path del archivo .p12 en filesystem
 * @param {string} datos.certificadoPassword - Contraseña del .p12, ya descifrada por certificadoService
 * @returns {Promise<{vigenteDesde: Date, vigenteHasta: Date}>}
 */
const obtenerVencimientoCertificado = async ({ certificadoPath, certificadoPassword }) => {
  try {
    const { notBefore, notAfter } = await xmlsign.getExpiration(certificadoPath, certificadoPassword, FIRMAR_CON_NODEJS);
    return {
      vigenteDesde: new Date(notBefore),
      vigenteHasta: new Date(notAfter),
    };
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al leer el vencimiento del certificado");
  }
};

module.exports = {
  firmarXmlDocumento,
  firmarXmlEvento,
  obtenerVencimientoCertificado,
};
