/**
 * Mapa de interpretación de códigos de respuesta de negocio de SIFEN (`dCodRes`), MIGRATION_PLAN.md
 * §3.5. Solo interpreta códigos que llegaron dentro de una respuesta SOAP ya resuelta —
 * `sifenClientService` nunca rechaza la Promise ante un código de negocio, solo ante fallas de
 * transporte/parseo (timeout, red, 5xx, respuesta no-XML). Esas fallas de transporte NO pasan por
 * acá: `loteService`/`eventoService` las atrapan directamente (catch del `ErrorApp` que lanza
 * `sifenClientService`) y las tratan como reintentables sin necesidad de este mapa.
 *
 * NO INVENTAR CÓDIGOS (instrucción explícita de MIGRATION_PLAN.md §3.2) — cada entrada de este mapa
 * está sourceada, no adivinada:
 * - "0142": ya documentado en MIGRATION_PLAN.md desde el inicio del proyecto (motivo original de esta
 *   migración — certificado no asociado/vencido para el RUC emisor).
 * - "0260", "0300", "0301": confirmados contra documentación oficial de la SET/DNIT (Manual Técnico
 *   SIFEN v150 y "Guía de Mejores Prácticas para la Gestión del Envío de DE", ambos publicados en
 *   dnit.gov.py) vía búsqueda dirigida — no inventados, ver MIGRATION_PLAN.md "Estado de
 *   implementación" para el detalle de la verificación.
 *
 * Para ampliar este mapa: consultar el Manual Técnico oficial (dnit.gov.py), nunca adivinar un
 * código nuevo.
 */

const CATEGORIA = {
  APROBADO: "APROBADO",
  RECHAZADO: "RECHAZADO",
  REINTENTABLE: "REINTENTABLE",
  // No es un resultado final por sí solo (p. ej. lote encolado, todavía sin resolver) — no dispara
  // ninguna transición de estado en el documento/lote, solo se persiste para trazabilidad.
  INFORMATIVO: "INFORMATIVO",
};

const CODIGOS_RESPUESTA = {
  "0142": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "Certificado no asociado o vencido para el RUC emisor — no reintentar tal cual, requiere " +
      "intervención manual (renovar o asociar el certificado correcto antes de reenviar).",
  },
  // Nivel documento (dentro de gResProcLoteDe de consultaLote, o de una consulta individual por CDC).
  "0260": {
    categoria: CATEGORIA.APROBADO,
    alertar: false,
    mensajeInterno: "Documento autorizado (aprobado) por SIFEN.",
  },
  // Nivel lote/sobre (respuesta de recibeLote).
  "0300": {
    categoria: CATEGORIA.INFORMATIVO,
    alertar: false,
    mensajeInterno:
      "Lote recibido con éxito por SIFEN, encolado para procesamiento asíncrono " +
      "(dProtConsLote disponible para consultarLote más adelante) — todavía no es un resultado final.",
  },
  "0301": {
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno:
      "Lote no encolado para procesamiento (rechazado a nivel de sobre/envoltorio, p. ej. ZIP o XML " +
      "malformado) — no reintentar el mismo envío tal cual, requiere revisar el error antes de reenviar.",
  },
};

/**
 * Interpreta un código de respuesta de SIFEN. Códigos desconocidos (no mapeados arriba) se tratan
 * como RECHAZADO — no REINTENTABLE — porque ya es una respuesta de negocio resuelta (no una falla de
 * transporte): reintentar el mismo documento sin cambios muy probablemente repite el mismo resultado.
 * Siempre se marca `alertar: true` para códigos desconocidos, para que un humano agregue el código a
 * este mapa consultando el Manual Técnico oficial (nunca inventarlo acá).
 * @param {string|number|null|undefined} codigo - Código crudo devuelto por SIFEN (`dCodRes`)
 * @returns {{codigo: string|null, conocido: boolean, categoria: string, alertar: boolean, mensajeInterno: string}}
 */
const interpretarCodigo = (codigo) => {
  const codigoNormalizado = codigo === null || codigo === undefined || codigo === "" ? null : String(codigo);
  const entrada = codigoNormalizado ? CODIGOS_RESPUESTA[codigoNormalizado] : undefined;

  if (entrada) {
    return { codigo: codigoNormalizado, conocido: true, ...entrada };
  }

  return {
    codigo: codigoNormalizado,
    conocido: false,
    categoria: CATEGORIA.RECHAZADO,
    alertar: true,
    mensajeInterno: codigoNormalizado
      ? `Código de respuesta SIFEN "${codigoNormalizado}" no está mapeado en codigosRespuesta.js — ` +
        "agregarlo consultando el Manual Técnico oficial antes de asumir su categoría."
      : "Respuesta de SIFEN sin código de resultado (dCodRes ausente) — revisar la respuesta cruda " +
        "persistida en SifenTrazabilidad para diagnosticar.",
  };
};

/**
 * Atajo para el caso más común: ¿este código representa un documento aprobado por SIFEN?
 * @param {string|number|null|undefined} codigo
 * @returns {boolean}
 */
const esAprobado = (codigo) => interpretarCodigo(codigo).categoria === CATEGORIA.APROBADO;

module.exports = {
  CATEGORIA,
  CODIGOS_RESPUESTA,
  interpretarCodigo,
  esAprobado,
};
