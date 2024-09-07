const { validationResult } = require('express-validator');
const notaDeCreditoService = require('../services/notaDeCreditoService');
const Response = require('../utils/response');
const ErrorApp = require('../utils/error');

const emitirNotaDeCredito = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await notaDeCreditoService.emitirNotaDeCredito(req.body, req.usuario);

        return res.status(200).send(Response.success(data, 'Nota de crédito creada'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al crear nota de crédito');

        return res.status(code).send(Response.error(message, code));
        
    }
}

module.exports = {
    emitirNotaDeCredito
}

