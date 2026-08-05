const prisma = require("../prisma/cliente");
const ErrorApp = require("../utils/error");
const { calcularImpuesto } = require("../utils/facturacion");
const notaDeCreditoService = require("./notaDeCreditoService");

// Nota de crédito simplificada para integraciones tipo bot (ver CLAUDE.md, mismo criterio que
// facturaSimpleService): el caller sólo manda el cdc de la factura a acreditar e items, y este service
// arma el payload que espera notaDeCreditoService.emitirNotaDeCredito. El establecimiento/caja son
// opcionales: si el caller manda sus códigos (datos.establecimiento/datos.caja) se usan esos; si no
// vienen o vienen vacíos se cae al primero de la empresa (comportamiento histórico). Los datos del
// cliente (ruc, razón social, email) no se piden porque emitirNotaDeCredito ya los resuelve a partir de
// la Factura original vinculada al cdc.
const emitirNotaDeCreditoSimple = async (datos, datosUsuario) => {
  try {
    const establecimiento = await prisma.establecimiento.findFirst({
      where: {
        empresa_id: datosUsuario.empresaId,
        ...(datos.establecimiento ? { codigo: datos.establecimiento } : {}),
      },
      orderBy: { id: "asc" },
    });

    if (!establecimiento) {
      throw new ErrorApp(
        datos.establecimiento
          ? `No se encontró el establecimiento con código ${datos.establecimiento}`
          : "La empresa no tiene establecimientos configurados",
        404
      );
    }

    const caja = await prisma.caja.findFirst({
      where: {
        establecimiento_id: establecimiento.id,
        ...(datos.caja ? { codigo: datos.caja } : {}),
      },
      orderBy: { id: "asc" },
    });

    if (!caja) {
      throw new ErrorApp(
        datos.caja
          ? `No se encontró la caja con código ${datos.caja} en el establecimiento ${establecimiento.codigo}`
          : "La empresa no tiene cajas configuradas",
        404
      );
    }

    const items = datos.items.map((item) => {
      const impuesto = calcularImpuesto(item.cantidad, item.precioUnitario, item.tasa);
      const total = Number(item.cantidad) * Number(item.precioUnitario);
      return {
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        tasa: item.tasa,
        impuesto,
        total,
        descripcion: item.descripcion,
      };
    });

    const total = items.reduce((acc, item) => acc + item.total, 0);
    const totalIva = items.reduce((acc, item) => acc + item.impuesto, 0);

    const datosCompletos = {
      cdc: datos.cdc,
      total,
      totalIva,
      items,
      establecimiento: establecimiento.codigo,
      caja: caja.codigo,
      idExterno: datos.idExterno,
      fuente: "BOT",
    };

    return await notaDeCreditoService.emitirNotaDeCredito(datosCompletos, datosUsuario);
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al crear nota de crédito simple");
  }
};

// Cancelación simplificada: el caller sólo manda el cdc, sin motivo — se usa un motivo fijo y se
// delega en notaDeCreditoService.cancelarNotaDeCredito (misma validación de estado que la
// cancelación por notaDeCreditoId, ver notaDeCreditoService.js).
const cancelarNotaDeCreditoSimple = async (datos, datosUsuario) => {
  try {
    const notaDeCredito = await prisma.notaCredito.findFirst({
      where: {
        AND: [
          { cdc: datos.cdc },
          {
            usuario: {
              empresa_id: datosUsuario.empresaId,
            },
          },
        ],
      },
    });

    if (!notaDeCredito) {
      throw new ErrorApp("Nota de crédito no encontrada", 404);
    }

    const resultado = await notaDeCreditoService.cancelarNotaDeCredito(
      { notaDeCreditoId: notaDeCredito.id, motivo: "A pedido del usuario" },
      datosUsuario
    );

    await prisma.notaCredito.update({
      where: { id: notaDeCredito.id },
      data: { fuente: "BOT" },
    });

    return resultado;
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al cancelar nota de crédito simple");
  }
};

module.exports = {
  emitirNotaDeCreditoSimple,
  cancelarNotaDeCreditoSimple,
};
