/**
 * Lectura dual de estado para Factura/NotaCredito históricas (AUD-001, STATIC_AUDIT_FINDINGS.json;
 * "sifen_estado NO se convirtió a enum"). `estado_sifen` (enum nativo)
 * es NULL para todo documento emitido antes del corte a este pipeline (o por el flujo legacy mientras
 * convivió) — el dato real de aprobación/cancelación de esos documentos vive únicamente en
 * `sifen_estado` (texto libre, escrito históricamente por la API PHP legacy, ya congelado y sin
 * escrituras nuevas desde el corte). `reciboService.js` ya lee `sifen_estado` directo con los mismos
 * valores ("Cancelado", "Rechazado") — se reusan acá los mismos literales, no inventados.
 *
 * Temporal: si en el futuro se decide hacer backfill de `estado_sifen` sobre el histórico completo,
 * este módulo deja de ser necesario y los call sites pueden volver a comparar solo `estado_sifen`.
 */

const esAprobado = (documento) =>
  documento.estado_sifen === "APROBADO" ||
  (documento.estado_sifen === null && documento.sifen_estado === "Aprobado");

const esCancelado = (documento) =>
  documento.estado_sifen === "CANCELADO" ||
  (documento.estado_sifen === null && documento.sifen_estado === "Cancelado");

const esRechazado = (documento) =>
  documento.estado_sifen === "RECHAZADO" ||
  (documento.estado_sifen === null && documento.sifen_estado === "Rechazado");

module.exports = {
  esAprobado,
  esCancelado,
  esRechazado,
};
