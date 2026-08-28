/* =============================================================================
   TR_FACVEN_SIFEN_OUTBOX_ANULACION  —  PLANTILLA (SQL SERVER 2008 R2)
   Encola un evento 'ANULACION' (PENDIENTE) en FACTYBLE_SIFEN_OUTBOX cuando una
   factura (TipCmp=13) YA EMITIDA se anula en PVTA. El worker externo, al procesar
   ese evento, decide el instrumento SIFEN (evento de cancelación <=48h de
   aprobada; Nota de Crédito fuera de plazo).

   ┌───────────────────────────────────────────────────────────────────────────┐
   │ 🚫 NO DESPLEGAR TODAVÍA. PENDIENTE DE CONFIRMAR CON EL PROVEEDOR DE PVTA.   │
   └───────────────────────────────────────────────────────────────────────────┘
   Motivo: en la BD actual NO hay forma verificada de detectar una anulación.
   Verificado contra datos reales (2026-08-16):
     - FacVenAnl = 0 en las 109.059 facturas (la columna NUNCA se prende).
     - FacVenEntEst / FacVenEstDev / FacVenEstRes no marcan anulaciones.
     - No existe tabla de anulación/void/cancelación.
   => No sabemos si "anular factura" en PVTA es (A) un UPDATE que setea un flag,
      o (B) un DELETE físico de la fila. Hasta que el proveedor lo confirme, este
      trigger es una PLANTILLA: elegir el CASO correcto, revisar la condición y
      recién ahí crearlo. Requiere primero desplegar tabla-outbox-2008.sql.

   ═════════════════════════════════════════════════════════════════════════════
   CASO A — Anular = UPDATE de un flag en FACVEN (p.ej. FacVenAnl pasa a <>0).
            Ajustar el nombre/condición del flag a lo que confirme el proveedor.
   ═════════════════════════════════════════════════════════════════════════════
/*
USE PVTA;
GO
IF OBJECT_ID('dbo.TR_FACVEN_SIFEN_OUTBOX_ANULACION', 'TR') IS NOT NULL
    DROP TRIGGER dbo.TR_FACVEN_SIFEN_OUTBOX_ANULACION;
GO
CREATE TRIGGER dbo.TR_FACVEN_SIFEN_OUTBOX_ANULACION
ON dbo.FACVEN
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.FACTYBLE_SIFEN_OUTBOX (venta_id, tipo_evento, estado)
    SELECT
        i.FacVenId, 'ANULACION', 'PENDIENTE'
    FROM inserted i
    INNER JOIN deleted d ON d.FacVenId = i.FacVenId
    WHERE i.FacVenTipCmp = 13
      AND d.FacVenAnl = 0 AND i.FacVenAnl <> 0        -- <<< transición: pasó a anulada (AJUSTAR flag real)
      AND NOT EXISTS (                                -- idempotencia (venta_id, ANULACION)
          SELECT 1 FROM dbo.FACTYBLE_SIFEN_OUTBOX o
          WHERE o.venta_id = i.FacVenId AND o.tipo_evento = 'ANULACION'
      );
END;
GO
*/

   ═════════════════════════════════════════════════════════════════════════════
   CASO B — Anular = DELETE físico de la fila de FACVEN.
            ⚠️ Un AFTER DELETE sobre la tabla core de ventas: filtrar a TipCmp=13
            (solo facturas confirmadas; ignorar borrado de borradores TipCmp=0).
            Antes de habilitar, confirmar que PVTA NO borra facturas 13 como
            parte de su operatoria normal (si lo hiciera, habría falsos positivos).
   ═════════════════════════════════════════════════════════════════════════════
/*
USE PVTA;
GO
IF OBJECT_ID('dbo.TR_FACVEN_SIFEN_OUTBOX_ANULACION', 'TR') IS NOT NULL
    DROP TRIGGER dbo.TR_FACVEN_SIFEN_OUTBOX_ANULACION;
GO
CREATE TRIGGER dbo.TR_FACVEN_SIFEN_OUTBOX_ANULACION
ON dbo.FACVEN
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.FACTYBLE_SIFEN_OUTBOX (venta_id, tipo_evento, estado)
    SELECT
        d.FacVenId, 'ANULACION', 'PENDIENTE'
    FROM deleted d
    WHERE d.FacVenTipCmp = 13                         -- solo facturas confirmadas
      AND NOT EXISTS (                                -- idempotencia (venta_id, ANULACION)
          SELECT 1 FROM dbo.FACTYBLE_SIFEN_OUTBOX o
          WHERE o.venta_id = d.FacVenId AND o.tipo_evento = 'ANULACION'
      );
END;
GO
*/
============================================================================= */
