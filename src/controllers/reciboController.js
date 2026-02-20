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

    const data = await reciboService.getRecibos(
      page,
      itemsPerPage,
      filter,
      Number(req.usuario.empresaId)
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

module.exports = {
  emitirRecibo,
  getRecibos,
};
