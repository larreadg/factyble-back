const prisma = require('../prisma/cliente');
const { getPool, sql } = require('../db/dbPvta');
const ErrorApp = require('../utils/error');
const facturaSimpleService = require('./facturaSimpleService');
const { calcularTotalItem } = require('../utils/facturacion');
const telegramService = require('./telegramService');
const { IMPRESORA_TICKETS } = require('../utils/impresoraTickets');

// Centinela de PVTA para el cliente "sin nombre" (consumidor final no identificado): en la vista figura
// como cliente_ruc = 'x'. Estas ventas se emiten como INNOMINADAS (SIFEN iTipIDRec=5) y entran por el
// MISMO camino que las nominadas: aparecen en GET /procesar-factura/pendientes y las emite la cajera con
// el botón "Generar factura". Antes las emitía sola un cron cada 5 min (cronJobsPvta.js, eliminado).
// El único camino que las sigue excluyendo es POST /procesar-factura (por ruc+fecha): ahí el filtro es el
// RUC del cliente y 'x' no es un RUC con el que se pueda buscar.
const RUC_SIN_NOMBRE = 'x';

// Procesamiento de ventas de PVTA (base MSSQL de terceros) hacia facturación electrónica SIFEN.
//
// Flujo (ver D:\proyectos\automatizaciones\el-halcon-explorar-db para la ingeniería inversa de la BD):
//   1. Se recibe { fecha, ruc } y se buscan las ventas de ese cliente/fecha en FACTYBLE_VENTAS_SIFEN_MIN
//      (una fila por ítem; se agrupan por venta_id). Sólo Facturas vigentes (la vista ya filtra TipCmp=13;
//      acá además se excluyen las anuladas).
//   2. Cada venta se emite con facturaSimpleService.emitirFacturaSimple usando la empresa emisora del JWT.
//   3. FACTYBLE_SIFEN_OUTBOX es el candado anti-doble-emisión: el evento ALTA de cada venta se reclama
//      atómicamente (PENDIENTE -> PROCESANDO) ANTES de emitir; sólo un request concurrente gana el UPDATE,
//      así "el mismo cliente dos veces" no genera dos facturas. Si la emisión sale bien el evento pasa a
//      PROCESADO; si falla, vuelve a PENDIENTE para poder reintentar. Como PVTA (MSSQL) y factyble (MySQL)
//      son dos bases sin transacción compartida, el mutex del outbox es la única garantía de unicidad.
//
// Decisiones de negocio confirmadas (2026-08-16):
//   A) Candado con estado intermedio PROCESANDO (cabe en el VARCHAR(10) del outbox).
//   B) situacion_tributaria: cliente_ruc con dígito verificador ("NNNN-D") => CONTRIBUYENTE; si no, CEDULA.
//   C) Sólo se procesan ventas con un evento ALTA PENDIENTE en el outbox; sin fila => OMITIDA.
//   D) Las ventas anuladas (anulada=1) se excluyen en la query.

// Mapea la tasa de IVA numérica de la vista (10/5/0) al literal que espera el endpoint /factura/simple.
const TASA_IVA_MAP = { 10: '10%', 5: '5%', 0: '0%' };

// Fecha de hoy en 'yyyy-mm-dd' segun el reloj LOCAL del proceso. Se usa como default del listado de
// caja. Local y no UTC a proposito: en el despliegue on-prem el backend, el SQL Server de Starsoft y la
// caja son la misma maquina, y lo que importa es el dia calendario de la ferreteria, no el de Greenwich
// (con UTC, despues de las 21:00 de Paraguay el "hoy" saltaria al dia siguiente).
function fechaHoyISO() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');

  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

// 'dd/mm/yyyy' (ya validado por la ruta) -> 'yyyy-mm-dd' para el binding sql.Date.
function convertirFecha(fechaDdMmYyyy) {
  const [dd, mm, yyyy] = fechaDdMmYyyy.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

// Decisión B: el RUC crudo trae el DV ("2341952-0"); su presencia distingue contribuyente de cédula.
function derivarSituacionTributaria(clienteRuc) {
  return /^\S+-\w$/.test((clienteRuc || '').trim()) ? 'CONTRIBUYENTE' : 'NO_CONTRIBUYENTE';
}

// La vista devuelve condicion_venta como texto ('Contado' | 'Credito').
function mapearCondicionVenta(condicion) {
  const v = (condicion || '').trim().toLowerCase();
  if (v === 'contado') return 'CONTADO';
  if (v === 'credito') return 'CREDITO';
  return null;
}

// Trae las filas (una por ítem) de las ventas del cliente en la fecha. Parametrizado (anti-inyección).
//
// El día se filtra con un rango semiabierto [fecha, fecha+1) y NO con CAST(fecha AS DATE) = @fecha:
// envolver la columna en una función deja al optimizador de 2008 R2 dependiendo de un caso especial
// (GetRangeThroughConvert) y sin poder usar las estadísticas de FacVenFec para estimar cardinalidad,
// lo que en producción derivaba en planes de join completo (4,5 s para listar un día). El rango es
// semánticamente idéntico (FacVenFec es DATETIME; cualquier hora del día cae dentro) pero deja la
// columna desnuda: sargable en cualquier versión y con estimaciones sanas. Mismo criterio en todas
// las queries por fecha de este archivo.
async function obtenerFilasVentas(ruc, fechaISO) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('ruc', sql.VarChar, ruc)
    .input('fecha', sql.Date, fechaISO)
    .input('sinNombre', sql.VarChar, RUC_SIN_NOMBRE)
    .query(`
      SELECT venta_id, empresa, anulada, condicion_venta, cliente_ruc, cliente_nombre,
             item_nro, item_descripcion, item_cantidad, item_precio_unitario, item_tasa_iva
      FROM dbo.FACTYBLE_VENTAS_SIFEN_MIN
      WHERE cliente_ruc = @ruc
        AND fecha >= @fecha AND fecha < DATEADD(DAY, 1, @fecha)
        AND anulada = 0
        AND cliente_ruc <> @sinNombre
      ORDER BY venta_id, item_nro
    `);
  return result.recordset;
}

// Agrupa las filas-ítem por venta_id conservando el orden de item_nro.
function agruparPorVenta(filas) {
  const mapa = new Map();
  for (const fila of filas) {
    const id = String(fila.venta_id);
    if (!mapa.has(id)) {
      mapa.set(id, {
        venta_id: fila.venta_id,
        empresa: (fila.empresa || '').trim(),
        cliente_ruc: (fila.cliente_ruc || '').trim(),
        cliente_nombre: (fila.cliente_nombre || '').trim(),
        condicion_venta: fila.condicion_venta,
        items: [],
      });
    }
    mapa.get(id).items.push(fila);
  }
  return Array.from(mapa.values());
}

// Mapea+valida los ítems de una venta al formato de /factura/simple. Devuelve { ok, items } o
// { ok:false, error }. Compartido por el flujo nominado y el innominado.
function mapearItems(venta) {
  const items = [];
  for (const it of venta.items) {
    const tasa = TASA_IVA_MAP[Number(it.item_tasa_iva)];
    if (!tasa) {
      return { ok: false, error: `Ítem ${it.item_nro} sin tasa de IVA derivable (item_tasa_iva=${it.item_tasa_iva})` };
    }
    const cantidad = Number(it.item_cantidad);
    const precioUnitario = Number(it.item_precio_unitario);
    if (!(cantidad > 0) || !(precioUnitario >= 0)) {
      return { ok: false, error: `Ítem ${it.item_nro} con cantidad/precio inválidos (${cantidad}/${precioUnitario})` };
    }
    items.push({
      cantidad,
      precioUnitario,
      descripcion: (it.item_descripcion || '').trim() || 'Producto',
      tasa,
    });
  }
  return { ok: true, items };
}

// Construye el payload NOMINADO para /factura/simple. Devuelve { ok, payload } o { ok:false, error } si
// la venta tiene datos que impiden emitir (condición desconocida, ítem sin tasa de IVA derivable, etc.).
function construirPayload(venta) {
  const condicionVenta = mapearCondicionVenta(venta.condicion_venta);
  if (!condicionVenta) {
    return { ok: false, error: `Condición de venta desconocida: "${venta.condicion_venta}"` };
  }

  const mapeoItems = mapearItems(venta);
  if (!mapeoItems.ok) return mapeoItems;

  const situacionTributaria = derivarSituacionTributaria(venta.cliente_ruc);

  const payload = {
    situacionTributaria,
    personaDocumento: venta.cliente_ruc,
    personaNombre: venta.cliente_nombre || 'Sin Nombre',
    personaEmail: '', // la vista _MIN no expone email; opcional en /factura/simple
    condicionVenta,
    items: mapeoItems.items,
    // Trazabilidad con el origen PVTA (id_externo en factyble NO es único, no dedup: el candado es el outbox).
    idExterno: String(venta.venta_id),
  };

  return { ok: true, payload };
}

// Construye el payload INNOMINADO (consumidor final "Sin Nombre", SIFEN iTipIDRec=5) para una venta con
// cliente_ruc='x'. Con innominado=true, facturaService.emitirFactura ignora todo dato de receptor, así
// que sólo se mandan condición e ítems. Ver facturaSimpleService.js / facturaRoute.js (rama innominado).
function construirPayloadInnominado(venta) {
  const condicionVenta = mapearCondicionVenta(venta.condicion_venta);
  if (!condicionVenta) {
    return { ok: false, error: `Condición de venta desconocida: "${venta.condicion_venta}"` };
  }

  const mapeoItems = mapearItems(venta);
  if (!mapeoItems.ok) return mapeoItems;

  const payload = {
    innominado: true,
    condicionVenta,
    items: mapeoItems.items,
    idExterno: String(venta.venta_id),
  };

  return { ok: true, payload };
}

// Candado: reclama el evento ALTA (PENDIENTE -> PROCESANDO) de forma atómica. rowsAffected=1 => ganó el
// candado; 0 => no había fila PENDIENTE (ya procesada/en proceso, o inexistente).
async function reclamarEvento(pool, ventaId) {
  const r = await pool
    .request()
    .input('venta_id', sql.Decimal(15, 0), ventaId)
    .query(`
      UPDATE dbo.FACTYBLE_SIFEN_OUTBOX
      SET estado = 'PROCESANDO'
      WHERE venta_id = @venta_id AND tipo_evento = 'ALTA' AND estado = 'PENDIENTE'
    `);
  return r.rowsAffected[0] === 1;
}

// Estado actual del evento ALTA de una venta (o null si no existe fila).
async function estadoEvento(pool, ventaId) {
  const r = await pool
    .request()
    .input('venta_id', sql.Decimal(15, 0), ventaId)
    .query(`
      SELECT estado FROM dbo.FACTYBLE_SIFEN_OUTBOX
      WHERE venta_id = @venta_id AND tipo_evento = 'ALTA'
    `);
  return r.recordset.length ? r.recordset[0].estado : null;
}

// Fija el estado del evento ALTA (PROCESADO al emitir bien; PENDIENTE para liberar el candado ante fallo).
async function marcarEvento(pool, ventaId, estado) {
  await pool
    .request()
    .input('venta_id', sql.Decimal(15, 0), ventaId)
    .input('estado', sql.VarChar, estado)
    .query(`
      UPDATE dbo.FACTYBLE_SIFEN_OUTBOX
      SET estado = @estado
      WHERE venta_id = @venta_id AND tipo_evento = 'ALTA'
    `);
}

// Impresora de tickets del despliegue on-prem (nombre exacto de Windows, p. ej.
// "EPSON TM-T20IV-L Receipt"). Vacía = no se imprime nada, que es lo que corresponde en la nube.
//
// Se lee UNA vez al cargar el módulo (utils/impresoraTickets, compartido con la reimpresión): cambiar
// el .env no tiene efecto hasta reiniciar el proceso. Por eso se loguea al arrancar — sin esto, "no
// imprime" y "no está configurada" se ven exactamente igual desde afuera (la emisión funciona, el KUDE
// sale, y no aparece ningún error en ningún lado). El log vive acá y no en el módulo compartido para
// no repetirlo una vez por consumidor.
console.log(
  IMPRESORA_TICKETS
    ? `[procesarFactura] impresión de tickets ACTIVA -> "${IMPRESORA_TICKETS}"`
    : '[procesarFactura] impresión de tickets DESACTIVADA (IMPRESORA_TICKETS vacía)'
);

// Emite una venta ya mapeada bajo el candado del outbox. Devuelve el objeto resultado (PROCESADA /
// YA_PROCESADA / OMITIDA / ERROR). Compartido por los dos caminos de emisión (POST /procesar-factura por
// ruc+fecha y el botón "Generar factura" de la caja), tanto para nominadas como para innominadas.
//
// Se imprime siempre que haya IMPRESORA_TICKETS configurada. Existió un flag `imprimir` para distinguir
// los casos de uso: el cron de innominadas (cronJobsPvta.js) emitía en lotes cada 5 minutos e imprimir
// ahí escupía tickets de ventas cuyo cliente se había ido hacía rato. Sacado ese cron, TODA emisión la
// dispara una persona parada frente a la caja con el cliente esperando su comprobante — ya no queda un
// emisor desatendido del que haya que distinguirse.
async function emitirVentaConCandado(pool, venta, payload, datosUsuario) {
  const ventaId = venta.venta_id;

  // fuente APP y no BOT (el default de facturaSimpleService): estas facturas nacen en Factyble sobre
  // una venta de Starsoft, no en una conversación de WhatsApp. No es cosmético — loteService reenvía a
  // BOT_API_URL el resultado de SIFEN de todo documento con fuente BOT, y en el despliegue on-prem esa
  // URL no existe: cada factura terminaría en un POST fallido y una alerta de Telegram avisando que el
  // cliente final no recibió una notificación que nunca correspondió.
  const payloadFinal = {
    ...payload,
    fuente: 'APP',
    ...(IMPRESORA_TICKETS ? { impresora: IMPRESORA_TICKETS } : {}),
  };

  // Decisión A/C: reclamar el candado ANTES de emitir. Si no se gana, la venta ya fue tomada.
  const reclamada = await reclamarEvento(pool, ventaId);
  if (!reclamada) {
    const estado = await estadoEvento(pool, ventaId);
    return { venta_id: ventaId, resultado: estado ? 'YA_PROCESADA' : 'OMITIDA', estado_outbox: estado };
  }

  try {
    const factura = await facturaSimpleService.emitirFacturaSimple(payloadFinal, datosUsuario);
    await marcarEvento(pool, ventaId, 'PROCESADO');
    return {
      venta_id: ventaId,
      resultado: 'PROCESADA',
      factura_id: factura && factura.id,
      cdc: factura && factura.cdc,
      numero_factura: factura && factura.numeroFacturaFormateada,
      // Cuando esto responde el KUDE ya existe y está servido en /public: firma, QR y PDF son
      // síncronos dentro de facturaService.emitirFactura (sólo el envío a SIFEN es por lote). El
      // front lo necesita para imprimir (POST /procesar-factura, que emite en tanda, lo ignora).
      pdf_nombre: factura && factura.pdfNombre,
    };
  } catch (error) {
    // Emisión falló: liberar el candado (PROCESANDO -> PENDIENTE) para permitir un reintento futuro.
    try {
      await marcarEvento(pool, ventaId, 'PENDIENTE');
    } catch (revertErr) {
      console.error(`No se pudo liberar el candado de la venta ${ventaId}:`, revertErr.message);
    }
    return { venta_id: ventaId, resultado: 'ERROR', error: error.message };
  }
}

const procesarFactura = async (datos, datosUsuario) => {
  try {
    const fechaISO = convertirFecha(datos.fecha);
    const ruc = String(datos.ruc).trim();

    const filas = await obtenerFilasVentas(ruc, fechaISO);
    const ventas = agruparPorVenta(filas);

    if (ventas.length === 0) {
      // Datos inexistentes: no hay ninguna venta en la vista para ese ruc/fecha (RUC mal tipeado, fecha
      // equivocada, venta anulada, o directamente no existe). Se avisa al grupo de Telegram. Best-effort:
      // envuelto en try/catch propio para que una caída de Telegram no rompa la respuesta del endpoint
      // (mismo criterio de aislamiento que loteService/cronJobs).
      try {
        await telegramService.notificarFallaSistemica({
          titulo: 'Procesar factura: sin datos en PVTA',
          detalle: `No se encontró ninguna venta en FACTYBLE_VENTAS_SIFEN_MIN para RUC ${ruc} y fecha ${datos.fecha} (empresa emisora ${datosUsuario.empresaId}). Verificá el RUC y la fecha.`,
        });
      } catch (alertaErr) {
        console.error('No se pudo enviar la alerta de Telegram (sin datos en PVTA):', alertaErr.message);
      }

      return {
        fecha: datos.fecha,
        ruc,
        ventas_encontradas: 0,
        procesadas: 0,
        resultados: [],
      };
    }

    const pool = await getPool();
    const resultados = [];

    // Procesamiento aislado por venta: una falla no aborta las demás (mismo criterio que loteService).
    for (const venta of ventas) {
      const mapeo = construirPayload(venta);
      if (!mapeo.ok) {
        resultados.push({ venta_id: venta.venta_id, resultado: 'ERROR', error: mapeo.error });
        continue;
      }
      resultados.push(await emitirVentaConCandado(pool, venta, mapeo.payload, datosUsuario));
    }

    const procesadas = resultados.filter((r) => r.resultado === 'PROCESADA').length;

    return {
      fecha: datos.fecha,
      ruc,
      ventas_encontradas: ventas.length,
      procesadas,
      resultados,
    };
  } catch (error) {
    ErrorApp.handleServiceError(error, 'Error al procesar factura de PVTA');
  }
};

// ---------------------------------------------------------------------------------------------------
// Flujo asistido por caja (El Halcón): la cajera ve TODAS las ventas pendientes del día — nominadas e
// innominadas — y aprieta "Generar factura" en cada una, que emite el DE e imprime el KUDE para el cliente.
//
// Deliberadamente NO hay cron ni copia local para esto: la vista + FACTYBLE_SIFEN_OUTBOX ya son la cola,
// así que el front pollea el listado y éste consulta MSSQL en vivo. Replicar ese estado en MySQL sólo
// sumaría latencia (cron + polling se apilan) y consultas de fondo con la caja cerrada.
//
// Las innominadas (cliente_ruc='x') entran por este mismo camino: se listan junto a las nominadas y se
// emiten con el mismo botón; lo único que cambia es el payload (construirPayloadInnominado, sin datos de
// receptor). Antes las emitía por su cuenta un cron cada 5 minutos (cronJobsPvta.js); se eliminó, así que
// hoy no hay ningún emisor automático que pueda competir con la caja por una venta.
// ---------------------------------------------------------------------------------------------------

// PVTA es multiempresa (FACVEN.FacVenEmp -> CFGEMP.CfgRuc, expuesto como emisor_ruc en la vista), así
// que TODA consulta del flujo de caja debe acotarse al RUC de la empresa del usuario: sin ese filtro un
// usuario vería — y podría emitir bajo su propio timbrado — ventas de otra empresa del sistema.
//
// El RUC se resuelve desde la BD por empresaId en vez de leer el claim `empresaRuc` del JWT: el token es
// de larga duración y quedaría desactualizado si se corrige el RUC de la empresa. Es un lookup por clave
// primaria, barato aun con el polling del front.
async function obtenerRucEmpresa(datosUsuario) {
  const empresaId = datosUsuario && datosUsuario.empresaId;
  if (!empresaId) {
    throw new ErrorApp('El usuario no tiene una empresa asociada', 403);
  }

  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { ruc: true } });
  if (!empresa || !empresa.ruc) {
    throw new ErrorApp('La empresa del usuario no tiene RUC configurado', 409);
  }

  return empresa.ruc.trim();
}

// Filas-ítem de TODAS las ventas de un día con evento ALTA PENDIENTE: nominadas (cliente identificado) e
// innominadas (cliente_ruc='x'), que desde que se sacó el cron se facturan también desde la caja.
// Sin TOP: es un listado, no un batch acotado — el volumen queda limitado por el filtro de fecha.
//
// La fecha se bindea en vez de usar GETDATE() para poder mirar días anteriores: una venta cerrada a las
// 23:58 y no facturada cae fuera del "hoy" apenas pasa medianoche, y sin esto quedaba sin forma de
// llegar desde la pantalla de caja.
//
// Esta es LA query caliente del sistema (el front la pollea cada pocos segundos), así que todos los
// predicados están escritos para ser sargables en el SQL Server 2008 R2 Express de producción:
//   - fecha por rango semiabierto, no CAST(fecha AS DATE) (ver obtenerFilasVentas);
//   - sin RTRIM sobre emisor_ruc: la vista YA lo expone con RTRIM aplicado, y volver a envolverlo le
//     impide al optimizador matchear la expresión contra la definición de la vista.
// Con esto (y la vista v2, que sacó el RTRIM del join a CFGEMP — ver
// el-halcon-explorar-db/vista-ventas-sifen-2008-v2.sql) el plan queda en puros index seeks: arranca por
// el índice (estado, fecha) del outbox — decenas de filas — y hace seek por PK de FACVEN /
// FACVENLEVEL1 / CLIENTE / CFGEMP por cada pendiente, en vez de armar el join del día entero (contar
// las ventas de un día sobre la vista costaba 4,5 s medidos en la máquina de producción).
async function obtenerVentasPendientes(emisorRuc, fechaISO) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('emisorRuc', sql.VarChar, emisorRuc)
    .input('fecha', sql.Date, fechaISO)
    .query(`
      SELECT v.venta_id, v.empresa, v.condicion_venta, v.cliente_ruc, v.cliente_nombre,
             v.item_nro, v.item_descripcion, v.item_cantidad, v.item_precio_unitario, v.item_tasa_iva
      FROM dbo.FACTYBLE_VENTAS_SIFEN_MIN v
      WHERE v.anulada = 0
        AND v.emisor_ruc = @emisorRuc
        AND v.fecha >= @fecha AND v.fecha < DATEADD(DAY, 1, @fecha)
        AND EXISTS (
          SELECT 1 FROM dbo.FACTYBLE_SIFEN_OUTBOX o
          WHERE o.venta_id = v.venta_id AND o.tipo_evento = 'ALTA' AND o.estado = 'PENDIENTE'
        )
      ORDER BY v.venta_id, v.item_nro
    `);
  return result.recordset;
}

// Filas-ítem de UNA venta por su venta_id. Sin filtro de fecha a propósito: el front ya la listó, y una
// venta tomada justo antes de medianoche debe poder facturarse después. El filtro de emisor_ruc sí es
// una guarda y se mantiene: impide emitir una venta de otra empresa bajo el timbrado propio (el venta_id
// viene de la URL, no de la sesión). El de innominadas se sacó — existía sólo para no pisar al cron, que
// ya no existe; con él puesto, el botón de una venta sin nombre daría un 404.
async function obtenerFilasVentaPorId(ventaId, emisorRuc) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('venta_id', sql.Decimal(15, 0), ventaId)
    .input('emisorRuc', sql.VarChar, emisorRuc)
    .query(`
      SELECT v.venta_id, v.empresa, v.condicion_venta, v.cliente_ruc, v.cliente_nombre,
             v.item_nro, v.item_descripcion, v.item_cantidad, v.item_precio_unitario, v.item_tasa_iva
      FROM dbo.FACTYBLE_VENTAS_SIFEN_MIN v
      WHERE v.venta_id = @venta_id
        AND v.anulada = 0
        AND v.emisor_ruc = @emisorRuc
      ORDER BY v.item_nro
    `);
  return result.recordset;
}

// Listado en vivo que consume el front. Cada venta se pasa por el constructor de payload que le
// corresponde (innominado si el cliente es el "sin nombre" de PVTA) para adelantar acá los errores de
// mapeo (tasa de IVA no derivable, condición de venta desconocida) y exponerlos como `emitible: false` +
// `error`: la UI deshabilita el botón en vez de dejar que el clic falle en el POST.
const listarVentasPendientes = async (datosUsuario, fecha) => {
  try {
    const emisorRuc = await obtenerRucEmpresa(datosUsuario);
    // Sin fecha explicita se lista el dia en curso: es el caso de uso normal de la caja.
    const fechaISO = fecha || fechaHoyISO();
    const filas = await obtenerVentasPendientes(emisorRuc, fechaISO);
    const ventas = agruparPorVenta(filas);

    const pendientes = ventas.map((venta) => {
      // La venta de cliente "sin nombre" sale como innominada: mismo listado y mismo botón, pero sin
      // datos de receptor. Se marca en la respuesta (y no se deja que el front deduzca de un cliente_ruc
      // 'x', que es un centinela de PVTA, no un documento) para que la caja pueda mostrarla como lo que
      // es: un comprobante a "Sin Nombre", sin crédito fiscal para el cliente.
      const innominada = venta.cliente_ruc === RUC_SIN_NOMBRE;
      const mapeo = innominada ? construirPayloadInnominado(venta) : construirPayload(venta);
      const items = mapeo.ok ? mapeo.payload.items : [];

      return {
        venta_id: venta.venta_id,
        innominada,
        cliente_ruc: venta.cliente_ruc,
        cliente_nombre: venta.cliente_nombre,
        condicion_venta: venta.condicion_venta,
        items,
        // Mismo redondeo guaraní-entero que aplica la emisión (calcularTotalItem, ver CLAUDE.md), para
        // que el total que ve la cajera coincida con el que sale impreso en el KUDE.
        total: items.reduce((acc, it) => acc + calcularTotalItem(it.cantidad, it.precioUnitario), 0),
        emitible: mapeo.ok,
        error: mapeo.ok ? null : mapeo.error,
      };
    });

    // Se devuelve la fecha efectivamente consultada para que el front no tenga que asumir cual fue el
    // default del servidor (su reloj puede no coincidir con el del navegador).
    return { fecha: fechaISO, emisor_ruc: emisorRuc, ventas_pendientes: pendientes.length, ventas: pendientes };
  } catch (error) {
    ErrorApp.handleServiceError(error, 'Error al listar las ventas pendientes de PVTA');
  }
};

// Emite UNA venta a pedido de la cajera (nominada o innominada). El emisor es la empresa del JWT
// (datosUsuario), y ese mismo RUC acota la búsqueda en PVTA, así la venta que se emite y el timbrado con
// el que se emite pertenecen siempre a la misma empresa. El candado del outbox hace idempotente el doble
// clic: el segundo request no reclama nada y devuelve YA_PROCESADA sin emitir de nuevo.
const emitirVentaPorId = async (ventaId, datosUsuario) => {
  try {
    const emisorRuc = await obtenerRucEmpresa(datosUsuario);
    const filas = await obtenerFilasVentaPorId(ventaId, emisorRuc);
    const ventas = agruparPorVenta(filas);

    if (ventas.length === 0) {
      throw new ErrorApp(
        `No se encontró la venta ${ventaId} para el RUC ${emisorRuc} (inexistente, anulada o de otra ` +
          `empresa)`,
        404
      );
    }

    const venta = ventas[0];
    // Mismo criterio que el listado: el cliente sin nombre de PVTA se emite como innominada.
    const mapeo = venta.cliente_ruc === RUC_SIN_NOMBRE ? construirPayloadInnominado(venta) : construirPayload(venta);
    if (!mapeo.ok) {
      throw new ErrorApp(`La venta ${ventaId} no se puede emitir: ${mapeo.error}`, 422);
    }

    const pool = await getPool();
    return await emitirVentaConCandado(pool, venta, mapeo.payload, datosUsuario);
  } catch (error) {
    ErrorApp.handleServiceError(error, 'Error al emitir la venta de PVTA');
  }
};

module.exports = {
  procesarFactura,
  // exportados para verificación/testing de las piezas puras (sin emitir)
  convertirFecha,
  derivarSituacionTributaria,
  mapearCondicionVenta,
  agruparPorVenta,
  construirPayload,
  construirPayloadInnominado,
  obtenerFilasVentas,
  listarVentasPendientes,
  emitirVentaPorId,
  obtenerVentasPendientes,
  obtenerFilasVentaPorId,
  obtenerRucEmpresa,
  fechaHoyISO,
};
