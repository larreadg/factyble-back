const prisma = require("../../prisma/cliente");
const ErrorApp = require("../../utils/error");
const xmlBuilderService = require("./xmlBuilderService");
const firmadorService = require("./firmadorService");
const certificadoService = require("./certificadoService");
const sifenClientService = require("./sifenClientService");
const trazabilidadService = require("./trazabilidadService");
const { interpretarCodigo, CATEGORIA } = require("../../utils/sifen/codigosRespuesta");
const { extraerCodigoYMensaje, extraerProtocoloAutorizacion } = require("../../utils/sifen/respuestaSoap");
const { esAprobado } = require("../../utils/sifen/estadoHistorico");

/**
 * Eventos SIFEN (MIGRATION_PLAN.md §3.1/§3.2) — solo Cancelación implementada (Decisión cerrada,
 * alcance de eventos). Camino **síncrono** contra `evento.wsdl`, no pasa por `loteService` (SIFEN no
 * ofrece envío de eventos por lote).
 *
 * Guarda de estado antes de cancelar: el documento debe estar `estado_sifen = APROBADO`. Generaliza
 * el patrón que ya existía en `notaDeCreditoService.js:69-71` (chequeo de `sifen_estado` contra la API
 * PHP legacy) al nuevo pipeline nativo — corrige el antipatrón W de `src/` (v2), que no validaba nada
 * antes de cancelar.
 */

const TIPOS_DOCUMENTO = {
  FACTURA: {
    entidadTipo: "FACTURA",
    modelo: () => prisma.factura,
    campoEventoId: "factura_id",
    include: { caja: { include: { establecimiento: { include: { empresa: true } } } } },
  },
  NOTA_CREDITO: {
    entidadTipo: "NOTA_CREDITO",
    modelo: () => prisma.notaCredito,
    campoEventoId: "nota_credito_id",
    include: { caja: { include: { establecimiento: { include: { empresa: true } } } } },
  },
};

const generarDId = () => Date.now();

/**
 * Cancela un documento (Factura o NotaCredito) ante SIFEN. Orquesta en cadena todo lo ya construido:
 * `xmlBuilderService.construirXmlEventoCancelacion` -> `firmadorService.firmarXmlEvento` ->
 * `certificadoService.obtenerCertificadoActivo` (certificado de la empresa dueña del documento) ->
 * `sifenClientService.evento` -> `trazabilidadService.registrarInteraccion`.
 *
 * El registro `EventoSifen` se crea *antes* de llamar a SIFEN (con el XML sin firmar todavía) y se va
 * completando a medida que avanza el pipeline — así, si el proceso se cae a mitad de camino, queda un
 * registro consultable de que hubo un intento de cancelación, en vez de una llamada "fantasma" que no
 * dejó rastro (mismo espíritu que el antipatrón P documentado en MIGRATION_PLAN.md).
 * @param {"FACTURA"|"NOTA_CREDITO"} tipoDoc
 * @param {number} documentoId - Id de la Factura o NotaCredito a cancelar
 * @param {string} motivo - Motivo de la cancelación (5 a 500 caracteres, exigido por SIFEN)
 * @returns {Promise<{eventoId: number, estadoSifen: string, codigoRespuesta: string|null, mensajeRespuesta: string|null}>}
 */
const cancelarDocumento = async (tipoDoc, documentoId, motivo) => {
  const config = TIPOS_DOCUMENTO[tipoDoc];
  try {
    const documento = await config.modelo().findFirst({
      where: { id: documentoId },
      include: config.include,
    });

    if (!documento) {
      throw new ErrorApp(`${tipoDoc} no encontrada`, 404);
    }
    // esAprobado cubre también el documento histórico (estado_sifen NULL + sifen_estado='Aprobado'
    // legacy, ver AUD-001 en STATIC_AUDIT_FINDINGS.json) — sin esto, ningún documento emitido antes
    // del corte a este pipeline podía cancelarse nunca.
    if (!esAprobado(documento)) {
      throw new ErrorApp(
        `Solo se puede cancelar un documento en estado APROBADO (estado actual: ${documento.estado_sifen ?? documento.sifen_estado ?? "sin definir"})`,
        400
      );
    }
    if (!documento.caja) {
      throw new ErrorApp(`${tipoDoc} id=${documentoId} no tiene caja asignada, no se puede cancelar`, 400);
    }

    const empresa = documento.caja.establecimiento.empresa;
    const id = generarDId();

    const evento = await prisma.eventoSifen.create({
      data: {
        empresa_id: empresa.id,
        tipo_evento: "CANCELACION",
        [config.campoEventoId]: documentoId,
        motivo,
      },
    });

    try {
      const certificado = await certificadoService.obtenerCertificadoActivo({ empresaId: empresa.id });
      const xmlSinFirmar = await xmlBuilderService.construirXmlEventoCancelacion({ id, cdc: documento.cdc, motivo });
      const xmlFirmado = await firmadorService.firmarXmlEvento({
        xml: xmlSinFirmar,
        certificadoPath: certificado.archivo,
        certificadoPassword: certificado.clave,
      });

      await prisma.eventoSifen.update({ where: { id: evento.id }, data: { xml_firmado: xmlFirmado } });

      const respuesta = await sifenClientService.evento({
        id,
        xml: xmlFirmado,
        certificadoPath: certificado.archivo,
        certificadoPassword: certificado.clave,
      });

      const { codigo, mensaje } = extraerCodigoYMensaje(respuesta);
      const interpretacion = interpretarCodigo(codigo);
      const exitoso = interpretacion.categoria === CATEGORIA.APROBADO;

      await trazabilidadService.registrarInteraccion({
        entidadTipo: "EVENTO",
        entidadId: evento.id,
        operacion: "EVENTO",
        request: xmlFirmado,
        response: respuesta,
        codigoRespuesta: interpretacion.codigo,
        exitoso,
      });

      await prisma.eventoSifen.update({
        where: { id: evento.id },
        data: {
          sifen_respuesta_codigo: interpretacion.codigo,
          sifen_respuesta_mensaje: mensaje || null,
          sifen_respuesta_xml: typeof respuesta === "string" ? respuesta : JSON.stringify(respuesta),
          // dProtAut, generado por SIFEN para cada evento registrado (dCodRes=0600) — Manual §9.5.3.
          secuencia_sifen: extraerProtocoloAutorizacion(respuesta) || null,
        },
      });

      if (exitoso) {
        await config.modelo().update({ where: { id: documentoId }, data: { estado_sifen: "CANCELADO" } });
      } else if (interpretacion.alertar) {
        console.error(`[eventoService] SIFEN rechazo la cancelacion de ${tipoDoc} id=${documentoId} (codigo ${interpretacion.codigo}): ${interpretacion.mensajeInterno} — SIFEN dijo: ${mensaje}`);
      }

      return {
        eventoId: evento.id,
        estadoSifen: exitoso ? "CANCELADO" : documento.estado_sifen,
        codigoRespuesta: interpretacion.codigo,
        mensajeRespuesta: mensaje || null,
      };
    } catch (error) {
      // Falla de transporte (timeout/red) o de firma/certificado: se deja registrado en el propio
      // EventoSifen (mismos campos de reintento que Lote, §3.3) para diagnóstico — no hay todavía un
      // cron que reintente eventos fallidos automáticamente (no está en la tabla de jobs de §3.4,
      // solo `Lote` tiene reintento automático hoy), así que el error se relanza al caller síncrono
      // (facturaService/notaDeCreditoService), que hoy ya maneja errores de cancelación de la misma
      // forma con la API PHP legacy.
      await trazabilidadService.registrarInteraccion({
        entidadTipo: "EVENTO",
        entidadId: evento.id,
        operacion: "EVENTO",
        request: null,
        response: null,
        exitoso: false,
      });
      await prisma.eventoSifen.update({
        where: { id: evento.id },
        data: { intentos_envio: { increment: 1 }, ultimo_error: error.message },
      });
      throw error;
    }
  } catch (error) {
    ErrorApp.handleServiceError(error, `Error al cancelar la ${tipoDoc === "FACTURA" ? "Factura" : "Nota de Credito"}`);
  }
};

/**
 * Cancela una Factura.
 * @param {Object} datos
 * @param {number} datos.facturaId
 * @param {string} datos.motivo
 */
const cancelarFactura = async ({ facturaId, motivo }) => cancelarDocumento("FACTURA", facturaId, motivo);

/**
 * Cancela una Nota de Crédito.
 * @param {Object} datos
 * @param {number} datos.notaCreditoId
 * @param {string} datos.motivo
 */
const cancelarNotaCredito = async ({ notaCreditoId, motivo }) => cancelarDocumento("NOTA_CREDITO", notaCreditoId, motivo);

module.exports = {
  cancelarFactura,
  cancelarNotaCredito,
};
