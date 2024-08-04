const { Client } = require('pg');

const conectarDbApiFacturacion = () => {
    return new Client({
        host: process.env.HOST_API_FACT,
        port: process.env.PORT_DB_API_FACT,
        database: process.env.DB_API_FACT,
        user: process.env.USER_DB_API_FACT,
        password: process.env.PW_DB_API_FACT
    });
}

module.exports = {
    conectarDbApiFacturacion
}