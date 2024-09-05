const ErrorApp = require('../utils/error');
const prisma = require('../prisma/cliente');

const getEstablecimientosByEmpresa = async ({ empresaId }) => {

    try {
        
        const establecimientos = await prisma.establecimiento.findMany({
            where: {
                empresa_id: empresaId
            }
        })

        return establecimientos
        
    } catch (error) {
        ErrorApp.handleServiceError(error, 'Error al obtener establecimientos');
    }
}

module.exports = {
    getEstablecimientosByEmpresa
}