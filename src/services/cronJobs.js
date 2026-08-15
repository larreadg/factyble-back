const cron = require('node-cron')
const loteService = require('./sifen/loteService')
const certificadoService = require('./sifen/certificadoService')
const trazabilidadService = require('./sifen/trazabilidadService')
const correoService = require('./correoService')
const telegramService = require('./telegramService')

/**
 * Ejecuta un job de cron con trazabilidad de inicio/fin/duración en consola — cada job sigue quedando
 * aislado en su propio try/catch (una falla acá nunca debe crashear el proceso ni bloquear otros jobs).
 * Si el job entero explota (no ya un documento/lote aislado — eso lo maneja cada servicio por su
 * cuenta — sino el job completo, p. ej. un bug o la base de datos caída), es el último punto antes de
 * quedar completamente invisible: se alerta por Telegram además de loguear, aislado en su propio
 * try/catch (si Telegram también falla, al menos queda el log).
 * @param {string} nombre
 * @param {() => Promise<void>} tarea
 */
const ejecutarJob = async (nombre, tarea) => {
    const inicio = Date.now()
    console.log(`[cronJobs] ${nombre}: inicio`)
    try {
        await tarea()
        console.log(`[cronJobs] ${nombre}: fin (${Date.now() - inicio}ms)`)
    } catch (error) {
        console.error(`[cronJobs] ${nombre}: error tras ${Date.now() - inicio}ms —`, error.message)
        try {
            await telegramService.notificarFallaSistemica({
                titulo: `Cron '${nombre}' falló`,
                detalle: `El job completo terminó en error tras ${Date.now() - inicio}ms: ${error.message}`,
            })
        } catch (errorTelegram) {
            console.error(`[cronJobs] Error al notificar a Telegram la falla del cron '${nombre}':`, errorTelegram.message)
        }
    }
}

/**
 * Jobs del pipeline nativo SIFEN. `facturaService.js`/
 * `notaDeCreditoService.js` fueron reescritos (Fase 5) para emitir a través de `loteService`/
 * `eventoService` y ya setean `estado_sifen = 'GENERADO'` al crear un documento — estos jobs son
 * ahora el único camino de envío/consulta a SIFEN. El sync legacy contra la API PHP
 * (`checkFacturaStatus`/`dbApiFacturacion.js`) se eliminó en el corte, junto con `apiFacturacionElectronica*`.
 */
const cronJobsSifen = () => {
    // armarYEnviarLotes y consultarLotes corren cada 2min 30s (150s). Un intervalo de 150s NO es
    // expresable como patrón cron (los campos de segundos y minutos son independientes: los disparos
    // caen en 00:00, 02:30, 05:00, 07:30… alternando segundos y sin avance fijo de minutos), por eso
    // se usa setInterval en vez de cron.schedule. Cada tick sigue aislado en su propio try/catch vía
    // ejecutarJob (antipatrón Q — una falla nunca crashea el proceso ni bloquea otros jobs).
    const INTERVALO_EMISION_MS = 150000 // 2min 30s

    // armarYEnviarLotes: build + send, único camino de emisión — aislado por lote y por empresa
    // dentro de loteService.
    setInterval(() => ejecutarJob('armarYEnviarLotes', async () => {
        await loteService.armarLotes()
        await loteService.enviarLotesConstruidos()
    }), INTERVALO_EMISION_MS)

    setInterval(() => ejecutarJob('consultarLotes', () => loteService.consultarLotes()), INTERVALO_EMISION_MS)

    cron.schedule('0 * * * *', () => ejecutarJob('consultaIndividualRedDeSeguridad', () => loteService.consultaIndividualRedDeSeguridad()))

    // alertaCertificadosPorVencer: recalcula estado y devuelve los certificados POR_VENCER/VENCIDO.
    // Siempre queda registrado en el log del servidor (no depende de que el correo esté configurado);
    // si `SIFEN_ALERTA_EMAIL` está seteada, además envía un correo al administrador (AUD-014,
    // STATIC_AUDIT_FINDINGS.json — antes solo llegaba a console.warn). Además se alerta por Telegram
    // (un certificado vencido bloquea toda la emisión de la empresa — es de las fallas más graves del
    // pipeline y antes no llegaba al grupo). Correo y Telegram están aislados cada uno en su propio
    // try/catch para no bloquear el resto del pipeline ni depender uno del otro.
    cron.schedule('0 6 * * *', () => ejecutarJob('alertaCertificadosPorVencer', async () => {
        const porAlertar = await certificadoService.actualizarEstadosPorVencimiento()
        if (porAlertar.length > 0) {
            console.warn('[cronJobs] Certificados por vencer o vencidos:', porAlertar.map((c) => ({ id: c.id, empresa_id: c.empresa_id, estado: c.estado, fecha_vencimiento: c.fecha_vencimiento })))

            const destinatario = process.env.SIFEN_ALERTA_EMAIL
            if (destinatario) {
                try {
                    await correoService.enviarAlertaCertificadosPorVencer({ destinatario, certificados: porAlertar })
                } catch (errorCorreo) {
                    console.error('[cronJobs] Error al enviar la alerta de certificados por correo:', errorCorreo.message)
                }
            } else {
                console.warn('[cronJobs] SIFEN_ALERTA_EMAIL no configurada — la alerta de certificados solo queda en el log')
            }

            try {
                const detalle = porAlertar
                    .map((c) => `empresa_id=${c.empresa_id}: ${c.estado} (vence ${c.fecha_vencimiento.toISOString().slice(0, 10)})`)
                    .join('\n')
                await telegramService.notificarFallaSistemica({
                    titulo: `${porAlertar.length} certificado(s) por vencer o vencido(s)`,
                    detalle,
                })
            } catch (errorTelegram) {
                console.error('[cronJobs] Error al notificar a Telegram la alerta de certificados:', errorTelegram.message)
            }
        } else {
            console.log('[cronJobs] alertaCertificadosPorVencer: sin certificados por vencer o vencidos')
        }
    }))

    cron.schedule('0 3 * * 0', () => ejecutarJob('limpiezaTrazabilidad', () => trazabilidadService.limpiezaTrazabilidad()))
}

const cronJobs = () => {

    cronJobsSifen()

}

module.exports = cronJobs