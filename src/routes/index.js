const routes = require('express').Router();

routes.use('/factura', require('./facturaRoute'));
routes.use('/', require('./genericoRoute'));

module.exports = routes;