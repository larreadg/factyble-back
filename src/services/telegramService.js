const axios = require('axios');

const TIPO_DOC_LABEL = {
    FACTURA: 'Factura',
    NOTA_CREDITO: 'Nota de Crédito',
};

const ESTADO_EMOJI = {
    RECHAZADO: '🔴',
    ERROR: '⚠️',
};

const escaparHtml = (valor) =>
    String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

/**
 * Alerta al admin (grupo de Telegram) cuando una Factura o NotaCredito termina en `RECHAZADO`/`ERROR`
 * — distinto del reenvío a `botService` (WhatsApp), que le avisa al cliente final. Deliberadamente
 * síncrono/best-effort: el caller siempre lo envuelve en su propio try/catch (mismo criterio de
 * aislamiento que el resto de `loteService.js` — un fallo acá nunca debe interrumpir el pipeline SIFEN).
 * @param {Object} datos
 * @param {"FACTURA"|"NOTA_CREDITO"} datos.tipoDoc
 * @param {"RECHAZADO"|"ERROR"} datos.estado
 * @param {number|string} datos.numeroDocumento
 * @param {string} [datos.cdc]
 * @param {string} datos.empresaNombre
 * @param {string} datos.clienteNombre
 * @param {string} datos.clienteDocumento
 * @param {string} datos.motivo
 */
const notificarDocumentoRechazado = async ({
    tipoDoc,
    estado,
    numeroDocumento,
    cdc,
    empresaNombre,
    clienteNombre,
    clienteDocumento,
    motivo,
}) => {
    const emoji = ESTADO_EMOJI[estado] || '⚠️';
    const tipoLabel = TIPO_DOC_LABEL[tipoDoc] || tipoDoc;

    const lineas = [
        `${emoji} <b>${escaparHtml(tipoLabel)} ${escaparHtml(estado)}</b>`,
        '',
        `<b>Número:</b> ${escaparHtml(numeroDocumento)}`,
    ];
    if (cdc) {
        lineas.push(`<b>CDC:</b> <code>${escaparHtml(cdc)}</code>`);
    }
    lineas.push(
        `<b>Empresa:</b> ${escaparHtml(empresaNombre)}`,
        `<b>Cliente:</b> ${escaparHtml(clienteNombre)}`,
        `<b>Doc. cliente:</b> ${escaparHtml(clienteDocumento)}`,
        `<b>Motivo:</b> ${escaparHtml(motivo)}`
    );

    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: lineas.join('\n'),
        parse_mode: 'HTML',
    });
};

/**
 * Alerta al admin (grupo de Telegram) ante una falla que no es de un documento puntual sino del
 * propio pipeline/infraestructura — un cron entero que explotó, un certificado vencido, un evento de
 * cancelación rechazado. Mismo criterio de "best-effort" que `notificarDocumentoRechazado`: el caller
 * siempre lo envuelve en su propio try/catch.
 * @param {Object} datos
 * @param {string} datos.titulo - Encabezado corto (p. ej. "Cron caído", "Certificado vencido")
 * @param {string} datos.detalle - Texto libre con el detalle de la falla
 */
const notificarFallaSistemica = async ({ titulo, detalle }) => {
    const lineas = [`🚨 <b>${escaparHtml(titulo)}</b>`, '', escaparHtml(detalle)];

    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: lineas.join('\n'),
        parse_mode: 'HTML',
    });
};

module.exports = {
    notificarDocumentoRechazado,
    notificarFallaSistemica,
};
