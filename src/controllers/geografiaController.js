const { validationResult } = require('express-validator');
const geografiaService = require('../services/geografiaService');
const Response = require('../utils/response');
const ErrorApp = require('../utils/error');

const getDepartamentos = async (req, res) => {

    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await geografiaService.getDepartamentos();

        return res.status(200).send(Response.success(data, 'Operación exitosa'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener departamentos');

        return res.status(code).send(Response.error(message, code));

    }
}

const getDistritos = async (req, res) => {

    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await geografiaService.getDistritos(req.query);

        return res.status(200).send(Response.success(data, 'Operación exitosa'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener distritos');

        return res.status(code).send(Response.error(message, code));

    }
}

const getCiudades = async (req, res) => {

    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await geografiaService.getCiudades(req.query);

        return res.status(200).send(Response.success(data, 'Operación exitosa'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener ciudades');

        return res.status(code).send(Response.error(message, code));

    }
}

module.exports = {
    getDepartamentos,
    getDistritos,
    getCiudades
}
