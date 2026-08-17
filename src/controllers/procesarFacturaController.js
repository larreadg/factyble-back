const { validationResult } = require('express-validator');
const procesarFacturaService = require('../services/procesarFacturaService');
const Response = require('../utils/response');
const ErrorApp = require('../utils/error');

const procesarFactura = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

    const data = await procesarFacturaService.procesarFactura(req.body, req.usuario);

    return res.status(200).send(Response.success(data, 'Ventas procesadas'));
  } catch (error) {
    const { code, message } = ErrorApp.handleControllerError(error, 'Error al procesar factura');

    return res.status(code).send(Response.error(message, code));
  }
};

module.exports = {
  procesarFactura,
};
