const { validationResult } = require('express-validator');
const reciboService = require('../services/reciboService');
const Response = require('../utils/response');
const ErrorApp = require('../utils/error');

const emitirRecibo = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .send(new Response('error', 400, errors.array(), 'Error de validacion'));
    }

    const data = await reciboService.emitirRecibo(req.body, req.usuario);

    return res.status(200).send(Response.success(data, 'Recibo creado'));
  } catch (error) {
    const { code, message } = ErrorApp.handleControllerError(
      error,
      'Error al crear recibo'
    );

    return res.status(code).send(Response.error(message, code));
  }
};

const emitirRecibosBulk = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .send(new Response('error', 400, errors.array(), 'Error de validacion'));
    }

    const data = await reciboService.emitirRecibosBulk(req.body, req.usuario);

    return res.status(200).send(Response.success(data, 'Procesamiento finalizado'));
  } catch (error) {
    const { code, message } = ErrorApp.handleControllerError(
      error,
      'Error al procesar recibos'
    );

    return res.status(code).send(Response.error(message, code));
  }
};

const getRecibos = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .send(new Response('error', 400, errors.array(), 'Error de validacion'));
    }

    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    const filter = req.query.filter || null;
    const fields = req.query.fields || null;

    const data = await reciboService.getRecibos(
      page,
      itemsPerPage,
      filter,
      Number(req.usuario.empresaId),
      fields
    );

    return res.status(200).send(Response.success(data, 'Datos obtenidos'));
  } catch (error) {
    const { code, message } = ErrorApp.handleControllerError(
      error,
      'Error al obtener recibos'
    );

    return res.status(code).send(Response.error(message, code));
  }
};

const getReciboByIdExterno = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .send(new Response('error', 400, errors.array(), 'Error de validacion'));
    }

    const { id } = req.params;
    const fields = req.query.fields || null;

    const data = await reciboService.getReciboByIdExterno(id, Number(req.usuario.empresaId), fields);

    return res.status(200).send(Response.success(data, 'Datos obtenidos'));
  } catch (error) {
    const { code, message } = ErrorApp.handleControllerError(
      error,
      'Error al obtener recibo'
    );

    return res.status(code).send(Response.error(message, code));
  }
};

const consultarRecibosPorIdExternoLote = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .send(new Response('error', 400, errors.array(), 'Error de validacion'));
    }

    // `numeros` ya viene normalizado por los sanitizers de la ruta (string trimmeado por elemento).
    const { numeros } = req.body;
    const fields = req.query.fields || null;

    const data = await reciboService.consultarRecibosPorIdExterno(numeros, Number(req.usuario.empresaId), fields);

    return res.status(200).send(Response.success(data, 'Datos obtenidos'));
  } catch (error) {
    const { code, message } = ErrorApp.handleControllerError(
      error,
      'Error al consultar recibos por id externo'
    );

    return res.status(code).send(Response.error(message, code));
  }
};

module.exports = {
  emitirRecibo,
  emitirRecibosBulk,
  getRecibos,
  getReciboByIdExterno,
  consultarRecibosPorIdExternoLote,
};
