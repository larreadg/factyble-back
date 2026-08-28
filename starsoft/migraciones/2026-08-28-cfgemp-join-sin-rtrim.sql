/* =============================================================================
   FACTYBLE_VENTAS_SIFEN — v2 — VERSIÓN COMPATIBLE SQL SERVER 2008 R2 (10.50)

   ÚNICO CAMBIO vs. vista-ventas-sifen-2008.sql: el join a CFGEMP pierde los
   RTRIM de ambos lados:

       ANTES:  LEFT JOIN dbo.CFGEMP e ON RTRIM(e.CfgEmpId) = RTRIM(h.FacVenEmp)
       AHORA:  LEFT JOIN dbo.CFGEMP e ON e.CfgEmpId = h.FacVenEmp

   POR QUÉ (medido, no teórico):
   - CfgEmpId y FacVenEmp son ambos char(8). En SQL Server la comparación `=`
     entre char/varchar IGNORA los espacios finales (regla ANSI de padding), así
     que el RTRIM no cambia ningún resultado: es semánticamente un no-op.
     Verificado en la copia local: el EXCEPT bidireccional entre la vista vieja
     y esta da 0 filas de diferencia sobre todo el dataset (323.379 filas-ítem).
   - Pero SÍ cambia el plan: RTRIM(col) es una expresión, no una columna, y el
     optimizador de 2008 R2 no puede hacer seek por ella. Con el RTRIM, CFGEMP
     solo admite SCAN por fila (el incidente documentado de 4,9M de lecturas en
     CFGEMP nació de este join) y — peor — FACVEN pierde el camino
     CFGEMP → seek por el índice de Starsoft UFACVENEMP (FacVenEmp, FacVenFec),
     que es exactamente el que necesita el filtro "ventas de la empresa X en el
     día Y" de la pantalla de caja. Sin RTRIM, ambos seeks quedan disponibles.

   El resto de la vista es idéntico (incluida la subconsulta correlacionada de
   total_items_calculado — ver el comentario de performance en el original).
   FACTYBLE_VENTAS_SIFEN_MIN no cambia: hereda este join por definición.

   DESPLIEGUE EN PRODUCCIÓN: la vista ya existe, por eso este archivo usa
   ALTER VIEW (no requiere re-otorgar permisos ni tocar la vista _MIN).
   ============================================================================= */
USE PVTA;   -- <<< IMPORTANTE: la vista vive en PVTA, NO en master
GO

ALTER VIEW dbo.FACTYBLE_VENTAS_SIFEN
AS
SELECT
    ------------------------------------------------------------------ Identidad
    h.FacVenId                                   AS venta_id,
    RTRIM(h.FacVenEmp)                            AS empresa,
    h.FacVenFec                                   AS fecha,
    h.FacVenAnl                                   AS anulada,          -- 0 = vigente

    ---------------------------------------------------------------- Comprobante
    RTRIM(h.FacVenNoFac)                          AS comprobante,      -- 001-002-0107669
    LEFT(RTRIM(h.FacVenNoFac), 3)                 AS establecimiento,  -- 001
    SUBSTRING(RTRIM(h.FacVenNoFac), 5, 3)         AS punto_expedicion, -- 002
    RIGHT(RTRIM(h.FacVenNoFac), 7)                AS numero_documento, -- 0107669
    h.FacVenTim                                   AS timbrado,
    h.FacVenTipCmp                                AS tipo_comprobante_cod,
    CASE h.FacVenTipCmp
         WHEN 13 THEN 'Factura'
         ELSE 'Otro (' + CAST(h.FacVenTipCmp AS varchar(10)) + ')'
    END                                           AS tipo_comprobante,
    h.FacVenCon                                   AS condicion_venta_cod,
    CASE h.FacVenCon
         WHEN 1 THEN 'Contado'
         WHEN 2 THEN 'Credito'
         ELSE 'Otro (' + CAST(h.FacVenCon AS varchar(10)) + ')'
    END                                           AS condicion_venta,
    h.FacVenCanCuo                                AS cantidad_cuotas,

    -------------------------------------------------------- SIFEN (hoy vacíos)
    NULLIF(RTRIM(h.FacVenCDC), '')                AS cdc,
    NULLIF(RTRIM(h.FacVenQR), '')                 AS qr,
    h.FacVenEstEnvDe                              AS estado_envio_de,
    h.FacVenProtocolo                             AS protocolo_sifen,
    h.FacVenFecApro                               AS fecha_aprobacion,

    ---------------------------------------------------------------- Emisor
    RTRIM(e.CfgRuc)                               AS emisor_ruc,
    RTRIM(e.CfgRaz)                               AS emisor_razon_social,
    RTRIM(e.CfgNomFanEmi)                         AS emisor_nombre_fantasia,
    RTRIM(e.CfgDir)                               AS emisor_direccion,

    ---------------------------------------------------------------- Cliente
    h.CliId                                       AS cliente_id,
    RTRIM(h.CliEmp)                               AS cliente_empresa,
    RTRIM(c.CliRuc)                               AS cliente_ruc,        -- crudo, con DV
    RTRIM(c.CliNom)                               AS cliente_nombre,
    RTRIM(c.CliDir)                               AS cliente_direccion,
    RTRIM(c.CliMail)                              AS cliente_email,
    RTRIM(c.CliTel)                               AS cliente_telefono,

    -------------------------------------------------- Totales de la cabecera
    RTRIM(h.FacVenMon)                            AS moneda,             -- '' = PYG
    h.FacVenTotExe                                AS total_exenta,
    h.FAcVenTotG10                                AS total_gravado_10,
    h.FacVenTotG05                                AS total_gravado_05,
    h.FacVenLiqIva10                              AS iva_10,
    h.FacVenLiqIva05                              AS iva_05,
    h.FacVenDesML                                 AS descuento_total,
    h.FacVenTotImp                                AS total_comprobante,
    -- Total robusto (suma del detalle), como verificación del total de cabecera.
    -- ⚠️ Subconsulta correlacionada (NO window function): en SQL 2008 R2 el
    --    optimizador NO empuja el filtro por venta_id debajo de un
    --    SUM() OVER (PARTITION BY ...), y termina armando el join completo
    --    antes de filtrar (verificado: 86s / 4,9M lecturas en CFGEMP). La
    --    subconsulta hace SEEK por FacVenId -> misma consulta en ~114ms.
    (SELECT SUM(d2.FacVenTotLinExe + d2.FacVenTotLinG05 + d2.FacVenTotLinG10)
       FROM dbo.FACVENLEVEL1 d2
      WHERE d2.FacVenId = h.FacVenId)             AS total_items_calculado,
    h.FacVenTotEfe                                AS pago_efectivo,
    h.FacVenTotChe                                AS pago_cheque,
    h.FacVenTotTar                                AS pago_tarjeta,

    ----------------------------------------------------------------- Ítem
    d.FacVenIte                                   AS item_nro,
    RTRIM(d.ProId)                                AS item_producto_id,
    RTRIM(d.ProEmp)                               AS item_producto_empresa,
    RTRIM(d.FacVenDesc)                           AS item_descripcion,
    d.FacVenCan                                   AS item_cantidad,
    d.FacVenPreVen                                AS item_precio_unitario,
    CASE WHEN d.FacVenTotLinG10 > 0 THEN 10
         WHEN d.FacVenTotLinG05 > 0 THEN 5
         WHEN d.FacVenTotLinExe > 0 THEN 0
         ELSE NULL
    END                                           AS item_tasa_iva,       -- derivada (no usar FacVenTipImpVen)
    d.FacVenTotLinExe                             AS item_total_exenta,
    d.FacVenTotLinG05                             AS item_total_gravado_05,
    d.FacVenTotLinG10                             AS item_total_gravado_10,
    d.FacVenIva10Det                              AS item_iva_10,
    d.FacVenIva05Det                              AS item_iva_05,
    (d.FacVenTotLinExe + d.FacVenTotLinG05 + d.FacVenTotLinG10) AS item_total
FROM            dbo.FACVEN        h
INNER JOIN      dbo.FACVENLEVEL1  d ON d.FacVenId = h.FacVenId
INNER JOIN      dbo.CLIENTE       c ON c.CliId = h.CliId
                                   AND c.CliEmp = h.CliEmp          -- <-- clave compuesta (obligatoria)
LEFT  JOIN      dbo.CFGEMP        e ON e.CfgEmpId = h.FacVenEmp     -- <-- SIN RTRIM (ver cabecera)
WHERE           h.FacVenTipCmp = 13;                               -- Solo Facturas
GO
