const { validationResult } = require('express-validator');
const facturaService = require('../services/facturaService');
const facturaSimpleService = require('../services/facturaSimpleService');
const Response = require('../utils/response');
const ErrorApp = require('../utils/error');

const emitirFactura = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await facturaService.emitirFactura(req.body, req.usuario);

        return res.status(200).send(Response.success(data, 'Factura creada'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al crear factura');

        return res.status(code).send(Response.error(message, code));

    }
}

const emitirFacturaSimple = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await facturaSimpleService.emitirFacturaSimple(req.body, req.usuario);

        return res.status(200).send(Response.success(data, 'Factura creada'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al crear factura');

        return res.status(code).send(Response.error(message, code));

    }
}

const getFacturas = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const page = parseInt(req.query.page) || 1
        const itemsPerPage = parseInt(req.query.itemsPerPage) || 10
        const filter = req.query.filter || null

        const data = await facturaService.getFacturas(page, itemsPerPage, filter,  Number(req.usuario.empresaId));

        return res.status(200).send(Response.success(data, 'Datos obtenidos'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener facturas');

        return res.status(code).send(Response.error(message, code));
        
    }
}

const getFacturaById = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const { id } = req.params;
        
        const data = await facturaService.getFacturaById(id);

        return res.status(200).send(Response.success(data, 'Datos obtenidos'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener facturas');

        return res.status(code).send(Response.error(message, code));
        
    }
}

const getMontoTotalFacturaPorCdc = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const { cdc } = req.params;

        const data = await facturaService.getMontoTotalPorCdc(cdc, Number(req.usuario.empresaId));

        return res.status(200).send(Response.success(data, 'Datos obtenidos'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener monto total de factura');

        return res.status(code).send(Response.error(message, code));

    }
}

const reenviarFactura = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const { email, facturaId } = req.body;
        
        await facturaService.reenviarFactura({ email, facturaId });

        return res.status(200).send(Response.success(null, 'Datos obtenidos'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener facturas');

        return res.status(code).send(Response.error(message, code));
        
    }
}

const cancelarFactura = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await facturaService.cancelarFactura(req.body, req.usuario);

        return res.status(200).send(Response.success(data, 'Solicitud procesada'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al procesar solicitud');

        return res.status(code).send(Response.error(message, code));
        
    }
}

const reintentarEnvioSifen = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await facturaService.reintentarEnvioSifen(req.body, req.usuario);

        return res.status(200).send(Response.success(data, 'Reintento de envío a SIFEN encolado'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al reintentar el envío a SIFEN');

        return res.status(code).send(Response.error(message, code));

    }
}

const cancelarFacturaSimple = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await facturaSimpleService.cancelarFacturaSimple(req.body, req.usuario);

        return res.status(200).send(Response.success(data, 'Solicitud procesada'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al procesar solicitud');

        return res.status(code).send(Response.error(message, code));

    }
}

module.exports = {
    emitirFactura,
    emitirFacturaSimple,
    getFacturas,
    getFacturaById,
    getMontoTotalFacturaPorCdc,
    reenviarFactura,
    cancelarFactura,
    cancelarFacturaSimple,
    reintentarEnvioSifen
}