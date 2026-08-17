const routes = require('express').Router();
const { body } = require('express-validator');
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

module.exports = routes;
