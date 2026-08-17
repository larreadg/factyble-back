const { body } = require('express-validator');
const { validarCantidad } = require('../utils/facturacion');

// Para una factura innominada (consumidor final no identificado) los datos del receptor no aplican:
// el receptor se emite como "Sin Nombre" (SIFEN iTipIDRec=5). Cuando `innominado` es true se omiten las
// validaciones de personaDocumento/personaNombre/situacionTributaria.
const noInnominado = (value, { req }) => req.body.innominado !== true;

// Reglas de validación del body de una factura simple. Se extraen aquí para reutilizarlas tal cual en dos
// puntos: (1) la ruta POST /factura/simple (una factura por request) y (2) POST /factura/bulk-insert, donde
// se corren de forma imperativa (`.run(reqSintetico)`) contra cada elemento del array para que un ítem
// inválido produzca un resultado de error propio en el array espejo, sin abortar el resto del lote.
const validadoresFacturaSimple = [
    body('innominado', 'Parámetro innominado debe ser booleano').optional().isBoolean({ strict: true }),
    body('situacionTributaria', 'Parámetro situacionTributaria requerido').if(noInnominado).notEmpty().isIn([
        'CONTRIBUYENTE','NO_CONTRIBUYENTE'
    ]),
    body('personaDocumento', 'Parámetro personaDocumento requerido').if(noInnominado).notEmpty().isString(),
    body('personaNombre', 'Parámetro personaNombre requerido').if(noInnominado).notEmpty().isString(),
    body('personaEmail', 'Parámetro personaEmail inválido').optional({ checkFalsy: true }).isEmail(),
    body('condicionVenta', 'Parámetro condicionVenta requerido').notEmpty().isIn(['CONTADO', 'CREDITO']),
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
    .custom(v => ['string', 'number'].includes(typeof v)).customSanitizer(v => String(v)).isLength({ max: 255 }),
];

module.exports = { validadoresFacturaSimple, noInnominado };
