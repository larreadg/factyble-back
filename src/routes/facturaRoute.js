const routes = require('express').Router();
const { body } = require('express-validator');
const facturaController = require('../controllers/facturaController');
const { authJwt } = require('../middleware/authJwt');

routes.post(
    '/',
    authJwt(['ADMIN']),
    body(''),
    facturaController.emitirFactura
);

module.exports = routes;