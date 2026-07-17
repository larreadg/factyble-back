const prisma = require("../prisma/cliente");
const ErrorApp = require("../utils/error");
const { calcularImpuesto } = require("../utils/facturacion");
const facturaService = require("./facturaService");

// Facturación simplificada para integraciones tipo bot (ver CLAUDE.md): el caller sólo manda datos del
// cliente e items, y este service arma el payload que espera facturaService.emitirFactura, resolviendo
// por su cuenta establecimiento/caja (siempre el primero de la empresa, no hay selección posible acá).
const emitirFacturaSimple = async (datos, datosUsuario) => {
  try {
    const establecimiento = await prisma.establecimiento.findFirst({
      where: { empresa_id: datosUsuario.empresaId },
      orderBy: { id: "asc" },
    });

    if (!establecimiento) {
      throw new ErrorApp("La empresa no tiene establecimientos configurados", 404);
    }

    const caja = await prisma.caja.findFirst({
      where: { establecimiento_id: establecimiento.id },
      orderBy: { id: "asc" },
    });

    if (!caja) {
      throw new ErrorApp("La empresa no tiene cajas configuradas", 404);
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
      situacionTributaria: datos.situacionTributaria,
      tipoIdentificacion: datos.situacionTributaria === "CONTRIBUYENTE" ? "RUC" : "CEDULA",
      ruc: datos.personaDocumento,
      razonSocial: datos.personaNombre,
      direccion: "",
      email: "",
      pais: "",
      condicionVenta: datos.condicionVenta,
      total,
      totalIva,
      items,
      establecimiento: establecimiento.codigo,
      caja: caja.codigo,
    };

    // Crédito simplificado: siempre "a plazo" con una descripción fija — facturaService.emitirFactura
    // sólo lee plazoDescripcion para esta rama (no cantidadCuota/periodicidad, ver facturaService.js).
    if (datos.condicionVenta === "CREDITO") {
      datosCompletos.tipoCredito = "A_PLAZO";
      datosCompletos.plazoDescripcion = "Plazo flexible";
    }

    return await facturaService.emitirFactura(datosCompletos, datosUsuario);
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al crear factura simple");
  }
};

// Cancelación simplificada: el caller sólo manda el cdc, sin motivo — se usa un motivo fijo y se
// delega en facturaService.cancelarFactura (misma validación de estado/NC vinculadas que la
// cancelación por facturaId, ver facturaService.js).
const cancelarFacturaSimple = async (datos, datosUsuario) => {
  try {
    const factura = await prisma.factura.findFirst({
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

    if (!factura) {
      throw new ErrorApp("Factura no encontrada", 404);
    }

    return await facturaService.cancelarFactura(
      { facturaId: factura.id, motivo: "A pedido del usuario" },
      datosUsuario
    );
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al cancelar factura simple");
  }
};

module.exports = {
  emitirFacturaSimple,
  cancelarFacturaSimple,
};
