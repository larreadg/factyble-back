const fs = require('fs');
const { validationResult } = require('express-validator');
const empresaService = require('../services/empresaService');
const Response = require('../utils/response');
const ErrorApp = require('../utils/error');

const crearEmpresa = async (req, res) => {

    try {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // El .p12 y el logo ya quedaron guardados en disco por multer antes de que corrieran
            // las validaciones — si el resto del payload es inválido, no los dejamos huérfanos.
            if (req.files) {
                if (req.files.certificado) fs.unlink(req.files.certificado[0].path, () => {});
                if (req.files.logo) fs.unlink(req.files.logo[0].path, () => {});
            }
            return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));
        }

        const { empresa, establecimientos, usuarioAdmin, certificado } = req.body;

        const data = await empresaService.crearEmpresaCompleta({
            empresa,
            establecimientos,
            usuarioAdmin,
            certificado,
            archivoCertificadoPath: req.files.certificado[0].path,
            archivoLogoPath: req.files.logo[0].path,
        });

        return res.status(200).send(Response.success(data, 'Empresa creada'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al crear la empresa');

        return res.status(code).send(Response.error(message, code));

    }
}

const getEmpresas = async (req, res) => {

    try {

        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
        const filter = req.query.filter || null;

        const data = await empresaService.getEmpresas({ page, itemsPerPage, filter });

        return res.status(200).send(Response.success(data, 'Datos obtenidos'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener empresas');

        return res.status(code).send(Response.error(message, code));

    }
}

const getEmpresaById = async (req, res) => {

    try {

        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        const data = await empresaService.getEmpresaById({ empresaId: Number(req.params.id) });

        return res.status(200).send(Response.success(data, 'Datos obtenidos'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al obtener la empresa');

        return res.status(code).send(Response.error(message, code));

    }
}

const actualizarEmpresa = async (req, res) => {

    try {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // Igual que en crearEmpresa: si vinieron archivos (renovación de certificado y/o
            // reemplazo de logo) y el resto del payload es inválido, no los dejamos huérfanos.
            if (req.files) {
                if (req.files.certificado) fs.unlink(req.files.certificado[0].path, () => {});
                if (req.files.logo) fs.unlink(req.files.logo[0].path, () => {});
            }
            return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));
        }

        const data = await empresaService.actualizarEmpresa({
            empresaId: Number(req.params.id),
            cambios: req.body,
            archivoCertificadoPath: req.files && req.files.certificado ? req.files.certificado[0].path : undefined,
            archivoLogoPath: req.files && req.files.logo ? req.files.logo[0].path : undefined,
        });

        return res.status(200).send(Response.success(data, 'Empresa actualizada'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al actualizar la empresa');

        return res.status(code).send(Response.error(message, code));

    }
}

module.exports = {
    crearEmpresa,
    getEmpresas,
    getEmpresaById,
    actualizarEmpresa
}
