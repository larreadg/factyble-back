const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { MAX_ARCHIVOS, MAX_ARCHIVO_BYTES, TEMP_DIR } = require('../utils/padronRucConfig');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, TEMP_DIR),
    filename: (req, file, cb) => cb(null, `${uuidv4()}.zip`)
});

/**
 * Filtro por extensión/mimetype declarados por el cliente. Es solo la primera barrera: la
 * validación real de que el contenido sea un ZIP válido la hace `yauzl.open` al procesar el
 * archivo (`padronRucZipService.js`), que parsea la estructura binaria real y no confía en
 * lo que el cliente haya declarado acá.
 */
const MIMETYPES_ZIP = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'];

const fileFilter = (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (extension !== '.zip') {
        return cb(new Error('Todos los archivos deben tener extensión .zip'));
    }
    if (!MIMETYPES_ZIP.includes(file.mimetype)) {
        return cb(new Error(`Tipo de archivo no permitido para "${file.originalname}"`));
    }
    cb(null, true);
};

const uploadPadronRuc = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_ARCHIVO_BYTES,
        files: MAX_ARCHIVOS
    }
}).array('files[]', MAX_ARCHIVOS);

module.exports = {
    uploadPadronRuc
};
