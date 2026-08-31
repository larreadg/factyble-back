/* =============================================================================
   diagnostico-innominadas.sql  —  por qué la pantalla de caja no muestra
   ventas INNOMINADAS (cliente sin nombre, cliente_ruc = 'x' en PVTA).

   Contexto: hasta 2026-08-31 las innominadas las emitia solo un cron del backend
   (cronJobsPvta.js) cada 5 minutos. Se elimino: ahora salen en el mismo listado
   que las nominadas (GET /procesar-factura/pendientes) y las factura la cajera.
   Si no aparece ninguna, la causa casi siempre es una de estas dos:
     a) el cron ya las dejo en PROCESADO antes de que lo sacaramos -> paso 2;
     b) el backend que responde el endpoint no se reinicio con el cambio -> paso 3
        (si el paso 3 devuelve filas y la pantalla no, el problema es el proceso
        Node o el bundle del front, no la base).

   Solo lecturas. Compatible SQL Server 2008 R2.
   ============================================================================= */
USE PVTA;
GO

/* -- 1. La cola cruda: TODO lo que el trigger encolo y todavia no se proceso ---
   Es la tabla tal cual, sin joins: si aca no hay filas, no hay nada que facturar
   (o el trigger TR_FACVEN_SIFEN_OUTBOX_ALTA no esta encolando). */
SELECT o.venta_id,
       o.tipo_evento,
       o.estado,
       o.fecha AS fecha_evento
FROM dbo.FACTYBLE_SIFEN_OUTBOX o
WHERE o.estado <> 'PROCESADO'          -- PENDIENTE, y PROCESANDO si quedo colgado
ORDER BY o.fecha;
GO


/* -- 2. Resumen del dia: cuantas nominadas / innominadas hay y en que estado ---
   La linea (INNOMINADA, PROCESADO) es el cron viejo: esas ventas ya se emitieron
   y por eso NO van a aparecer nunca mas en la pantalla. Solo las PENDIENTE se
   listan. '(sin fila en outbox)' = el trigger no las tomo. */
DECLARE @fecha DATE = '2026-08-08';    -- <<< el dia que estas mirando

SELECT CASE WHEN v.cliente_ruc = 'x' THEN 'INNOMINADA' ELSE 'NOMINADA' END AS tipo,
       ISNULL(o.estado, '(sin fila en outbox)')                            AS estado_outbox,
       COUNT(DISTINCT v.venta_id)                                          AS ventas
FROM dbo.FACTYBLE_VENTAS_SIFEN_MIN v
LEFT JOIN dbo.FACTYBLE_SIFEN_OUTBOX o
       ON o.venta_id = v.venta_id AND o.tipo_evento = 'ALTA'
WHERE v.anulada = 0
  AND v.fecha >= @fecha AND v.fecha < DATEADD(DAY, 1, @fecha)
GROUP BY CASE WHEN v.cliente_ruc = 'x' THEN 'INNOMINADA' ELSE 'NOMINADA' END,
         ISNULL(o.estado, '(sin fila en outbox)')
ORDER BY tipo, estado_outbox;
GO


/* -- 3. Lo MISMO que devuelve el endpoint, venta por venta ---------------------
   Estos son exactamente los filtros de obtenerVentasPendientes()
   (procesarFacturaService.js) despues de sacar el cron: sin la exclusion de
   cliente_ruc <> 'x'. Si aca ves innominadas y en la pantalla no, el backend no
   corre el codigo nuevo (reinicia Node) o el navegador tiene el bundle viejo. */
DECLARE @fecha DATE        = '2026-08-08';   -- <<< el dia
DECLARE @emisorRuc VARCHAR(20) = '4172191-8';  -- <<< emisor_ruc que devuelve la API

SELECT v.venta_id,
       CASE WHEN v.cliente_ruc = 'x' THEN 'INNOMINADA' ELSE 'NOMINADA' END AS tipo,
       v.cliente_ruc,
       v.cliente_nombre,
       v.condicion_venta,
       MIN(v.fecha)                                                        AS fecha_venta,
       COUNT(*)                                                            AS items,
       SUM(v.item_cantidad * v.item_precio_unitario)                       AS total_aprox
FROM dbo.FACTYBLE_VENTAS_SIFEN_MIN v
WHERE v.anulada = 0
  AND v.emisor_ruc = @emisorRuc
  AND v.fecha >= @fecha AND v.fecha < DATEADD(DAY, 1, @fecha)
  AND EXISTS (
        SELECT 1 FROM dbo.FACTYBLE_SIFEN_OUTBOX o
        WHERE o.venta_id = v.venta_id AND o.tipo_evento = 'ALTA' AND o.estado = 'PENDIENTE')
GROUP BY v.venta_id, v.cliente_ruc, v.cliente_nombre, v.condicion_venta
ORDER BY tipo, v.venta_id;
GO


/* -- 4. Candados colgados (PROCESANDO) -----------------------------------------
   Una venta queda en PROCESANDO solo mientras se emite. Si aparece una vieja, el
   proceso Node murio en el medio: NO se lista ni se puede facturar hasta soltarla.
   Antes de tocarla hay que confirmar en factyble si la factura llego a emitirse
   (buscar el id_externo = venta_id); si NO se emitio, se libera con:
       UPDATE dbo.FACTYBLE_SIFEN_OUTBOX SET estado = 'PENDIENTE'
       WHERE venta_id = <id> AND tipo_evento = 'ALTA' AND estado = 'PROCESANDO';
   Nunca borrar la fila: el trigger la volveria a encolar y se emitiria dos veces. */
SELECT o.venta_id, o.estado, o.fecha AS fecha_evento,
       DATEDIFF(MINUTE, o.fecha, GETDATE()) AS minutos_desde_el_evento
FROM dbo.FACTYBLE_SIFEN_OUTBOX o
WHERE o.tipo_evento = 'ALTA'
  AND o.estado = 'PROCESANDO'
ORDER BY o.fecha;
GO
