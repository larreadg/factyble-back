const prisma = require("../../prisma/cliente");
const ErrorApp = require("../../utils/error");

/**
 * Trazabilidad request/response de toda interacción con SIFEN (MIGRATION_PLAN.md §3.2/§3.5) —
 * v1/v2 no tienen ningún registro de esto, lo que hace imposible diagnosticar después del hecho
 * un rechazo como el error 0142. `registrarInteraccion` es la función central: ningún llamado a
 * SIFEN (`sifenClientService.recibeLote/evento/consultaLote/consulta/consultaRuc`, ni la firma vía
 * `firmadorService`) debe hacerse sin pasar por acá — responsabilidad de `loteService`/
 * `eventoService` (todavía no implementados), no de este módulo.
 *
 * Este módulo no interpreta el contenido de la respuesta de SIFEN (`codigoRespuesta`/`exitoso` los
 * decide el caller, típicamente con ayuda de `codigosRespuesta.js`, todavía no implementado) — solo
 * persiste lo que se le pasa.
 */
const RETENCION_DIAS_DEFAULT = 90;

/**
 * Serializa un payload (request u response) a texto para persistir en una columna
 * `@db.MediumText`. Los payloads de request suelen ser el XML/SOAP ya armado (string); los de
 * response suelen ser el body SOAP ya parseado por `sifenClientService` (objeto JS) — se acepta
 * cualquiera de los dos sin que el caller tenga que serializar a mano.
 * @param {string|Object|null|undefined} payload
 * @returns {string|null}
 */
const serializarPayload = (payload) => {
  if (payload === null || payload === undefined) {
    return null;
  }
  return typeof payload === "string" ? payload : JSON.stringify(payload);
};

/**
 * Registra una interacción completa con SIFEN (request + response + resultado). Función central
 * de trazabilidad — ver nota de módulo arriba.
 * @param {Object} datos
 * @param {"FACTURA"|"NOTA_CREDITO"|"LOTE"|"EVENTO"} datos.entidadTipo - Tipo de entidad sobre la que se operó
 * @param {number} datos.entidadId - Id de esa entidad (`Factura.id`, `NotaCredito.id`, `Lote.id` o `EventoSifen.id`)
 * @param {"FIRMA"|"ENVIO_LOTE"|"CONSULTA_LOTE"|"CONSULTA_DOCUMENTO"|"EVENTO"} datos.operacion - Operación realizada
 * @param {string|Object} [datos.request] - Payload enviado (XML/SOAP como string, u objeto — se serializa)
 * @param {string|Object} [datos.response] - Payload recibido (XML/SOAP como string, u objeto ya parseado — se serializa)
 * @param {string} [datos.codigoRespuesta] - Código de respuesta de SIFEN, crudo, si aplica
 * @param {boolean} datos.exitoso - Si la interacción se considera exitosa (lo decide el caller)
 * @returns {Promise<Object>} - Registro de `SifenTrazabilidad` creado
 */
const registrarInteraccion = async ({ entidadTipo, entidadId, operacion, request, response, codigoRespuesta, exitoso }) => {
  try {
    return await prisma.sifenTrazabilidad.create({
      data: {
        entidad_tipo: entidadTipo,
        entidad_id: entidadId,
        operacion,
        request_payload: serializarPayload(request),
        response_payload: serializarPayload(response),
        codigo_respuesta: codigoRespuesta ?? null,
        exitoso,
      },
    });
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al registrar la interaccion de trazabilidad SIFEN");
  }
};

/**
 * Devuelve el historial de interacciones SIFEN de una entidad puntual (p. ej. para diagnosticar
 * un rechazo como el 0142 después del hecho, ver §3.5), más reciente primero.
 * @param {Object} datos
 * @param {"FACTURA"|"NOTA_CREDITO"|"LOTE"|"EVENTO"} datos.entidadTipo
 * @param {number} datos.entidadId
 * @returns {Promise<Object[]>}
 */
const obtenerTrazabilidadPorEntidad = async ({ entidadTipo, entidadId }) => {
  try {
    return await prisma.sifenTrazabilidad.findMany({
      where: { entidad_tipo: entidadTipo, entidad_id: entidadId },
      orderBy: { fecha_creacion: "desc" },
    });
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al obtener la trazabilidad SIFEN de la entidad");
  }
};

/**
 * Purga registros de `SifenTrazabilidad` más allá del período de retención configurado
 * (`SIFEN_TRAZABILIDAD_RETENCION_DIAS`, default 90 días) — pensada para el cron
 * `limpiezaTrazabilidad` (§3.4, semanal; el registro del cron en si queda para cuando se conecte
 * el resto de Fase 3/4 a `src/services/cronJobs.js`).
 * @returns {Promise<number>} - Cantidad de registros eliminados
 */
const limpiezaTrazabilidad = async () => {
  try {
    const retencionDias = Number(process.env.SIFEN_TRAZABILIDAD_RETENCION_DIAS) || RETENCION_DIAS_DEFAULT;
    const limite = new Date(Date.now() - retencionDias * 24 * 60 * 60 * 1000);

    const { count } = await prisma.sifenTrazabilidad.deleteMany({
      where: { fecha_creacion: { lt: limite } },
    });
    return count;
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al purgar la trazabilidad SIFEN por retencion");
  }
};

module.exports = {
  registrarInteraccion,
  obtenerTrazabilidadPorEntidad,
  limpiezaTrazabilidad,
};
