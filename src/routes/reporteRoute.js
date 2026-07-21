const routes = require('express').Router();
const { query } = require('express-validator');
const reporteController = require('../controllers/reporteController');
const { authJwt } = require('../middleware/authJwt');

routes.get(
    '/facturas-x-estados',
    authJwt(['ADMIN']),
    query('desde').optional().isISO8601().withMessage('Parámetro desde debe ser una fecha ISO8601 válida'),
    query('hasta').optional().isISO8601().withMessage('Parámetro hasta debe ser una fecha ISO8601 válida'),
    reporteController.getFacturasPorEstados
);

routes.get(
    '/facturacion-x-periodo',
    authJwt(['ADMIN']),
    query('desde').optional().isISO8601().withMessage('Parámetro desde debe ser una fecha ISO8601 válida'),
    query('hasta').optional().isISO8601().withMessage('Parámetro hasta debe ser una fecha ISO8601 válida'),
    reporteController.getFacturacionPorPeriodo
);

routes.get(
    '/top-clientes',
    authJwt(['ADMIN']),
    query('desde').optional().isISO8601().withMessage('Parámetro desde debe ser una fecha ISO8601 válida'),
    query('hasta').optional().isISO8601().withMessage('Parámetro hasta debe ser una fecha ISO8601 válida'),
    query('limite').optional().isInt({ min: 1, max: 100 }).withMessage('Parámetro limite debe ser un entero entre 1 y 100'),
    reporteController.getTopClientes
);

module.exports = routes;
