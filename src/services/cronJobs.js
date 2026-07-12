const cron = require('node-cron')
const loteService = require('./sifen/loteService')
const certificadoService = require('./sifen/certificadoService')
const trazabilidadService = require('./sifen/trazabilidadService')
const correoService = require('./correoService')

/**
 * Ejecuta un job de cron con trazabilidad de inicio/fin/duración en consola — cada job sigue quedando
 * aislado en su propio try/catch (una falla acá nunca debe crashear el proceso ni bloquear otros jobs).
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
    }
}

/**
 * Jobs del pipeline nativo SIFEN (MIGRATION_PLAN.md §3.4). `facturaService.js`/
 * `notaDeCreditoService.js` fueron reescritos (Fase 5) para emitir a través de `loteService`/
 * `eventoService` y ya setean `estado_sifen = 'GENERADO'` al crear un documento — estos jobs son
 * ahora el único camino de envío/consulta a SIFEN. El sync legacy contra la API PHP
 * (`checkFacturaStatus`/`dbApiFacturacion.js`) se eliminó en el corte, junto con `apiFacturacionElectronica*`.
 */
const cronJobsSifen = () => {
    // armarYEnviarLotes: build + send, único camino de emisión — aislado por lote y por empresa
    // dentro de loteService (antipatrón Q).
    cron.schedule('*/5 * * * *', () => ejecutarJob('armarYEnviarLotes', async () => {
        await loteService.armarLotes()
        await loteService.enviarLotesConstruidos()
    }))

    cron.schedule('*/5 * * * *', () => ejecutarJob('consultarLotes', () => loteService.consultarLotes()))

    cron.schedule('0 * * * *', () => ejecutarJob('consultaIndividualRedDeSeguridad', () => loteService.consultaIndividualRedDeSeguridad()))

    // alertaCertificadosPorVencer: recalcula estado y devuelve los certificados POR_VENCER/VENCIDO.
    // Siempre queda registrado en el log del servidor (no depende de que el correo esté configurado);
    // si `SIFEN_ALERTA_EMAIL` está seteada, además envía un correo al administrador (AUD-014,
    // STATIC_AUDIT_FINDINGS.json — antes solo llegaba a console.warn). El envío de correo está aislado
    // en su propio try/catch para no bloquear el resto del pipeline si el SMTP falla.
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