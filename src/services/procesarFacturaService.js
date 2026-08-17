const prisma = require('../prisma/cliente');
const { getPool, sql } = require('../db/dbPvta');
const ErrorApp = require('../utils/error');
const facturaSimpleService = require('./facturaSimpleService');
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
        AND CAST(fecha AS DATE) = @fecha
        AND anulada = 0
        AND RTRIM(cliente_ruc) <> @sinNombre
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
        AND RTRIM(v.cliente_ruc) = @sinNombre
        AND v.venta_id IN (
          SELECT TOP (@limite) o.venta_id
          FROM dbo.FACTYBLE_SIFEN_OUTBOX o
          WHERE o.tipo_evento = 'ALTA'
            AND o.estado = 'PENDIENTE'
            AND EXISTS (
              SELECT 1 FROM dbo.FACTYBLE_VENTAS_SIFEN_MIN vx
              WHERE vx.venta_id = o.venta_id
                AND vx.anulada = 0
                AND RTRIM(vx.cliente_ruc) = @sinNombre
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
};
