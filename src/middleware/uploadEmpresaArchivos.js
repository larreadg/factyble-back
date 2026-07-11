const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

/**
 * Multer multi-campo compartido por POST /empresa y PUT /empresa/:id: sube el certificado
 * (.p12/.pfx) y el logo (imagen) en la misma request multipart, cada uno con su propia
 * extensión permitida y destino. Ninguno de los dos va dentro de `public/` — `public/` se
 * sirve estático (`src/index.js`), y ni el certificado ni el logo tienen que ser accesibles
 * por URL directa; `generarPdf.js`/`generarPdfRecibo.js` los leen del filesystem por path.
 */
const CERTIFICADOS_DIR = path.resolve(__dirname, '..', '..', process.env.SIFEN_CERTIFICADOS_DIR || 'certificados');
const LOGOS_DIR = path.resolve(__dirname, '..', '..', process.env.LOGOS_DIR || 'logos');

for (const dir of [CERTIFICADOS_DIR, LOGOS_DIR]) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

const EXTENSIONES_POR_CAMPO = {
    certificado: ['.p12', '.pfx'],
    logo: ['.png', '.jpg', '.jpeg'],
};

const DESTINO_POR_CAMPO = {
    certificado: CERTIFICADOS_DIR,
    logo: LOGOS_DIR,
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, DESTINO_POR_CAMPO[file.fieldname]),
    filename: (req, file, cb) => {
        const nombre = `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`;
        cb(null, nombre);
    }
});

const fileFilter = (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const permitidas = EXTENSIONES_POR_CAMPO[file.fieldname] || [];
    if (!permitidas.includes(extension)) {
        return cb(new Error(`El campo "${file.fieldname}" debe tener extensión ${permitidas.join(' o ')}`));
    }
    cb(null, true);
};

const uploadEmpresaArchivos = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB — cubre un .p12 (pocos KB) y un logo razonable
}).fields([
    { name: 'certificado', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
]);

module.exports = {
    uploadEmpresaArchivos,
    CERTIFICADOS_DIR,
    LOGOS_DIR
};
