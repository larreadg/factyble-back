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

const getNotasDeCredito = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));
        const page = parseInt(req.query.page) || 1
        const itemsPerPage = parseInt(req.query.itemsPerPage) || 10
        const filter = req.query.filter || null

        const data = await notaDeCreditoService.getNotasDeCredito(page, itemsPerPage, filter, Number(req.usuario.empresaId));

        return res.status(200).send(Response.success(data, 'Notas de crédito obtenidas'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener notas de crédito');

        return res.status(code).send(Response.error(message, code));
        
    }
}

const cancelarNotaDeCredito = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await notaDeCreditoService.cancelarNotaDeCredito(req.body, req.usuario);

        return res.status(200).send(Response.success(data, 'Solicitud procesada'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al procesar solicitud');

        return res.status(code).send(Response.error(message, code));
        
    }
}

module.exports = {
    emitirNotaDeCredito,
    getNotasDeCredito,
    cancelarNotaDeCredito
}

