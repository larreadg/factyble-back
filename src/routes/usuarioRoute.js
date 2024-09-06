const routes = require('express').Router()
const { body } = require('express-validator')
const { authJwt } = require('../middleware/authJwt')
const usuarioController = require('../controllers/usuarioController')

routes.post(
    '/authenticate',
    body('usuario').notEmpty().withMessage('El email o usuario es obligatorio'),
    body('password').notEmpty().withMessage('La contraseña es obligatoria'),
    body('captcha').notEmpty().withMessage('La captcha es obligatoria'),
    usuarioController.authenticateUsuario
)

routes.post(
    '/register',
    body('email').isEmail().withMessage('Parámetro email requerito'),
    body('password', 'Parámetro password requerido').isString().notEmpty(),
    body('nombres', 'Parámetro nombres es requerido').isString().notEmpty(),
    body('apellidos', 'Parámetro apellidos es requerido').isString().notEmpty(),
    body('documento', 'Parámetro documento es requerido').isString().notEmpty(),
    body('telefono', 'Parámetro telefono es requerido').isString().notEmpty(),
    body('roles', 'Parámetro roles es requerido').isArray({min: 1}),
    body('roles.*', 'Parámetro roles incorrecto').isInt({min: 1}),
    body('empresaId', 'Parámetro empresaId es requerido').isInt(),
    usuarioController.register
)

routes.get(
    '/establecimientos-cajas',
    authJwt(['ADMIN']),
    usuarioController.getCajasEstablecimientosByUsuarioId
)

module.exports = routes