const routes = require('express').Router();
const { query } = require('express-validator');
const genericoController = require('../controllers/genericoController');
const { authJwt } = require('../middleware/authJwt');

routes.get(
    '/buscar',
    authJwt(),
    query('ruc').notEmpty().withMessage('Parámetro ruc requerido'),
    query('situacionTributaria').isIn(['CONTRIBUYENTE','NO_CONTRIBUYENTE','NO_DOMICILIADO']).withMessage('Parámetros válidos "CONTRIBUYENTE","NO_CONTRIBUYENTE","NO_DOMICILIADO"'),
    genericoController.getDatosByRuc
);

module.exports = routes;