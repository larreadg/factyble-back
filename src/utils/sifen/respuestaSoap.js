/**
 * Extracción de campos de la respuesta SOAP de SIFEN ya parseada (xml2js, `explicitArray: false`,
 * tal como la devuelve `sifenClientService`), sin asumir un namespace prefix fijo en las claves.
 *
 * El nombre exacto del nodo raíz (con o sin prefijo de namespace) no se fija en ningún lado a
 * propósito — estas funciones buscan por *sufijo* de nombre de tag (ignorando el prefijo `algo:` si
 * existe, y case-insensitive) recorriendo el objeto completo, robusto ante variaciones de namespace.
 *
 * Nombres de campo confirmados contra una respuesta real de `consultaLote` (round-trip contra SIFEN
 * test, ver info2.json de auditoría / MIGRATION_PLAN.md, corrigió el spike #3 que estaba pendiente):
 * el nodo por-documento se llama `gResProcLote` (**sin** "De" final, a diferencia de lo que se había
 * asumido inicialmente), el código/mensaje a nivel de sobre/lote de una respuesta de `consultaLote`
 * vienen en `dCodResLot`/`dMsgResLot` (no `dCodRes`/`dMsgRes`, que a ese nivel son los del *documento*,
 * anidados dentro de `gResProcLote.gResProc`), el CDC de cada entrada viene en el campo `id` (no
 * `CDC`), y el protocolo de autorización SIFEN (destino: `sifen_num_transaccion`) viene en `dProtAut`.
 * `dProtConsLote` (respuesta de `recibeLote`) y `dCodRes`/`dMsgRes` a nivel de sobre de `recibeLote`
 * siguen confirmados contra documentación oficial SET/DNIT (Manual Técnico SIFEN v150) vía búsqueda
 * dirigida — no se tocan acá.
 */

/**
 * Busca el primer valor cuya clave (sin prefijo de namespace) termine en `sufijo`, recorriendo el
 * objeto en profundidad (primero el nivel actual completo, recién después desciende a los hijos —
 * por eso, si `sufijo` existe como clave directa de un nivel, nunca se sigue bajando a explorar los
 * hijos de ese mismo nivel en busca de otra coincidencia más profunda).
 *
 * `excluirSufijos` (AUD-008, STATIC_AUDIT_FINDINGS.json) permite no descender a un subárbol puntual
 * — pensado para que, al extraer el código a nivel de sobre/lote de una respuesta de `consultaLote`,
 * la búsqueda nunca pueda terminar devolviendo el código de un documento individual anidado dentro de
 * `gResProcLoteDe`, sin importar el namespace/anidamiento real (todavía no confirmado contra una
 * respuesta real de SIFEN, ver spike #3 en MIGRATION_PLAN.md). No cambia el comportamiento para
 * llamadas que no pasan esta opción.
 * @param {*} obj - Objeto (o valor) donde buscar
 * @param {string} sufijo - Sufijo de nombre de tag a buscar (case-insensitive), p. ej. "dCodRes"
 * @param {Object} [opciones]
 * @param {string[]} [opciones.excluirSufijos] - Sufijos de clave (mismo criterio que `sufijo`) cuyo
 *   subárbol no se debe explorar, ni siquiera si `sufijo` no aparece en ningún otro lado
 * @param {Set} [opciones.visitados] - Uso interno, evita ciclos
 * @returns {*} - Valor encontrado, o `undefined`
 */
const buscarValorPorSufijo = (obj, sufijo, { excluirSufijos = [], visitados = new Set() } = {}) => {
  if (obj === null || typeof obj !== "object" || visitados.has(obj)) {
    return undefined;
  }
  visitados.add(obj);

  const sufijoNormalizado = sufijo.toLowerCase();
  const excluidosNormalizados = excluirSufijos.map((s) => s.toLowerCase());
  const nombreSinPrefijo = (clave) => (clave.includes(":") ? clave.split(":").pop() : clave).toLowerCase();

  for (const [clave, valor] of Object.entries(obj)) {
    if (nombreSinPrefijo(clave).endsWith(sufijoNormalizado)) {
      return valor;
    }
  }
  for (const [clave, valor] of Object.entries(obj)) {
    if (excluidosNormalizados.some((ex) => nombreSinPrefijo(clave).endsWith(ex))) {
      continue;
    }
    if (valor && typeof valor === "object") {
      const encontrado = buscarValorPorSufijo(valor, sufijo, { excluirSufijos, visitados });
      if (encontrado !== undefined) {
        return encontrado;
      }
    }
  }
  return undefined;
};

/**
 * Extrae {codigo, mensaje} de un nivel puntual (lote o documento) de una respuesta SOAP ya parseada.
 * @param {Object} respuestaSoap - Objeto (respuesta completa, o un sub-nodo puntual como una entrada de `gResProcLote`)
 * @param {Object} [opciones]
 * @param {string[]} [opciones.excluirSufijos] - Ver `buscarValorPorSufijo`.
 * @param {string} [opciones.sufijoCodigo] - Default `"dCodRes"` (nivel documento, y nivel sobre de
 *   `recibeLote`). Pasar `"dCodResLot"` para el código a nivel de sobre de una respuesta de
 *   `consultaLote`, que es un tag distinto (no un caso particular de `dCodRes`).
 * @param {string} [opciones.sufijoMensaje] - Default `"dMsgRes"`, análogo a `sufijoCodigo`.
 * @returns {{codigo: string|undefined, mensaje: string|undefined}}
 */
const extraerCodigoYMensaje = (respuestaSoap, { excluirSufijos, sufijoCodigo = "dCodRes", sufijoMensaje = "dMsgRes" } = {}) => ({
  codigo: buscarValorPorSufijo(respuestaSoap, sufijoCodigo, { excluirSufijos }),
  mensaje: buscarValorPorSufijo(respuestaSoap, sufijoMensaje, { excluirSufijos }),
});

/**
 * Extrae el protocolo de consulta de lote (`dProtConsLote`) de la respuesta de `recibeLote` —
 * necesario para poder llamar después a `consultaLote`.
 * @param {Object} respuestaSoap
 * @returns {string|undefined}
 */
const extraerProtocoloLote = (respuestaSoap) => buscarValorPorSufijo(respuestaSoap, "dProtConsLote");

/**
 * Extrae la lista de resultados por documento (`gResProcLote`) de una respuesta de `consultaLote`,
 * normalizada siempre a array — xml2js con `explicitArray: false` devuelve un objeto único (no un
 * array de 1 elemento) cuando el lote consultado tiene un solo documento, caso borde que el caller no
 * debería tener que manejar aparte.
 * @param {Object} respuestaSoap
 * @returns {Object[]}
 */
const extraerResultadosPorDocumento = (respuestaSoap) => {
  const grupo = buscarValorPorSufijo(respuestaSoap, "gResProcLote");
  if (!grupo) {
    return [];
  }
  return Array.isArray(grupo) ? grupo : [grupo];
};

/**
 * Extrae el CDC de una entrada puntual de `gResProcLote`. Ojo: busca por sufijo `"id"`, que es
 * genérico — solo es seguro porque el caller siempre pasa acá una entrada ya recortada de
 * `extraerResultadosPorDocumento` (cuyas claves son `id`/`dEstRes`/`dProtAut`/`gResProc`), nunca la
 * respuesta SOAP completa (que sí trae un `id` de tracking de la llamada, ajeno al CDC, al nivel raíz).
 * @param {Object} resultadoDocumento
 * @returns {string|undefined}
 */
const extraerCdc = (resultadoDocumento) => buscarValorPorSufijo(resultadoDocumento, "id");

/**
 * Extrae el protocolo de autorización SIFEN (`dProtAut`) de una entrada puntual de `gResProcLote` —
 * el número de transacción que identifica el documento ya aprobado (destino: `sifen_num_transaccion`).
 * @param {Object} resultadoDocumento
 * @returns {string|undefined}
 */
const extraerProtocoloAutorizacion = (resultadoDocumento) => buscarValorPorSufijo(resultadoDocumento, "dProtAut");

module.exports = {
  buscarValorPorSufijo,
  extraerCodigoYMensaje,
  extraerProtocoloLote,
  extraerResultadosPorDocumento,
  extraerCdc,
  extraerProtocoloAutorizacion,
};
