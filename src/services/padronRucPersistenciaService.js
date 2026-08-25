const { Prisma } = require('@prisma/client');
const prisma = require('../prisma/cliente');
const ErrorApp = require('../utils/error');

/**
 * Error de infraestructura (DB caída, timeout, etc.), distinto de un error de datos de un
 * archivo puntual. El orquestador de la importación (`padronRucImportService`) lo usa para
 * decidir si aborta todo el proceso en vez de seguir con el resto de los ZIP.
 */
class ErrorInfraestructuraPadronRuc extends ErrorApp {
    constructor(message) {
        super(message, 500);
    }
}

/**
 * INSERT ... ON DUPLICATE KEY UPDATE de un lote de registros del padrón, en una única
 * sentencia parametrizada (sin `upsert` por fila). `Prisma.sql`/`Prisma.join` arman la lista
 * de VALUES con bind parameters reales (no concatenación de strings), por lo que es seguro
 * contra inyección aunque los datos vengan de un archivo externo.
 *
 * @param {Array<{ruc: string, razonSocial: string, digitoVerificador: string, rucAnterior: string|null, estado: string}>} registros
 */
const guardarLote = async (registros) => {
    if (!registros || registros.length === 0) return;

    const filas = registros.map((r) => Prisma.sql`(${r.ruc}, ${r.razonSocial}, ${r.digitoVerificador}, ${r.rucAnterior}, ${r.estado}, NOW(), NOW())`);

    const query = Prisma.sql`
        INSERT INTO padron_ruc (ruc, razon_social, digito_verificador, ruc_anterior, estado, fecha_creacion, fecha_modificacion)
        VALUES ${Prisma.join(filas)}
        ON DUPLICATE KEY UPDATE
            razon_social = VALUES(razon_social),
            digito_verificador = VALUES(digito_verificador),
            ruc_anterior = VALUES(ruc_anterior),
            estado = VALUES(estado),
            fecha_modificacion = NOW()
    `;

    try {
        await prisma.$executeRaw(query);
    } catch (error) {
        throw new ErrorInfraestructuraPadronRuc(`Error de base de datos al guardar lote del padrón RUC: ${error.message}`);
    }
};

/**
 * Lookup local para reemplazar la consulta externa a TURUC en `genericoService.getDatosByRuc`:
 * el padrón se importa en batch (`importarPadronRuc`), así que esto es una lectura pura contra
 * la tabla ya poblada, sin llamada de red.
 *
 * @param {string} ruc
 * @returns {Promise<{ruc: string, razonSocial: string, digitoVerificador: string, rucAnterior: string|null, estado: string}|null>}
 */
const buscarPorRuc = async (ruc) => {
    const registro = await prisma.padronRuc.findUnique({ where: { ruc } });

    if (!registro) return null;

    return {
        ruc: registro.ruc,
        razonSocial: registro.razon_social,
        digitoVerificador: registro.digito_verificador,
        rucAnterior: registro.ruc_anterior,
        estado: registro.estado
    };
};

module.exports = {
    guardarLote,
    buscarPorRuc,
    ErrorInfraestructuraPadronRuc
};
