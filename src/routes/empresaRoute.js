const fs = require('fs');
const routes = require('express').Router();
const { body, param, query } = require('express-validator');
const { authJwt } = require('../middleware/authJwt');
const { uploadEmpresaArchivos } = require('../middleware/uploadEmpresaArchivos');
const { comprimirImagen } = require('../utils/comprimirImagen');
const empresaController = require('../controllers/empresaController');
const Response = require('../utils/response');
const { PLANTILLAS_PDF } = require('../utils/plantillasPdf');

const LOGO_MAX_BYTES = 300 * 1024;

/**
 * multer no delega en `next(err)` de forma que Express la convierta en JSON — sin este
 * wrapper, un archivo con extensión inválida o que excede el límite de tamaño devuelve la
 * página de error HTML por defecto de Express en vez de una `Response.error` consistente
 * con el resto de la API.
 */
const handleUploadEmpresaArchivos = (req, res, next) => {
    uploadEmpresaArchivos(req, res, (err) => {
        if (err) {
            return res.status(400).send(Response.error(err.message || 'Error al subir los archivos', 400));
        }
        next();
    });
};

/**
 * El logo llega tal cual lo mandó el cliente — puede pesar varios MB. Se comprime acá, en
 * disco, ANTES de las validaciones de negocio, para no terminar con imágenes pesadas en
 * `LOGOS_DIR` (JasperReports las carga completas a memoria por cada PDF generado). Si no se
 * puede bajar de `LOGO_MAX_BYTES` ni con la compresión más agresiva, se rechaza la request.
 */
const comprimirLogoSubido = async (req, res, next) => {
    if (!req.files || !req.files.logo || req.files.logo.length === 0) return next();
    try {
        await comprimirImagen(req.files.logo[0].path, { maxBytes: LOGO_MAX_BYTES });
        next();
    } catch (error) {
        if (req.files.logo) fs.unlink(req.files.logo[0].path, () => {});
        if (req.files.certificado) fs.unlink(req.files.certificado[0].path, () => {});
        return res.status(400).send(Response.error(error.message || 'Error al procesar el logo', 400));
    }
};

/**
 * El payload va en multipart/form-data: el campo de texto `data` trae un JSON con todos
 * los datos no-binarios (empresa, establecimientos, usuarioAdmin, certificado.alias/clave),
 * y los campos `certificado`/`logo` traen los binarios en sí. Se hace así (en vez de un body
 * JSON plano) porque los archivos y los datos estructurados tienen que viajar en la misma
 * request. Este middleware parsea `data` y lo reemplaza en `req.body` para que las
 * validaciones de abajo (y el controller) trabajen sobre un objeto ya parseado, con paths
 * anidados (`empresa.ruc`, `establecimientos.*.cajas`, etc.).
 */
const parseDataField = (req, res, next) => {
    if (typeof req.body.data !== 'string') {
        req.body = {};
        return next();
    }
    try {
        req.body = JSON.parse(req.body.data);
    } catch (_error) {
        req.body = {};
    }
    next();
};

/**
 * Variante de `parseDataField` para el PUT: a diferencia del POST, el PUT admite tanto
 * `application/json` plano (update parcial de siempre, sin tocar certificado/logo) como
 * `multipart/form-data` (cuando se quiere renovar el certificado y/o reemplazar el logo). Si
 * la request no es multipart, `req.body` ya viene parseado por `body-parser` y se deja intacto.
 */
const parseDataFieldIfMultipart = (req, res, next) => {
    if (!req.is('multipart/form-data')) return next();
    return parseDataField(req, res, next);
};

routes.post(
    '/',
    authJwt(['SUPERADMIN']),
    handleUploadEmpresaArchivos,
    comprimirLogoSubido,
    parseDataField,

    // Empresa
    body('empresa.ruc', 'Parámetro empresa.ruc es requerido').isString().notEmpty(),
    body('empresa.rucSinDv', 'Parámetro empresa.rucSinDv debe ser numérico de hasta 8 dígitos').matches(/^\d{1,8}$/),
    body('empresa.digitoVerificador', 'Parámetro empresa.digitoVerificador debe ser un único dígito').matches(/^\d$/),
    body('empresa.nombreEmpresa', 'Parámetro empresa.nombreEmpresa es requerido').isString().notEmpty(),
    body('empresa.timbrado', 'Parámetro empresa.timbrado es requerido').isString().notEmpty(),
    body('empresa.direccion', 'Parámetro empresa.direccion es requerido').isString().notEmpty(),
    body('empresa.vigenteDesde', 'Parámetro empresa.vigenteDesde debe ser una fecha ISO8601 válida').isISO8601(),
    // Fin de vigencia del timbrado: opcional (las empresas que hoy no lo tienen cargado siguen
    // emitiendo igual, solo que el KuDE no imprime la línea).
    body('empresa.vigenteHasta').optional({ nullable: true }).isISO8601()
        .withMessage('Parámetro empresa.vigenteHasta debe ser una fecha ISO8601 válida'),
    body('empresa.telefono', 'Parámetro empresa.telefono es requerido').isString().notEmpty(),
    body('empresa.email', 'Parámetro empresa.email debe ser un email válido').isEmail(),
    body('empresa.ciudad', 'Parámetro empresa.ciudad es requerido').isString().notEmpty(),
    body('empresa.tipoContribuyente', 'Parámetro empresa.tipoContribuyente inválido')
        .isIn(['FISICA', 'JURIDICA']),
    body('empresa.tipoImpuesto', 'Parámetro empresa.tipoImpuesto inválido')
        .isIn(['IVA', 'ISC', 'RENTA', 'NINGUNO', 'IVA_RENTA']),
    body('empresa.codActividadPrincipal', 'Parámetro empresa.codActividadPrincipal es requerido').isString().notEmpty(),
    body('empresa.descActividadPrincipal', 'Parámetro empresa.descActividadPrincipal es requerido').isString().notEmpty(),
    body('empresa.codActividadSecundaria').optional().isString(),
    body('empresa.descActividadSecundaria').optional().isString(),
    body('empresa.codMoneda').optional().isString().isLength({ min: 3, max: 3 }),
    body('empresa.descMoneda').optional().isString(),
    body('empresa.csc', 'Parámetro empresa.csc es requerido').isString().notEmpty(),
    body('empresa.cscId', 'Parámetro empresa.cscId es requerido').isString().notEmpty(),
    body('empresa.plantillaPdf').optional().isIn(PLANTILLAS_PDF)
        .withMessage(`Parámetro empresa.plantillaPdf inválido (valores: ${PLANTILLAS_PDF.join(', ')})`),
    // Imprime el KuDE por duplicado (2-up en A4 horizontal). Opcional: si no viene, la columna cae a
    // su default `false` y la empresa imprime una sola copia, como siempre.
    body('empresa.duplicarDoc').optional().isBoolean()
        .withMessage('Parámetro empresa.duplicarDoc debe ser booleano').toBoolean(),

    // Establecimientos + cajas + secuencias
    body('establecimientos', 'Parámetro establecimientos debe ser un array con al menos un elemento')
        .isArray({ min: 1 }),
    body('establecimientos.*.nombre', 'Parámetro establecimientos.*.nombre es requerido').isString().notEmpty(),
    body('establecimientos.*.direccion', 'Parámetro establecimientos.*.direccion es requerido').isString().notEmpty(),
    body('establecimientos.*.numeroCasa').optional().isString(),
    body('establecimientos.*.telefono').optional().isString(),
    body('establecimientos.*.codigo', 'Parámetro establecimientos.*.codigo debe ser numérico de 3 dígitos').matches(/^\d{3}$/),
    body('establecimientos.*.codDistrito', 'Parámetro establecimientos.*.codDistrito es requerido').isString().notEmpty(),
    body('establecimientos.*.codCiudad', 'Parámetro establecimientos.*.codCiudad es requerido').isString().notEmpty(),
    body('establecimientos.*.codDepartamento', 'Parámetro establecimientos.*.codDepartamento es requerido').isString().notEmpty(),
    body('establecimientos.*.cajas', 'Cada establecimiento debe tener al menos una caja').isArray({ min: 1 }),
    body('establecimientos.*.cajas.*.nombre', 'Parámetro cajas.*.nombre es requerido').isString().notEmpty(),
    body('establecimientos.*.cajas.*.codigo', 'Parámetro cajas.*.codigo debe ser numérico de 3 dígitos').matches(/^\d{3}$/),
    body('establecimientos.*.cajas.*.secuenciaFacturaInicial').optional().isInt({ min: 0 }),
    body('establecimientos.*.cajas.*.secuenciaNotaCreditoInicial').optional().isInt({ min: 0 }),
    body('establecimientos.*.cajas.*.secuenciaReciboInicial').optional().isInt({ min: 0 }),

    // Usuario administrador inicial de la empresa
    body('usuarioAdmin.nombres', 'Parámetro usuarioAdmin.nombres es requerido').isString().notEmpty(),
    body('usuarioAdmin.apellidos', 'Parámetro usuarioAdmin.apellidos es requerido').isString().notEmpty(),
    body('usuarioAdmin.email', 'Parámetro usuarioAdmin.email debe ser un email válido').isEmail(),
    body('usuarioAdmin.documento', 'Parámetro usuarioAdmin.documento es requerido').isString().notEmpty(),
    body('usuarioAdmin.telefono', 'Parámetro usuarioAdmin.telefono es requerido').isString().notEmpty(),
    body('usuarioAdmin.password', 'Parámetro usuarioAdmin.password es requerido').isString().isLength({ min: 8 }),

    // Certificado (clave/alias van en `data`, el binario va en el campo "certificado")
    body('certificado.alias', 'Parámetro certificado.alias es requerido').isString().notEmpty(),
    body('certificado.clave', 'Parámetro certificado.clave es requerido').isString().notEmpty(),
    body().custom((_, { req }) => {
        if (!req.files || !req.files.certificado || req.files.certificado.length === 0) {
            throw new Error('El archivo del certificado (.p12 o .pfx) es requerido en el campo "certificado"');
        }
        return true;
    }),

    // Logo (obligatorio: lo usa la generación de PDF de factura/nota de crédito/recibo)
    body().custom((_, { req }) => {
        if (!req.files || !req.files.logo || req.files.logo.length === 0) {
            throw new Error('El archivo del logo (.png, .jpg o .jpeg) es requerido en el campo "logo"');
        }
        return true;
    }),

    empresaController.crearEmpresa
);

routes.get(
    '/',
    authJwt(['SUPERADMIN']),
    query('page').optional().isInt({ min: 1 }).withMessage('Parámetro page debe ser un entero >= 1'),
    query('itemsPerPage').optional().isInt({ min: 1 }).withMessage('Parámetro itemsPerPage debe ser un entero >= 1'),
    query('filter').optional().isString(),
    empresaController.getEmpresas
);

routes.get(
    '/:id',
    authJwt(['SUPERADMIN']),
    param('id').isInt({ min: 1 }).withMessage('Parámetro :id inválido'),
    empresaController.getEmpresaById
);

/**
 * Update PARCIAL de los datos propios de `Empresa` — a propósito NO acepta
 * establecimientos/cajas/secuencias/usuarios: son otros recursos, y editar secuencias desde
 * acá podría desalinearlas contra la numeración fiscal ya emitida. `certificado` y `logo` SÍ
 * se aceptan como caso especial (ver más abajo), porque hay que poder renovar un certificado
 * a punto de vencer / reemplazar el logo sin pasar por otro endpoint.
 *
 * Todos los campos de texto son opcionales (se actualiza solo lo que venga en el body), pero
 * al menos uno (incluyendo certificado/logo) debe estar presente.
 *
 * Content-Type: si no se toca certificado ni logo, sigue siendo `application/json` plano como
 * siempre. Si se quiere renovar el certificado y/o reemplazar el logo, la request tiene que
 * ser `multipart/form-data` con el mismo esquema `data` + archivos que usa el POST (ver
 * `parseDataFieldIfMultipart`).
 */
routes.put(
    '/:id',
    authJwt(['SUPERADMIN']),
    handleUploadEmpresaArchivos,
    comprimirLogoSubido,
    parseDataFieldIfMultipart,

    param('id').isInt({ min: 1 }).withMessage('Parámetro :id inválido'),

    body('ruc').optional().isString().notEmpty().withMessage('Parámetro ruc debe ser un string no vacío'),
    body('rucSinDv').optional().matches(/^\d{1,8}$/).withMessage('Parámetro rucSinDv debe ser numérico de hasta 8 dígitos'),
    body('digitoVerificador').optional().matches(/^\d$/).withMessage('Parámetro digitoVerificador debe ser un único dígito'),
    body('nombreEmpresa').optional().isString().notEmpty().withMessage('Parámetro nombreEmpresa debe ser un string no vacío'),
    body('timbrado').optional().isString().notEmpty().withMessage('Parámetro timbrado debe ser un string no vacío'),
    body('direccion').optional().isString().notEmpty().withMessage('Parámetro direccion debe ser un string no vacío'),
    body('vigenteDesde').optional().isISO8601().withMessage('Parámetro vigenteDesde debe ser una fecha ISO8601 válida'),
    // `null` es válido acá: es la forma de borrar el fin de vigencia del timbrado (la columna es
    // nullable). Con `optional({ nullable: true })` express-validator saltea la validación y el valor
    // igual llega al service, que lo traduce a NULL.
    body('vigenteHasta').optional({ nullable: true }).isISO8601()
        .withMessage('Parámetro vigenteHasta debe ser una fecha ISO8601 válida'),
    body('telefono').optional().isString().notEmpty().withMessage('Parámetro telefono debe ser un string no vacío'),
    body('email').optional().isEmail().withMessage('Parámetro email debe ser un email válido'),
    body('ciudad').optional().isString().notEmpty().withMessage('Parámetro ciudad debe ser un string no vacío'),
    body('tipoContribuyente').optional().isIn(['FISICA', 'JURIDICA']).withMessage('Parámetro tipoContribuyente inválido'),
    body('tipoImpuesto').optional().isIn(['IVA', 'ISC', 'RENTA', 'NINGUNO', 'IVA_RENTA']).withMessage('Parámetro tipoImpuesto inválido'),
    body('codActividadPrincipal').optional().isString().notEmpty().withMessage('Parámetro codActividadPrincipal debe ser un string no vacío'),
    body('descActividadPrincipal').optional().isString().notEmpty().withMessage('Parámetro descActividadPrincipal debe ser un string no vacío'),
    body('codActividadSecundaria').optional().isString(),
    body('descActividadSecundaria').optional().isString(),
    body('codMoneda').optional().isString().isLength({ min: 3, max: 3 }),
    body('descMoneda').optional().isString(),
    body('csc').optional().isString().notEmpty().withMessage('Parámetro csc debe ser un string no vacío'),
    body('cscId').optional().isString().notEmpty().withMessage('Parámetro cscId debe ser un string no vacío'),
    body('plantillaPdf').optional().isIn(PLANTILLAS_PDF)
        .withMessage(`Parámetro plantillaPdf inválido (valores: ${PLANTILLAS_PDF.join(', ')})`),
    body('duplicarDoc').optional().isBoolean()
        .withMessage('Parámetro duplicarDoc debe ser booleano').toBoolean(),

    // Certificado: alias/clave son opcionales, pero si se quiere renovar tienen que venir los
    // tres juntos (alias + clave + archivo) — un certificado a medio informar no sirve para
    // nada y complicaría el estado de `Certificado` innecesariamente.
    body('certificado.alias').optional().isString().notEmpty().withMessage('Parámetro certificado.alias debe ser un string no vacío'),
    body('certificado.clave').optional().isString().notEmpty().withMessage('Parámetro certificado.clave debe ser un string no vacío'),
    body().custom((value, { req }) => {
        const tieneAlias = !!(value && value.certificado && value.certificado.alias);
        const tieneClave = !!(value && value.certificado && value.certificado.clave);
        const tieneArchivo = !!(req.files && req.files.certificado && req.files.certificado.length > 0);
        if ((tieneAlias || tieneClave || tieneArchivo) && !(tieneAlias && tieneClave && tieneArchivo)) {
            throw new Error('Para renovar el certificado deben informarse certificado.alias, certificado.clave y el archivo (.p12/.pfx) juntos');
        }
        return true;
    }),

    body().custom((value, { req }) => {
        const tieneCambiosDeTexto = !!(value && Object.keys(value).length > 0);
        const tieneArchivos = !!(req.files && (req.files.certificado || req.files.logo));
        if (!tieneCambiosDeTexto && !tieneArchivos) {
            throw new Error('Debe informarse al menos un campo a actualizar');
        }
        return true;
    }),

    empresaController.actualizarEmpresa
);

module.exports = routes;
