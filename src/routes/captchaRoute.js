const { generarCaptchaController } = require('../controllers/captchaController')
const routes = require('express').Router()

routes.get(
  '/',
  generarCaptchaController
)

module.exports = routes
