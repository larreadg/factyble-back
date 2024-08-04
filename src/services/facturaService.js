const dayjs = require("dayjs");
const prisma = require("../prisma/cliente");
const ErrorApp = require("../utils/error");
const { calcularImpuesto } = require("../utils/facturacion");
const generarPdf = require("../utils/generarPdf");
const path = require("path");
const { v4: uuidv4} = require('uuid');
const { conectarDbApiFacturacion } = require("../db/dbApiFacturacion");

const emitirFactura = async (datos, datosUsuario) => {
  try {
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
      cliente = await prisma.cliente.create({
        data: {
          ruc: datos.ruc,
          razon_social: datos.razonSocial,
          documento: datos.ruc,
          tipo_identificacion: datos.situacionTributaria == "CONTRIBUYENTE" ? "RUC" : "CEDULA",
          situacion_tributaria: datos.situacionTributaria,
          dv: datos.ruc.include('-') ? Number(datos.ruc.split("-")[1]) : null,
          direccion: datos.direccion,
          email: datos.email,
          telefono: datos.telefono
        },
      });
    }

    //Actualizar datos de cliente
    if(datos.direccion != cliente.direccion || datos.email != cliente.email){
      await prisma.cliente.update({
        data: {
          direccion: datos.direccion ? datos.direccion : cliente.direccion,
          email: datos.email ? datos.email : cliente.email
        },
        where: {id: cliente.id}
      });
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

      switch (e.tasa) {
        case "0%":
          totalExenta += e.impuesto;
        case "5%":
          totalIva5 += e.impuesto;
        default:
          totalIva10 += e.impuesto;
      }

      total += Number(e.total);
      totalIva += Number(e.impuesto);
    });

    if (total != Number(datos.total) || totalIva != Number(datos.totalIva)) {
      throw new ErrorApp("Datos proporcionados incorrectos", 400);
    }

    //Llamar a la API de Facturación electrónica
    const resultado = await apiFacturacionElectronica();

    //Crear factura
    const factura = await prisma.factura.create({
      data: {
        numero_factura: "",
        factura_uuid: uuidv4(),
        usuario_id: usuario.id,
        cliente_empresa_id: clienteEmpresa.id,
        condicion_venta: datos.condicionVenta,
        total_iva: datos.totalIva,
        total: datos.total,
        kude: "",
        cdc: "",
        xml: "",
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
      facturaId: factura.numero_factura,
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
      items: datos.items,
      facturaUuid: factura.factura_uuid
    });

    return factura;

  } catch (error) {
    console.log(error);
    ErrorApp.handleServiceError(error, "Error al crear factura");
  }
};

const apiFacturacionElectronica = async (datos) => {
  
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
    })

    const totalItems = await prisma.factura.count({
        where: {
          cliente_empresa_id: {
            in: clienteEmpresaIds
          }
        }
    })

    return {
      items: facturas,
      page,
      itemsPerPage,
      totalItems,
    }

  } catch (error) {
    console.log(error);
    ErrorApp.handleServiceError(error, "Error al obtener facturas");
  }
};

const getFacturaById = async (id) => {
  try {
    
    const factura = await prisma.factura.findFirst({
      where: {
        id: Number(id)
      },
      include: {
        detalles: true
      }
    });

    if(!factura){
      throw new ErrorApp(`Factura con ID ${id} no encontrado`, 404);
    }

    return factura;

  } catch (error) {
    ErrorApp.handleServiceError(error, 'Error al obtener datos de factura');
  }
}

const checkFacturaStatus = async () => {
  const dbApiFacturacion = conectarDbApiFacturacion();
  await dbApiFacturacion.connect();

  

  dbApiFacturacion.end();
}

module.exports = {
  emitirFactura,
  getFacturas,
  getFacturaById,
  checkFacturaStatus
};
