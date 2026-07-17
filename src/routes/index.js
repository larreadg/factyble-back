const routes = require('express').Router();

routes.use('/', require('./genericoRoute'));
routes.use('/usuario', require('./usuarioRoute'));
routes.use('/factura', require('./facturaRoute'));
routes.use('/recibo', require('./reciboRoute'));
routes.use('/rol', require('./rolRoute'));
routes.use('/captcha', require('./captchaRoute'))
routes.use('/nota-credito', require('./notaDeCreditoRoute'))
routes.use('/empresa', require('./empresaRoute'))
routes.use('/geografia', require('./geografiaRoute'))
routes.use('/rucs', require('./padronRucRoute'))

module.exports = routes;
