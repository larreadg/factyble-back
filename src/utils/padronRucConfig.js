const path = require('path');

/**
 * Tamaño de lote para el INSERT ... ON DUPLICATE KEY UPDATE masivo. Centralizado acá para
 * poder ajustarlo sin tocar el servicio de persistencia. 5000 filas x 5 parámetros bindeados
 * por fila queda muy por debajo del límite de parámetros de una consulta preparada en MySQL.
 */
const BATCH_SIZE = parseInt(process.env.PADRON_RUC_BATCH_SIZE, 10) || 5000;

const MAX_ARCHIVOS = parseInt(process.env.PADRON_RUC_MAX_ARCHIVOS, 10) || 20;

const MAX_ARCHIVO_BYTES = parseInt(process.env.PADRON_RUC_MAX_ARCHIVO_BYTES, 10) || 200 * 1024 * 1024;

// Fuera de `public/` a propósito: son .zip transitorios, se borran apenas termina la importación.
const TEMP_DIR = path.resolve(
    __dirname, '..', '..',
    process.env.PADRON_RUC_TEMP_DIR || 'tmp/padron-ruc'
);

module.exports = {
    BATCH_SIZE,
    MAX_ARCHIVOS,
    MAX_ARCHIVO_BYTES,
    TEMP_DIR
};
