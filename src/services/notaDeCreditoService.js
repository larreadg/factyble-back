const dayjs = require("dayjs");
const prisma = require("../prisma/cliente");
const ErrorApp = require("../utils/error");
const { calcularImpuesto } = require("../utils/facturacion");
const FormData = require("form-data");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const emitirNotaDeCredito = async (datos, datosUsuario) => {
  try {
    // Buscar establecimiento
    const establecimiento = await prisma.establecimiento.findFirst({
      where: {
        codigo: datos.establecimiento,
        empresa_id: datosUsuario.empresaId
      }
    })

    if(!establecimiento) {
      throw new ErrorApp('No se encontró establecimiento', 404)
    }
    
    // Buscar caja para establecimiento
    const caja = await prisma.caja.findFirst({
      where: {
        codigo: datos.caja,
        establecimiento_id: establecimiento.id
      }
    })

    if(!caja) {
      throw new ErrorApp('No se encontró caja', 404)
    }

    //Buscar datos del usuario
    const usuario = await prisma.usuario.findFirst({
      where: { id: datosUsuario.id },
      include: {
        empresa: true,
      },
    });

    if (!usuario) {
      throw new ErrorApp("Usuario no encontrado", 404);
    }

    // Buscar cdc
    const cdc = await prisma.factura.findFirst({
      where: {
        cdc: datos.cdc
      }
    })

    if(!cdc) {
      throw new ErrorApp('No se encontró cdc', 404)
    }

    // Verificar cálculos
    let total = 0;
    let totalIva = 0;
    let totalIva5 = 0;
    let totalIva10 = 0;
    let totalExenta = 0;

    datos.items.forEach((e) => {
      const impuesto = calcularImpuesto(e.cantidad, e.precioUnitario, e.tasa);
      if (Number(e.impuesto) != impuesto) {
        throw new ErrorApp("Datos proporcionados incorrectos", 400);
      }

      if (Number(e.total) != Number(e.cantidad) * Number(e.precioUnitario)) {
        throw new ErrorApp("Datos proporcionados incorrectos", 400);
      }

      if (e.tasa == "0%") {
        totalExenta += e.impuesto;
      } else if (e.tasa == "5%") {
        totalIva5 += e.impuesto;
      } else {
        totalIva10 += e.impuesto;
      }

      total += Number(e.total);
      totalIva += Number(e.impuesto);
    });

    if (total != Number(datos.total) || totalIva != Number(datos.totalIva)) {
      throw new ErrorApp("Datos proporcionados incorrectos", 400);
    }

    // Datos adicionales
    const notaDeCreditoUuid = uuidv4()

    // Se usa transacción y FOR UPDATE para bloquear la tabla al crear el número de factura por si hay concurrencia
    const notaDeCredito = await prisma.$transaction(async (tx) => {
      const secuencia = await tx.$queryRaw`SELECT valor FROM secuencia_nota_credito WHERE caja_id = ${caja.id} FOR UPDATE`

      if (!secuencia || secuencia.length === 0) {
        throw new ErrorApp('Secuencia no encontrada', 404)
      }

      const numeroNotaDeCredito = Number(secuencia[0].valor) + 1;
      await tx.$executeRaw`UPDATE secuencia_nota_credito SET valor = ${numeroNotaDeCredito} WHERE caja_id = ${caja.id}`

      const codigosSeguridadRaw = await prisma.notaCredito.findMany({
        select: {
          codigo_seguridad: true,
        },
        where: {
          caja_id: caja.id
        }
      })

      const codigosSeguridad = codigosSeguridadRaw.map((e) => e.codigo_seguridad)

      let codigoSeguridadAleatorio = generarCodigoSeguridad()
  
      while (codigosSeguridad.includes(codigoSeguridadAleatorio)) {
        codigoSeguridadAleatorio = generarCodigoSeguridad()
      }

      // Llamar a la API de facturación
      const resultado = await apiFacturacionElectronicaNotaDeCredito({
        ...datos,
        codigoSeguridadAleatorio,
        notaDeCreditoUuid,
        numeroNotaDeCredito
      })

      if (!resultado || resultado.status != true) {
        throw new ErrorApp("Error al generar nota de crédito", 500)
      }

      // Crear nota de crédito
      const notaDeCredito = await prisma.notaCredito.create({
        data: {
          numero_nota_credito: numeroNotaDeCredito,
          nota_credito_uuid: notaDeCreditoUuid,
          usuario_id: usuario.id,
          total_iva: datos.totalIva,
          total: datos.total,
          cdc: resultado.cdc,
          xml: resultado.xmlLink,
          linkqr: resultado.link,
          codigo_seguridad: codigoSeguridadAleatorio,
        }
      })

      // Agregar detalles de nota de crédito
      const datosNotaDeCreditoDetalle = datos.items.map(e => ({
        nota_credito_id: notaDeCredito.id,
        cantidad: Number(e.cantidad),
        precio_unitario: e.precioUnitario,
        tasa: e.tasa == "0%" ? "T0" : e.tasa == "5%" ? "T5" : "T10",
        impuesto: e.impuesto,
        total: e.total,
        descripcion: e.descripcion,
      }))

      const notaDeCreditoDetalle = await prisma.notaCreditoDetalle.createMany({
        data: datosNotaDeCreditoDetalle
      })

      return notaDeCredito
    })

    // PDF

    return notaDeCredito

  } catch (error) {
    console.log(error);
    ErrorApp.handleServiceError(error)
  }
}

const apiFacturacionElectronicaNotaDeCredito = async (datos) => {
  const form = new FormData();

}

const generarCodigoSeguridad = (length = 9) => {
  let result = "";
  const characters = "0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

module.exports = {
    emitirNotaDeCredito
}
