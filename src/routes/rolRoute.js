const routes = require('express').Router();
const { query, body } = require('express-validator');
const rolController = require('../controllers/rolController');
const { authJwt } = require('../middleware/authJwt');

routes.get(
    '/',
    authJwt(),
    rolController.getRoles
);

module.exports = routes;


