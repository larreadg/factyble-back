const routes = require('express').Router();

routes.use('/', require('./genericoRoute'));
routes.use('/usuario', require('./usuarioRoute'));
routes.use('/factura', require('./facturaRoute'));
routes.use('/rol', require('./rolRoute'));
routes.use('/captcha', require('./captchaRoute'))

module.exports = routes;