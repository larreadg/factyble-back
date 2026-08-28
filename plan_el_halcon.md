# Plan — Integración El Halcón (Starsoft/PVTA → Factyble)

> Estado: **implementado** (backend + frontend) — falta la prueba on-prem
> Fecha: 2026-08-25

## 1. Contexto del despliegue

| Pieza | Dónde vive |
|---|---|
| Backend (`factyble-back`) + Frontend (`D:\proyectos\factyble\factyble-front`) | Computadora **A** ("servidor" de la ferretería) |
| Base MSSQL de Starsoft (`PVTA`) | Computadora **A** |
| Caja / PDV — navegador con el frontend | Computadora **B** |

`src/db/dbPvta.js` conecta a MSSQL con **Trusted Connection** (identidad Windows del proceso Node,
sin usuario/clave), vía `msnodesqlv8` + `ODBC Driver 17 for SQL Server`. Sólo funciona on-prem
Windows — no en Docker/Linux. Como la BD está en la misma máquina A que el backend, esto no
requiere ningún cambio.

## 2. Flujo objetivo

```
Cajera concreta la venta en Starsoft
        ↓
Aparece en la vista dbo.FACTYBLE_VENTAS_SIFEN_MIN
 + fila ALTA/PENDIENTE en dbo.FACTYBLE_SIFEN_OUTBOX
        ↓
Frontend (computadora B) lista las ventas NOMINADAS pendientes
        ↓
Cajera hace clic en "Generar factura"
        ↓
Backend emite → firma → QR → PDF (todo síncrono)
        ↓
Frontend abre el PDF e imprime para el cliente
```

## 3. Decisiones tomadas

### 3.1 Sin cron para el listado — pull on-demand

Se descartó un cron cada 5s. Razones:

- `FACTYBLE_SIFEN_OUTBOX` + la vista **ya son la cola**. Copiar ese estado a MySQL sería
  duplicarlo sin ganancia.
- Un cron **empeora** la latencia: cron cada 5s + polling del front cada 5s = hasta 10s de
  peor caso. Consultando directo es ~0 + red.
- Un cron consulta MSSQL ~17.280 veces/día aunque la caja esté cerrada.

**El frontend hace polling cada 3s** contra un endpoint que consulta la vista en vivo.

Se descartó también SSE/WebSocket: el backend igual tendría que pollear MSSQL (Starsoft no
notifica), así que SSE sólo pagaría con varias cajas mirando la misma lista. Con **una sola caja**
es complejidad sin beneficio.

### 3.2 Alcance: sólo ventas NOMINADAS

El frontend lista **únicamente** ventas con cliente identificado (`cliente_ruc <> 'x'`), porque
son las que requieren impresión para el cliente.

### 3.3 El cron de innominadas NO se toca

`cronJobsPvta.js` sigue exactamente como está: cada 5 min emite las ventas de cliente sin nombre
(`cliente_ruc = 'x'`) como INNOMINADAS. No hay competencia con el flujo manual porque los
conjuntos son **disjuntos** (nominadas vs. innominadas).

### 3.4 Sin override de datos del cliente

Los datos del receptor se manejan en Starsoft. Factyble sólo factura lo que la vista expone.
No se agrega edición de RUC/nombre en el momento de facturar.

### 3.5 Aislamiento multiempresa: se filtra por `emisor_ruc`

PVTA es multiempresa (`FACVEN.FacVenEmp` → `CFGEMP.CfgRuc`, expuesto como `emisor_ruc` en la vista —
ver `vista-ventas-sifen-2008.sql:56` y `:114`). **Los dos endpoints acotan al RUC de la empresa del
usuario autenticado**, con el RUC bindeado como parámetro:

```sql
AND RTRIM(v.emisor_ruc) = @emisorRuc
```

Sin ese filtro, un usuario vería ventas de otra empresa del sistema y — peor — podría emitirlas
**bajo su propio timbrado**, porque el emisor sale del JWT y no de la venta. En el `POST` el riesgo era
mayor que en el `GET`: el `venta_id` llega por la URL, no de la sesión.

El RUC se resuelve **desde la BD** por `empresaId` (`obtenerRucEmpresa`), no del claim `empresaRuc` del
JWT: el token es de larga duración y quedaría desactualizado si se corrige el RUC de la empresa. Es un
lookup por clave primaria, barato aun con el polling cada 3s.

Casos borde: usuario sin `empresaId` → **403**; empresa sin RUC cargado → **409**.

Nota: el `RTRIM` es necesario — `CfgRuc` es `CHAR` con padding. Y como `CFGEMP` entra por `LEFT JOIN`,
una venta cuya empresa no exista en `CFGEMP` trae `emisor_ruc` en `NULL` y queda naturalmente excluida.

### 3.6 La impresión no espera a SIFEN

Verificado en el código: la **firma y el QR son síncronos**
(`facturaService.js:454` → `loteService.firmarDocumentoRecienCreado` dentro de la misma
transacción), y el **PDF también** (`facturaService.js:493`, con `await`, devolviendo
`pdfNombre: "<uuid>.pdf"` en `facturaService.js:531`).

Sólo el **envío** a SIFEN es asíncrono por lote. Por lo tanto, cuando el `POST` responde el KUDE
ya existe completo, con CDC y QR, servido en `/public/<uuid>.pdf` (`index.js:24`).
La cajera imprime al instante — que es lo correcto: el KUDE es entregable desde que está firmado.

## 4. Qué se implementa

### 4.1 `GET /procesar-factura/pendientes[?fecha=yyyy-mm-dd]`

Lista las ventas **nominadas** de un día, **de la empresa del usuario**, con evento `ALTA` en estado
`PENDIENTE`. Sin `fecha` se lista el día en curso.

Implementación: nueva función `obtenerVentasNominadasPendientes` en `procesarFacturaService.js`,
clonada de `obtenerVentasInnominadasPendientes` con cuatro cambios:

1. `RTRIM(v.cliente_ruc) <> @sinNombre` (en vez de `=`)
2. Sin `TOP` — se listan todas
3. Filtro `CAST(v.fecha AS DATE) = @fecha` (día parametrizado, ver abajo)
4. Filtro `RTRIM(v.emisor_ruc) = @emisorRuc` (aislamiento multiempresa, ver 3.5)

**La fecha se bindea, no se usa `GETDATE()`.** El corte a medianoche dejaba sin salida a una venta
cerrada 23:58 y no facturada: desaparecía del listado al día siguiente y no había forma de llegar a
ella desde la pantalla de caja. Con el parámetro se puede mirar cualquier día anterior.

El default sale de `fechaHoyISO()`, que usa los getters **locales** del proceso Node, no UTC: importa el
día calendario de la ferretería, y con UTC el "hoy" saltaría al día siguiente pasadas las 21:00 de
Paraguay. Backend y SQL Server corren en la misma máquina (A), así que no hay desfase entre ambos relojes.

El formato del query param es **ISO** (`yyyy-mm-dd`) y no el `dd/mm/yyyy` del `POST /` heredado: en un
query param conviene el orden inequívoco (dd/mm vs mm/dd), y es lo que produce nativamente un
`<input type='date'>`. El `POST /` legacy queda como está.

Se conservan los filtros existentes: `anulada = 0` y el `EXISTS` contra el outbox en `PENDIENTE`.

Las filas-ítem se agrupan con `agruparPorVenta` y se devuelve por venta: `venta_id`, `cliente_ruc`,
`cliente_nombre`, `condicion_venta`, `items[]` y el `total` calculado.

**No se devuelve fecha por fila.** La vista mapea `h.FacVenFec` directo (`vista-ventas-sifen-2008.sql:26`)
y Starsoft guarda esa columna a medianoche (`2026-08-12 00:00:00.000`), así que el horario de la venta no
existe en el origen: mostrarlo era imprimir `00:00` en cada fila. La fecha viaja una sola vez, a nivel de
respuesta, y la tabla entera corresponde a ese día.

Auth: `authJwt(['ADMIN'])` — mismo rol que el `POST /` existente.

### 4.2 `POST /procesar-factura/venta/:ventaId`

Emite **una** venta puntual y devuelve lo necesario para imprimir.

La búsqueda se acota al `emisor_ruc` de la empresa del usuario (ver 3.5), así la venta que se emite y el
timbrado con el que se emite pertenecen siempre a la misma empresa.

Reutiliza sin cambios:
- `construirPayload` (`:121`) — el payload **nominado**
- `emitirVentaConCandado` (`:209`) — candado `PENDIENTE → PROCESANDO → PROCESADO`

El emisor es `req.usuario` (la empresa del JWT de la cajera), igual que el `procesarFactura`
existente. No se usa `resolverEmisorPorRuc` (eso es sólo del cron multiempresa).

El candado ya cubre el doble clic: el segundo request devuelve `YA_PROCESADA`.

Respuesta esperada:
```json
{ "venta_id": 12345, "resultado": "PROCESADA", "factura_id": 987,
  "cdc": "01800695631001001...", "numero_factura": "001-001-0000123",
  "pdf_nombre": "a1b2c3d4-....pdf" }
```

### 4.3 Fix: `emitirVentaConCandado` descarta el `pdfNombre`

**Este es el único cambio real sobre código existente.**

Hoy (`procesarFacturaService.js:222-228`) devuelve sólo `factura_id`, `cdc` y `numero_factura`.
`emitirFacturaSimple` **sí** trae el `pdfNombre` (propaga el retorno completo de `emitirFactura`),
pero se pierde acá. Sin ese campo el frontend no sabe qué archivo imprimir.

Se agrega `pdf_nombre: factura && factura.pdfNombre`. No afecta al cron de innominadas, que
ignora ese campo.

## 5. Notas y riesgos conocidos

**`/public` no tiene autenticación.** `express.static` está montado sin middleware
(`index.js:24`), así que cualquiera en la LAN con el nombre del archivo puede bajar el PDF.
Los nombres son UUID (no adivinables) y es una red de ferretería → aceptable en la práctica.
Si se quiere cerrar: endpoint autenticado con `res.sendFile` en vez del static.

**Polling en background.** El frontend debería chequear `document.visibilityState` antes de cada
tick, para no martillar MSSQL toda la noche si dejan el navegador abierto.

**Estado SIFEN en la UI.** La factura queda `FIRMADO` y pasa a `APROBADO` recién cuando el cron de
lotes la envía. Conviene que la lista muestre el `estado_sifen` para que la cajera no interprete
"todavía no aprobada" como un fallo.

**`id_externo` no es único en factyble** — no sirve para deduplicar. El candado del outbox es la
única garantía de unicidad (PVTA/MSSQL y factyble/MySQL son dos bases sin transacción compartida).

## 6. Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/services/procesarFacturaService.js` | + `obtenerRucEmpresa`, `obtenerVentasNominadasPendientes`, `obtenerFilasVentaPorId`, `listarVentasPendientes`, `emitirVentaPorId`; fix `pdf_nombre` en `emitirVentaConCandado`; + `fecha` en `agruparPorVenta` |
| `src/controllers/procesarFacturaController.js` | + `listarPendientes`, + `emitirVenta` |
| `src/routes/procesarFacturaRoute.js` | + `GET /pendientes`, + `POST /venta/:ventaId` |

Sin cambios en: `cronJobsPvta.js`, `dbPvta.js`, `facturaService.js`, `facturaSimpleService.js`,
schema de Prisma (no hay migración — no se persiste nada nuevo).

## 7. Contrato de la API (para el frontend)

### `GET /procesar-factura/pendientes`

Header `Authorization: Bearer <jwt>`, rol `ADMIN`. Sin parámetros — la fecha es siempre el día en curso
y la empresa sale del JWT — el front no puede elegir el emisor.

Parámetro opcional `fecha=yyyy-mm-dd`. Omitido: día en curso según el reloj del servidor
(computadora A). Formato inválido o fecha inexistente (`2026-02-31`): **400**.

```json
{
  "status": "success", "code": 200, "message": "Ventas pendientes",
  "data": {
    "fecha": "2026-08-25",
    "emisor_ruc": "80012345-6",
    "ventas_pendientes": 2,
    "ventas": [
      {
        "venta_id": 5001,
        "cliente_ruc": "2341952-0",
        "cliente_nombre": "Juan Perez",
        "condicion_venta": "Contado",
        "items": [{ "cantidad": 2.5, "precioUnitario": 3333, "descripcion": "Tornillo", "tasa": "10%" }],
        "total": 8333,
        "emitible": true,
        "error": null
      }
    ]
  }
}
```

`emitible: false` + `error` con el motivo cuando la venta no se puede mapear (tasa de IVA no derivable,
condición de venta desconocida). **La UI debe deshabilitar el botón en ese caso** y mostrar el `error`.
En esas ventas `items` viene vacío y `total` es `0`.

El `total` usa el mismo redondeo guaraní-entero que la emisión (`calcularTotalItem`), así que coincide
con lo que sale impreso en el KUDE.

### `POST /procesar-factura/venta/:ventaId`

Header `Authorization: Bearer <jwt>`, rol `ADMIN`. `ventaId` entero positivo.

**200 — emitida** (único caso con KUDE para imprimir):
```json
{ "status": "success", "code": 200, "message": "Factura generada",
  "data": { "venta_id": 5001, "resultado": "PROCESADA", "factura_id": 987,
            "cdc": "018006956310010010000000120260825...", "numero_factura": "001-001-0000123",
            "pdf_nombre": "a1b2c3d4-e5f6-....pdf" } }
```

El front imprime abriendo `/public/{pdf_nombre}` en el mismo host del backend.

| Status | `data.resultado` | Significado |
|---|---|---|
| 200 | `PROCESADA` | Emitida; hay `pdf_nombre` para imprimir |
| 409 | `YA_PROCESADA` | Doble clic u otra caja ganó el candado del outbox. No reintentar |
| 409 | `OMITIDA` | La venta no tiene evento `ALTA` en el outbox |
| 502 | `ERROR` | Falló la emisión. El candado volvió a `PENDIENTE` — **sí se puede reintentar** |
| 404 | — | La venta no existe, está anulada, o es de cliente sin nombre |
| 422 | — | La venta existe pero no es mapeable (mismo motivo que `emitible: false`) |
| 400 | — | `ventaId` inválido |
| 403 | — | El usuario no tiene empresa asociada |
| 409 | — | La empresa del usuario no tiene RUC configurado |

Los 403 y 409 aplican también al `GET`. El 404 del `POST` cubre también **"la venta es de otra
empresa"** — deliberadamente no se distingue de "no existe", para no filtrar la existencia de ventas
ajenas.

## 8. Verificación realizada

Siguiendo el criterio del repo (no hay suite de tests): scripts descartables con las dependencias
pesadas (Prisma, MSSQL, JasperReports/`java`, Telegram) stubbeadas vía `require.cache`, ya eliminados.

- **31 checks en verde** sobre: agrupación con `fecha`, listado (conteo por venta y no por ítem, total
  con redondeo guaraní-entero `2.5 × 3333 = 8332.5 → 8333`, `emitible` en falso con el motivo),
  emisión feliz (payload **nominado**, `situacionTributaria` derivada del DV, `idExterno`, marca
  `PROCESADO` en el outbox, `pdf_nombre` propagado), y los errores 404 / 422.
- **19 checks de aislamiento multiempresa**, con el pool falso simulando el filtro de `emisor_ruc`:
  cada empresa ve sólo sus ventas; las innominadas no aparecen (son del cron); el RUC sale de la BD y un
  claim `empresaRuc` manipulado en el token **no** da acceso a otra empresa; `emisorRuc` va bindeado y no
  interpolado; el `POST` de una venta ajena da 404 **sin emitir nada**; 403 sin empresa y 409 sin RUC.
- **Forma del SQL**: filtro de nominadas, de fecha de hoy, de `anulada = 0`, `EXISTS` sobre outbox
  `PENDIENTE`, ausencia de `TOP`, y parámetros bindeados (nunca interpolados).
- **Regresión del cron** (dos veces, tras cada tanda de cambios): `procesarInnominadosPendientes` sigue
  emitiendo como INNOMINADA, sin datos de receptor, y su query **no** lleva el filtro de `emisor_ruc` —
  sigue siendo multiempresa, resolviendo el emisor fila por fila. Los dos campos agregados a código
  compartido (`fecha`, `pdf_nombre`) son aditivos y el cron los ignora.
- `node --check` sobre los tres archivos.

**No verificado** (requiere el entorno on-prem): la conexión real a MSSQL y la ejecución de las queries
contra la vista. `require()` del service cuelga en este entorno por el bridge `java` de JasperReports —
es la limitación de entorno ya documentada en CLAUDE.md, no una regresión.

## 9. Frontend (`D:\proyectos\factyble\factyble-front`)

Stack existente: React 18 + Vite + NextUI + Tailwind, Poppins, primario `#00c4ff`. Se respetaron las
convenciones del repo (`axiosInstance`, `CustomBreadcrumbs`, `formatGs`, `toastStyle`, páginas en
`src/pages/<Nombre>/`).

### Archivos

| Archivo | Qué es |
|---|---|
| `src/pages/Ventas/useVentasPendientes.js` | Hook de polling (3s), por día |
| `src/pages/Ventas/VentasFiltroFecha.jsx` | Selector de día + atajo "Hoy" |
| `src/pages/Ventas/Ventas.jsx` | Página: cabecera, estados, emisión + impresión |
| `src/pages/Ventas/VentasTabla.jsx` | Tabla de la cola |
| `src/pages/Ventas/VentasPulso.jsx` | Indicador "actualizado hace N s" |
| `src/pages/Dashboard/DashboardVentas.jsx` | Card de inicio con el contador |
| `src/icons/StoreIcon.jsx` | Ícono (mismo estilo que los existentes) |
| `src/routes/AppRoutes.jsx` | Ruta `/ventas` (lazy) |
| `src/utils/utils.js` | Ítem "Ventas" en el sidebar |
| `src/pages/Dashboard/Dashboard.jsx` | Monta la card arriba de los accesos directos |
| `src/index.css` | Animaciones `venta-nueva` / `venta-pulso` + `prefers-reduced-motion` |

### Decisiones de UI

**La card del dashboard no es una cuarta card igual.** Los accesos directos son una grilla de 3 cards
idénticas; sumar una cuarta habría reforzado ese patrón. Ventas va como banda **full-width arriba** de
la grilla, porque no es un acceso más: es la cola viva y con estado (cuántas esperan). El borde y el
botón pasan a sólido sólo cuando hay pendientes — color por estado, no por decoración.

El dashboard **no** hace polling: consulta al montar y al volver a la pestaña. El polling continuo vive
en `/ventas`, que es donde la cajera opera. Si Starsoft está caído, el contador se omite y la card sigue
navegable, en vez de romper el dashboard entero.

**Polling con tres cuidados** (`useVentasPendientes`):
1. Sólo con la pestaña visible (`visibilityState`); al volver al tab refresca de inmediato.
2. Nunca dos requests en vuelo — con red lenta los ticks se saltean en vez de apilarse.
3. Se pausa mientras se emite, para que la fila no desaparezca bajo el cursor.

**Selector de día**: por defecto hoy, con `max` en hoy (no hay ventas en el futuro) y un botón "Hoy"
que aparece sólo cuando se está mirando otro día. Al cambiar de fecha se vuelve al skeleton y se vacía
la cola: mostrar la del día anterior mientras carga haría creer que esas ventas son del día elegido.
Los días pasados también se pollean, porque otra caja puede estar facturando la misma cola. El copy de
la descripción y del estado vacío cambia según si el día es hoy o uno anterior.

El resalte de fila nueva no se dispara al cambiar de día: la referencia de "ya vistas" guarda también
la fecha, y la primera respuesta de un día distinto sólo se toma como base.

**Estados cubiertos**: carga inicial (skeleton, no spinner), vacío (enseña que las ventas aparecen solas
y que las innominadas se facturan automáticamente), error (banner + se conserva la última cola conocida
avisando que puede estar desactualizada), fila emitiendo, fila no emitible (botón deshabilitado +
tooltip con el `error` que manda el back), y resto de filas bloqueadas mientras hay una emisión en curso.

**Impresión**: al emitir se abre `${apiUrl}/public/{pdf_nombre}` en pestaña nueva. Si el navegador la
bloquea (pasa cuando el POST tarda y se pierde el gesto del clic), **no** se muestra un error: la factura
ya está emitida, así que el toast ofrece el link para abrirla a mano.

**Manejo de respuestas**: 409/404 sacan la fila y avisan sin drama (otra caja ganó el candado, o la venta
se anuló). 502 deja la fila donde está — el back ya devolvió el candado a `PENDIENTE`, así que reintentar
es válido.

**Motion**: sólo dos animaciones, ambas de estado. La fila nueva destella (la cajera no mira la pantalla
fijo) y el punto late mientras el polling está activo. Las dos tienen alternativa en
`prefers-reduced-motion`: fondo fijo en vez de destello, punto sólido sin pulso.

### Verificación del filtro de fecha (backend)

15 checks en verde: `fechaHoyISO` usa getters locales y devuelve `yyyy-mm-dd`; sin parámetro se bindea
hoy y la respuesta expone la fecha consultada; con fecha explícita se bindea esa y **no se interpola**
en el SQL; ya no aparece `GETDATE()`; los demás filtros (emisor, nominadas, outbox, sin `TOP`) siguen
intactos; y la query del `POST /venta/:ventaId` sigue **sin** filtro de fecha, que es lo que permite
facturar una venta de ayer.

### Verificación del front

`npm run build` en verde y `npm run lint` limpio (`--max-warnings 0`). La página sale en su propio chunk
lazy (`Ventas-*.js`).

**No verificado**: no se hizo prueba visual en navegador. `apiUrl` apunta a producción, que todavía no
tiene los endpoints nuevos desplegados y exige login, así que un `npm run dev` acá sólo habría mostrado
la pantalla de error. La revisión visual queda para el entorno on-prem.

## 10. Pendiente

- **Prueba on-prem** en la computadora A contra la BD real de Starsoft: listado, emisión, impresión, y
  revisión visual de la pantalla con datos reales.
- Apuntar `apiUrl` (`src/config/constants.js`) al backend local de la computadora A para el despliegue
  de la ferretería.
