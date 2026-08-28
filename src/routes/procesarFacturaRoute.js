const routes = require('express').Router();
const { body, param, query } = require('express-validator');
const procesarFacturaController = require('../controllers/procesarFacturaController');
const { authJwt } = require('../middleware/authJwt');

// Valida que un 'dd/mm/yyyy' sea una fecha calendario real (el regex sólo garantiza el formato).
const esFechaValida = (value) => {
  const [dd, mm, yyyy] = value.split('/').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
};

// POST /procesar-factura — toma las ventas de PVTA (MSSQL) de un cliente/fecha y emite su factura
// electrónica, usando FACTYBLE_SIFEN_OUTBOX como candado anti-doble-emisión. Ver procesarFacturaService.js.
routes.post(
  '/',
  authJwt(['ADMIN']),
  body('fecha', 'Parámetro fecha requerido con formato dd/mm/yyyy')
    .matches(/^\d{2}\/\d{2}\/\d{4}$/)
    .withMessage('El parámetro fecha debe tener formato dd/mm/yyyy')
    .custom(esFechaValida)
    .withMessage('El parámetro fecha no es una fecha válida'),
  body('ruc', 'Parámetro ruc requerido').isString().trim().notEmpty(),
  procesarFacturaController.procesarFactura
);

// Valida que un 'yyyy-mm-dd' sea una fecha calendario real (el regex sólo garantiza el formato).
const esFechaIsoValida = (value) => {
  const [yyyy, mm, dd] = value.split('-').map(Number);
  const d = new Date(yyyy, mm - 1, dd);

  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
};

// GET /procesar-factura/pendientes[?fecha=yyyy-mm-dd] — ventas NOMINADAS pendientes de facturar de ese
// día, leídas en vivo de la vista de PVTA. Sin `fecha` se lista el día en curso, que es el caso normal;
// el parámetro existe para poder facturar una venta de ayer (una cerrada 23:58 sale del "hoy" apenas
// pasa medianoche). Es lo que pollea la pantalla de caja; las innominadas no aparecen acá (las emite el
// cron, ver cronJobsPvta.js).
//
// El formato es ISO y no el 'dd/mm/yyyy' del POST de abajo a propósito: en un query param conviene el
// orden inequívoco (dd/mm vs mm/dd), y es lo que produce nativamente un <input type='date'> en el front.
routes.get(
  '/pendientes',
  authJwt(['ADMIN']),
  query('fecha')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('El parámetro fecha debe tener formato yyyy-mm-dd')
    .custom(esFechaIsoValida)
    .withMessage('El parámetro fecha no es una fecha válida'),
  procesarFacturaController.listarPendientes
);

// POST /procesar-factura/venta/:ventaId — botón "Generar factura" de la caja: emite esa venta puntual y
// devuelve el `pdf_nombre` del KUDE para imprimir. Idempotente vía el candado del outbox.
routes.post(
  '/venta/:ventaId',
  authJwt(['ADMIN']),
  param('ventaId', 'Parámetro ventaId requerido')
    .isInt({ min: 1 })
    .withMessage('El parámetro ventaId debe ser un entero positivo'),
  procesarFacturaController.emitirVenta
);

module.exports = routes;
