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

// Textos legacy de `sifen_estado` que tienen equivalente exacto en el enum EstadoSifen. Son los tres
// mismos literales que ya comparan esAprobado/esCancelado/esRechazado — no se agregan valores nuevos.
const ESTADO_LEGACY_A_ENUM = {
  Aprobado: "APROBADO",
  Cancelado: "CANCELADO",
  Rechazado: "RECHAZADO",
};

// Estado único del documento, para consumidores que no quieren resolver el par nativo/legacy a mano
// (ej. la consulta en lote por id_externo). Devuelve `estado_sifen` cuando existe —todo documento del
// pipeline nativo— y, para el histórico donde es NULL, traduce el texto legacy al mismo vocabulario.
// Un texto legacy fuera de los tres conocidos devuelve null en vez de un valor inventado — nunca se
// adivina un estado. Ojo: los consumidores nuevos (consulta en lote) NO exponen `sifen_estado`, así que
// para ellos `null` es todo lo que van a ver; el texto crudo solo sigue disponible en los GET unitarios
// y de listado, que lo mantienen por compatibilidad.
const resolverEstado = (documento) =>
  documento.estado_sifen ?? ESTADO_LEGACY_A_ENUM[documento.sifen_estado] ?? null;

module.exports = {
  esAprobado,
  esCancelado,
  esRechazado,
  resolverEstado,
};
