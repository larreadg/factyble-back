const { validationResult } = require('express-validator');
const genericoService = require('../services/genericoService');
const Response = require('../utils/response');
const ErrorApp = require('../utils/error');

const getDatosByRuc = async (req, res) => {

    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, null, errors.array()));

        const data = await genericoService.getDatosByRuc(req.query);

        return res.status(200).send(Response.success(data));

    } catch (error) {
        
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener datos del contribuyente');

        return res.status(code).send(Response.error(message, code));
        
    }
}

const ping = async (req, res) => {

    const data = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    };

    return res.status(200).send(Response.success(data, 'API disponible'));
}

module.exports = {
    getDatosByRuc,
    ping
}