const routes = require('express').Router();
const { query } = require('express-validator');
const genericoController = require('../controllers/genericoController');
const { authJwt } = require('../middleware/authJwt');

routes.get(
    '/ping',
    genericoController.ping
);

// Capacidad del servidor, no de la empresa: alcanza con estar autenticado.
routes.get(
    '/impresion',
    authJwt(),
    genericoController.getEstadoImpresion
);

routes.get(
    '/buscar',
    authJwt(),
    query('ruc').notEmpty().withMessage('Parámetro ruc requerido'),
    query('situacionTributaria').notEmpty().withMessage('Parámetro situacionTributaria requerido')
    .isIn(['CONTRIBUYENTE','NO_CONTRIBUYENTE','NO_DOMICILIADO']).withMessage('Parámetros válidos CONTRIBUYENTE, NO_CONTRIBUYENTE, NO_DOMICILIADO'),
    genericoController.getDatosByRuc
);

module.exports = routes;