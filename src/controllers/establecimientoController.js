const { validationResult } = require('express-validator');
const cajaService = require('../services/cajaService');
const Response = require('../utils/response');
const ErrorApp = require('../utils/error');

const getCajasByEstablecimiento = async (req, res) => {

    try {

        const errors = validationResult(req);
        console.log(errors.array())
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await cajaService.getCajasByEstablecimiento({ establecimientoId: Number(req.params.id) });

        return res.status(200).send(Response.success(data, 'Operación exitosa'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener establecimientos');

        return res.status(code).send(Response.error(message, code));
        
    }
}

module.exports = {
    getCajasByEstablecimiento
}
