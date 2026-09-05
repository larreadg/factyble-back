const { body } = require('express-validator');
const { validarCantidad } = require('../utils/facturacion');
const { FUENTES_DOCUMENTO } = require('../utils/fuenteDocumento');

// Reglas de validación del body de una nota de crédito simple. Se extraen aquí para reutilizarlas tal cual en
// dos puntos: (1) la ruta POST /nota-credito/simple (una NC por request) y (2) POST /nota-credito/bulk-insert,
// donde se corren de forma imperativa (`.run(reqSintetico)`) contra cada elemento del array para que un ítem
// inválido produzca un resultado de error propio en el array espejo, sin abortar el resto del lote. Mismo
// criterio que validadoresFacturaSimple.
const validadoresNotaCreditoSimple = [
    body('cdc', 'Parámetro cdc requerido').notEmpty().isString(),
    body('items', 'Parámetro items requerido').isArray({min: 1}),
    body('items.*', 'Parámetros item requerido Object').isObject(),
    body('items.*.cantidad', 'Parámetro cantidad debe ser numérico > 0, máx 4 decimales').custom(validarCantidad),
    body('items.*.precioUnitario', 'Parámetro precioUnitario dentro de items requerido').isNumeric(),
    body('items.*.descripcion', 'Parámetro descripcion dentro de items requerido').isString().notEmpty(),
    body('items.*.tasa', 'Parámetro tasa dentro de items requerido').isIn(['0%','5%','10%']),
    body('establecimiento').optional({ checkFalsy: true }).matches(/^\d{3}$/)
    .withMessage('El parámetro establecimiento debe tener exactamente 3 dígitos entre 001 y 999')
    .custom(v => {
        const n = parseInt(v, 10)
        if(n < 1 || n > 999) return false
        return true
    }).withMessage('Parámetro establecimiento inválido'),
    body('caja').optional({ checkFalsy: true }).matches(/^\d{3}$/)
    .withMessage('El parámetro caja debe tener exactamente 3 dígitos entre 001 y 999')
    .custom(v => {
        const n = parseInt(v, 10)
        if(n < 1 || n > 999) return false
        return true
    }).withMessage('Parámetro caja inválido'),
    body('idExterno', 'Parámetro idExterno inválido').optional({ checkFalsy: true })
    .custom(v => ['string', 'number'].includes(typeof v)).customSanitizer(v => String(v).trim()).isLength({ max: 255 }),
    // `fuente` marca el origen del documento. Opcional: si no viene (o viene vacío) el service cae a
    // FUENTE_SIMPLE_POR_DEFECTO ("BOT"), que es el valor que estos endpoints escribían hardcodeado.
    // Ojo: no es solo una etiqueta — solo los documentos con fuente BOT se reenvían al bot de WhatsApp
    // con el resultado de SIFEN (loteService.notificarResultadoDocumento). Ver utils/fuenteDocumento.js.
    body('fuente', 'Parámetro fuente inválido, valores permitidos: APP, API, BOT')
        .optional({ checkFalsy: true }).isIn(FUENTES_DOCUMENTO),
];

module.exports = { validadoresNotaCreditoSimple };
