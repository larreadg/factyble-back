const routes = require('express').Router();
const notaDeCreditoController = require('../controllers/notaDeCreditoController');
const { body, query, param } = require('express-validator');
const { authJwt } = require('../middleware/authJwt');

routes.post(
    '/',
    authJwt(['ADMIN']),
    body('cdc', 'Parámetro cdc requerido').notEmpty().isString(),
    body('totalIva', 'Parámetro totalIva requerido').isNumeric(),
    body('total', 'Parámetro total requerido').isNumeric(),
    body('items', 'Parámetro items requerido').isArray({min: 1}),
    body('items.*', 'Parámetros item requerido Object').isObject(),
    body('items.*.cantidad', 'Parámetro cantidad[number] dentro de items requerido').isInt(),
    body('items.*.precioUnitario', 'Parámetro precioUnitario dentro de items requerido').isNumeric(),
    body('items.*.impuesto', 'Parámetro impuesto dentro de items requerido').isNumeric(),
    body('items.*.total', 'Parámetro total dentro de items requerido').isNumeric(),
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
    notaDeCreditoController.emitirNotaDeCredito
)

routes.get(
    '/',
    authJwt(['ADMIN']),
    notaDeCreditoController.getNotasDeCredito
)

routes.post(
    '/cancelar',
    authJwt(['ADMIN']),
    body('notaDeCreditoId', 'Parámetro notaDeCreditoId requerido').isInt({min: 1}),
    body('motivo', 'Parámetro motivo requerido').isString().notEmpty(),
    notaDeCreditoController.cancelarNotaDeCredito
);

module.exports = routes