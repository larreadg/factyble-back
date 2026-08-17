const routes = require('express').Router();
const notaDeCreditoController = require('../controllers/notaDeCreditoController');
const { body, query, param } = require('express-validator');
const { authJwt } = require('../middleware/authJwt');
const { validarFields } = require('../utils/fields');
const { CAMPOS_NOTA_CREDITO } = require('../services/notaDeCreditoService');
const { validarCantidad } = require('../utils/facturacion');
const { validadoresNotaCreditoSimple } = require('../validators/notaCreditoSimpleValidators');

routes.post(
    '/',
    authJwt(['ADMIN']),
    body('cdc', 'Parámetro cdc requerido').notEmpty().isString(),
    body('items', 'Parámetro items requerido').isArray({min: 1}),
    body('items.*', 'Parámetros item requerido Object').isObject(),
    body('items.*.cantidad', 'Parámetro cantidad debe ser numérico > 0, máx 4 decimales').custom(validarCantidad),
    body('items.*.precioUnitario', 'Parámetro precioUnitario dentro de items requerido').isNumeric(),
    body('items.*.descripcion', 'Parámetro descripcion dentro de items requerido').isString().notEmpty(),
    body('items.*.tasa', 'Parámetro tasa dentro de items requerido').isIn(['0%','5%','10%']),
    body('establecimiento').matches(/^\d{3}$/)
    .withMessage('El parámetro establecimiento debe tener exactamente 3 dígitos entre 001 y 999')
    .custom(v => {
        const n = parseInt(v, 10)
        if(n < 1 || n > 999) return false
        return true
    }).withMessage('Parámetro establecimiento inválido'),
    body('caja').matches(/^\d{3}$/)
    .withMessage('El parámetro caja debe tener exactamente 3 dígitos entre 001 y 999')
    .custom(v => {
        const n = parseInt(v, 10)
        if(n < 1 || n > 999) return false
        return true
    }).withMessage('Parámetro caja inválido'),
    body('idExterno', 'Parámetro idExterno inválido').optional({ checkFalsy: true })
    .custom(v => ['string', 'number'].includes(typeof v)).customSanitizer(v => String(v)).isLength({ max: 255 }),
    notaDeCreditoController.emitirNotaDeCredito
)

routes.post(
    '/simple',
    authJwt(['ADMIN']),
    ...validadoresNotaCreditoSimple,
    notaDeCreditoController.emitirNotaDeCreditoSimple
)

// Alta masiva: el body es un array con exactamente el mismo shape que POST /nota-credito/simple por elemento.
// La validación de cada NC se corre por ítem dentro del service (array espejo), por eso aquí sólo se valida el
// contenedor: que sea un array no vacío y acotado. La respuesta es un array de resultados en el mismo orden que
// la entrada, donde cada elemento indica éxito o error de esa NC en particular.
routes.post(
    '/bulk-insert',
    authJwt(['ADMIN']),
    body('', 'El body debe ser un array de notas de crédito (1 a 100)').isArray({ min: 1, max: 100 }),
    notaDeCreditoController.emitirNotasDeCreditoBulk
)

routes.get(
    '/',
    authJwt(['ADMIN']),
    query('fields').optional().isString().bail().custom(validarFields(CAMPOS_NOTA_CREDITO)),
    notaDeCreditoController.getNotasDeCredito
)

routes.get(
    '/id-externo/:id',
    authJwt(['ADMIN']),
    param('id', 'Parámetro :id requerido').isString().notEmpty().isLength({ max: 255 }),
    query('fields').optional().isString().bail().custom(validarFields(CAMPOS_NOTA_CREDITO)),
    notaDeCreditoController.getNotaDeCreditoByIdExterno
)

routes.post(
    '/cancelar',
    authJwt(['ADMIN']),
    body('notaDeCreditoId', 'Parámetro notaDeCreditoId requerido').isInt({min: 1}),
    body('motivo', 'Parámetro motivo requerido').isString().notEmpty(),
    notaDeCreditoController.cancelarNotaDeCredito
);

routes.post(
    '/simple/cancelar',
    authJwt(['ADMIN']),
    body('cdc').matches(/^\d{44}$/).withMessage('Parámetro cdc inválido, debe ser numérico de 44 dígitos'),
    notaDeCreditoController.cancelarNotaDeCreditoSimple
);

routes.post(
    '/reenviar',
    authJwt(['ADMIN']),
    body('email').isEmail().withMessage('Parámetro email requerito'),
    body('notaDeCreditoId', 'Parámetro notaDeCreditoId requerido').isInt().notEmpty(),
    notaDeCreditoController.reenviarNotaDeCredito
)

routes.post(
    '/reintentar-sifen',
    authJwt(['ADMIN']),
    body('caja').matches(/^\d{3}$/).withMessage('El parámetro caja debe tener exactamente 3 dígitos entre 001 y 999'),
    body('notaCredito', 'Parámetro notaCredito requerido').isInt({min: 1}),
    notaDeCreditoController.reintentarEnvioSifen
);

module.exports = routes