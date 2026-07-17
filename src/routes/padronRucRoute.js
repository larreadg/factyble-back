const routes = require('express').Router();
const { authJwt } = require('../middleware/authJwt');
const { uploadPadronRuc } = require('../middleware/uploadPadronRuc');
const padronRucController = require('../controllers/padronRucController');
const Response = require('../utils/response');

/**
 * multer no delega en `next(err)` de forma que Express la convierta en JSON — sin este
 * wrapper, un ZIP con extensión inválida o que excede el tamaño/cantidad máxima devuelve la
 * página de error HTML por defecto de Express en vez de una `Response.error` consistente
 * con el resto de la API (mismo patrón que `empresaRoute.js`).
 */
const handleUploadPadronRuc = (req, res, next) => {
    uploadPadronRuc(req, res, (err) => {
        if (err) {
            return res.status(400).send(Response.error(err.message || 'Error al subir los archivos', 400));
        }
        next();
    });
};

routes.post(
    '/import',
    authJwt(['SUPERADMIN']),
    handleUploadPadronRuc,
    padronRucController.importarPadron
);

module.exports = routes;
