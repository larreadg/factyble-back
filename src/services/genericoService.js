const axios = require('axios');

const getDatosByRuc = async ({ ruc } = {}) => {
    
    const { data: { data } } = await axios({
        url: `${process.env.TURUC}/${ruc}`,
    });
    
    return data;
}

module.exports = {
    getDatosByRuc
}