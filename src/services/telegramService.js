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

// Etiquetas por tipo de documento para el aviso de aprobación por lote (`notificarDocumentosAprobados`).
// Separado de `TIPO_DOC_LABEL` (que es el nombre suelto usado en las alertas de rechazo) porque acá el
// texto tiene que concordar en número y género con la cantidad aprobada.
const TIPO_DOC_APROBADO = {
    FACTURA: { titulo: 'Facturas aprobadas correctamente', singular: 'factura', plural: 'facturas', verboSingular: 'aprobó', verboPlural: 'aprobaron', todas: 'Todas las facturas del lote fueron aprobadas exitosamente.' },
    NOTA_CREDITO: { titulo: 'Notas de crédito aprobadas correctamente', singular: 'nota de crédito', plural: 'notas de crédito', verboSingular: 'aprobó', verboPlural: 'aprobaron', todas: 'Todas las notas de crédito del lote fueron aprobadas exitosamente.' },
};

// Tope de números listados en el mensaje. Un lote tiene como máximo `LOTE_MAX_DOCUMENTOS` (50,
// loteService.js) documentos, así que en la práctica nunca se recorta; está por si ese tope sube, para
// no acercarse al límite de 4096 caracteres de la Bot API (un mensaje más largo lo rechaza entero).
const MAX_NUMEROS_LISTADOS = 50;

// Fecha/hora local del servidor, formato dd/mm/aaaa hh:mm. Getters locales a propósito (mismo criterio
// que `formatearFechaEmision` en utils/sifen/cdc.js): el pie del aviso tiene que leerse en la hora de
// Paraguay, que es la del host donde corre el cron.
const formatearFechaHora = (fecha) => {
    const dosDigitos = (valor) => String(valor).padStart(2, '0');
    return `${dosDigitos(fecha.getDate())}/${dosDigitos(fecha.getMonth() + 1)}/${fecha.getFullYear()} ` +
        `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`;
};

/**
 * Avisa al grupo de Telegram que SIFEN aprobó documentos, **agrupado por lote** — un único mensaje por
 * pasada de `consultarLotes()` sobre un lote, no uno por documento (un lote son hasta 50 documentos: uno
 * por cada uno inundaría el grupo y haría que las alertas de rechazo, que sí requieren acción, se pierdan).
 * Contrapartida positiva de `notificarDocumentoRechazado`. Mismo criterio best-effort que el resto del
 * módulo: el caller siempre lo envuelve en su propio try/catch.
 * @param {Object} datos
 * @param {"FACTURA"|"NOTA_CREDITO"} datos.tipoDoc
 * @param {string[]} datos.numeros - Números impresos (formato `001-001-0000123`) recién aprobados
 * @param {number} datos.totalLote - Cantidad total de documentos del lote
 * @param {number} datos.aprobadosLote - Cuántos del lote están APROBADO en total (incluye los de pasadas previas)
 */
const notificarDocumentosAprobados = async ({ tipoDoc, numeros, totalLote, aprobadosLote }) => {
    const etiquetas = TIPO_DOC_APROBADO[tipoDoc] || TIPO_DOC_APROBADO.FACTURA;
    const cantidad = numeros.length;
    const esSingular = cantidad === 1;
    const sustantivo = esSingular ? etiquetas.singular : etiquetas.plural;
    const verbo = esSingular ? etiquetas.verboSingular : etiquetas.verboPlural;

    const listados = numeros.slice(0, MAX_NUMEROS_LISTADOS);
    const restantes = cantidad - listados.length;

    const lineas = [
        `✅ <b>${escaparHtml(etiquetas.titulo)}</b>`,
        '',
        `📄 Se ${verbo} <b>${cantidad} ${escaparHtml(sustantivo)}</b> en SIFEN:`,
        '',
        ...listados.map((numero) => `• <code>${escaparHtml(numero)}</code>`),
    ];
    if (restantes > 0) {
        lineas.push(`• … y ${restantes} más`);
    }

    lineas.push('');
    // El cierre distingue "el lote cerró entero" de "todavía quedan documentos sin aprobar" — sin esto,
    // un lote con rechazos se leería como si hubiera salido todo bien.
    if (aprobadosLote >= totalLote) {
        lineas.push(`🎉 <b>${escaparHtml(etiquetas.todas)}</b>`);
    } else {
        const pendientes = totalLote - aprobadosLote;
        // El sustantivo concuerda con el TOTAL del lote, no con los pendientes: se lee "1 de 3 facturas".
        lineas.push(`⚠️ <b>${pendientes} de ${totalLote}</b> ${escaparHtml(totalLote === 1 ? etiquetas.singular : etiquetas.plural)} del lote todavía sin aprobar (rechazadas, con error o en consulta).`);
    }

    lineas.push('', `🕒 ${formatearFechaHora(new Date())}`);

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
    notificarDocumentosAprobados,
    notificarFallaSistemica,
};
