const routes = require('express').Router();
const { query } = require('express-validator');
const geografiaController = require('../controllers/geografiaController');
const { authJwt } = require('../middleware/authJwt');

routes.get(
    '/departamentos',
    authJwt(),
    geografiaController.getDepartamentos
);

routes.get(
    '/distritos',
    authJwt(),
    query('cod_departamento').optional().notEmpty().withMessage('Parámetro cod_departamento inválido'),
    geografiaController.getDistritos
);

routes.get(
    '/ciudades',
    authJwt(),
    query('cod_distrito').optional().notEmpty().withMessage('Parámetro cod_distrito inválido'),
    geografiaController.getCiudades
);

module.exports = routes;
