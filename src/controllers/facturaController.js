const { validationResult } = require('express-validator');
const facturaService = require('../services/facturaService');
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

module.exports = {
    emitirFactura
}