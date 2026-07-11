/**
 * Extracción de campos de la respuesta SOAP de SIFEN ya parseada (xml2js, `explicitArray: false`,
 * tal como la devuelve `sifenClientService`), sin asumir un namespace prefix fijo en las claves.
 *
 * El propio código fuente de `facturacionelectronicapy-setapi` (SET.js) tiene, comentado, un intento
 * anterior de bajar a una clave específica con prefijo (`result['env:Envelope']['env:Body']['ns2:rResEnviLoteDe']`)
 * que fue reemplazado por devolver `env:Body` entero sin bajar más — es decir, el nombre exacto del
 * nodo raíz de la respuesta (con o sin prefijo de namespace) no está confirmado por lectura de código,
 * y depende de cómo SIFEN namespacea la respuesta real (pendiente del spike #3, round-trip real contra
 * SIFEN test — ver MIGRATION_PLAN.md). Los nombres de campo (`dCodRes`, `dMsgRes`, `dProtConsLote`,
 * `gResProcLoteDe`, `CDC`) sí están confirmados contra documentación oficial SET/DNIT (Manual Técnico
 * SIFEN v150 y "Guía de Mejores Prácticas para la Gestión del Envío de DE") vía búsqueda dirigida.
 *
 * Para no depender de acertar el namespace/anidamiento exacto, estas funciones buscan por *sufijo* de
 * nombre de tag (ignorando el prefijo `algo:` si existe, y case-insensitive) recorriendo el objeto
 * completo — robusto ante variaciones de namespace, a costa de no distinguir dos campos con el mismo
 * sufijo en ramas distintas del árbol (no es el caso de los campos que se buscan acá, todos únicos
 * dentro del scope en el que se invocan).
 */

/**
 * Busca el primer valor cuya clave (sin prefijo de namespace) termine en `sufijo`, recorriendo el
 * objeto en profundidad (primero el nivel actual, después recursivo).
 * @param {*} obj - Objeto (o valor) donde buscar
 * @param {string} sufijo - Sufijo de nombre de tag a buscar (case-insensitive), p. ej. "dCodRes"
 * @param {Set} [visitados] - Uso interno, evita ciclos
 * @returns {*} - Valor encontrado, o `undefined`
 */
const buscarValorPorSufijo = (obj, sufijo, visitados = new Set()) => {
  if (obj === null || typeof obj !== "object" || visitados.has(obj)) {
    return undefined;
  }
  visitados.add(obj);

  const sufijoNormalizado = sufijo.toLowerCase();

  for (const [clave, valor] of Object.entries(obj)) {
    const nombreSinPrefijo = clave.includes(":") ? clave.split(":").pop() : clave;
    if (nombreSinPrefijo.toLowerCase().endsWith(sufijoNormalizado)) {
      return valor;
    }
  }
  for (const valor of Object.values(obj)) {
    if (valor && typeof valor === "object") {
      const encontrado = buscarValorPorSufijo(valor, sufijo, visitados);
      if (encontrado !== undefined) {
        return encontrado;
      }
    }
  }
  return undefined;
};

/**
 * Extrae {codigo, mensaje} de un nivel puntual (lote o documento) de una respuesta SOAP ya parseada.
 * @param {Object} respuestaSoap - Objeto (respuesta completa, o un sub-nodo puntual como una entrada de `gResProcLoteDe`)
 * @returns {{codigo: string|undefined, mensaje: string|undefined}}
 */
const extraerCodigoYMensaje = (respuestaSoap) => ({
  codigo: buscarValorPorSufijo(respuestaSoap, "dCodRes"),
  mensaje: buscarValorPorSufijo(respuestaSoap, "dMsgRes"),
});

/**
 * Extrae el protocolo de consulta de lote (`dProtConsLote`) de la respuesta de `recibeLote` —
 * necesario para poder llamar después a `consultaLote`.
 * @param {Object} respuestaSoap
 * @returns {string|undefined}
 */
const extraerProtocoloLote = (respuestaSoap) => buscarValorPorSufijo(respuestaSoap, "dProtConsLote");

/**
 * Extrae la lista de resultados por documento (`gResProcLoteDe`) de una respuesta de `consultaLote`,
 * normalizada siempre a array — xml2js con `explicitArray: false` devuelve un objeto único (no un
 * array de 1 elemento) cuando el lote consultado tiene un solo documento, caso borde que el caller no
 * debería tener que manejar aparte.
 * @param {Object} respuestaSoap
 * @returns {Object[]}
 */
const extraerResultadosPorDocumento = (respuestaSoap) => {
  const grupo = buscarValorPorSufijo(respuestaSoap, "gResProcLoteDe");
  if (!grupo) {
    return [];
  }
  return Array.isArray(grupo) ? grupo : [grupo];
};

/**
 * Extrae el CDC de una entrada puntual de `gResProcLoteDe`.
 * @param {Object} resultadoDocumento
 * @returns {string|undefined}
 */
const extraerCdc = (resultadoDocumento) => buscarValorPorSufijo(resultadoDocumento, "CDC");

module.exports = {
  buscarValorPorSufijo,
  extraerCodigoYMensaje,
  extraerProtocoloLote,
  extraerResultadosPorDocumento,
  extraerCdc,
};
