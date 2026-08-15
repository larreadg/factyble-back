const routes = require('express').Router();
const { body, param, query } = require('express-validator');
const facturaController = require('../controllers/facturaController');
const { authJwt } = require('../middleware/authJwt');
const { validarFields } = require('../utils/fields');
const { CAMPOS_FACTURA } = require('../services/facturaService');
const { validarCantidad } = require('../utils/facturacion');

// Para una factura innominada (consumidor final no identificado) los datos del receptor no aplican:
// el receptor se emite como "Sin Nombre" (SIFEN iTipIDRec=5). Cuando `innominado` es true se omiten las
// validaciones de ruc/razonSocial/situacionTributaria/email.
const noInnominado = (value, { req }) => req.body.innominado !== true;

routes.post(
    '/',
    authJwt(['ADMIN']),
    body('innominado', 'Parámetro innominado debe ser booleano').optional().isBoolean({ strict: true }),
    body('ruc', 'Parámetro ruc requerido').if(noInnominado).notEmpty().isString(),
    body('razonSocial', 'Parámetro razonSocial requerido').if(noInnominado).notEmpty().isString(),
    body('situacionTributaria', 'Parámetro situacionTributaria requerido').if(noInnominado).notEmpty().isIn([
        'CONTRIBUYENTE','NO_CONTRIBUYENTE','NO_DOMICILIADO'
    ]),
    body('condicionVenta', 'Parámetro condicionVenta requerido').isIn(['CONTADO', 'CREDITO']),
    body('direccion', 'Parámetro direccion requerido').optional().isString(),
    body('email', 'Parámetro email requerido').if(noInnominado).isEmail(),
    body('items', 'Parámetro items requerido').isArray({min: 1}),
    body('items.*', 'Parámetros item requerido Object').isObject(),
    body('items.*.cantidad', 'Parámetro cantidad debe ser numérico > 0, máx 4 decimales').custom(validarCantidad),
    body('items.*.precioUnitario', 'Parámetro precioUnitario dentro de items requerido').isNumeric(),
    body('items.*.descripcion', 'Parámetro descripcion dentro de items requerido').isString().notEmpty(),
    body('items.*.tasa', 'Parámetro tasa dentro de items requerido').isIn(['0%','5%','10%']),
    body('tipoCredito', 'Parámetro tipoCredito requerido').custom((tipoCredito, { req: { body }}) => {
        if(body && body.condicionVenta == 'CONTADO') return true;
        if(body && body.condicionVenta == 'CREDITO'){
            return tipoCredito && ['CUOTA', 'A_PLAZO'].includes(tipoCredito);
        }
        return false;
    }),
    body('periodicidad', 'Parámetro periodicidad requerido').custom((periodicidad, { req: { body }}) => {
        if(body && body.condicionVenta == 'CONTADO') return true;
        if(body && body.condicionVenta == 'CREDITO'){
            return periodicidad && ['SEMANAL','QUINCENAL','MENSUAL','TRIMESTRAL','SEMESTRAL','ANUAL'].includes(periodicidad);
        }
        return false;
    }),
    body('cantidadCuota', 'Parámetro cantidadCuota requerido').custom((cantidadCuota, { req: { body }}) => {
        if(body && body.condicionVenta == 'CONTADO') return true;
        if(body && body.tipoCredito == 'A_PLAZO') return true;
        return body.cantidadCuota && body.cantidadCuota > 0;
    }),
    body('plazoDescripcion', 'Parámetro plazoDescripcion requerido').custom((plazoDescripcion, { req: { body }}) => {
        if(body && body.condicionVenta == 'CONTADO') return true;
        if(body && body.tipoCredito == 'CUOTA') return true;
        return typeof body.plazoDescripcion == 'string' ;
    }),
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
    facturaController.emitirFactura
);

routes.post(
    '/simple',
    authJwt(['ADMIN']),
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
    facturaController.emitirFacturaSimple
);

routes.get(
    '/',
    authJwt(['ADMIN']),
    query('fields').optional().isString().bail().custom(validarFields(CAMPOS_FACTURA)),
    facturaController.getFacturas
);

routes.get(
    '/:id',
    authJwt(['ADMIN']),
    param('id').isInt().withMessage('Parámetro :id requerido'),
    query('fields').optional().isString().bail().custom(validarFields(CAMPOS_FACTURA)),
    facturaController.getFacturaById
);

routes.get(
    '/id-externo/:id',
    authJwt(['ADMIN']),
    param('id', 'Parámetro :id requerido').isString().notEmpty().isLength({ max: 255 }),
    query('fields').optional().isString().bail().custom(validarFields(CAMPOS_FACTURA)),
    facturaController.getFacturaByIdExterno
);

routes.get(
    '/cdc/:cdc/total',
    authJwt(['ADMIN']),
    param('cdc').matches(/^\d{44}$/).withMessage('Parámetro :cdc inválido, debe ser numérico de 44 dígitos'),
    facturaController.getMontoTotalFacturaPorCdc
);

routes.post(
    '/reenviar',
    authJwt(['ADMIN']),
    body('email').isEmail().withMessage('Parámetro email requerito'),
    body('facturaId', 'Parámetro facturaId requerido').isInt().notEmpty(),
    facturaController.reenviarFactura
);

routes.post(
    '/cancelar',
    authJwt(['ADMIN']),
    body('facturaId', 'Parámetro facturaId requerido').isInt({min: 1}),
    body('motivo', 'Parámetro motivo requerido').isString().notEmpty(),
    facturaController.cancelarFactura
);

routes.post(
    '/simple/cancelar',
    authJwt(['ADMIN']),
    body('cdc').matches(/^\d{44}$/).withMessage('Parámetro cdc inválido, debe ser numérico de 44 dígitos'),
    facturaController.cancelarFacturaSimple
);

routes.post(
    '/reintentar-sifen',
    authJwt(['ADMIN']),
    body('caja').matches(/^\d{3}$/).withMessage('El parámetro caja debe tener exactamente 3 dígitos entre 001 y 999'),
    body('factura', 'Parámetro factura requerido').isInt({min: 1}),
    facturaController.reintentarEnvioSifen
);

module.exports = routes;