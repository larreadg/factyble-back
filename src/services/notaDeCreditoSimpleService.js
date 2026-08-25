const { validationResult } = require("express-validator");
const prisma = require("../prisma/cliente");
const ErrorApp = require("../utils/error");
const { calcularImpuesto, calcularTotalItem } = require("../utils/facturacion");
const { validadoresNotaCreditoSimple } = require("../validators/notaCreditoSimpleValidators");
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

// Alta masiva de notas de crédito simples (carga por planilla): el caller manda un array de objetos, cada uno
// con el mismo shape que POST /nota-credito/simple. Se devuelve un array espejo `resultados` en el MISMO orden
// que la entrada, donde el elemento en la posición `i` corresponde a la NC `i`. El procesamiento es
// deliberadamente secuencial: emitirNotaDeCredito numera con un UPDATE transaccional sobre la secuencia y
// envía a SIFEN, así que serializar evita carreras de numeración y no golpea a SIFEN en paralelo. Cada NC se
// valida y emite de forma aislada: un ítem inválido o una emisión fallida produce un resultado de error propio
// sin abortar el resto del lote (mismo criterio de aislamiento por documento del pipeline SIFEN).
// Idéntico patrón a facturaSimpleService.emitirFacturasBulk.
const emitirNotasDeCreditoBulk = async (notasDeCredito, datosUsuario) => {
  try {
    const resultados = [];

    for (let i = 0; i < notasDeCredito.length; i++) {
      // Se valida cada elemento reutilizando exactamente las reglas de /nota-credito/simple, corriéndolas de
      // forma imperativa contra un req sintético `{ body: item }`. Los sanitizers (p. ej. idExterno a string)
      // mutan ese body, por eso a emitirNotaDeCreditoSimple se le pasa `reqItem.body` ya saneado.
      const reqItem = { body: notasDeCredito[i] };

      for (const validador of validadoresNotaCreditoSimple) {
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
        const data = await emitirNotaDeCreditoSimple(reqItem.body, datosUsuario);
        resultados.push({
          indice: i,
          status: "success",
          code: 200,
          message: "Nota de crédito creada",
          errores: null,
          data,
        });
      } catch (error) {
        const { code, message } = ErrorApp.handleControllerError(error, "Error al crear nota de crédito");
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
    ErrorApp.handleServiceError(error, "Error al procesar notas de crédito en lote");
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
  emitirNotasDeCreditoBulk,
  cancelarNotaDeCreditoSimple,
};
