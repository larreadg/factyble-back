const setapi = require("facturacionelectronicapy-setapi").default;
const ErrorApp = require("../../utils/error");

/**
 * Wrapea `facturacionelectronicapy-setapi`. Expone deliberadamente solo `recibeLote`, `evento`,
 * `consultaLote`, `consulta` y `consultaRuc` — nunca `recibe` (envío
 * síncrono individual), para que no exista ni la tentación de bifurcar el camino de emisión: el
 * único camino de emisión de Factura/NotaCredito es por lote (Decisión cerrada), incluso para
 * lotes de 1 solo documento.
 *
 * `SIFEN_ENV` se lee de `process.env` (mismo patrón que `qrService.js`) — la propia lib resuelve el
 * endpoint SOAP según este valor (`"test"` -> sifen-test.set.gov.py, cualquier otro -> producción;
 * confirmado por lectura de codigo en el spike #1).
 *
 * Certificado (path + password ya descifrada) recibido explicito por parametro en cada llamada, sin
 * estado global (antipatron G) — mismo patron que `firmadorService.js`.
 *
 * Todas las funciones de este modulo devuelven el body SOAP ya parseado (objeto JS), tanto para
 * respuestas de exito como para rechazos de negocio de SIFEN (la lib solo rechaza la Promise ante
 * fallas de red/parseo, no ante un rechazo de SIFEN en si) — la interpretacion del codigo de
 * respuesta (aprobado/rechazado/reintentable) es responsabilidad de `codigosRespuesta.js` y de los
 * servicios que llaman a este modulo (`loteService`, `eventoService`), no de este wrapper.
 */
const SIFEN_ENV = process.env.SIFEN_ENV === "prod" ? "prod" : "test";

const LOTE_MIN_DOCUMENTOS = 1;
const LOTE_MAX_DOCUMENTOS = 50;

/**
 * Techo de espera para `consultaRuc`, y SOLO para `consultaRuc`. El default de la lib es 90 s para
 * todas sus operaciones (`SET.js`, `defaultConfig.timeout`), razonable para el pipeline de lotes —
 * que corre en cron y puede esperar— pero inaceptable acá: la consulta de RUC cuelga de un request
 * HTTP sincrónico del usuario (`/generico/buscar` y la emisión desde caja), así que una caída de
 * SIFEN dejaba la UI y la caja bloqueadas hasta 90 s por búsqueda.
 *
 * El tope vive en el wrapper y no en el caller a propósito: así lo hereda cualquier consulta de RUC
 * a SIFEN, presente o futura, sin depender de que cada call site se acuerde de pasar el `config`.
 * Un caller puede subirlo pasando su propio `config.timeout` (gana sobre este default), pero ningún
 * caller vuelve a los 90 s por omisión.
 *
 * Agotar el tiempo NO es un rechazo: la lib rechaza la Promise, `consultaRucService` lo traduce a
 * `indeterminado` y cada caller aplica su política local (la emisión emite sin verificar, el
 * buscador devuelve 404). Por eso recortar la espera es seguro: nunca convierte "no sabemos" en
 * "el RUC no existe".
 */
const CONSULTA_RUC_TIMEOUT_MS = Number(process.env.SIFEN_CONSULTA_RUC_TIMEOUT_MS) || 5000;

/**
 * Envia un lote de XML ya firmados a SIFEN. La propia lib arma el envoltorio `<rLoteDE>`, el ZIP en
 * memoria y el sobre SOAP con mTLS (confirmado por lectura de codigo, spike #1) — este servicio solo
 * junta los XML ya firmados de un lote (mismo RUC + tipo de documento, maximo 50, minimo 1) y llama.
 * Valida el tamaño del lote del lado nuestro antes de llamar a la lib: sus propios `reject(...)` de
 * validacion no cortan la ejecucion con `return` (nota de robustez documentada en el spike #1), asi
 * que no hay que confiar en que la lib corte ahi.
 * @param {Object} datos
 * @param {number} datos.id - Identificador numerico de la solicitud (`dId` del sobre SOAP), generado por el caller
 * @param {string[]} datos.xmls - XML firmados del lote (1 a 50, mismo RUC + tipo de documento)
 * @param {string} datos.certificadoPath - Path del archivo .p12 en filesystem
 * @param {string} datos.certificadoPassword - Contraseña del .p12, ya descifrada por certificadoService
 * @param {Object} [datos.config] - Config opcional de la lib (timeout, debug, etc.)
 * @returns {Promise<Object>} - Body SOAP de la respuesta de SIFEN, ya parseado
 */
const recibeLote = async ({ id, xmls, certificadoPath, certificadoPassword, config }) => {
  if (!Array.isArray(xmls) || xmls.length < LOTE_MIN_DOCUMENTOS || xmls.length > LOTE_MAX_DOCUMENTOS) {
    throw new ErrorApp(
      `El lote debe tener entre ${LOTE_MIN_DOCUMENTOS} y ${LOTE_MAX_DOCUMENTOS} documentos (recibidos: ${Array.isArray(xmls) ? xmls.length : 0})`,
      400
    );
  }
  try {
    return await setapi.recibeLote(id, xmls, SIFEN_ENV, certificadoPath, certificadoPassword, config);
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al enviar el lote a SIFEN");
  }
};

/**
 * Envia un evento (p. ej. cancelacion) ya firmado a SIFEN. Camino sincrono — SIFEN no ofrece envio
 * de eventos por lote.
 * @param {Object} datos
 * @param {number} datos.id - Identificador numerico de la solicitud (`dId` del sobre SOAP), generado por el caller
 * @param {string} datos.xml - XML de evento ya firmado (nodo `rEve`)
 * @param {string} datos.certificadoPath - Path del archivo .p12 en filesystem
 * @param {string} datos.certificadoPassword - Contraseña del .p12, ya descifrada por certificadoService
 * @param {Object} [datos.config] - Config opcional de la lib (timeout, debug, etc.)
 * @returns {Promise<Object>} - Body SOAP de la respuesta de SIFEN, ya parseado
 */
const evento = async ({ id, xml, certificadoPath, certificadoPassword, config }) => {
  try {
    return await setapi.evento(id, xml, SIFEN_ENV, certificadoPath, certificadoPassword, config);
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al enviar el evento a SIFEN");
  }
};

/**
 * Consulta el estado de un lote ya enviado, por su número de protocolo (`sifen_numero_lote` en
 * nuestro modelo `Lote`). Parte del pipeline regular (`consultarLotes`, cada 5 min, ver §3.4).
 * @param {Object} datos
 * @param {number} datos.id - Identificador numerico de la solicitud (`dId` del sobre SOAP), generado por el caller
 * @param {number|string} datos.numeroProtocolo - Número de protocolo devuelto por `recibeLote`
 * @param {string} datos.certificadoPath - Path del archivo .p12 en filesystem
 * @param {string} datos.certificadoPassword - Contraseña del .p12, ya descifrada por certificadoService
 * @param {Object} [datos.config] - Config opcional de la lib (timeout, debug, etc.)
 * @returns {Promise<Object>} - Body SOAP de la respuesta de SIFEN, ya parseado
 */
const consultaLote = async ({ id, numeroProtocolo, certificadoPath, certificadoPassword, config }) => {
  try {
    return await setapi.consultaLote(id, numeroProtocolo, SIFEN_ENV, certificadoPath, certificadoPassword, config);
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al consultar el lote en SIFEN");
  }
};

/**
 * Consulta un Documento Electrónico por CDC. No se usa como vía de emisión ni como reemplazo de la
 * consulta por lote — solo en el job de red de seguridad (`consultaIndividualRedDeSeguridad`, §3.4)
 * para documentos en `ENVIADO` sin resolución tras un umbral.
 * @param {Object} datos
 * @param {number} datos.id - Identificador numerico de la solicitud (`dId` del sobre SOAP), generado por el caller
 * @param {string} datos.cdc - CDC del documento a consultar
 * @param {string} datos.certificadoPath - Path del archivo .p12 en filesystem
 * @param {string} datos.certificadoPassword - Contraseña del .p12, ya descifrada por certificadoService
 * @param {Object} [datos.config] - Config opcional de la lib (timeout, debug, etc.)
 * @returns {Promise<Object>} - Body SOAP de la respuesta de SIFEN, ya parseado
 */
const consulta = async ({ id, cdc, certificadoPath, certificadoPassword, config }) => {
  try {
    return await setapi.consulta(id, cdc, SIFEN_ENV, certificadoPath, certificadoPassword, config);
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al consultar el documento en SIFEN");
  }
};

/**
 * Consulta los datos de un RUC en el padrón de contribuyentes de SIFEN.
 * @param {Object} datos
 * @param {number} datos.id - Identificador numerico de la solicitud (`dId` del sobre SOAP), generado por el caller
 * @param {string} datos.ruc - RUC a consultar (sin dígito verificador, según exige el WSDL)
 * @param {string} datos.certificadoPath - Path del archivo .p12 en filesystem
 * @param {string} datos.certificadoPassword - Contraseña del .p12, ya descifrada por certificadoService
 * @param {Object} [datos.config] - Config opcional de la lib (timeout, debug, etc.). Se mezcla SOBRE
 *   el default de este módulo, así que pasar `timeout` acá pisa a `CONSULTA_RUC_TIMEOUT_MS`
 * @returns {Promise<Object>} - Body SOAP de la respuesta de SIFEN, ya parseado
 */
const consultaRuc = async ({ id, ruc, certificadoPath, certificadoPassword, config }) => {
  try {
    return await setapi.consultaRUC(id, ruc, SIFEN_ENV, certificadoPath, certificadoPassword, {
      timeout: CONSULTA_RUC_TIMEOUT_MS,
      ...config,
    });
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al consultar el RUC en SIFEN");
  }
};

module.exports = {
  recibeLote,
  evento,
  consultaLote,
  consulta,
  consultaRuc,
};
