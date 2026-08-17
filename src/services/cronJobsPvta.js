const cron = require('node-cron');
const procesarFacturaService = require('./procesarFacturaService');
const telegramService = require('./telegramService');

// Cron de la integración PVTA — módulo aparte de cronJobs.js (pipeline SIFEN); index.js lo registra
// junto al resto con ENTORNO=prod.
//
// Emite proactivamente las ventas de cliente SIN NOMBRE (cliente_ruc='x' en PVTA) como facturas
// INNOMINADAS: barre FACTYBLE_SIFEN_OUTBOX, toma hasta PVTA_INNOMINADO_BATCH ventas pendientes y las
// procesa. Corre cada 5 minutos. El endpoint POST /procesar-factura NO emite estos clientes (los excluye).

const BATCH = Number(process.env.PVTA_INNOMINADO_BATCH || 10);

// Un tick aislado en su propio try/catch (antipatrón Q: una falla nunca crashea el proceso). Si el job
// entero explota (no una venta puntual — eso lo aísla procesarInnominadosPendientes por venta — sino la
// corrida completa, p. ej. PVTA/MySQL caída o emisor mal configurado), se alerta por Telegram además de
// loguear, con el aviso a su vez aislado para no depender de que Telegram responda.
const ejecutarTick = async () => {
  const inicio = Date.now();
  console.log('[cronJobsPvta] procesarInnominados: inicio');
  try {
    const res = await procesarFacturaService.procesarInnominadosPendientes(BATCH);
    console.log(
      `[cronJobsPvta] procesarInnominados: fin (${Date.now() - inicio}ms) —`,
      JSON.stringify({ tomadas: res.tomadas, procesadas: res.procesadas, errores: res.errores })
    );
  } catch (error) {
    console.error(`[cronJobsPvta] procesarInnominados: error tras ${Date.now() - inicio}ms —`, error.message);
    try {
      await telegramService.notificarFallaSistemica({
        titulo: "Cron 'procesarInnominados' falló",
        detalle: `El job completo terminó en error tras ${Date.now() - inicio}ms: ${error.message}`,
      });
    } catch (errorTelegram) {
      console.error('[cronJobsPvta] Error al notificar a Telegram la falla del cron:', errorTelegram.message);
    }
  }
};

const cronJobsPvta = () => {
  cron.schedule('*/5 * * * *', ejecutarTick);
  console.log('[cronJobsPvta] cron de innominadas PVTA registrado (cada 5 min, batch ' + BATCH + ')');
};

module.exports = cronJobsPvta;
