const docsService = require("../services/docsService");
const Response = require("../utils/response");
const ErrorApp = require("../utils/error");

const getApiDocumentacion = async (req, res) => {
  try {
    const data = await docsService.getApiDocumentacion();

    return res.status(200).send(Response.success(data, "Documentación obtenida"));
  } catch (error) {
    const { code, message } = ErrorApp.handleControllerError(
      error,
      "Error al obtener la documentación"
    );

    return res.status(code).send(Response.error(message, code));
  }
};

module.exports = {
  getApiDocumentacion,
};
