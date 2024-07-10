const routes = require('express').Router();

routes.use('/', require('./genericoRoute'));
routes.use('/usuario', require('./usuarioRoute'));

module.exports = routes;