const { validationResult } = require('express-validator');
const notaDeCreditoService = require('../services/notaDeCreditoService');
const notaDeCreditoSimpleService = require('../services/notaDeCreditoSimpleService');
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

const emitirNotaDeCreditoSimple = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await notaDeCreditoSimpleService.emitirNotaDeCreditoSimple(req.body, req.usuario);

        return res.status(200).send(Response.success(data, 'Nota de crédito creada'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al crear nota de crédito');

        return res.status(code).send(Response.error(message, code));

    }
}

const emitirNotasDeCreditoBulk = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await notaDeCreditoSimpleService.emitirNotasDeCreditoBulk(req.body, req.usuario);

        return res.status(200).send(Response.success(data, 'Procesamiento finalizado'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al procesar notas de crédito');

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
        const fields = req.query.fields || null

        const data = await notaDeCreditoService.getNotasDeCredito(page, itemsPerPage, filter, Number(req.usuario.empresaId), fields);

        return res.status(200).send(Response.success(data, 'Notas de crédito obtenidas'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener notas de crédito');

        return res.status(code).send(Response.error(message, code));
        
    }
}

const getNotaDeCreditoByIdExterno = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const { id } = req.params;
        const fields = req.query.fields || null;

        const data = await notaDeCreditoService.getNotaDeCreditoByIdExterno(id, Number(req.usuario.empresaId), fields);

        return res.status(200).send(Response.success(data, 'Datos obtenidos'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener notas de crédito');

        return res.status(code).send(Response.error(message, code));

    }
}

const consultarNotasDeCreditoPorIdExternoLote = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        // `numeros` ya viene normalizado por los sanitizers de la ruta (string trimmeado por elemento).
        const { numeros } = req.body;
        const fields = req.query.fields || null;

        const data = await notaDeCreditoService.consultarNotasDeCreditoPorIdExterno(numeros, Number(req.usuario.empresaId), fields);

        return res.status(200).send(Response.success(data, 'Datos obtenidos'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al consultar notas de crédito por id externo');

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

const reenviarNotaDeCredito = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const { email, notaDeCreditoId } = req.body;

        await notaDeCreditoService.reenviarNotaDeCredito({ email, notaDeCreditoId, empresaId: Number(req.usuario.empresaId) });

        return res.status(200).send(Response.success(null, 'Nota de credito reenviada'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al enviar nota de credito');

        return res.status(code).send(Response.error(message, code));
        
    }
}

const reintentarEnvioSifen = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await notaDeCreditoService.reintentarEnvioSifen(req.body, req.usuario);

        return res.status(200).send(Response.success(data, 'Reintento de envío a SIFEN encolado'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al reintentar el envío a SIFEN');

        return res.status(code).send(Response.error(message, code));

    }
}

const cancelarNotaDeCreditoSimple = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await notaDeCreditoSimpleService.cancelarNotaDeCreditoSimple(req.body, req.usuario);

        return res.status(200).send(Response.success(data, 'Solicitud procesada'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al procesar solicitud');

        return res.status(code).send(Response.error(message, code));

    }
}

module.exports = {
    emitirNotaDeCredito,
    emitirNotaDeCreditoSimple,
    emitirNotasDeCreditoBulk,
    getNotasDeCredito,
    getNotaDeCreditoByIdExterno,
    consultarNotasDeCreditoPorIdExternoLote,
    cancelarNotaDeCredito,
    cancelarNotaDeCreditoSimple,
    reenviarNotaDeCredito,
    reintentarEnvioSifen
}

