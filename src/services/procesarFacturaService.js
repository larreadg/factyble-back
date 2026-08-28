const prisma = require('../prisma/cliente');
const { getPool, sql } = require('../db/dbPvta');
const ErrorApp = require('../utils/error');
const facturaSimpleService = require('./facturaSimpleService');
const { calcularTotalItem } = require('../utils/facturacion');
const telegramService = require('./telegramService');

// Centinela de PVTA para el cliente "sin nombre" (consumidor final no identificado): en la vista figura
// como cliente_ruc = 'x'. Estas ventas NO se emiten como facturas nominadas (el endpoint las excluye);
// se emiten como INNOMINADAS de forma proactiva por el cron (ver procesarInnominadosPendientes + cronJobsPvta.js).
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
        emisor_ruc: (fila.emisor_ruc || '').trim(), // sólo lo trae la query de innominadas (cron)
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

// Emite una venta ya mapeada bajo el candado del outbox. Devuelve el objeto resultado (PROCESADA /
// YA_PROCESADA / OMITIDA / ERROR). Compartido por el endpoint (nominadas) y el cron (innominadas).
async function emitirVentaConCandado(pool, venta, payload, datosUsuario) {
  const ventaId = venta.venta_id;

  // Decisión A/C: reclamar el candado ANTES de emitir. Si no se gana, la venta ya fue tomada.
  const reclamada = await reclamarEvento(pool, ventaId);
  if (!reclamada) {
    const estado = await estadoEvento(pool, ventaId);
    return { venta_id: ventaId, resultado: estado ? 'YA_PROCESADA' : 'OMITIDA', estado_outbox: estado };
  }

  try {
    const factura = await facturaSimpleService.emitirFacturaSimple(payload, datosUsuario);
    await marcarEvento(pool, ventaId, 'PROCESADO');
    return {
      venta_id: ventaId,
      resultado: 'PROCESADA',
      factura_id: factura && factura.id,
      cdc: factura && factura.cdc,
      numero_factura: factura && factura.numeroFacturaFormateada,
      // Cuando esto responde el KUDE ya existe y está servido en /public: firma, QR y PDF son
      // síncronos dentro de facturaService.emitirFactura (sólo el envío a SIFEN es por lote). El
      // front lo necesita para imprimir; el cron de innominadas simplemente ignora este campo.
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

// Trae las filas-ítem de hasta `limite` ventas de cliente SIN NOMBRE (cliente_ruc='x') que tengan un
// evento ALTA PENDIENTE en el outbox, en orden de llegada (fecha del evento). El TOP se aplica sobre los
// venta_id de la cola (no sobre las filas-ítem), así el límite cuenta VENTAS y no ítems. Trae emisor_ruc
// para resolver la empresa emisora aguas abajo. Compatible SQL 2008 R2 (TOP con variable + subconsulta).
// Sin RTRIM sobre cliente_ruc: la vista ya lo expone con RTRIM aplicado (mismo criterio de
// sargabilidad que obtenerVentasNominadasPendientes).
async function obtenerVentasInnominadasPendientes(limite) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('limite', sql.Int, limite)
    .input('sinNombre', sql.VarChar, RUC_SIN_NOMBRE)
    .query(`
      SELECT v.venta_id, v.empresa, v.emisor_ruc, v.condicion_venta, v.cliente_ruc, v.cliente_nombre,
             v.item_nro, v.item_descripcion, v.item_cantidad, v.item_precio_unitario, v.item_tasa_iva
      FROM dbo.FACTYBLE_VENTAS_SIFEN_MIN v
      WHERE v.anulada = 0
        AND v.cliente_ruc = @sinNombre
        AND v.venta_id IN (
          SELECT TOP (@limite) o.venta_id
          FROM dbo.FACTYBLE_SIFEN_OUTBOX o
          WHERE o.tipo_evento = 'ALTA'
            AND o.estado = 'PENDIENTE'
            AND EXISTS (
              SELECT 1 FROM dbo.FACTYBLE_VENTAS_SIFEN_MIN vx
              WHERE vx.venta_id = o.venta_id
                AND vx.anulada = 0
                AND vx.cliente_ruc = @sinNombre
            )
          ORDER BY o.fecha ASC
        )
      ORDER BY v.venta_id, v.item_nro
    `);
  return result.recordset;
}

// Resuelve el emisor (equivalente al req.usuario del endpoint) para una venta a partir de su emisor_ruc:
// se matchea contra empresa.ruc (RUC completo con DV — el ruc_sin_dv no es confiable) y se toma un
// usuario activo de esa empresa. Devuelve { ok, datosUsuario } o { ok:false, error }. PVTA es
// multiempresa: sólo se emite para empresas que existan en factyble; las demás (IGM, 4J, etc. sin alta)
// se saltan con ERROR. `cache` (Map por corrida) evita reconsultar el mismo emisor_ruc.
async function resolverEmisorPorRuc(emisorRuc, cache) {
  const ruc = (emisorRuc || '').trim();
  if (!ruc) return { ok: false, error: 'La venta no tiene emisor_ruc en la vista' };
  if (cache.has(ruc)) return cache.get(ruc);

  let resultado;
  const empresa = await prisma.empresa.findFirst({ where: { ruc }, select: { id: true } });
  if (!empresa) {
    resultado = { ok: false, error: `No hay empresa en factyble con RUC ${ruc} (emisor no dado de alta)` };
  } else {
    const usuario = await prisma.usuario.findFirst({
      where: { empresa_id: empresa.id, activo: true },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    resultado = usuario
      ? { ok: true, datosUsuario: { id: usuario.id, empresaId: empresa.id } }
      : { ok: false, error: `La empresa (RUC ${ruc}) no tiene un usuario activo para emitir` };
  }

  cache.set(ruc, resultado);
  return resultado;
}

// Barre el outbox y emite como INNOMINADAS hasta `limite` ventas de cliente sin nombre pendientes. Lo
// invoca el cron cada 5 min (cronJobsPvta.js). El emisor de cada venta se resuelve por su emisor_ruc
// (multiempresa). Mismo candado atómico que el endpoint (PENDIENTE -> PROCESANDO -> PROCESADO), así dos
// corridas solapadas nunca emiten dos veces la misma venta.
async function procesarInnominadosPendientes(limite = 10) {
  const filas = await obtenerVentasInnominadasPendientes(limite);
  const ventas = agruparPorVenta(filas);

  if (ventas.length === 0) {
    return { tomadas: 0, procesadas: 0, errores: 0, resultados: [] };
  }

  const pool = await getPool();
  const emisorCache = new Map();
  const resultados = [];

  for (const venta of ventas) {
    const mapeo = construirPayloadInnominado(venta);
    if (!mapeo.ok) {
      resultados.push({ venta_id: venta.venta_id, resultado: 'ERROR', error: mapeo.error });
      continue;
    }

    // El emisor se resuelve por venta a partir de emisor_ruc (cacheado por corrida). Si no hay empresa
    // dada de alta para ese RUC, la venta se salta SIN reclamar el candado (queda PENDIENTE para cuando
    // se configure la empresa).
    const emisor = await resolverEmisorPorRuc(venta.emisor_ruc, emisorCache);
    if (!emisor.ok) {
      resultados.push({ venta_id: venta.venta_id, resultado: 'ERROR', error: emisor.error });
      continue;
    }

    resultados.push(await emitirVentaConCandado(pool, venta, mapeo.payload, emisor.datosUsuario));
  }

  const procesadas = resultados.filter((r) => r.resultado === 'PROCESADA').length;
  const errores = resultados.filter((r) => r.resultado === 'ERROR').length;

  return { tomadas: ventas.length, procesadas, errores, resultados };
}

// ---------------------------------------------------------------------------------------------------
// Flujo asistido por caja (El Halcón): la cajera ve las ventas NOMINADAS pendientes y aprieta
// "Generar factura" en cada una, porque son las que requieren KUDE impreso para el cliente.
//
// Deliberadamente NO hay cron ni copia local para esto: la vista + FACTYBLE_SIFEN_OUTBOX ya son la cola,
// así que el front pollea el listado y éste consulta MSSQL en vivo. Replicar ese estado en MySQL sólo
// sumaría latencia (cron + polling se apilan) y consultas de fondo con la caja cerrada.
//
// Las innominadas quedan fuera de estos dos caminos: las emite proactivamente el cron
// (procesarInnominadosPendientes + cronJobsPvta.js). Los conjuntos son disjuntos, así que el flujo
// manual y el automático nunca compiten por la misma venta.
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

// Filas-ítem de TODAS las ventas nominadas (cliente identificado) de un día con evento ALTA PENDIENTE.
// Sin TOP: es un listado, no un batch acotado — el volumen queda limitado por el filtro de fecha.
//
// La fecha se bindea en vez de usar GETDATE() para poder mirar días anteriores: una venta cerrada a las
// 23:58 y no facturada cae fuera del "hoy" apenas pasa medianoche, y sin esto quedaba sin forma de
// llegar desde la pantalla de caja.
//
// Esta es LA query caliente del sistema (el front la pollea cada pocos segundos), así que todos los
// predicados están escritos para ser sargables en el SQL Server 2008 R2 Express de producción:
//   - fecha por rango semiabierto, no CAST(fecha AS DATE) (ver obtenerFilasVentas);
//   - sin RTRIM sobre emisor_ruc / cliente_ruc: la vista YA los expone con RTRIM aplicado, y volver a
//     envolverlos le impide al optimizador matchear la expresión contra la definición de la vista.
// Con esto (y la vista v2, que sacó el RTRIM del join a CFGEMP — ver
// el-halcon-explorar-db/vista-ventas-sifen-2008-v2.sql) el plan queda en puros index seeks: arranca por
// el índice (estado, fecha) del outbox — decenas de filas — y hace seek por PK de FACVEN /
// FACVENLEVEL1 / CLIENTE / CFGEMP por cada pendiente, en vez de armar el join del día entero (contar
// las ventas de un día sobre la vista costaba 4,5 s medidos en la máquina de producción).
async function obtenerVentasNominadasPendientes(emisorRuc, fechaISO) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('sinNombre', sql.VarChar, RUC_SIN_NOMBRE)
    .input('emisorRuc', sql.VarChar, emisorRuc)
    .input('fecha', sql.Date, fechaISO)
    .query(`
      SELECT v.venta_id, v.empresa, v.condicion_venta, v.cliente_ruc, v.cliente_nombre,
             v.item_nro, v.item_descripcion, v.item_cantidad, v.item_precio_unitario, v.item_tasa_iva
      FROM dbo.FACTYBLE_VENTAS_SIFEN_MIN v
      WHERE v.anulada = 0
        AND v.emisor_ruc = @emisorRuc
        AND v.cliente_ruc <> @sinNombre
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
// venta tomada justo antes de medianoche debe poder facturarse después. Los otros dos filtros sí son
// guardas y se mantienen: el de emisor_ruc impide emitir una venta de otra empresa bajo el timbrado
// propio (el venta_id viene de la URL, no de la sesión), y el de innominadas impide pisar al cron.
async function obtenerFilasVentaPorId(ventaId, emisorRuc) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('venta_id', sql.Decimal(15, 0), ventaId)
    .input('sinNombre', sql.VarChar, RUC_SIN_NOMBRE)
    .input('emisorRuc', sql.VarChar, emisorRuc)
    .query(`
      SELECT v.venta_id, v.empresa, v.condicion_venta, v.cliente_ruc, v.cliente_nombre,
             v.item_nro, v.item_descripcion, v.item_cantidad, v.item_precio_unitario, v.item_tasa_iva
      FROM dbo.FACTYBLE_VENTAS_SIFEN_MIN v
      WHERE v.venta_id = @venta_id
        AND v.anulada = 0
        AND v.emisor_ruc = @emisorRuc
        AND v.cliente_ruc <> @sinNombre
      ORDER BY v.item_nro
    `);
  return result.recordset;
}

// Listado en vivo que consume el front. Cada venta se pasa por construirPayload para adelantar acá los
// errores de mapeo (tasa de IVA no derivable, condición de venta desconocida) y exponerlos como
// `emitible: false` + `error`: la UI deshabilita el botón en vez de dejar que el clic falle en el POST.
const listarVentasPendientes = async (datosUsuario, fecha) => {
  try {
    const emisorRuc = await obtenerRucEmpresa(datosUsuario);
    // Sin fecha explicita se lista el dia en curso: es el caso de uso normal de la caja.
    const fechaISO = fecha || fechaHoyISO();
    const filas = await obtenerVentasNominadasPendientes(emisorRuc, fechaISO);
    const ventas = agruparPorVenta(filas);

    const pendientes = ventas.map((venta) => {
      const mapeo = construirPayload(venta);
      const items = mapeo.ok ? mapeo.payload.items : [];

      return {
        venta_id: venta.venta_id,
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

// Emite UNA venta nominada a pedido de la cajera. El emisor es la empresa del JWT (datosUsuario), igual
// que procesarFactura — resolverEmisorPorRuc es exclusivo del cron, que corre sin usuario y sobre varias
// empresas. Ese mismo RUC acota la búsqueda en PVTA, así la venta que se emite y el timbrado con el que
// se emite pertenecen siempre a la misma empresa. El candado del outbox hace idempotente el doble clic: el segundo request no reclama nada y
// devuelve YA_PROCESADA sin emitir de nuevo.
const emitirVentaPorId = async (ventaId, datosUsuario) => {
  try {
    const emisorRuc = await obtenerRucEmpresa(datosUsuario);
    const filas = await obtenerFilasVentaPorId(ventaId, emisorRuc);
    const ventas = agruparPorVenta(filas);

    if (ventas.length === 0) {
      throw new ErrorApp(
        `No se encontró la venta ${ventaId} para el RUC ${emisorRuc} (inexistente, anulada, de otra ` +
          `empresa, o de cliente sin nombre)`,
        404
      );
    }

    const venta = ventas[0];
    const mapeo = construirPayload(venta);
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
  procesarInnominadosPendientes,
  // exportados para verificación/testing de las piezas puras (sin emitir)
  convertirFecha,
  derivarSituacionTributaria,
  mapearCondicionVenta,
  agruparPorVenta,
  construirPayload,
  construirPayloadInnominado,
  obtenerFilasVentas,
  obtenerVentasInnominadasPendientes,
  listarVentasPendientes,
  emitirVentaPorId,
  obtenerVentasNominadasPendientes,
  obtenerFilasVentaPorId,
  obtenerRucEmpresa,
  fechaHoyISO,
};
