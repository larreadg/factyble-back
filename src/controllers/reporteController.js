const { validationResult } = require('express-validator');
const reporteService = require('../services/reporteService');
const Response = require('../utils/response');
const ErrorApp = require('../utils/error');

const getFacturasPorEstados = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const { desde, hasta } = req.query;

        const data = await reporteService.facturasPorEstados(desde || null, hasta || null, Number(req.usuario.empresaId));

        return res.status(200).send(Response.success(data, 'Datos obtenidos'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener reporte de facturas por estado');

        return res.status(code).send(Response.error(message, code));

    }
}

const getFacturacionPorPeriodo = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const { desde, hasta } = req.query;

        const data = await reporteService.facturacionPorPeriodo(desde || null, hasta || null, Number(req.usuario.empresaId));

        return res.status(200).send(Response.success(data, 'Datos obtenidos'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener reporte de facturación por período');

        return res.status(code).send(Response.error(message, code));

    }
}

const getTopClientes = async (req, res) => {
    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const { desde, hasta } = req.query;
        const limite = parseInt(req.query.limite) || 10;

        const data = await reporteService.topClientes(desde || null, hasta || null, limite, Number(req.usuario.empresaId));

        return res.status(200).send(Response.success(data, 'Datos obtenidos'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener reporte de top de clientes');

        return res.status(code).send(Response.error(message, code));

    }
}

module.exports = {
    getFacturasPorEstados,
    getFacturacionPorPeriodo,
    getTopClientes
}
