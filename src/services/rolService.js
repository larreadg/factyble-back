const ErrorApp = require('../utils/error');
const prisma = require('../prisma/cliente');

const getRoles = async () => {

    try {
        const roles = await prisma.rol.findMany();
        return roles;
        
    } catch (error) {
        ErrorApp.handleServiceError(error, 'Error al obtener roles');

    }
}

module.exports = {
    getRoles
}