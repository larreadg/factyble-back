const axios = require('axios');

/**
 * Reenvía al bot (WhatsApp) el resultado final de SIFEN para documentos cuya `fuente` es `BOT` —
 * el bot mantiene su propia tabla de "pendientes de avisar" al cliente final y hace el matching por
 * (empresaId, cdc). Llamada idempotente por diseño del lado del bot (ver contrato del endpoint):
 * reenviar el mismo { empresaId, cdc, estadoSifen } no genera un aviso duplicado, así que no hace
 * falta deduplicar acá.
 * @param {Object[]} documentos - Cada uno con { empresaId, cdc, estadoSifen, sifenEstadoMensaje }
 */
const bulkUpdateDocumentos = async (documentos) => {
    if (!documentos || documentos.length === 0) {
        return;
    }

    await axios.post(`${process.env.BOT_API_URL}/documento/bulk-update`, documentos, {
        headers: {
            'x-api-key': process.env.BOT_API_KEY,
            'Content-Type': 'application/json',
        },
    });
};

module.exports = {
    bulkUpdateDocumentos,
};
