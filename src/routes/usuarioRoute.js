const routes = require('express').Router();
const { query, body } = require('express-validator');
const usuarioController = require('../controllers/usuarioController');

routes.post(
    '/authenticate',
    body('usuario').notEmpty().withMessage('El email o usuario es obligatorio'),
    body('password').notEmpty().withMessage('La contraseña es obligatoria'),
    usuarioController.authenticateUsuario
);

routes.post(
    '/register',
    body('usuario','Parámetro usuario es requerido').isString().notEmpty(),
    body('email').isEmail().withMessage('Parámetro email requerito'),
    body('password', 'Parámetro password requerido').isString().notEmpty(),
    body('nombres', 'Parámetro nombres es requerido').isString().notEmpty(),
    body('apellidos', 'Parámetro apellidos es requerido').isString().notEmpty(),
    body('rolId', 'Parámetro rolId es requerido').isInt(),
    body('empresaId', 'Parámetro empresaId es requerido').isInt(),
    usuarioController.register
);

module.exports = routes;