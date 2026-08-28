const { validationResult } = require('express-validator');
const procesarFacturaService = require('../services/procesarFacturaService');
const Response = require('../utils/response');
const ErrorApp = require('../utils/error');

const procesarFactura = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

    const data = await procesarFacturaService.procesarFactura(req.body, req.usuario);

    return res.status(200).send(Response.success(data, 'Ventas procesadas'));
  } catch (error) {
    const { code, message } = ErrorApp.handleControllerError(error, 'Error al procesar factura');

    return res.status(code).send(Response.error(message, code));
  }
};

// GET /procesar-factura/pendientes — cola de ventas nominadas de un día que la caja todavía no facturó.
// Sin ?fecha se lista el día en curso. Lo consume el front por polling; consulta MSSQL en vivo (no hay
// copia local del estado).
const listarPendientes = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

    const data = await procesarFacturaService.listarVentasPendientes(req.usuario, req.query.fecha);

    return res.status(200).send(Response.success(data, 'Ventas pendientes'));
  } catch (error) {
    const { code, message } = ErrorApp.handleControllerError(error, 'Error al listar ventas pendientes');

    return res.status(code).send(Response.error(message, code));
  }
};

// El service devuelve el resultado del candado en vez de lanzar (así una falla de emisión no se confunde
// con un error de infraestructura), pero para el front conviene un status HTTP que distinga los casos sin
// tener que leer el body: sólo PROCESADA es éxito — es el único caso donde hay un KUDE para imprimir.
const HTTP_POR_RESULTADO = {
  YA_PROCESADA: 409, // otra caja (o un doble clic) ya ganó el candado del outbox
  OMITIDA: 409,      // la venta no tiene evento ALTA en el outbox
  ERROR: 502,        // la emisión falló; el candado ya volvió a PENDIENTE y se puede reintentar
};

// POST /procesar-factura/venta/:ventaId — botón "Generar factura". Responde con el `pdf_nombre` del KUDE
// ya generado, que el front abre desde /public para imprimir.
const emitirVenta = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).send(new Response('error', 400, errors.array(), 'Error de validación'));

    const data = await procesarFacturaService.emitirVentaPorId(Number(req.params.ventaId), req.usuario);

    if (data.resultado !== 'PROCESADA') {
      const code = HTTP_POR_RESULTADO[data.resultado] || 500;

      return res.status(code).send(Response.error(data.error || `La venta no se emitió (${data.resultado})`, code, data));
    }

    return res.status(200).send(Response.success(data, 'Factura generada'));
  } catch (error) {
    const { code, message } = ErrorApp.handleControllerError(error, 'Error al generar la factura de la venta');

    return res.status(code).send(Response.error(message, code));
  }
};

module.exports = {
  procesarFactura,
  listarPendientes,
  emitirVenta,
};
