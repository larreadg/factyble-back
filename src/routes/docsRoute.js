const routes = require("express").Router();
const docsController = require("../controllers/docsController");
const { authJwt } = require("../middleware/authJwt");

// Sirve API_DOCUMENTACION.md para renderizarla en una pantalla autenticada del front.
// authJwt() sin roles = requiere token válido pero cualquier usuario (no exige ADMIN): es solo
// documentación de lectura. Cambiar a authJwt(['ADMIN']) si se quiere restringir por rol.
routes.get("/", authJwt(), docsController.getApiDocumentacion);

module.exports = routes;
