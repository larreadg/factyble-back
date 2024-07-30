const routes = require('express').Router();

routes.use('/', require('./genericoRoute'));
routes.use('/usuario-realm', require('./usuarioRoute'));
routes.use('/factura', require('./facturaRoute'));
routes.use('/rol', require('./rolRoute'));

module.exports = routes;