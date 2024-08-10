const routes = require('express').Router();
const { body, query, param } = require('express-validator');
const facturaController = require('../controllers/facturaController');
const { authJwt } = require('../middleware/authJwt');

routes.post(
    '/',
    authJwt(['ADMIN']),
    body('ruc', 'Parámetro ruc requerido').notEmpty().isString(),
    body('razonSocial', 'Parámetro razonSocial requerido').notEmpty().isString(),
    body('situacionTributaria', 'Parámetro situacionTributaria requerido').notEmpty().isIn([
        'CONTRIBUYENTE','NO_CONTRIBUYENTE','NO_DOMICILIADO'
    ]),
    body('total', 'Parámetro total requerido').isNumeric(),
    body('totalIva', 'Parámetro totalIva requerido').isNumeric(),
    body('condicionVenta', 'Parámetro condicionVenta requerido').isIn(['CONTADO', 'CREDITO']),
    body('direccion', 'Parámetro direccion requerido').optional().isString(),
    body('email', 'Parámetro email requerido').isEmail(),
    body('items', 'Parámetro items requerido').isArray({min: 1}),
    body('items.*', 'Parámetros item requerido Object').isObject(),
    body('items.*.cantidad', 'Parámetro cantidad[number] dentro de items requerido').isInt(),
    body('items.*.precioUnitario', 'Parámetro precioUnitario dentro de items requerido').isNumeric(),
    body('items.*.impuesto', 'Parámetro impuesto dentro de items requerido').isNumeric(),
    body('items.*.total', 'Parámetro total dentro de items requerido').isNumeric(),
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
    facturaController.emitirFactura
);

routes.get(
    '/',
    authJwt(['ADMIN']),
    facturaController.getFacturas
);

routes.get(
    '/:id',
    authJwt(['ADMIN']),
    param('id').isInt().withMessage('Parámetro :id requerido'),
    facturaController.getFacturaById
);

routes.post(
    '/reenviar',
    authJwt(['ADMIN']),
    body('email').isEmail().withMessage('Parámetro email requerito'),
    body('facturaId', 'Parámetro facturaId requerido').isInt().notEmpty(),
    facturaController.reenviarFactura
);

module.exports = routes;