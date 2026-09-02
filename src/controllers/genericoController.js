const { validationResult } = require('express-validator');
const genericoService = require('../services/genericoService');
const Response = require('../utils/response');
const ErrorApp = require('../utils/error');
const { IMPRESORA_TICKETS, impresionHabilitada } = require('../utils/impresoraTickets');

const getDatosByRuc = async (req, res) => {

    try {

        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).send(new Response('error', 400, null, errors.array()));

        // `empresaId` viaja en el payload del JWT (ver usuarioService) y no en la query: el servicio
        // lo necesita para resolver el certificado con el que consultar el RUC en SIFEN cuando no
        // está en el padrón local.
        const data = await genericoService.getDatosByRuc({ ...req.query, empresaId: req.usuario.empresaId });

        return res.status(200).send(Response.success(data));

    } catch (error) {
        
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener datos del contribuyente');

        return res.status(code).send(Response.error(message, code));
        
    }
}

// Si este servidor puede imprimir tickets (KuDE) o no. Lo consulta el front para decidir si muestra el
// botón "Reimprimir" en los listados: en la nube no hay impresora y el botón sólo serviría para dar un
// 400. Se resuelve leyendo la constante de utils/impresoraTickets — un módulo sin dependencias, para no
// arrastrar la JVM ni el service de reimpresión hasta acá.
const getEstadoImpresion = async (req, res) => {

    const data = {
        habilitada: impresionHabilitada(),
        // El nombre se expone para poder diagnosticar desde el front qué impresora tiene configurada el
        // servidor (es un nombre de cola de impresión de Windows, no un secreto).
        impresora: IMPRESORA_TICKETS || null
    };

    return res.status(200).send(Response.success(data));
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
    getEstadoImpresion,
    ping
}