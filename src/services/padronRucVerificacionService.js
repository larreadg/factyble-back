const prisma = require('../prisma/cliente');
const { guardarLote, ORIGEN_SIFEN, ORIGEN_FABRICADO } = require('./padronRucPersistenciaService');
const { consultarRucEnSifen } = require('./sifen/consultaRucService');
const { bloqueaEmision } = require('../utils/sifen/estadoPadronRuc');
const telegramService = require('./telegramService');

/**
 * Verificación diaria contra SIFEN de las filas de `padron_ruc` que fabricamos nosotros.
 *
 * Por qué existe: `emitirFactura` inventa un registro (`estado: "ACTIVO"` asumido + la razón social
 * que vino en el body) cuando el RUC no está en el padrón local Y la consulta a SIFEN quedó
 * `indeterminado`. Ese registro se persiste, y como se escribe ACTIVO —el único estado que NO
 * dispara revalidación en el camino de lectura— la invención se auto-sella: ninguna emisión ni
 * búsqueda posterior la vuelve a cuestionar. Sólo la corregía una importación batch, que es manual
 * y corre cada varios meses. Este job cierra ese ciclo.
 *
 * Qué NO hace: no recorre el padrón. `siConsRUC` es una llamada por RUC y la tabla tiene ~2M filas;
 * además el Manual Técnico (§7) reserva a la SET el derecho de "limitar y/o restringir la
 * utilización de los servicios por contribuyente, por direcciones IP u otros", y nos cortarían la
 * misma IP y el mismo certificado con los que emitimos. Este job toca exclusivamente las filas
 * `origen = 'FABRICADO'`, que son las que nosotros ensuciamos.
 */

// Techo de consultas por corrida. No es por el volumen actual (las filas FABRICADO se cuentan con
// los dedos), es para que un bug que marque de más no se convierta en un barrido del padrón.
const MAX_POR_CORRIDA = Number(process.env.PADRON_RUC_VERIFICACION_MAX_POR_CORRIDA) || 50;

// Pausa entre consultas. El WS se comparte con la emisión: este job no tiene ninguna urgencia y no
// debe competir por la conexión ni parecer un scraper.
const PAUSA_ENTRE_CONSULTAS_MS = Number(process.env.PADRON_RUC_VERIFICACION_PAUSA_MS) || 1000;

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resuelve con qué certificado consultar. No hay request context en un cron, así que se usa el de
 * la empresa que tiene a ese RUC como cliente — que es, por construcción, la que lo fabricó al
 * emitirle. Así se mantiene el invariante de que cada empresa consulta con SU certificado y nadie
 * gasta la cuota del WS de un contribuyente ajeno.
 *
 * `SUBSTRING_INDEX(ruc, '-', 1)` tolera las dos formas en que `cliente.ruc` puede estar guardado:
 * la canónica `BASE-DV` y la legacy sólo-base.
 *
 * @param {string} rucBase
 * @returns {Promise<number|null>} empresaId, o null si ninguna empresa lo tiene como cliente
 */
const resolverEmpresaParaConsulta = async (rucBase) => {
    const filas = await prisma.$queryRaw`
        SELECT ce.empresa_id AS empresaId
        FROM cliente c
        JOIN cliente_empresa ce ON ce.cliente_id = c.id
        WHERE SUBSTRING_INDEX(c.ruc, '-', 1) = ${rucBase}
        ORDER BY ce.empresa_id
        LIMIT 1
    `;

    return filas.length > 0 ? Number(filas[0].empresaId) : null;
};

/**
 * Una fila fabricada que resultó ser un RUC inexistente se elimina en vez de conservarse. No es
 * destruir dato de la SET: es retirar una invención nuestra que la SET desmiente. Dejarla sería
 * peor que no tenerla —seguiría respondiendo ACTIVO al buscador y a la próxima emisión—, y
 * borrarla restaura el comportamiento correcto: el siguiente pedido vuelve a ser un miss, consulta
 * a SIFEN y recibe el 404 que corresponde.
 *
 * Se loguea la fila completa antes de borrar para que quede recuperable desde el log.
 *
 * @param {Object} fila
 */
const eliminarFilaFantasma = async (fila) => {
    console.log(
        `[padronRucVerificacion] RUC ${fila.ruc} — SIFEN afirma que NO EXISTE. Se elimina la fila fabricada: ` +
        JSON.stringify({ razon_social: fila.razon_social, estado: fila.estado, fecha_creacion: fila.fecha_creacion })
    );

    await prisma.padronRuc.delete({ where: { id: fila.id } });
};

/**
 * Alerta accionable: una fila fabricada que resulta bloqueante o inexistente significa que ya
 * emitimos al menos un DE a un receptor al que no correspondía. Hay que revisarlo a mano, así que
 * va a Telegram y no sólo al log. Aislada en su propio try/catch — una falla de Telegram no debe
 * cortar el resto de la corrida.
 *
 * @param {string} titulo
 * @param {string} detalle
 */
const alertar = async (titulo, detalle) => {
    try {
        await telegramService.notificarFallaSistemica({ titulo, detalle });
    } catch (error) {
        console.error(`[padronRucVerificacion] No se pudo alertar por Telegram: ${error.message}`);
    }
};

/**
 * Procesa una fila fabricada. Los tres desenlaces de `consultarRucEnSifen` se tratan distinto, con
 * el mismo criterio que el resto del código: `indeterminado` nunca se interpreta como un hecho.
 *
 * @param {Object} fila - Fila cruda de `padron_ruc`
 * @param {Object} resumen - Contadores de la corrida, mutados in situ
 */
const verificarFila = async (fila, resumen) => {
    const empresaId = await resolverEmpresaParaConsulta(fila.ruc);

    if (!empresaId) {
        // Sin empresa que lo reclame no hay certificado con el cual preguntar. Queda FABRICADO y se
        // reintenta mañana; si nunca aparece un cliente, la próxima importación batch lo resuelve.
        console.log(`[padronRucVerificacion] RUC ${fila.ruc} — ninguna empresa lo tiene como cliente, se omite`);
        resumen.omitidos += 1;
        return;
    }

    const consulta = await consultarRucEnSifen({ ruc: fila.ruc, empresaId });

    if (consulta.indeterminado) {
        // No se pudo saber. La fila queda FABRICADO tal cual y se reintenta en la próxima corrida:
        // una caída de SIFEN no puede convertirse en una confirmación de nuestra suposición.
        console.log(`[padronRucVerificacion] RUC ${fila.ruc} — indeterminado (${consulta.motivo}), se reintenta mañana`);
        resumen.indeterminados += 1;
        return;
    }

    if (consulta.noExiste) {
        await eliminarFilaFantasma(fila);
        resumen.eliminados += 1;
        await alertar(
            'Padrón RUC: se emitió a un RUC inexistente',
            `El RUC ${fila.ruc} ("${fila.razon_social}") se había fabricado como ACTIVO durante una emisión y SIFEN ` +
            `confirma que no existe en el padrón de la SET. La fila se eliminó de padron_ruc. Revisá las facturas ` +
            `emitidas a ese receptor: SIFEN las rechaza por D206b (código 1306).`
        );
        return;
    }

    // `encontrado`: se adopta el registro real. `pisarRazonSocial: true` porque la que había era la
    // que tipeó el usuario en la emisión, no dato del DNIT — acá la de SIFEN es estrictamente mejor.
    // El upsert además cambia `origen` a SIFEN y estampa `fecha_verificacion_sifen`, con lo que la
    // fila deja de ser candidata de este job: se gradúa y no se vuelve a consultar todos los días.
    const estadoFabricado = fila.estado;
    const estadoReal = consulta.registro.estado;

    await guardarLote([consulta.registro], ORIGEN_SIFEN, { pisarRazonSocial: true });
    resumen.confirmados += 1;

    if (bloqueaEmision(estadoReal)) {
        resumen.bloqueantes += 1;
        console.log(`[padronRucVerificacion] RUC ${fila.ruc} — fabricado como "${estadoFabricado}" pero SIFEN responde "${estadoReal}" (BLOQUEANTE)`);
        await alertar(
            'Padrón RUC: se emitió a un RUC bloqueado',
            `El RUC ${fila.ruc} ("${consulta.registro.razonSocial}") se había fabricado como "${estadoFabricado}" durante ` +
            `una emisión, pero SIFEN responde "${estadoReal}", que impide recibir documentos electrónicos. La fila ya se ` +
            `corrigió, así que las próximas emisiones degradan el receptor a cédula. Revisá las facturas ya emitidas.`
        );
        return;
    }

    console.log(`[padronRucVerificacion] RUC ${fila.ruc} — confirmado por SIFEN como "${estadoReal}", origen SIFEN`);
};

/**
 * Punto de entrada del cron (diario, 08:00). Procesa hasta `MAX_POR_CORRIDA` filas fabricadas,
 * las nunca verificadas primero (`fecha_verificacion_sifen` NULL ordena primero en ASC).
 *
 * Cada fila está aislada en su propio try/catch: un RUC que falle no puede abortar la corrida
 * entera ni impedir que se verifiquen los demás (mismo criterio que el resto de los jobs SIFEN).
 *
 * @returns {Promise<Object>} resumen de la corrida
 */
const verificarRucsFabricados = async () => {
    const resumen = { candidatos: 0, confirmados: 0, bloqueantes: 0, eliminados: 0, indeterminados: 0, omitidos: 0, errores: 0 };

    const filas = await prisma.padronRuc.findMany({
        where: { origen: ORIGEN_FABRICADO },
        orderBy: [{ fecha_verificacion_sifen: 'asc' }, { fecha_modificacion: 'asc' }],
        take: MAX_POR_CORRIDA
    });

    resumen.candidatos = filas.length;

    if (filas.length === 0) {
        console.log('[padronRucVerificacion] No hay filas fabricadas pendientes de verificar');
        return resumen;
    }

    console.log(`[padronRucVerificacion] ${filas.length} fila(s) fabricada(s) a verificar (techo por corrida: ${MAX_POR_CORRIDA})`);

    for (const [indice, fila] of filas.entries()) {
        try {
            await verificarFila(fila, resumen);
        } catch (error) {
            resumen.errores += 1;
            console.error(`[padronRucVerificacion] RUC ${fila.ruc} — error al verificar: ${error.message}`);
        }

        if (indice < filas.length - 1) {
            await dormir(PAUSA_ENTRE_CONSULTAS_MS);
        }
    }

    console.log(`[padronRucVerificacion] Fin: ${JSON.stringify(resumen)}`);

    // Si quedaron candidatos sin tocar por el techo, se dice explícitamente en vez de dejar creer
    // que se cubrió todo (el techo no es un error, pero el silencio sí sería engañoso).
    if (filas.length === MAX_POR_CORRIDA) {
        console.log(`[padronRucVerificacion] Se alcanzó el techo de ${MAX_POR_CORRIDA}; el resto se procesa en la próxima corrida`);
    }

    return resumen;
};

module.exports = {
    verificarRucsFabricados
};
