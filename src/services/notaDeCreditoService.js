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
        empresa_id: datosUsuario.empresaId,
      },
    });

    if (!establecimiento) {
      throw new ErrorApp("No se encontró establecimiento", 404);
    }

    // Buscar caja para establecimiento
    const caja = await prisma.caja.findFirst({
      where: {
        codigo: datos.caja,
        establecimiento_id: establecimiento.id,
      },
    });

    if (!caja) {
      throw new ErrorApp("No se encontró caja", 404);
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

    // Buscar factura y verificar condicion_venta = CONTADO y no este Cancelado
    const factura = await prisma.factura.findFirst({
      where: {
        cdc: datos.cdc,
        condicion_venta: "CONTADO",
        sifen_estado: { not: "Cancelado" },
      },
      include: {
        cliente_empresa: {
          include: {
            cliente: true,
          },
        },
      },
    });

    if (!factura) {
      throw new ErrorApp("No se encontró cdc", 404);
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

    // Buscar si ya hay nota de crédito para la factura dada
    const notasDeCredito = await prisma.notaCredito.findMany({
      where: {
        factura_id: factura.id,
      },
    });

    // Verificar que el total de las notas de crédito anteriores más el de ahora no supere el total de la factura
    if (notasDeCredito && notasDeCredito.length > 0) {
      let totalNotasDeCredito = total;
      notasDeCredito.forEach((e) => {
        totalNotasDeCredito += Number(e.total);
      });

      if (totalNotasDeCredito > factura.total) {
        throw new ErrorApp(
          "El total de las notas de crédito supera el valor total de la factura",
          400
        );
      }
    }

    // Datos adicionales
    const notaDeCreditoUuid = uuidv4();

    // Se usa transacción y FOR UPDATE para bloquear la tabla al crear el número de factura por si hay concurrencia
    const notaDeCredito = await prisma.$transaction(async (tx) => {
      const secuencia =
        await tx.$queryRaw`SELECT valor FROM secuencia_nota_credito WHERE caja_id = ${caja.id} FOR UPDATE`;

      if (!secuencia || secuencia.length === 0) {
        throw new ErrorApp("Secuencia no encontrada", 404);
      }

      const numeroNotaDeCredito = Number(secuencia[0].valor) + 1;
      await tx.$executeRaw`UPDATE secuencia_nota_credito SET valor = ${numeroNotaDeCredito} WHERE caja_id = ${caja.id}`;

      const codigosSeguridadRaw = await prisma.notaCredito.findMany({
        select: {
          codigo_seguridad: true,
        },
        where: {
          caja_id: caja.id,
        },
      });

      const codigosSeguridad = codigosSeguridadRaw.map(
        (e) => e.codigo_seguridad
      );

      let codigoSeguridadAleatorio = generarCodigoSeguridad();

      while (codigosSeguridad.includes(codigoSeguridadAleatorio)) {
        codigoSeguridadAleatorio = generarCodigoSeguridad();
      }

      // Llamar a la API de facturación
      const resultado = await apiFacturacionElectronicaNotaDeCredito({
        ...datos,
        codigoSeguridadAleatorio,
        notaDeCreditoUuid,
        numeroNotaDeCredito,
        empresaRuc: usuario.empresa.ruc,
        clienteRuc: factura.cliente_empresa.cliente.ruc,
        clienteNombre: factura.cliente_empresa.cliente.nombres,
      });

      if (!resultado || resultado.status != true) {
        throw new ErrorApp("Error al generar nota de crédito", 500);
      }

      // Crear nota de crédito
      const notaDeCredito = await prisma.notaCredito.create({
        data: {
          factura_id: factura.id,
          nota_credito_uuid: notaDeCreditoUuid,
          usuario_id: usuario.id,
          total_iva: datos.totalIva,
          total: datos.total,
          cdc: resultado.cdc,
          xml: resultado.xmlLink,
          linkqr: resultado.link,
          codigo_seguridad: codigoSeguridadAleatorio,
          numero_nota_credito: numeroNotaDeCredito,
          usuario_id: usuario.id,
          caja_id: caja.id,
        },
      });

      // Agregar detalles de nota de crédito
      const datosNotaDeCreditoDetalle = datos.items.map((e) => ({
        nota_credito_id: notaDeCredito.id,
        cantidad: Number(e.cantidad),
        precio_unitario: e.precioUnitario,
        tasa: e.tasa == "0%" ? "T0" : e.tasa == "5%" ? "T5" : "T10",
        impuesto: e.impuesto,
        total: e.total,
        descripcion: e.descripcion,
      }));

      const notaDeCreditoDetalle = await prisma.notaCreditoDetalle.createMany({
        data: datosNotaDeCreditoDetalle,
      });

      return notaDeCredito;
    });

    // Crear PDF

    return notaDeCredito;
  } catch (error) {
    console.log(error);
    ErrorApp.handleServiceError(error);
  }
};

const apiFacturacionElectronicaNotaDeCredito = async (datos) => {
  // return {status: true, recordID: '123', cdc: 'test', link: 'test', xmlLink: 'test'}

  const form = new FormData();

  let pagos = [
    {
      name: "cash",
      tipoPago: "99", // 1 (efectivo), 3 (TC), 4 (TD), 99 (Otros)
      monto: Number(datos.total),
    },
  ];

  const items = datos.items.map((e) => {
    const baseGravItem =
      e.tasa == "0%" ? 0 : Number(e.total) - Number(e.impuesto);
    const ivaTasa = e.tasa == "0%" ? 0 : e.tasa == "5%" ? 5 : 10;
    const ivaAfecta = e.tasa == "0%" ? 3 : 1;

    return {
      descripcion: e.descripcion,
      codigo: "0011",
      unidadMedida: 77, // 77 (Unidad), 83 (kg)
      ivaTasa,
      ivaAfecta,
      cantidad: Number(e.cantidad),
      precioUnitario: Number(e.precioUnitario),
      precioTotal: Number(e.total),
      liqIvaItem: Number(e.impuesto),
      baseGravItem,
    };
  });

  //Armar datajson
  let data = {
    ruc: datos.empresaRuc,
    fecha: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    documentoAsociado: {
      remision: false,
      tipoDocumento: 1,
      cdcAsociado: datos.cdc,
    },
    establecimiento: datos.establecimiento,
    punto: datos.caja,
    numero: String(datos.numeroNotaDeCredito),
    descripcion: ".",
    tipoDocumento: 5, // 1 (Factura), 5 (Nota de crédito), 7 (Nota de remision)
    tipoEmision: 1,
    tipoTransaccion: 1, // 1 (Venta presencial)
    receiptid: datos.notaDeCreditoUuid,
    condicionPago: 1, // condicion_venta = CONTADO
    moneda: "PYG",
    cambio: 0, // Porque moneda = "PYG"
    cliente: {
      ruc: datos.clienteRuc,
      nombre: datos.clienteNombre,
      diplomatico: false, //Cuando un cliente es diplomatico (true). Todo tiene que ir como exenta
    },
    codigoSeguridadAleatorio: datos.codigoSeguridadAleatorio,
    items,
    pagos,
    totalPago: Number(datos.total),
    totalRedondeo: 0,
  };

  const datajson = JSON.stringify(data, null, 2);

  form.append("datajson", datajson);
  form.append("recordID", "123");
  console.log(data);

  const { data: { data: resultado } = {} } = await axios({
    url: `${process.env.URL_API_FACT}/data.php`,
    method: "POST",
    data: form,
    headers: {
      ...form.getHeaders(),
    },
  });

  console.log(resultado);

  return resultado;
};

const generarCodigoSeguridad = (length = 9) => {
  let result = "";
  const characters = "0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const getNotasDeCredito = async (
  page = 1,
  itemsPerPage = 10,
  filter = null,
  empresaId
) => {
  try {
    const skip = (page - 1) * itemsPerPage;
    const take = itemsPerPage;

    const establecimientos = await prisma.establecimiento.findMany({
      where: {
        empresa_id: empresaId,
      },
      include: {
        cajas: true,
      },
    });

    const cajasIds = [];

    for (const establecimiento of establecimientos) {
      for (const caja of establecimiento.cajas) {
        cajasIds.push(caja.id);
      }
    }

    let notasCredito = [];
    let totalItems = 0;

    if (filter === null) {
      notasCredito = await prisma.notaCredito.findMany({
        skip,
        take,
        orderBy: {
          fecha_creacion: "desc",
        },
        where: {
          caja_id: {
            in: cajasIds,
          },
        },
        include: {
          factura: true,
        },
      });

      totalItems = await prisma.notaCredito.count({
        where: {
          caja_id: {
            in: cajasIds,
          },
        },
      });
    } else {
      const factura = await prisma.factura.findFirst({
        skip,
        take,
        orderBy: {
          fecha_creacion: "desc",
        },
        where: {
          OR: [
            { cdc: filter },
            { numero_factura: !isNaN(filter) && String(filter).length <= 7 ? Number(filter) : 0 },
          ],
        },
      });

      if (factura) {
        notasCredito = await prisma.notaCredito.findMany({
          where: {
            factura_id: factura.id,
          },
          include: {
            factura: true,
          },
        });

        totalItems = await prisma.notaCredito.count({
          where: {
            factura_id: factura.id,
          },
        });
      }
    }

    return {
      items: notasCredito,
      page,
      itemsPerPage,
      totalItems,
    };
  } catch (error) {
    console.log(error);
    ErrorApp.handleServiceError(error, "Error al obtener notas de crédito");
  }
};

module.exports = {
  emitirNotaDeCredito,
  getNotasDeCredito,
};
