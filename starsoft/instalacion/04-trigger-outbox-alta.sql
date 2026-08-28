/* =============================================================================
   TR_FACVEN_SIFEN_OUTBOX_ALTA  —  VERSIÓN COMPATIBLE SQL SERVER 2008 R2 (10.50)
   Trigger LIVIANO sobre FACVEN: encola un evento 'ALTA' (PENDIENTE) en
   FACTYBLE_SIFEN_OUTBOX cuando una venta pasa a ser Factura (TipCmp=13).

   El Halcón NO emite Notas de Crédito (anula la factura y emite otra), así que
   solo encolamos Facturas. La ANULACION se maneja en un trigger aparte
   (trigger-outbox-anulacion-2008.sql), PENDIENTE de confirmar con el proveedor
   cómo registra PVTA una anulación (UPDATE de flag vs DELETE de la fila).

   ⚠️ DISPARA EN INSERT *Y* UPDATE (verificado contra datos reales): PVTA inserta
      la venta primero como BORRADOR con FacVenTipCmp = 0 y recién DESPUÉS la
      actualiza a 13. Un trigger solo AFTER INSERT nunca la vería (al INSERT es 0;
      el paso a 13 ocurre en un UPDATE). Por eso escuchamos también UPDATE:
      encolamos en el momento en que la fila PASA a ser 13.

   CLAVE: el trigger SOLO inserta (venta_id, 'ALTA') en la cola (sin red, sin
   HTTP, sin lógica, sin datos de la venta). Corre dentro de la transacción de la
   venta. Toda la facturación electrónica ocurre FUERA, en el proceso externo,
   que obtiene los datos desde FACTYBLE_VENTAS_SIFEN_MIN.

   Idempotente: NOT EXISTS por (venta_id, tipo_evento='ALTA') + el índice único
   UX_FACTYBLE_SIFEN_OUTBOX_venta_evento evitan duplicar aunque haya varios UPDATE
   sobre la misma venta. Sin blindaje TRY/CATCH (decisión del usuario: un INSERT
   de 4 columnas a una tabla local es rarísimo que falle).
   ============================================================================= */
USE PVTA;   -- <<< IMPORTANTE: crear en PVTA, NO en master
GO

IF OBJECT_ID('dbo.TR_FACVEN_SIFEN_OUTBOX_ALTA', 'TR') IS NOT NULL
    DROP TRIGGER dbo.TR_FACVEN_SIFEN_OUTBOX_ALTA;
GO
-- Compat: si existiera el trigger viejo (nombre anterior a la separación
-- ALTA/ANULACION), lo removemos para no encolar dos veces.
IF OBJECT_ID('dbo.TR_FACVEN_SIFEN_OUTBOX', 'TR') IS NOT NULL
    DROP TRIGGER dbo.TR_FACVEN_SIFEN_OUTBOX;
GO

CREATE TRIGGER dbo.TR_FACVEN_SIFEN_OUTBOX_ALTA
ON dbo.FACVEN
AFTER INSERT, UPDATE                                  -- <<< también UPDATE (draft 0 -> 13)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.FACTYBLE_SIFEN_OUTBOX (venta_id, tipo_evento, estado)
    SELECT
        i.FacVenId,
        'ALTA',
        'PENDIENTE'
    FROM inserted i
    WHERE i.FacVenTipCmp = 13                         -- Solo Facturas
      AND NOT EXISTS (                                -- idempotencia (venta_id, ALTA)
          SELECT 1
          FROM dbo.FACTYBLE_SIFEN_OUTBOX o
          WHERE o.venta_id = i.FacVenId
            AND o.tipo_evento = 'ALTA'
      );
END;
GO
