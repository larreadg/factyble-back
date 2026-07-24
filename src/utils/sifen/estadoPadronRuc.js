/**
 * Estados del RUC en el padrón de contribuyentes (Marangatu) que SIFEN usa para rechazar un DE
 * por RUC inválido — Manual Técnico SIFEN v150, validaciones D206c/D206d (receptor), D101b
 * (emisor) y GET016b (transportista): las tres describen exactamente la misma lista de estados
 * descalificantes ("el RUC debe contar con un estado distinto a CANCELADO, CANCELADO DEFINITIVO
 * o SUSPENSIÓN TEMPORAL"). BLOQUEADO no aparece en el manual como motivo de rechazo en ninguna
 * de esas validaciones, así que deliberadamente no está en esta lista.
 */
const ESTADOS_RUC_QUE_BLOQUEAN_EMISION = ["CANCELADO", "CANCELADO DEFINITIVO", "SUSPENSION TEMPORAL"];

const DIACRITICOS_REGEX = new RegExp("[̀-ͯ]", "g");

const normalizarEstado = (estado) =>
  (estado || "")
    .normalize("NFD")
    .replace(DIACRITICOS_REGEX, "")
    .trim()
    .toUpperCase();

/**
 * @param {string} estado - Valor crudo de `padron_ruc.estado`
 * @returns {boolean} true si ese estado inhabilita al RUC para recibir/emitir un DE
 */
const bloqueaEmision = (estado) => ESTADOS_RUC_QUE_BLOQUEAN_EMISION.includes(normalizarEstado(estado));

module.exports = {
  ESTADOS_RUC_QUE_BLOQUEAN_EMISION,
  bloqueaEmision,
};
