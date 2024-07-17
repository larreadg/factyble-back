const routes = require('express').Router();
const { query, body } = require('express-validator');
const rolController = require('../controllers/rolController');

routes.get(
    '/',
    rolController.getRoles
);

module.exports = routes;


