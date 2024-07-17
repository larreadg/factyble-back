const { validationResult } = require('express-validator');
const rolService = require('../services/rolService');
const Response = require('../utils/response');
const ErrorApp = require('../utils/error');

const getRoles = async (req, res) => {

    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await rolService.getRoles();

        return res.status(200).send(Response.success(data, 'Operación exitosa'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener roles');

        return res.status(code).send(Response.error(message, code));
        
    }
}

module.exports = {
    getRoles
}
