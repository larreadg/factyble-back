const { validationResult } = require('express-validator');
const usuarioService = require('../services/usuarioService');
const Response = require('../utils/response');
const ErrorApp = require('../utils/error');

const authenticateUsuario = async (req, res) => {

    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const token = await usuarioService.authenticateUsuario(req.body);

        return res.status(200).send(Response.success({token}, 'Autenticación exitosa'));

    } catch (error) {
        
        const { code, message } = ErrorApp.handleControllerError(error, 'Error de autenticación');

        return res.status(code).send(Response.error(message, code));
        
    }
}

const register = async (req, res) => {

    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await usuarioService.register(req.body);

        return res.status(200).send(Response.success(data, 'Usuario creado'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al crear usuario');

        return res.status(code).send(Response.error(message, code));
        
    }
}

module.exports = {
    authenticateUsuario,
    register
}