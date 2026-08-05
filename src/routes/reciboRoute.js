const routes = require('express').Router();
const { body, param, query } = require('express-validator');
const reciboController = require('../controllers/reciboController');
const { authJwt } = require('../middleware/authJwt');
const { validarFields } = require('../utils/fields');
const { CAMPOS_RECIBO } = require('../services/reciboService');

const normalizarTipo = (tipo) =>
  String(tipo ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();

const esTipoMedioValido = (tipo) => {
  const t = normalizarTipo(tipo);
  return t === 'CHEQUE' || t === 'TRANSFERENCIA';
};

const esTipoDocumentoValido = (tipo) => {
  const t = normalizarTipo(tipo);
  return t === 'FACTURA' || t === 'NOTA DE CREDITO';
};

routes.post(
  '/',
  authJwt(['ADMIN']),
  body('cheques', 'Parametro cheques requerido').isArray(),
  body('cheques.*', 'Cada cheque debe ser un objeto').isObject(),
  body('cheques.*.banco', 'Parametro banco dentro de cheques requerido')
    .notEmpty()
    .isString(),
  body('cheques.*.numero', 'Parametro numero dentro de cheques requerido')
    .notEmpty()
    .isString(),
  body('cheques.*.monto', 'Parametro monto dentro de cheques requerido').isInt({ min: 0 }),
  body('cheques.*.tipo', 'Parametro tipo dentro de cheques invalido')
    .notEmpty()
    .custom((v) => esTipoMedioValido(v)),
  body('totalEfectivo', 'Parametro totalEfectivo requerido').isInt({ min: 0 }),
  body('concepto', 'Parametro concepto requerido').notEmpty().isString(),
  body('facturas', 'Parametro facturas requerido').isArray({ min: 1 }),
  body('facturas.*', 'Cada factura debe ser un objeto').isObject(),
  body('facturas.*.numeroFactura', 'Parametro numeroFactura dentro de facturas requerido')
    .notEmpty()
    .isString(),
  body('facturas.*.montoAplicado', 'Parametro montoAplicado dentro de facturas requerido').isInt({ min: 1 }),
  body('facturas.*.tipo', 'Parametro tipo dentro de facturas invalido')
    .notEmpty()
    .custom((v) => esTipoDocumentoValido(v)),
  body('caja')
    .matches(/^\d{3}$/)
    .withMessage('El parametro caja debe tener exactamente 3 digitos entre 001 y 999')
    .custom((v) => {
      const n = parseInt(v, 10);
      if (n < 1 || n > 999) return false;
      return true;
    })
    .withMessage('Parametro caja invalido'),
  body('establecimiento')
    .matches(/^\d{3}$/)
    .withMessage('El parametro establecimiento debe tener exactamente 3 digitos entre 001 y 999')
    .custom((v) => {
      const n = parseInt(v, 10);
      if (n < 1 || n > 999) return false;
      return true;
    })
    .withMessage('Parametro establecimiento invalido'),
  body('ruc', 'Parametro ruc requerido')
    .notEmpty()
    .custom((v) => {
      const t = typeof v;
      if (t !== 'string' && t !== 'number') return false;
      return String(v).trim().length > 0;
    }),
  body('razonSocial', 'Parametro razonSocial requerido').notEmpty().isString(),
  body('email', 'Parametro email requerido').isEmail(),
  body('idExterno', 'Parametro idExterno invalido').optional({ checkFalsy: true })
    .custom((v) => ['string', 'number'].includes(typeof v)).customSanitizer((v) => String(v)).isLength({ max: 255 }),
  reciboController.emitirRecibo
);

routes.get(
  '/',
  authJwt(['ADMIN']),
  query('fields').optional().isString().bail().custom(validarFields(CAMPOS_RECIBO)),
  reciboController.getRecibos
);

routes.get(
  '/id-externo/:id',
  authJwt(['ADMIN']),
  param('id', 'Parametro :id requerido').isString().notEmpty().isLength({ max: 255 }),
  query('fields').optional().isString().bail().custom(validarFields(CAMPOS_RECIBO)),
  reciboController.getReciboByIdExterno
);

module.exports = routes;
