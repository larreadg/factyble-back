const dayjs = require("dayjs");
const prisma = require("../prisma/cliente");
const ErrorApp = require("../utils/error");
const { calcularImpuesto } = require("../utils/facturacion");
const generarPdf = require("../utils/generarPdf");
const { v4: uuidv4 } = require("uuid");
const { conectarDbApiFacturacion } = require("../db/dbApiFacturacion");
const FormData = require("form-data");
const axios = require("axios");
const { formatNumber, formatNumberWithLeadingZeros } = require("../utils/format");
const { enviarErrorFactura, enviarFactura, enviarNotaDeCredito, enviarErrorNotaDeCredito } = require("./correoService");
const { obtenerPeriodicidad } = require("../utils/date");

const emitirFactura = async (datos, datosUsuario) => {
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

    //Buscar si existe cliente
    let cliente = await prisma.cliente.findFirst({
      where: { ruc: datos.ruc },
    });

    //Crear cliente si no existe
    if (!cliente) {
      const nombres = datos.razonSocial.includes(",") ? (datos.razonSocial.split(",")[1] ? datos.razonSocial.split(",")[1].trim() : datos.razonSocial) : datos.razonSocial;
      const apellidos = datos.razonSocial.includes(",") ? (datos.razonSocial.split(",")[0] ? datos.razonSocial.split(",")[0] : "") : "";

      cliente = await prisma.cliente.create({
        data: {
          ruc: datos.ruc,
          razon_social: datos.razonSocial,
          documento: datos.ruc,
          tipo_identificacion: datos.situacionTributaria == "CONTRIBUYENTE" ? "RUC" : "CEDULA",
          situacion_tributaria: datos.situacionTributaria,
          dv: datos.ruc.includes("-") ? Number(datos.ruc.split("-")[1]) : null,
          nombres,
          apellidos,
          direccion: datos.direccion,
          email: datos.email,
          telefono: datos.telefono,
        },
      });
    }

    //Actualizar datos de cliente
    if (datos.direccion != cliente.direccion || datos.email != cliente.email) {
      await prisma.cliente.update({
        data: {
          direccion: datos.direccion ? datos.direccion : cliente.direccion,
          email: datos.email ? datos.email : cliente.email,
        },
        where: { id: cliente.id },
      });

      cliente.direccion = datos.direccion ? datos.direccion : cliente.direccion;
      cliente.email = datos.email ? datos.email : cliente.email;
    }

    //Buscar en cliente_empresa
    let clienteEmpresa = await prisma.clienteEmpresa.findFirst({
      where: {
        AND: [{ cliente_id: cliente.id }, { empresa_id: usuario.empresa_id }],
      },
    });

    //Agregar cliente a empresa
    if (!clienteEmpresa) {
      clienteEmpresa = await prisma.clienteEmpresa.create({
        data: {
          cliente_id: cliente.id,
          empresa_id: usuario.empresa_id,
        },
      });
    }

    //Verificar cálculos
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

    //Datos adicionales
    const facturaUuid = uuidv4();

    // Se usa transacción y FOR UPDATE para bloquear la tabla al crear el número de factura por si hay concurrencia
    const factura = await prisma.$transaction(async (tx) => {
      const secuencia = await tx.$queryRaw`SELECT valor FROM secuencia_factura WHERE caja_id = ${caja.id} FOR UPDATE`

      if (!secuencia || secuencia.length === 0) {
        throw new ErrorApp('Secuencia no encontrada', 404);
      }

      const numeroFactura = Number(secuencia[0].valor) + 1;
      await tx.$executeRaw`UPDATE secuencia_factura SET valor = ${numeroFactura} WHERE caja_id = ${caja.id}`;
      
      const codigosSeguridadRaw = await prisma.factura.findMany({
        select: {
          codigo_seguridad: true,
        },
        where: {
          caja_id: caja.id
        }
      });
  
      const codigosSeguridad = codigosSeguridadRaw.map((e) => e.codigo_seguridad);
  
      let codigoSeguridadAleatorio = generarCodigoSeguridad();
  
      while (codigosSeguridad.includes(codigoSeguridadAleatorio)) {
        codigoSeguridadAleatorio = generarCodigoSeguridad();
      }

      //Llamar a la API de Facturación electrónica
      const resultado = await apiFacturacionElectronica({
        ...datos,
        facturaUuid,
        codigoSeguridadAleatorio,
        numeroFactura,
        empresaRuc: usuario.empresa.ruc
      });
  
      if (!resultado || resultado.status != true) {
        throw new ErrorApp("Error al generar factura", 500);
      }
  
      //Crear factura
      const factura = await prisma.factura.create({
        data: {
          numero_factura: numeroFactura,
          factura_uuid: facturaUuid,
          usuario_id: usuario.id,
          cliente_empresa_id: clienteEmpresa.id,
          condicion_venta: datos.condicionVenta,
          total_iva: datos.totalIva,
          total: datos.total,
          cdc: resultado.cdc,
          xml: resultado.xmlLink,
          linkqr: resultado.link,
          codigo_seguridad: codigoSeguridadAleatorio,
          caja_id: caja.id
        },
      });

      //Agregar detalles de factura
      const datosFacturaDetalle = datos.items.map((e) => ({
        id_factura: factura.id,
        cantidad: Number(e.cantidad),
        precio_unitario: e.precioUnitario,
        tasa: e.tasa == "0%" ? "T0" : e.tasa == "5%" ? "T5" : "T10",
        impuesto: e.impuesto,
        total: e.total,
        descripcion: e.descripcion,
      }));
  
      const facturaDetalle = await prisma.facturaDetalle.createMany({
        data: datosFacturaDetalle,
      });

      return factura
    })

    const itemsPdf = datos.items.map((e) => {
      const exentas = e.tasa == "0%" ? formatNumber(e.impuesto) : "0";
      const iva5 = e.tasa == "5%" ? formatNumber(e.impuesto) : "0";
      const iva10 = e.tasa == "10%" ? formatNumber(e.impuesto) : "0";
      return {
        precioUnitario: formatNumber(e.precioUnitario),
        iva5,
        iva10,
        exentas,
        descripcion: e.descripcion,
        cantidad: String(e.cantidad),
      };
    });

    const facturaPdf = generarPdf({
      empresaLogo: usuario.empresa.logo,
      empresaRuc: usuario.empresa.ruc,
      empresaTimbrado: usuario.empresa.timbrado,
      empresaVigenteDesde: dayjs(usuario.empresa.vigente_desde).format(
        "YYYY-MM-DD"
      ),
      empresaNombre: usuario.empresa.nombre_empresa,
      empresaDireccion: usuario.empresa.direccion,
      empresaTelefono: usuario.empresa.telefono,
      empresaCiudad: usuario.empresa.ciudad,
      empresaCorreoElectronico: usuario.empresa.email,
      facturaId: `${datos.establecimiento}-` + `${datos.caja}-` + formatNumberWithLeadingZeros(factura.numero_factura),
      condicionVenta: datos.condicionVenta,
      ruc: cliente.ruc,
      razonSocial: cliente.razon_social,
      correoElectronico: cliente.email,
      total: datos.total,
      totalIva: datos.totalIva,
      totalExenta,
      totalIva5,
      totalIva10,
      moneda: "PYG",
      items: itemsPdf,
      facturaUuid: facturaUuid,
      linkqr: factura.linkqr,
      cdc: factura.cdc,
    });

    return factura;

  } catch (error) {
    // console.log(error);
    ErrorApp.handleServiceError(error, "Error al crear factura");
  }
};

const apiFacturacionElectronica = async (datos) => {
  // return {status: true, recordID: '123', cdc: 'test', link: 'test', xmlLink: 'test'}

  const form = new FormData();

  const condicionPago = datos.condicionVenta == "CONTADO" ? 1 : 2;

  let pagos = [{}];
  let credito = null;

  if(datos.condicionVenta == 'CONTADO'){
    pagos = [
      {
        name: "EFECTIVO",
        tipoPago: "1", // 1 (efectivo), 3 (TC), 4 (TD),
        monto: Number(datos.total),
      }
    ]
  } else {

    if(datos.tipoCredito == 'CUOTA'){
      let cuotas = [];
      const monto = Number(datos.total) / Number(datos.cantidadCuota);
      let fechaVencimiento = dayjs();
      const periodicidad = obtenerPeriodicidad(datos.periodicidad);

      for (let i = 0; i < Number(datos.cantidadCuota); i++) {
        fechaVencimiento = fechaVencimiento.add(periodicidad.valor, periodicidad.unidad);

        const cuota = {
          numero: i + 1,
          monto,
          fechaVencimiento: fechaVencimiento.format('YYYY-MM-DD')
        }
        
        cuotas.push(cuota);
      }

      credito = {
        condicionCredito: 2,
        descripcion: 'CUOTA',
        cantidadCuota: datos.cantidadCuota,
        cuotas
      }

    }else { // A plazo

      credito = {
        condicionCredito: 1,
        descripcion: datos.plazoDescripcion.slice(0, 15) // Ej: Plazo a 30 días // Hasta 15 caracteres
      }

    }
  }

  const items = datos.items.map((e) => {
    const baseGravItem = e.tasa == "0%" ? 0 : Number(e.total) - Number(e.impuesto);
    const ivaTasa = e.tasa == "0%" ? 0 : e.tasa == "5%" ? 5 : 10;
    const ivaAfecta = e.tasa == "0%" ? 3 : 1;

    return {
      descripcion: e.descripcion ? e.descripcion.slice(0,119) : '',
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
    },
    establecimiento: datos.establecimiento,
    punto: datos.caja,
    numero: String(datos.numeroFactura),
    descripcion: ".",
    tipoDocumento: 1, // 1 (Factura), 5 (Nota de crédito), 7 (Nota de remision)
    tipoEmision: 1,
    tipoTransaccion: 1, // 1 (Venta presencial)
    receiptid: datos.facturaUuid,
    condicionPago,
    moneda: "PYG",
    cambio: 0, // Porque moneda = "PYG"
    cliente: {
      ruc: datos.ruc,
      nombre: datos.razonSocial,
      diplomatico: false, //Cuando un cliente es diplomatico (true). Todo tiene que ir como exenta
    },
    codigoSeguridadAleatorio: datos.codigoSeguridadAleatorio,
    items,
    pagos,
    credito,
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

const getFacturas = async (page = 1, itemsPerPage = 10, filter = null) => {
  try {
    const skip = (page - 1) * itemsPerPage;
    const take = itemsPerPage;

    const clienteEmpresas = await prisma.clienteEmpresa.findMany({
      where: {
        cliente: {
          ...(filter && {
            OR: [
              { ruc: { contains: filter } },
              { documento: { contains: filter } },
              { nombres: { contains: filter } },
              { apellidos: { contains: filter } },
              { razon_social: { contains: filter } },
              { email: { contains: filter } },
            ],
          }),
        },
      },
      select: {
        id: true,
      },
    });

    const clienteEmpresaIds = clienteEmpresas.map((ce) => ce.id);

    const facturas = await prisma.factura.findMany({
      skip,
      take,
      orderBy: {
        fecha_creacion: "desc",
      },
      where: {
        cliente_empresa_id: {
          in: clienteEmpresaIds,
        },
      },
      include: {
        detalles: true,
        cliente_empresa: {
          include: {
            cliente: true,
          },
        },
      },
    });

    const totalItems = await prisma.factura.count({
      where: {
        cliente_empresa_id: {
          in: clienteEmpresaIds,
        },
      },
    });

    return {
      items: facturas,
      page,
      itemsPerPage,
      totalItems,
    };
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al obtener facturas");
  }
};

const getFacturaById = async (id) => {
  try {
    const factura = await prisma.factura.findFirst({
      where: {
        id: Number(id),
      },
      include: {
        detalles: true,
      },
    });

    if (!factura) {
      throw new ErrorApp(`Factura con ID ${id} no encontrado`, 404);
    }

    return factura;
  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al obtener datos de factura");
  }
};

const checkFacturaStatus = async () => {
  console.log(`${new Date().toISOString()} checkFacturaStatus Iniciado`);
  const facturasPendientes = await prisma.factura.findMany({
    where: {
      OR: [
        { sifen_estado: null },
        { sifen_estado: 'En Proceso' }
      ]
    },
    include: {
      cliente_empresa: { include: { cliente: true, empresa: true } },
      usuario: true,
    },
  });

  const notasDeCreditoPendientes = await prisma.notaCredito.findMany({
    where: {
      OR: [
        { sifen_estado: null },
        { sifen_estado: 'En Proceso' }
      ]
    },
    include: {
      factura: {
        include: {
          cliente_empresa: { include: {cliente: true, empresa: true } }
        }
      },
      usuario: true
    }
  })

  console.log(notasDeCreditoPendientes[0].factura);
  return
  
  const cdcFacturas = facturasPendientes.map((el) => el.cdc);
  const cdcNotasDeCredito = notasDeCreditoPendientes.map((el) => el.cdc)
  
  if(cdcFacturas.length > 0 || cdcNotasDeCredito.length > 0) {
    const dbApiFacturacion = conectarDbApiFacturacion();
    await dbApiFacturacion.connect();

    if (cdcFacturas.length > 0) {
  
      const { rows: resultApiFacturacion } = await dbApiFacturacion.query({
        text: `SELECT * FROM datos_factura2 WHERE cdc IN (${Array.from(
          { length: cdcFacturas.length },
          (_, index) => `$${index + 1}`
        ).join(",")})`,
        values: cdcFacturas,
      });
  
      for (const item of resultApiFacturacion) {
  
        const { cdc, sifen_estado: sifenEstado, sifen_mensaje: sifenMensaje } = item;
  
        if (sifenEstado !== null && sifenEstado !== "") {
          await prisma.factura.updateMany({
            where: {
              cdc,
            },
            data: {
              sifen_estado: sifenEstado == 'N' ? 'En Proceso' : sifenEstado,
              sifen_estado_mensaje: sifenMensaje,
            },
          });
  
          const factura = facturasPendientes.find((el) => el.cdc === cdc);
  
          if (typeof factura !== "undefined") {
            const { cliente, empresa } = factura.cliente_empresa;
  
            if (sifenEstado === "Aprobado") {
  
              await enviarFactura({
                cdc: factura.cdc,
                cliente: cliente.tipo_identificacion === "RUC" ? cliente.razon_social : `${cliente.nombres} ${cliente.apellidos}`,
                email: cliente.email,
                uuid: factura.factura_uuid,
                nroFactura: factura.numero_factura,
                empresa: empresa.nombre_empresa,
                emailEmpresa: empresa.email,
              });
  
            } else if (sifenEstado === "Rechazado") {
  
              await enviarErrorFactura({
                email: factura.usuario.email,
                empresa: empresa.nombre_empresa,
                errorFactura: sifenMensaje,
                nroFactura: factura.numero_factura,
              });
  
            }
          }
        }
      }
    }
  
    if (notasDeCreditoPendientes.length > 0) {
      const { rows: resultadoNotasDeCredito } = await dbApiFacturacion.query({
        text: `SELECT * FROM datos_factura2 WHERE cdc IN (${Array.from(
          { length: cdcNotasDeCredito.length },
          (_, index) => `$${index + 1}`
        ).join(",")})`,
        values: cdcNotasDeCredito
      })

      for (const item of resultadoNotasDeCredito) {
        const { cdc, sifen_estado: sifenEstado, sifen_mensaje: sifenMensaje } = item;

        if (sifenEstado !== null && sifenEstado !== "") {
          await prisma.notaCredito.update({
            where: { cdc },
            data: {
              sifen_estado: sifenEstado == 'N' ? 'En Proceso' : sifenEstado,
              sifen_estado_mensaje: sifenMensaje,
            }
          })

          const notaDeCredito = notasDeCreditoPendientes.find(e => e.cdc === cdc)

          if(notaDeCredito){
            const { cliente, empresa } = notaDeCredito.factura.cliente_empresa

            if(sifenEstado === 'Aprobado'){

              await enviarNotaDeCredito({
                cdc: notaDeCredito.cdc,
                cliente: cliente.tipo_identificacion === "RUC" ? cliente.razon_social : `${cliente.nombres} ${cliente.apellidos}`,
                email: cliente.email,
                uuid: notaDeCredito.nota_credito_uuid,
                nroNotaDeCredito: notaDeCredito.numero_nota_credito,
                empresa: empresa.nombre_empresa,
                emailEmpresa: empresa.email,
              });

            } else if (sifenEstado === 'Rechazado') {

              await enviarErrorNotaDeCredito({
                email: notaDeCredito.usuario,
                empresa: empresa.nombre_empresa,
                errorNotaDeCredito: sifenMensaje,
                nroNotaDeCredito: notaDeCredito.numero_nota_credito,
              });

            }
          }

        }

      }

    }

    dbApiFacturacion.end();
  }

  console.log(`${new Date().toISOString()} checkFacturaStatus Finalizado`);
};

const reenviarFactura = async ({ email, facturaId }) => {
  const factura = await prisma.factura.findFirst({
    where: { id: facturaId, sifen_estado: "Aprobado" },
    include: {
      cliente_empresa: { include: { cliente: true, empresa: true } },
      usuario: true,
    },
  });

  if (!factura) {
    throw new ErrorApp("La factura no existe", 404);
  }

  const { cliente, empresa } = factura.cliente_empresa;

  await enviarFactura({
    cdc: factura.cdc,
    cliente: cliente.tipo_identificacion === "RUC" ? cliente.razon_social : `${cliente.nombres} ${cliente.apellidos}`,
    email,
    uuid: factura.factura_uuid,
    nroFactura: factura.numero_factura,
    empresa: empresa.nombre_empresa,
    emailEmpresa: empresa.email,
  });
};

const cancelarFactura = async (datos, datosUsuario) => {

  try {

    const factura = await prisma.factura.findFirst({
      where: {
        AND: [
          { id: datos.facturaId },
          {
            usuario: {
              empresa_id: datosUsuario.empresaId
            }
          }
        ]
      }
    });

    if (!factura) {
      throw new ErrorApp('Factura no encontrada', 404)
    }

    // Se busca datos de la empresa
    const empresa = await prisma.empresa.findFirst({
      where: { id: datosUsuario.empresaId }
    })

    if (!empresa) {
      throw new ErrorApp('Empresa no encontrada', 404)
    }

    const resultado = await apiFacturacionElectronicaCancelar({ ruc: empresa.ruc, cdc: factura.cdc, motivo: datos.motivo });

    if (resultado && resultado.status) {
      await prisma.factura.update({
        where: {
          id: datos.facturaId
        },
        data: {
          sifen_estado: 'Cancelado',
          sifen_estado_mensaje: datos.motivo
        }
      })
      return resultado
    } else {
      throw new ErrorApp(resultado.message || 'No se pudo cancelar la factura', 400)
    }

  } catch (error) {
    console.log(error);
    ErrorApp.handleServiceError(error)
  }

}

const apiFacturacionElectronicaCancelar = async ({cdc, motivo, ruc} = {}) => {
    const form = new FormData();

    //Armar jsondata
    const data = {
        tipoEvento: 2,
        cdc,
        motivo,
        ruc
    }
    console.log(data);

    const datajson = JSON.stringify(data, null, 2);

    form.append("datajson", datajson);
    form.append("recordID", "123");

    const { data: resultado } = await axios({
        url: `${process.env.URL_API_FACT}/eventos.php`,
        method: "POST",
        data: form,
        headers: {
            ...form.getHeaders(),
        },
    });
    
    console.log(resultado);

    return resultado;
}

module.exports = {
  emitirFactura,
  getFacturas,
  getFacturaById,
  checkFacturaStatus,
  reenviarFactura,
  cancelarFactura
};
