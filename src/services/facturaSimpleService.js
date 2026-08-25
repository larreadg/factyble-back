const { validationResult } = require("express-validator");
const prisma = require("../prisma/cliente");
const ErrorApp = require("../utils/error");
const { calcularImpuesto, calcularTotalItem } = require("../utils/facturacion");
const { validadoresFacturaSimple } = require("../validators/facturaSimpleValidators");
const facturaService = require("./facturaService");

// Facturación simplificada para integraciones tipo bot (ver CLAUDE.md): el caller sólo manda datos del
// cliente e items, y este service arma el payload que espera facturaService.emitirFactura. El
// establecimiento/caja son opcionales: si el caller manda sus códigos (datos.establecimiento/datos.caja)
// se usan esos; si no vienen o vienen vacíos se cae al primero de la empresa (comportamiento histórico).
const emitirFacturaSimple = async (datos, datosUsuario) => {
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
      const total = calcularTotalItem(item.cantidad, item.precioUnitario);
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
      // Factura innominada (consumidor final no identificado): facturaService.emitirFactura ignora los
      // datos de receptor y usa el Cliente sentinela. Los campos persona* pueden venir ausentes.
      innominado: datos.innominado === true,
      situacionTributaria: datos.situacionTributaria,
      tipoIdentificacion: datos.situacionTributaria === "CONTRIBUYENTE" ? "RUC" : "CEDULA",
      ruc: datos.personaDocumento,
      razonSocial: datos.personaNombre,
      direccion: "",
      email: datos.personaEmail || "",
      pais: "",
      condicionVenta: datos.condicionVenta,
      total,
      totalIva,
      items,
      establecimiento: establecimiento.codigo,
      caja: caja.codigo,
      idExterno: datos.idExterno,
      fuente: "BOT",
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

// Alta masiva de facturas simples (carga por planilla): el caller manda un array de objetos, cada uno con el
// mismo shape que POST /factura/simple. Se devuelve un array espejo `resultados` en el MISMO orden que la
// entrada, donde el elemento en la posición `i` corresponde a la factura `i`. El procesamiento es
// deliberadamente secuencial: emitirFactura numera con un UPDATE transaccional sobre secuencia_factura y
// envía a SIFEN, así que serializar evita carreras de numeración y no golpea a SIFEN en paralelo. Cada
// factura se valida y emite de forma aislada: un ítem inválido o una emisión fallida produce un resultado de
// error propio sin abortar el resto del lote (mismo criterio de aislamiento por documento del pipeline SIFEN).
const emitirFacturasBulk = async (facturas, datosUsuario) => {
  try {
    const resultados = [];

    for (let i = 0; i < facturas.length; i++) {
      // Se valida cada elemento reutilizando exactamente las reglas de /factura/simple, corriéndolas de
      // forma imperativa contra un req sintético `{ body: item }`. Los sanitizers (p. ej. idExterno a
      // string) mutan ese body, por eso a emitirFacturaSimple se le pasa `reqItem.body` ya saneado.
      const reqItem = { body: facturas[i] };

      for (const validador of validadoresFacturaSimple) {
        await validador.run(reqItem);
      }

      const errores = validationResult(reqItem);
      if (!errores.isEmpty()) {
        resultados.push({
          indice: i,
          status: "error",
          code: 400,
          message: "Error de validación",
          errores: errores.array(),
          data: null,
        });
        continue;
      }

      try {
        const data = await emitirFacturaSimple(reqItem.body, datosUsuario);
        resultados.push({
          indice: i,
          status: "success",
          code: 200,
          message: "Factura creada",
          errores: null,
          data,
        });
      } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, "Error al crear factura");
        resultados.push({
          indice: i,
          status: "error",
          code,
          message,
          errores: null,
          data: null,
        });
      }
    }

    const exitosas = resultados.filter((r) => r.status === "success").length;

    return {
      resumen: {
        total: resultados.length,
        exitosas,
        fallidas: resultados.length - exitosas,
      },
      resultados,
    };
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al procesar facturas en lote");
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

    const resultado = await facturaService.cancelarFactura(
      { facturaId: factura.id, motivo: "A pedido del usuario" },
      datosUsuario
    );

    await prisma.factura.update({
      where: { id: factura.id },
      data: { fuente: "BOT" },
    });

    return resultado;
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al cancelar factura simple");
  }
};

module.exports = {
  emitirFacturaSimple,
  emitirFacturasBulk,
  cancelarFacturaSimple,
};
