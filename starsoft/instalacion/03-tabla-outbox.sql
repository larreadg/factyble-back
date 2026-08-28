/* =============================================================================
   FACTYBLE_SIFEN_OUTBOX  —  VERSIÓN COMPATIBLE SQL SERVER 2008 R2 (10.50)
   Cola de EVENTOS (append-only) para facturación electrónica (SIFEN).

   ── POR QUÉ APPEND-ONLY (y no una bandera mutable) ──────────────────────────
   El Halcón corrige errores ANULANDO la factura y emitiendo otra. Eso exige que
   la cola pueda expresar el CICLO DE VIDA de un comprobante:
       ALTA (emitir) -> eventualmente ANULACION (cancelar en SIFEN).
   Una bandera mutable (una fila por venta, estado PENDIENTE->PROCESADO,
   idempotente por venta_id) NO puede representar "esta venta, ya PROCESADA,
   ahora hay que cancelarla": la fila única y la idempotencia por venta_id
   justamente lo impiden. Por eso la cola es un LOG DE EVENTOS: cada transición
   es una fila nueva; el worker las procesa en orden.

   ⚠️ SIN COLUMNA IDENTITY (a propósito, igual criterio de siempre): el trigger
   que alimenta esta tabla corre dentro de la transacción del INSERT/UPDATE de
   FACVEN. Una IDENTITY contaminaría @@IDENTITY y la app de PVTA podría leer el
   id equivocado tras insertar la venta. PK = UNIQUEIDENTIFIER con DEFAULT
   NEWID() (NEWID no toca @@IDENTITY).

   La tabla es SOLO un semáforo de eventos: NO guarda datos de la venta ni lógica
   de control. El proceso externo toma el venta_id de las filas PENDIENTE, obtiene
   TODO desde la vista FACTYBLE_VENTAS_SIFEN_MIN, actúa según tipo_evento, y marca
   PROCESADO.

   tipo_evento: 'ALTA'      -> emitir la factura electrónica.
                'ANULACION' -> cancelar en SIFEN el comprobante ya emitido
                               (la app decide el instrumento: evento de
                               cancelación <=48h, o Nota de Crédito fuera de plazo).
   estado:      'PENDIENTE' -> 'PROCESADO'  (única transición; solo bandera)

   Idempotencia: a lo sumo UN evento por (venta_id, tipo_evento). Un re-emitido
   es una factura NUEVA (otro FacVenId), así que un mismo venta_id tiene como
   mucho un ALTA y un ANULACION. El índice único lo garantiza a nivel de BD y el
   trigger lo respeta con NOT EXISTS.
   ============================================================================= */
USE PVTA;   -- <<< IMPORTANTE: crear en PVTA, NO en master
GO

IF OBJECT_ID('dbo.FACTYBLE_SIFEN_OUTBOX', 'U') IS NOT NULL
    DROP TABLE dbo.FACTYBLE_SIFEN_OUTBOX;
GO

CREATE TABLE dbo.FACTYBLE_SIFEN_OUTBOX (
    evento_id     UNIQUEIDENTIFIER NOT NULL
                      CONSTRAINT DF_FACTYBLE_SIFEN_OUTBOX_id     DEFAULT (NEWID()),
    venta_id      DECIMAL(15,0)    NOT NULL,                 -- FACVEN.FacVenId (global, único)
    tipo_evento   VARCHAR(10)      NOT NULL,                 -- 'ALTA' | 'ANULACION'
    estado        VARCHAR(10)      NOT NULL
                      CONSTRAINT DF_FACTYBLE_SIFEN_OUTBOX_estado DEFAULT ('PENDIENTE'),
    fecha         DATETIME         NOT NULL
                      CONSTRAINT DF_FACTYBLE_SIFEN_OUTBOX_fecha  DEFAULT (GETDATE()),
    CONSTRAINT PK_FACTYBLE_SIFEN_OUTBOX PRIMARY KEY NONCLUSTERED (evento_id)
);
GO

-- Orden natural de la cola = orden de llegada de los eventos.
CREATE CLUSTERED INDEX IX_FACTYBLE_SIFEN_OUTBOX_fecha
    ON dbo.FACTYBLE_SIFEN_OUTBOX (fecha);
GO

-- Idempotencia dura: a lo sumo un evento por (venta_id, tipo_evento).
-- Además sirve de índice de apoyo al NOT EXISTS del trigger.
CREATE UNIQUE INDEX UX_FACTYBLE_SIFEN_OUTBOX_venta_evento
    ON dbo.FACTYBLE_SIFEN_OUTBOX (venta_id, tipo_evento);
GO

-- El worker levanta lo pendiente por orden de llegada.
CREATE INDEX IX_FACTYBLE_SIFEN_OUTBOX_pendiente
    ON dbo.FACTYBLE_SIFEN_OUTBOX (estado, fecha)
    INCLUDE (venta_id, tipo_evento);
GO
