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

const ORIGEN_BATCH = 'BATCH';
const ORIGEN_SIFEN = 'SIFEN';
const ORIGEN_FABRICADO = 'FABRICADO';
const ORIGENES = [ORIGEN_BATCH, ORIGEN_SIFEN, ORIGEN_FABRICADO];

/**
 * INSERT ... ON DUPLICATE KEY UPDATE de un lote de registros del padrón, en una única
 * sentencia parametrizada (sin `upsert` por fila). `Prisma.sql`/`Prisma.join` arman la lista
 * de VALUES con bind parameters reales (no concatenación de strings), por lo que es seguro
 * contra inyección aunque los datos vengan de un archivo externo.
 *
 * `origen` es obligatorio y queda registrado en la fila. Cambia dos comportamientos del UPDATE:
 *
 * 1. **Razón social.** Solo BATCH la pisa. El TXT del DNIT trae a las personas físicas como
 *    "APELLIDOS, NOMBRES" (la coma es el límite entre ambos; `genericoService.separarNombre` la
 *    usa para poblar `cliente.nombres`/`cliente.apellidos`), mientras que `dRazCons` del WS
 *    `siConsRUC` la devuelve corrida, sin coma ("LELI GLADYS PEÑA INSAURRALDE"). Pisar una fila
 *    del batch con la versión de SIFEN DESTRUYE ese límite y no se puede reconstruir: un nombre
 *    corrido no dice dónde termina el apellido. Como de SIFEN lo que necesitamos es el `estado`
 *    — no el nombre, que ya teníamos del propio DNIT y en mejor forma — se conserva el existente.
 *    Contrapartida asumida: un cambio real de razón social no se refleja hasta la próxima
 *    importación batch. Es el lado barato del intercambio; el `estado`, que es lo que habilita o
 *    bloquea la emisión, sí se actualiza siempre.
 *    (Ojo: la coma NO indica procedencia. El propio batch tiene ~164k filas sin coma — las
 *    personas jurídicas, "EMPRESA SA" —, así que no se puede inferir el origen mirando el texto.)
 *
 * 2. **`fecha_verificacion_sifen`.** Solo la escribe SIFEN. Un upsert de BATCH o FABRICADO manda
 *    NULL y el COALESCE conserva el valor previo: una importación masiva no debe borrar el hecho
 *    de que un RUC se verificó individualmente contra el WS.
 *
 * 3. **`es_oee`.** Ningún origen del padrón lo conoce: ni el TXT del DNIT (5 campos, ninguno es
 *    este) ni `siConsRUC` (ContRUC01-06, tampoco). Por eso los registros que llegan acá lo traen
 *    `undefined` y el COALESCE conserva lo que hubiera. Sin ese COALESCE, la próxima importación
 *    batch —o la simple revalidación de estado de un RUC ya marcado— borraría la marca de OEE y
 *    volveríamos a emitir B2B a un ministerio. Un registro puede setearlo explícitamente
 *    (`esOee: true/false`) y entonces sí pisa: es la vía que usan la siembra desde
 *    `data/oeeRucs.json` y la automarcación por rechazo 1332.
 *
 * @param {Array<{ruc: string, razonSocial: string, digitoVerificador: string, rucAnterior: string|null, estado: string}>} registros
 * @param {'BATCH'|'SIFEN'|'FABRICADO'} origen - Procedencia del dato
 * @param {Object} [opciones]
 * @param {boolean} [opciones.pisarRazonSocial] - Fuerza (o impide) sobrescribir la razón social
 *   existente. Por defecto solo BATCH la pisa. El cron de verificación lo pone en `true` al
 *   graduar una fila FABRICADO: ahí la razón social guardada es la que tipeó el usuario en la
 *   emisión, no dato del DNIT, así que la de SIFEN es estrictamente mejor y el argumento de
 *   "no destruir el límite apellido/nombre" no aplica — no había tal límite que preservar.
 */
const guardarLote = async (registros, origen, opciones = {}) => {
    if (!registros || registros.length === 0) return;

    if (!ORIGENES.includes(origen)) {
        throw new ErrorInfraestructuraPadronRuc(`Origen inválido "${origen}" al guardar lote del padrón RUC (esperado: ${ORIGENES.join('/')})`);
    }

    const esSifen = origen === ORIGEN_SIFEN;
    const pisarRazonSocial = opciones.pisarRazonSocial === undefined
        ? origen === ORIGEN_BATCH
        : opciones.pisarRazonSocial === true;

    // `esOee` viaja como NULL salvo que el registro lo declare explícitamente. El COALESCE del
    // UPDATE hace que un NULL no pise la marca existente (ver punto 3 de arriba).
    const filas = registros.map((r) => {
        const esOee = r.esOee === undefined || r.esOee === null ? null : Boolean(r.esOee);
        return Prisma.sql`(${r.ruc}, ${r.razonSocial}, ${r.digitoVerificador}, ${r.rucAnterior}, ${r.estado}, ${origen}, ${esSifen ? Prisma.sql`NOW()` : Prisma.sql`NULL`}, ${esOee}, NOW(), NOW())`;
    });

    // Solo el batch pisa la razón social; el resto la deja como está (ver el punto 1 de arriba).
    // `razon_social = razon_social` es un no-op explícito en el UPDATE: la fila nueva igual recibe
    // el valor por el INSERT, y la existente lo conserva.
    const razonSocialUpdate = pisarRazonSocial
        ? Prisma.sql`razon_social = VALUES(razon_social)`
        : Prisma.sql`razon_social = razon_social`;

    const query = Prisma.sql`
        INSERT INTO padron_ruc (ruc, razon_social, digito_verificador, ruc_anterior, estado, origen, fecha_verificacion_sifen, es_oee, fecha_creacion, fecha_modificacion)
        VALUES ${Prisma.join(filas)}
        ON DUPLICATE KEY UPDATE
            ${razonSocialUpdate},
            digito_verificador = VALUES(digito_verificador),
            ruc_anterior = VALUES(ruc_anterior),
            estado = VALUES(estado),
            origen = VALUES(origen),
            fecha_verificacion_sifen = COALESCE(VALUES(fecha_verificacion_sifen), fecha_verificacion_sifen),
            es_oee = COALESCE(VALUES(es_oee), es_oee),
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
 * `esOee` se devuelve TAL CUAL, con sus tres estados (`true` / `false` / `null` = no lo sabemos), y
 * NO normalizado a booleano. Normalizarlo acá sería una trampa: el resultado de esta función se
 * parece lo bastante a un registro de `guardarLote` como para que alguien lo reinyecte, y ahí un
 * `null` convertido en `false` pasaría de "no sabemos" a "verificado que no lo es", pisando la marca
 * real vía el UPDATE (el COALESCE solo protege contra `null`/`undefined`, no contra un `false`).
 * Los consumidores comparan con `=== true`, que trata `null` y `false` igual sin perder información.
 *
 * @param {string} ruc
 * @returns {Promise<{ruc: string, razonSocial: string, digitoVerificador: string, rucAnterior: string|null, estado: string, esOee: boolean|null}|null>}
 */
const buscarPorRuc = async (ruc) => {
    const registro = await prisma.padronRuc.findUnique({ where: { ruc } });

    if (!registro) return null;

    return {
        ruc: registro.ruc,
        razonSocial: registro.razon_social,
        digitoVerificador: registro.digito_verificador,
        rucAnterior: registro.ruc_anterior,
        estado: registro.estado,
        esOee: registro.es_oee
    };
};

module.exports = {
    guardarLote,
    buscarPorRuc,
    ErrorInfraestructuraPadronRuc,
    ORIGEN_BATCH,
    ORIGEN_SIFEN,
    ORIGEN_FABRICADO
};
