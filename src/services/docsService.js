const fs = require("fs");
const path = require("path");
const ErrorApp = require("../utils/error");

// La documentación de integración vive en la raíz del repo como un único markdown, que es la
// fuente de verdad. Este servicio la expone tal cual para que el front la renderice, sin duplicar
// el contenido en otra estructura (evita el doble mantenimiento). Se resuelve la ruta contra
// __dirname (no cwd) para que funcione sin importar desde dónde se arranque el proceso.
const DOC_PATH = path.resolve(__dirname, "../../API_DOCUMENTACION.md");

/**
 * Devuelve el contenido crudo de API_DOCUMENTACION.md y su fecha de última modificación.
 * @returns {Promise<{content: string, format: string, updatedAt: Date}>}
 */
const getApiDocumentacion = async () => {
  try {
    const [content, stats] = await Promise.all([
      fs.promises.readFile(DOC_PATH, "utf-8"),
      fs.promises.stat(DOC_PATH),
    ]);

    return {
      content,
      format: "markdown",
      updatedAt: stats.mtime,
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new ErrorApp("Documentación no encontrada", 404);
    }
    ErrorApp.handleServiceError(error, "Error al obtener la documentación");
  }
};

module.exports = {
  getApiDocumentacion,
};
