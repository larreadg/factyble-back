const { validationResult } = require('express-validator');
const genericoService = require('../services/genericoService');
const Response = require('../utils/response');
const handleError = require('../utils/handleError');

const getDatosByRuc = async (req, res) => {

    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, null, errors.array()));

        const data = await genericoService.getDatosByRuc(req.query);

        return res.status(200).send(new Response('success', 200, data, 'Operación exitosa'));

    } catch (error) {
        
        const e = handleError(error);

        return res.status(e.code).send(new Response('error', e.code, null, e.message));
        
    }
}

module.exports = {
    getDatosByRuc
}