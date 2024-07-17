const routes = require('express').Router();

routes.use('/', require('./genericoRoute'));
routes.use('/usuario', require('./usuarioRoute'));
routes.use('/rol', require('./rolRoute'));

module.exports = routes;