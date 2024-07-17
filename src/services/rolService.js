const { PrismaClient } = require('@prisma/client');
const ErrorApp = require('../utils/error');

const getRoles = async () => {
    
    const prisma = new PrismaClient();

    try {
        const roles = await prisma.rol.findMany();
        return roles;
        
    } catch (error) {
        ErrorApp.handleServiceError(error, 'Error al obtener roles');

    }finally{
        prisma.$disconnect();

    }

}

module.exports = {
    getRoles
}