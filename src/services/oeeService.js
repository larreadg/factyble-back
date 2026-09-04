const prisma = require('../prisma/cliente');
const catalogoOee = require('../data/oeeRucs.json');

/**
 * Organismos y Entidades del Estado (OEE) en `padron_ruc.es_oee`.
 *
 * Por qué existe: la validación D202b de SIFEN (código 1332, Nota Técnica N° 20, vigente en
 * producción desde el 31/01/2024) exige que un DE dirigido a un OEE informe tipo de operación B2G
 * (`iTiOpe=3`). Emitirle B2B es un rechazo terminal. Ver el addendum B2G del Manual Técnico local.
 *
 * El problema de fondo es que NINGUNA fuente automática dice qué RUC es un OEE:
 *   - El TXT del DNIT trae 5 campos (`ruc|razonSocial|dv|rucAnterior|estado|`) y ninguno es este.
 *   - `siConsRUC` devuelve `ContenedorRUC_v150.xsd` (ContRUC01-06) y tampoco lo incluye.
 *   - El open data de la DNCP identifica a sus entidades contratantes con un código interno
 *     (`DNCP-SICP-CODE-167`), nunca con el RUC.
 *
 * De ahí las dos vías de este módulo, deliberadamente distintas:
 *
 * 1. **Siembra desde catálogo** (`sembrarCatalogoOee`). `data/oeeRucs.json` se derivó cruzando los
 *    nombres de las entidades contratantes de la DNCP (descargas OCDS 2024-2026, públicas y sin API
 *    key) contra la razón social de nuestro propio padrón. El cruce se revisó a mano: los matches
 *    ambiguos se descartaron en vez de aceptarse, porque un falso positivo emite B2G a un
 *    contribuyente privado mientras que un falso negativo solo produce un rechazo que la vía 2
 *    corrige. El archivo está versionado —no se descarga en runtime— para que sea revisable en el
 *    diff y para no depender de que el portal de la DNCP esté en pie.
 *
 * 2. **Automarcación por rechazo** (`marcarComoOee`). Cuando SIFEN rechaza un documento con 1332
 *    nos está diciendo, con autoridad, que ese RUC es un OEE. Es un hecho de la SET, del mismo tipo
 *    que el `estado` que ya cacheamos desde `siConsRUC`, no una inferencia nuestra. Es lo único que
 *    evita que este catálogo se congele: la lista blanca hardcodeada del backend PHP legacy solo
 *    crecía cuando alguien se acordaba de editarla después de un rechazo, y por eso el MEC —dado de
 *    alta como cliente mucho después— nunca entró.
 */

/**
 * Marca un RUC como Organismo o Entidad del Estado.
 *
 * Solo escribe si la fila existe: no crea filas de padrón. Un RUC que SIFEN rechaza por 1332
 * necesariamente existe en Marangatu, pero fabricar acá una fila con `estado` inventado repetiría
 * el problema que `origen = FABRICADO` vino a resolver. Si no está, la próxima emisión la crea por
 * el camino normal (miss -> `siConsRUC`) y este marcado se reintenta con el siguiente rechazo.
 *
 * @param {string} ruc - RUC base, sin dígito verificador
 * @returns {Promise<boolean>} true si se marcó una fila, false si el RUC no está en el padrón o ya estaba marcado
 */
const marcarComoOee = async (ruc) => {
    const afectadas = await prisma.padronRuc.updateMany({
        where: { ruc, OR: [{ es_oee: null }, { es_oee: false }] },
        data: { es_oee: true }
    });

    return afectadas.count > 0;
};

/**
 * Siembra `padron_ruc.es_oee = true` para los RUC del catálogo versionado.
 *
 * Idempotente: se puede correr las veces que haga falta (tras cada importación batch, por ejemplo,
 * aunque `guardarLote` ya conserva la marca vía COALESCE). Solo toca filas cuyo `es_oee` no sea ya
 * `true`, así que una segunda corrida no escribe nada.
 *
 * NO marca `es_oee = false` para el resto del padrón: `false` significa "verificado que no lo es" y
 * no verificamos 2M de RUC. El default sigue siendo NULL = "no lo sabemos", que se comporta como el
 * histórico (B2B).
 *
 * Los RUC del catálogo que no existan en `padron_ruc` se informan pero no se crean, por el mismo
 * motivo que en `marcarComoOee`.
 *
 * @returns {Promise<{enCatalogo: number, marcados: number, yaMarcados: number, ausentesEnPadron: string[]}>}
 */
const sembrarCatalogoOee = async () => {
    const rucs = catalogoOee.map((e) => e.ruc);

    const existentes = await prisma.padronRuc.findMany({
        where: { ruc: { in: rucs } },
        select: { ruc: true, es_oee: true }
    });

    const presentes = new Set(existentes.map((f) => f.ruc));
    const ausentesEnPadron = rucs.filter((r) => !presentes.has(r));
    const yaMarcados = existentes.filter((f) => f.es_oee === true).length;

    // El filtro se escribe como OR explícito y no como `NOT: { es_oee: true }`: en SQL,
    // `NOT (NULL = TRUE)` es NULL, no TRUE, así que un NOT dejaría fuera exactamente las filas que
    // hay que marcar — todas las que nunca se evaluaron. Bug real encontrado en la primera corrida:
    // 392 filas presentes, 0 marcadas.
    const { count: marcados } = await prisma.padronRuc.updateMany({
        where: { ruc: { in: rucs }, OR: [{ es_oee: null }, { es_oee: false }] },
        data: { es_oee: true }
    });

    const resumen = { enCatalogo: rucs.length, marcados, yaMarcados, ausentesEnPadron };

    console.log(
        `[oee] Siembra: ${resumen.enCatalogo} en catálogo, ${marcados} marcados ahora, ` +
        `${yaMarcados} ya estaban, ${ausentesEnPadron.length} ausentes del padrón`
    );

    if (ausentesEnPadron.length > 0) {
        console.log(`[oee] RUC del catálogo ausentes de padron_ruc (no se crean filas): ${ausentesEnPadron.join(', ')}`);
    }

    return resumen;
};

module.exports = {
    marcarComoOee,
    sembrarCatalogoOee
};
