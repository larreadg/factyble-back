/* =============================================================================
   diagnostico-pendientes.sql  —  por qué GET /procesar-factura/pendientes
   devuelve 0 para una fecha que "tiene registros".

   El endpoint aplica CINCO filtros encadenados. Este script los va agregando de a
   uno para que se vea en qué escalón se cae el conteo a cero. Solo lecturas.
   Compatible SQL Server 2008 R2.
   ============================================================================= */
USE PVTA;
GO

DECLARE @fecha DATE        = '2026-07-08';    -- <<< la fecha que consultaste
DECLARE @ruc   VARCHAR(20) = '4172191-8';     -- <<< el emisor_ruc que devolvió la API

/* ── 1. Embudo: dónde se pierde ─────────────────────────────────────────────
   La primera línea que caiga a 0 es la culpable. */
SELECT 1 AS paso, 'ventas del dia (sin filtros)' AS filtro,
       COUNT(DISTINCT v.venta_id) AS ventas
FROM dbo.FACTYBLE_VENTAS_SIFEN_MIN v
WHERE CAST(v.fecha AS DATE) = @fecha

UNION ALL
SELECT 2, '+ no anuladas',
       COUNT(DISTINCT v.venta_id)
FROM dbo.FACTYBLE_VENTAS_SIFEN_MIN v
WHERE CAST(v.fecha AS DATE) = @fecha
  AND v.anulada = 0

UNION ALL
SELECT 3, '+ emisor_ruc = @ruc',
       COUNT(DISTINCT v.venta_id)
FROM dbo.FACTYBLE_VENTAS_SIFEN_MIN v
WHERE CAST(v.fecha AS DATE) = @fecha
  AND v.anulada = 0
  AND RTRIM(v.emisor_ruc) = @ruc

UNION ALL
SELECT 4, '+ nominadas (cliente_ruc <> x)',
       COUNT(DISTINCT v.venta_id)
FROM dbo.FACTYBLE_VENTAS_SIFEN_MIN v
WHERE CAST(v.fecha AS DATE) = @fecha
  AND v.anulada = 0
  AND RTRIM(v.emisor_ruc) = @ruc
  AND RTRIM(v.cliente_ruc) <> 'x'

UNION ALL
SELECT 5, '+ con ALTA PENDIENTE en el outbox  <-- lo que devuelve la API',
       COUNT(DISTINCT v.venta_id)
FROM dbo.FACTYBLE_VENTAS_SIFEN_MIN v
WHERE CAST(v.fecha AS DATE) = @fecha
  AND v.anulada = 0
  AND RTRIM(v.emisor_ruc) = @ruc
  AND RTRIM(v.cliente_ruc) <> 'x'
  AND EXISTS (
        SELECT 1 FROM dbo.FACTYBLE_SIFEN_OUTBOX o
        WHERE o.venta_id = v.venta_id AND o.tipo_evento = 'ALTA' AND o.estado = 'PENDIENTE')
ORDER BY paso;
GO


/* ── 2. Si cayó en el paso 3: qué RUC emisores hay ese día ──────────────────
   Si el RUC de la ferretería aparece con otro formato (sin DV, con puntos, con
   padding), el problema es que empresa.ruc en factyble no coincide con CfgRuc. */
DECLARE @fecha DATE = '2026-07-08';

SELECT RTRIM(v.emisor_ruc)          AS emisor_ruc,
       LEN(v.emisor_ruc)            AS largo_crudo,
       RTRIM(v.emisor_razon_social) AS razon_social,
       COUNT(DISTINCT v.venta_id)   AS ventas
FROM dbo.FACTYBLE_VENTAS_SIFEN_MIN v
WHERE CAST(v.fecha AS DATE) = @fecha
  AND v.anulada = 0
GROUP BY RTRIM(v.emisor_ruc), LEN(v.emisor_ruc), RTRIM(v.emisor_razon_social)
ORDER BY ventas DESC;
GO


/* ── 3. Si cayó en el paso 5: qué cubre realmente el outbox ─────────────────
   poblar-outbox-local.sql siembra con TOP (@Limite) ORDER BY FacVenFec DESC, o sea
   SOLO las N facturas más recientes. Si min_fecha es posterior a la fecha que
   consultás, las ventas de ese día nunca entraron a la cola: la vista las tiene,
   el outbox no, y el EXISTS las descarta. */
SELECT o.estado,
       COUNT(*)          AS eventos,
       MIN(h.FacVenFec)  AS min_fecha_venta,
       MAX(h.FacVenFec)  AS max_fecha_venta
FROM dbo.FACTYBLE_SIFEN_OUTBOX o
INNER JOIN dbo.FACVEN h ON h.FacVenId = o.venta_id
WHERE o.tipo_evento = 'ALTA'
GROUP BY o.estado;
GO


/* ── 4. Cuántas ventas de ESE día están en el outbox, y en qué estado ───────
   Sin filas = el backfill no las alcanzó. Con estado PROCESADO = ya se facturaron. */
DECLARE @fecha DATE = '2026-07-08';

SELECT ISNULL(o.estado, '(sin fila en el outbox)') AS estado_outbox,
       COUNT(DISTINCT h.FacVenId)                  AS ventas
FROM dbo.FACVEN h
LEFT JOIN dbo.FACTYBLE_SIFEN_OUTBOX o
       ON o.venta_id = h.FacVenId AND o.tipo_evento = 'ALTA'
WHERE h.FacVenTipCmp = 13
  AND h.FacVenAnl = 0
  AND CAST(h.FacVenFec AS DATE) = @fecha
GROUP BY o.estado;
GO


/* ── Arreglo, si el problema es el outbox (SOLO EN LOCAL) ───────────────────
   poblar-outbox-local.sql con @FechaDesde = '2026-07-01' y @Limite = 0 encola todo
   desde esa fecha. NO correr en producción: allí la cola la llena el trigger
   TR_FACVEN_SIFEN_OUTBOX_ALTA y un backfill masivo dispararía la emisión de
   facturas viejas a SIFEN. */
