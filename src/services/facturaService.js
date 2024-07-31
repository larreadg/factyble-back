const { PrismaClient } = require("@prisma/client");
const ErrorApp = require("../utils/error");
const { calcularImpuesto } = require("../utils/facturacion");

const emitirFactura = async (datos, datosUsuario) => {
    const prisma = new PrismaClient();

    try {
        //Buscar datos del usuario
        const usuario = await prisma.usuario.findFirst({
            where: {id: datosUsuario.id}
        });

        if(!usuario){
            throw new ErrorApp('Usuario no encontrado', 404);
        }

        //Buscar si existe cliente
        let cliente = await prisma.cliente.findFirst({
            where: {ruc: datos.ruc}
        });

        //Crear cliente si no existe
        if(!cliente){
            cliente = await prisma.cliente.create({
                data: {
                    ruc: datos.ruc,
                    razon_social: datos.razonSocial,
                    dv: Number(datos.ruc.split('-')[1])
                }
            });
        }

        //Buscar en cliente_empresa
        let clienteEmpresa = await prisma.clienteEmpresa.findFirst({
            where: {
                AND: [
                    {cliente_id: cliente.id},
                    {empresa_id: usuario.empresa_id}
                ]
            }
        });

        //Agregar cliente a empresa
        if(!clienteEmpresa){
            clienteEmpresa = await prisma.clienteEmpresa.create({
                data: {
                    cliente_id: cliente.id,
                    empresa_id: usuario.empresa_id
                }
            });
        }

        //Verificar cálculos
        let total = 0;
        let totalIva = 0;
        datos.items.forEach(e => {
            const impuesto = calcularImpuesto(e.cantidad, e.precioUnitario, e.tasa);
            if(Number(e.impuesto) != impuesto){
                throw new ErrorApp('Datos proporcionados incorrectos', 400);
            }

            if(Number(e.total) != Number(e.cantidad) * Number(e.precioUnitario)){
                throw new ErrorApp('Datos proporcionados incorrectos', 400);
            }

            total += Number(e.total);
            totalIva += Number(e.impuesto);
        });

        if(total != Number(datos.total) || totalIva != Number(datos.totalIva)){
            throw new ErrorApp('Datos proporcionados incorrectos', 400);
        }

        //Crear factura
        const factura = await prisma.factura.create({
            data: {
                numero_factura: '',
                usuario_id: usuario.id,
                cliente_empresa_id: clienteEmpresa.id,
                condicion_venta: datos.condicionVenta,
                total_iva: datos.totalIva,
                total: datos.total,
                kude: '',
                cdc: '',
                xml: ''
            }
        });

        //Agregar detalles de factura
        const datosFacturaDetalle = datos.items.map(e => ({
            id_factura: factura.id,
            cantidad: Number(e.cantidad),
            precio_unitario: e.precioUnitario,
            tasa: e.tasa == '0%' ? 'T0' : e.tasa == '5%' ? 'T5' : 'T10',
            impuesto: e.impuesto,
            total: e.total,
            descripcion: e.descripcion
        }));

        const facturaDetalle = await prisma.facturaDetalle.createMany({
            data: datosFacturaDetalle
        });
        
        
    } catch (error) {
        
        ErrorApp.handleServiceError(error, 'Error al crear factura');

    }finally{
        prisma.$disconnect;
    }
}

module.exports = {
    emitirFactura
}