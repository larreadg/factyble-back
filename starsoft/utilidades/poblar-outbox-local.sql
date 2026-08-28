/* =============================================================================
   poblar-outbox-local.sql  —  ⚠️ SOLO PRUEBAS LOCALES (copia snapshot)
   Backfill de eventos 'ALTA' (PENDIENTE) en FACTYBLE_SIFEN_OUTBOX a partir de las
   facturas existentes (FacVenTipCmp = 13) de la copia local, para poder probar el
   worker sin esperar ventas nuevas.

   🚫 NO correr en producción: allí la cola se alimenta sola con el trigger
      TR_FACVEN_SIFEN_OUTBOX_ALTA. Este script es solo para cargar datos de prueba.

   NO DUPLICA: mismo NOT EXISTS por (venta_id,'ALTA') que el trigger + índice único.
   ⚠️ Pero como usa TOP @Limite + NOT EXISTS, cada corrida AGREGA el SIGUIENTE lote
      de @Limite facturas aún no encoladas (correr 2 veces con @Limite=200 => 400 en
      la cola, sin duplicados). Para empezar de cero usá el RESET del final.
   ACOTABLE por los parámetros de abajo. Requiere tabla-outbox-2008.sql ya creada.
   Compatible SQL Server 2008 R2 (sin CONCAT, TOP con variable OK).
   ============================================================================= */
USE PVTA;
GO

-- ── Parámetros de la prueba (ajustá a gusto) ─────────────────────────────────
DECLARE @Limite       INT        = 200;          -- cuántas facturas cargar. 0 = TODAS (~109k)
DECLARE @Empresa      VARCHAR(8) = NULL;         -- p.ej. 'HALCON26'. NULL = todas las empresas
DECLARE @FechaDesde   DATE       = NULL;         -- p.ej. '2026-08-01'. NULL = sin límite inferior
DECLARE @SoloVigentes BIT        = 1;            -- 1 = solo FacVenAnl = 0 (no anuladas)

DECLARE @Top INT = CASE WHEN @Limite = 0 THEN 2147483647 ELSE @Limite END;

-- ── Carga de eventos ALTA ────────────────────────────────────────────────────
INSERT INTO dbo.FACTYBLE_SIFEN_OUTBOX (venta_id, tipo_evento, estado)
SELECT TOP (@Top)
       h.FacVenId, 'ALTA', 'PENDIENTE'
FROM dbo.FACVEN h
WHERE h.FacVenTipCmp = 13                                   -- solo Facturas
  AND (@Empresa      IS NULL OR RTRIM(h.FacVenEmp) = @Empresa)
  AND (@FechaDesde   IS NULL OR h.FacVenFec >= @FechaDesde)
  AND (@SoloVigentes = 0     OR h.FacVenAnl = 0)
  AND NOT EXISTS (                                          -- idempotencia
        SELECT 1 FROM dbo.FACTYBLE_SIFEN_OUTBOX o
        WHERE o.venta_id = h.FacVenId AND o.tipo_evento = 'ALTA')
ORDER BY h.FacVenFec DESC, h.FacVenId DESC;                 -- las más recientes primero

PRINT 'Filas insertadas en esta corrida: ' + CAST(@@ROWCOUNT AS varchar(20));
GO

-- ── Reporte del estado de la cola ────────────────────────────────────────────
SELECT tipo_evento, estado, COUNT(*) AS eventos
FROM dbo.FACTYBLE_SIFEN_OUTBOX
GROUP BY tipo_evento, estado
ORDER BY tipo_evento, estado;
GO

-- Muestra: los eventos + datos de la factura (para chequear que la vista resuelve).
-- ⚠️ item_nro (FacVenIte) NO siempre arranca en 1 (verificado: hay facturas con
--    ítems 2,3,4). Para "1 fila por venta" usamos OUTER APPLY tomando la primera
--    línea real por orden de item_nro, no un item_nro fijo.
SELECT TOP 10
       o.fecha AS encolado, o.tipo_evento, o.estado, o.venta_id,
       v.empresa, v.comprobante, v.cliente_nombre, v.total_comprobante
FROM dbo.FACTYBLE_SIFEN_OUTBOX o
OUTER APPLY (SELECT TOP 1 empresa, comprobante, cliente_nombre, total_comprobante
             FROM dbo.FACTYBLE_VENTAS_SIFEN v
             WHERE v.venta_id = o.venta_id
             ORDER BY v.item_nro) v
ORDER BY o.fecha DESC;
GO

/* -----------------------------------------------------------------------------
   OPCIONAL — inyectar un evento ANULACION de prueba para ejercitar esa rama del
   worker (reemplazá <VENTA_ID> por un venta_id que ya tenga ALTA en la cola):
   -----------------------------------------------------------------------------
   INSERT INTO dbo.FACTYBLE_SIFEN_OUTBOX (venta_id, tipo_evento, estado)
   VALUES (<VENTA_ID>, 'ANULACION', 'PENDIENTE');

   RESET — vaciar la cola para volver a probar desde cero:
   -----------------------------------------------------------------------------
   TRUNCATE TABLE dbo.FACTYBLE_SIFEN_OUTBOX;
----------------------------------------------------------------------------- */
