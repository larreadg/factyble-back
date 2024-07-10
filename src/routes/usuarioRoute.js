const routes = require('express').Router();
const { query, body } = require('express-validator');
const usuarioController = require('../controllers/usuarioController');

routes.post(
    '/authenticate',
    body('usuario').notEmpty().withMessage('El email o usuario es obligatorio'),
    body('password').notEmpty().withMessage('La contraseña es obligatoria'),
    usuarioController.authenticateUsuario
);

module.exports = routes;