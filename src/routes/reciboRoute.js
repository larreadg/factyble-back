const routes = require('express').Router();
const { body, param, query } = require('express-validator');
const reciboController = require('../controllers/reciboController');
const { authJwt } = require('../middleware/authJwt');
const { validarFields } = require('../utils/fields');
const { CAMPOS_RECIBO, CAMPOS_CONSULTA_LOTE_RECIBO } = require('../services/reciboService');
const { validadoresRecibo } = require('../validators/reciboValidators');
const { MAX_NUMEROS_CONSULTA_LOTE } = require('../utils/consultaLote');

routes.post(
  '/',
  authJwt(['ADMIN']),
  ...validadoresRecibo,
  reciboController.emitirRecibo
);

// Alta masiva: el body es un array con exactamente el mismo shape que POST /recibo por elemento (recibo no
// tiene versi\u00f3n "simple"). La validaci\u00f3n de cada recibo se corre por \u00edtem dentro del service (array espejo),
// por eso aqu\u00ed s\u00f3lo se valida el contenedor: que sea un array no vac\u00edo y acotado. La respuesta es un array de
// resultados en el mismo orden que la entrada, donde cada elemento indica \u00e9xito o error de ese recibo.
routes.post(
  '/bulk-insert',
  authJwt(['ADMIN']),
  body('', 'El body debe ser un array de recibos (1 a 100)').isArray({ min: 1, max: 100 }),
  reciboController.emitirRecibosBulk
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

routes.post(
  '/id-externo/consultar-lote',
  authJwt(['ADMIN']),
  // Consulta en lote por id_externo: hasta 100 identificadores en el body. Es POST porque la lista
  // va en el body (una query string con 100 valores es frágil y tiene tope de longitud), pero no
  // muta nada. No colisiona con el GET '/id-externo/:id' de arriba: distinto método.
  // Cada elemento se sanea a string trimmeado ANTES de validarlo, así el service siempre recibe
  // strings normalizados y el eco `numero` de la respuesta coincide con lo que se indexó.
  query('fields').optional().isString().bail().custom(validarFields(CAMPOS_CONSULTA_LOTE_RECIBO)),
  body('numeros', `Parámetro numeros debe ser un array de 1 a ${MAX_NUMEROS_CONSULTA_LOTE} elementos`)
        .isArray({ min: 1, max: MAX_NUMEROS_CONSULTA_LOTE }),
  body('numeros.*', 'Cada elemento de numeros debe ser un texto o número no vacío de hasta 255 caracteres')
      .custom(v => ['string', 'number'].includes(typeof v))
      .customSanitizer(v => String(v).trim())
      .notEmpty().isLength({ max: 255 }),
  reciboController.consultarRecibosPorIdExternoLote
);

module.exports = routes;
