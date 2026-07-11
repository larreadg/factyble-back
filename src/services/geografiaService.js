const ErrorApp = require('../utils/error');
const prisma = require('../prisma/cliente');

const getDepartamentos = async () => {

    try {
        const departamentos = await prisma.departamento.findMany({
            orderBy: { descripcion: 'asc' }
        });

        return departamentos;

    } catch (error) {
        ErrorApp.handleServiceError(error, 'Error al obtener departamentos');

    }
}

const getDistritos = async ({ cod_departamento } = {}) => {

    try {
        const distritos = await prisma.distrito.findMany({
            where: cod_departamento ? { departamento: { codigo: cod_departamento } } : undefined,
            orderBy: { descripcion: 'asc' }
        });

        return distritos;

    } catch (error) {
        ErrorApp.handleServiceError(error, 'Error al obtener distritos');

    }
}

const getCiudades = async ({ cod_distrito } = {}) => {

    try {
        const ciudades = await prisma.ciudad.findMany({
            where: cod_distrito ? { distrito: { codigo: cod_distrito } } : undefined,
            orderBy: { descripcion: 'asc' }
        });

        return ciudades;

    } catch (error) {
        ErrorApp.handleServiceError(error, 'Error al obtener ciudades');

    }
}

module.exports = {
    getDepartamentos,
    getDistritos,
    getCiudades
}
