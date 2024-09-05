const routes = require('express').Router()
const { param } = require('express-validator')
const establecimientoController = require('../controllers/establecimientoController')
const { authJwt } = require('../middleware/authJwt');

routes.get(
    '/:id/cajas',
    authJwt(['ADMIN']),
    param('id').isInt().withMessage('Parámetro id requerido y debe ser numérico'),
    establecimientoController.getCajasByEstablecimiento
)

module.exports = routes