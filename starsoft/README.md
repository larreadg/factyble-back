# Starsoft / PVTA — objetos SQL de la integración

Todo lo que este backend instala **dentro de la base MSSQL del PDV Starsoft** (`PVTA`) para
poder facturar electrónicamente sus ventas. Los objetos que creamos nosotros llevan el
prefijo `FACTYBLE_` / `TR_FACVEN_SIFEN_`; el resto de esa base es de Starsoft y **no se toca**.

Consumidor de todo esto: `src/services/procesarFacturaService.js` (vía `src/db/dbPvta.js`).

## Restricción que atraviesa todo: SQL Server 2008 R2

Producción corre **SQL Server 2008 R2 Express** (instancia nombrada `SQLEXPRESS`). Ningún
archivo de esta carpeta puede usar sintaxis posterior a 2008: nada de `CONCAT`, `IIF`,
`OFFSET/FETCH`, `TRY_CONVERT`, `STRING_AGG`. El equipo de desarrollo corre 2022, así que
el motor local **no te va a avisar** si introducís algo incompatible.

Dos reglas de performance descubiertas contra esa versión, ambas documentadas en línea en
los archivos que las aplican. Las dos nacieron de incidentes reales, no de teoría:

- **Nada de `... OVER (PARTITION BY)` en vistas que después se filtran por clave.** El
  optimizador de 2008 R2 no empuja el predicado por debajo de la window function: arma el
  join completo y filtra al final. Costaba 86 s y 4,9M de lecturas en `CFGEMP`; con
  subconsulta correlacionada, 114 ms.
- **Nada de `RTRIM()` (ni ninguna función) sobre columnas que participan de un join o de un
  `WHERE`.** `RTRIM(col)` es una expresión, no una columna: mata el seek. Entre `char` y
  `char`, `=` ya ignora los espacios finales, así que el `RTRIM` no aportaba nada.

## Instalación desde cero

Correr en orden, contra la base `PVTA` (no `master`):

| # | Archivo | Objeto |
|---|---|---|
| 01 | `instalacion/01-vista-ventas-sifen.sql` | `FACTYBLE_VENTAS_SIFEN` — vista base, 1 fila por ítem |
| 02 | `instalacion/02-vista-ventas-sifen-min.sql` | `FACTYBLE_VENTAS_SIFEN_MIN` — 16 columnas, lo único que lee el backend |
| 03 | `instalacion/03-tabla-outbox.sql` | `FACTYBLE_SIFEN_OUTBOX` — cola de eventos |
| 04 | `instalacion/04-trigger-outbox-alta.sql` | `TR_FACVEN_SIFEN_OUTBOX_ALTA` — encola el evento `ALTA` |

El 05 **no se despliega**: `05-trigger-outbox-anulacion.PLANTILLA-NO-DESPLEGAR.sql` es una
plantilla con dos casos alternativos. Falta confirmar con el proveedor cómo registra PVTA una
anulación (¿UPDATE de un flag, o DELETE de la cabecera?) antes de elegir uno. En producción
hoy hay **un solo trigger** nuestro, el de ALTA.

Los archivos 01 y 02 usan `DROP` + `CREATE`, o sea que son para instalar desde cero. Sobre
una instalación que ya existe usá `migraciones/`, que van con `ALTER VIEW` y no obligan a
re-otorgar permisos.

## Migraciones

Cambios sobre una instalación existente, en orden cronológico:

| Fecha | Archivo | Qué hace |
|---|---|---|
| 2026-08-28 | `migraciones/2026-08-28-cfgemp-join-sin-rtrim.sql` | Saca los `RTRIM` del join a `CFGEMP`. No-op semántico (verificado con `EXCEPT` bidireccional: 0 diferencias sobre 323.379 filas-ítem), pero habilita el seek por la PK `CfgEmpId` y el camino al índice de Starsoft `UFACVENEMP (FacVenEmp, FacVenFec)`. Ya está incorporado en `instalacion/01`. |

## Utilidades

- `utilidades/diagnostico-pendientes.sql` — por qué `GET /procesar-factura/pendientes` devuelve
  0 para un día que "tiene registros". Va agregando los cinco filtros del endpoint de a uno;
  el primer escalón que cae a cero es el culpable. Solo lecturas.
- `utilidades/poblar-outbox-local.sql` — **🚫 SOLO EN DESARROLLO, NUNCA EN PRODUCCIÓN.**
  Siembra la cola con ventas históricas para poder probar. En producción la cola la alimenta
  el trigger; un backfill masivo dispararía la emisión a SIFEN de facturas viejas, que además
  vuelven rechazadas por estar fuera de la ventana de transmisión.

## Por qué la cola es un log de eventos y no una bandera

`FACTYBLE_SIFEN_OUTBOX` es **append-only**: cada transición del ciclo de vida de un
comprobante es una fila nueva (`ALTA` → eventualmente `ANULACION`), no un `UPDATE` sobre una
fila única.

El motivo es concreto: El Halcón corrige errores anulando la factura y emitiendo otra. Una
bandera mutable idempotente por `venta_id` no puede expresar "esta venta, ya PROCESADA, ahora
hay que cancelarla" — la fila única y la idempotencia lo impiden justamente.

Tres propiedades que hay que preservar si alguien toca esto:

- **Sin columna `IDENTITY`.** El trigger corre dentro de la transacción del `INSERT`/`UPDATE`
  de `FACVEN`; una `IDENTITY` contaminaría `@@IDENTITY` y la app de Starsoft podría leer el id
  equivocado después de insertar una venta. La PK es `UNIQUEIDENTIFIER DEFAULT NEWID()`
  porque `NEWID()` no toca `@@IDENTITY`.
- **Índice único sobre `(venta_id, tipo_evento)`**, y el trigger lo respeta con `NOT EXISTS`.
- **El trigger es `AFTER INSERT, UPDATE`**, no solo INSERT: Starsoft crea la venta como
  borrador con `TipCmp = 0` y recién después la actualiza a 13. Un trigger de solo INSERT
  nunca la vería.

Consecuencia operativa que no es obvia: **la fila `PROCESADO` es la memoria de "esta venta ya
se facturó"**. Si se borra y Starsoft actualiza esa cabecera por cualquier motivo (cobrar una
cuota, un ajuste), el `NOT EXISTS` del trigger ya no encuentra nada y reencola un `ALTA` →
segunda emisión de una factura que ya existe. Al limpiar la cola, borrar `PENDIENTE` y
`PROCESANDO`; nunca `PROCESADO`.

## Conexión

`src/db/dbPvta.js` arma la connection string. Requiere **Windows Authentication (Trusted
Connection)**: usa la identidad de la sesión Windows que corre el proceso Node, sin
usuario/clave. Por eso esto sólo funciona on-prem/Windows, **nunca en Docker/Linux**.

Variables (`.env`). Todas tienen default en el código; en producción solo hacen falta las que
se apartan de él:

| Variable | Default | ¿Hace falta en prod? |
|---|---|---|
| `PVTA_DB_SERVER` | `localhost` | No |
| `PVTA_DB_DATABASE` | `PVTA` | No |
| `PVTA_DB_INSTANCE` | *(vacío = instancia default)* | **Sí** — `SQLEXPRESS` |
| `PVTA_DB_ODBC_DRIVER` | `ODBC Driver 17 for SQL Server` | **Sí** — ese driver no está instalado en la máquina productiva |
| `PVTA_DB_TRUST_SERVER_CERT` | `no` | Sólo con ODBC Driver 18, que cambió el default de `Encrypt` a `yes` |
| `PVTA_INNOMINADO_BATCH` | `10` | No |

Sobre el driver en producción: hay `SQL Server Native Client 10.0` y el `SQL Server` legacy.
Usar el **Native Client 10.0**. El `SQL Server` pelado es el driver MDAC que viene con Windows
desde hace veinte años y no entiende `varchar(max)`, `nvarchar(max)` ni `datetime2` — contra
estas vistas puede truncar campos o fallar de forma confusa en vez de dar un error claro.

## Modelo de datos

`PVTA-modelo-datos.md` documenta la ingeniería inversa de la base de Starsoft: convención de
nomenclatura de columnas, diagrama de relaciones, las tablas del flujo de venta y el mapeo a
los campos que pide SIFEN.

El hallazgo que más veces muerde: **`CliId` no es único**. El cliente se une por la clave
compuesta `(CliId, CliEmp)` — PVTA es multiempresa. Unir solo por `CliId` duplica filas y
mezcla clientes de empresas distintas.
