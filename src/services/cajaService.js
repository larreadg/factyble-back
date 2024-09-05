const ErrorApp = require('../utils/error');
const prisma = require('../prisma/cliente');

const getCajasByEstablecimiento = async ({ establecimientoId }) => {

    try {
        
        const cajas = await prisma.caja.findMany({
            where: {
                establecimiento_id: establecimientoId
            }
        })

        return cajas
        
    } catch (error) {
        ErrorApp.handleServiceError(error, 'Error al obtener cajas');

    }
}

module.exports = {
    getCajasByEstablecimiento
}