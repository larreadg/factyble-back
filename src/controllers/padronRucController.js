const fs = require('fs');
const { validationResult } = require('express-validator');
const { importarPadronRuc } = require('../services/padronRucImportService');
const Response = require('../utils/response');
const ErrorApp = require('../utils/error');

const limpiarArchivosTemporales = (archivos) => {
    for (const archivo of archivos || []) {
        fs.unlink(archivo.path, () => {});
    }
};

const importarPadron = async (req, res) => {
    const archivos = req.files || [];

    try {

        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

        if (archivos.length === 0) {
            return res.status(400).send(Response.error('Debe enviar al menos un archivo .zip en el campo "files[]"', 400));
        }

        const resumen = await importarPadronRuc(archivos.map((archivo) => archivo.path));

        // El servicio reporta `archivo` como el basename de la ruta que recibió, que en este
        // endpoint es el nombre generado por multer (uuid.zip), no el que subió el cliente.
        // El orden de `resultados` respeta 1:1 el de `archivos` porque el procesamiento es
        // secuencial y siempre agrega exactamente una entrada por archivo de entrada.
        resumen.resultados.forEach((resultado, i) => {
            if (archivos[i]) resultado.archivo = archivos[i].originalname;
        });

        return res.status(200).send(Response.success(resumen, 'Importación de padrón RUC finalizada'));

    } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, 'Error al importar el padrón de RUC');

        return res.status(code).send(Response.error(message, code));

    } finally {
        // Los .zip subidos son solo insumo transitorio de la importación — se borran siempre,
        // haya terminado bien o mal.
        limpiarArchivosTemporales(archivos);
    }
};

module.exports = {
    importarPadron
};
