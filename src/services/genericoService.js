const axios = require('axios');
const ErrorApp = require('../utils/error');

const getDatosByRuc = async ({ ruc, situacionTributaria } = {}) => {
    
    try {
        const { data: { data } } = await axios({
            url: `${process.env.TURUC}/${ruc}`,
        });
        
        return data;
        
    } catch (error) {

        ErrorApp.handleServiceError(error, 'Error al obtener datos del contribuyente');
    }

}

module.exports = {
    getDatosByRuc
}