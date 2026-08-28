/* =============================================================================
   FACTYBLE_VENTAS_SIFEN_MIN  —  vista mínima (instalación desde cero)
   Compatible SQL Server 2008 R2 (10.50) y superiores.

   Subconjunto de columnas de FACTYBLE_VENTAS_SIFEN: hereda sus joins y sus
   derivaciones, así que NO hay lógica duplicada acá. Una fila por ÍTEM de venta.

   Es la única vista que consume el backend (src/services/procesarFacturaService.js).
   Existe para que el código dependa de un contrato de 16 columnas estable en vez
   de las ~50 de la vista base: agregar columnas a la base no rompe nada, y lo que
   el backend necesita queda explícito en un solo lugar.

   Requiere que FACTYBLE_VENTAS_SIFEN ya exista (correr 01 antes que este archivo).

   ⚠️ Si cambiás esta lista de columnas, revisá los SELECT de
   procesarFacturaService.js: son los que las consumen por nombre.
   ============================================================================= */
USE PVTA;   -- <<< IMPORTANTE: crear en PVTA, NO en master
GO

IF OBJECT_ID('dbo.FACTYBLE_VENTAS_SIFEN_MIN', 'V') IS NOT NULL
    DROP VIEW dbo.FACTYBLE_VENTAS_SIFEN_MIN;
GO

CREATE VIEW dbo.FACTYBLE_VENTAS_SIFEN_MIN
AS
SELECT
    venta_id,
    empresa,
    anulada,
    fecha,
    tipo_comprobante,
    condicion_venta,
    emisor_ruc,
    emisor_razon_social,
    cliente_ruc,
    cliente_nombre,
    item_nro,
    item_producto_id,
    item_descripcion,
    item_cantidad,
    item_precio_unitario,
    item_tasa_iva
FROM dbo.FACTYBLE_VENTAS_SIFEN;
GO
