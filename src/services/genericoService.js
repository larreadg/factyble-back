const axios = require('axios');
const ErrorApp = require('../utils/error');
const prisma = require('../prisma/cliente');

const getDatosByRuc = async ({ ruc, situacionTributaria } = {}) => {

    try {

        const cliente = await prisma.cliente.findFirst({
            where: {
                AND: [
                    {
                        OR: [
                            {ruc},
                            {documento: ruc}
                        ]
                    },
                    {
                        situacion_tributaria: situacionTributaria
                    }
                ]                    
            }
        });

        if(cliente){
            return cliente
        }

        if(situacionTributaria == 'CONTRIBUYENTE'){
            const { data: { data } } = await axios({
                url: `${process.env.TURUC}/${ruc}`,
            });

            if(!data){
                throw new ErrorApp('No se encontró datos', 404);
            }

            const nuevoCliente = await prisma.cliente.create({
                data: {
                    ruc: data.ruc,
                    documento: String(data.doc),
                    razon_social: data.razonSocial,
                    dv: data.dv,
                    estado: data.estado,
                    situacion_tributaria: situacionTributaria,
                    tipo_identificacion: 'RUC',
                    nombres: data.razonSocial.split(',')[1].trim(),
                    apellidos: data.razonSocial.split(',')[0].trim()
                }
            });
            
            return nuevoCliente;
        }

        if(situacionTributaria == 'NO_CONTRIBUYENTE' || situacionTributaria == 'NO_DOMICILIADO'){
            const { data } = await axios({
                url: `${process.env.URL_CI}`,
                params: {cedula: ruc},
                auth: {
                    username: process.env.USER_CI, 
                    password: process.env.PW_CI
                }
            });
            
            if(!data){
                throw new ErrorApp('No se encontró datos', 404);
            }
            
            const nuevoCliente = await prisma.cliente.create({
                data: {
                    ruc: data.cedula_identidad,
                    documento: data.cedula_identidad,
                    razon_social: `${data.apellidos}, ${data.nombres}`,
                    situacion_tributaria: situacionTributaria,
                    tipo_identificacion: 'CEDULA',
                    nombres: data.nombres,
                    apellidos: data.apellidos
                }
            });

            return nuevoCliente;
        }

        
    } catch (error) {
        
        ErrorApp.handleServiceError(error, 'Error al obtener datos');

    }

}

module.exports = {
    getDatosByRuc
}