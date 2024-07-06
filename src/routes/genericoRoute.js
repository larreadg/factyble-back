const routes = require('express').Router();
const { query } = require('express-validator');
const genericoController = require('../controllers/genericoController');

routes.get(
    '/contribuyente',
    query('ruc').notEmpty().withMessage('Parámetro ruc requerido'),
    genericoController.getDatosByRuc
);

module.exports = routes;