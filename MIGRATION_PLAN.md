# Plan de migración: absorber factyble-api/v1 dentro de factyble-back

> Documento de análisis, planificación **y ejecución en curso**. Toda cita `archivo:línea` de análisis refiere al estado de los repos al 2026-07-09. Ya hay implementación real hecha sobre `factyble-back` — antes de escribir código nuevo, leer **"Estado de implementación"** (sección siguiente) para saber qué está hecho, qué se desvió del texto original del plan (y por qué) y cuál es el próximo paso.

## Estado de implementación (para retomar en otra sesión)

> Última actualización: 2026-07-11 (sesión 7 — usuario SUPERADMIN sin empresa + `PUT /empresa/:id`, ver Fase 5.3 debajo).

### Fase 5.1 — Correcciones de la auditoría estática (sesión 5, 2026-07-11)

> `.claude/skills/factyble-sifen-auditor` corrió una auditoría estática completa sobre el estado de
> Fase 5 (ver `STATIC_AUDIT_REPORT.md`/`STATIC_AUDIT_FINDINGS.json`/`STATIC_AUDIT_MATRIX.md` en la raíz
> del repo). De los hallazgos (0 P0, 3 P1, 8 P2, 3 P3, 2 P4), se corrigieron AUD-001 a AUD-009 en esta
> sesión — cada uno con su `remediacion` documentada dentro de `STATIC_AUDIT_FINDINGS.json`. Resumen:

| Hallazgo | Qué cambió | Archivos |
|---|---|---|
| AUD-001 (P1) — históricos rotos | Reenvío, cancelación y emisión de NC ya funcionan sobre Factura/NotaCredito con `estado_sifen=NULL` (histórico pre-corte), vía lectura dual contra `sifen_estado` legacy (`esAprobado`/`esCancelado`/`esRechazado`, nuevo `utils/sifen/estadoHistorico.js`) | `facturaService.js`, `notaDeCreditoService.js`, `eventoService.js`, `correoService.js` (adjunto XML ahora condicional, ya no crashea con `xml_firmado` nulo) |
| AUD-002 (P1) — timezone del CDC | `formatearFechaEmision`/`formatearFechaHoraISO`/`formatearFechaISO` ahora convierten explícitamente a `America/Asuncion` vía `dayjs.tz()` en vez de getters locales de `Date` — ya no depende de que el contenedor tenga `TZ` configurada | `utils/sifen/cdc.js`, `services/sifen/xmlBuilderService.js` |
| AUD-003 (P1) — doble envío de lote | Claim atómico (`updateMany` condicional `CONSTRUIDO -> ENVIANDO`) antes de llamar a SIFEN en `enviarLotesConstruidos`. Nuevos estados `EstadoLote.ENVIANDO`/`AGOTADO` (migración aditiva `20260711121316_lote_estado_enviando_agotado`). **Bug adicional encontrado y corregido al implementar**: `marcarLoteAgotado` nunca sacaba `Lote.estado` de `CONSTRUIDO`, así que un lote rechazado/agotado se reenviaba a SIFEN indefinidamente — ahora transiciona a `AGOTADO` (terminal) | `services/sifen/loteService.js`, `prisma/schema.prisma` |
| AUD-004 (P2) — certificado revocado no rechazado | `obtenerCertificadoActivo` ahora rechaza `REVOCADO` además de `VENCIDO` | `services/sifen/certificadoService.js` |
| AUD-005 (P2) — carrera de activación de certificado | `crearCertificado`/`activarCertificado` toman `SELECT ... FOR UPDATE` sobre la fila de `Empresa` dentro de la transacción (mismo patrón que la secuencia de numeración) — serializa altas/activaciones concurrentes para la misma empresa | `services/sifen/certificadoService.js` |
| AUD-006 (P2) — CSC en texto plano | `utils/crypto.js#decryptTolerante` (descifra si el valor fue cifrado, si no lo devuelve tal cual) usado al leer `Empresa.csc` en `loteService`. El lado de escritura quedó cerrado en Fase 5.2 (ver debajo): `empresaService.js#crearEmpresaCompleta` cifra `csc` con `encrypt()` antes de persistir — ya no hay ningún camino de escritura que deje `csc` en texto plano | `utils/crypto.js`, `services/sifen/loteService.js`, `services/empresaService.js` |
| AUD-007 (P2) — filtros Prisma `not`/`notIn` ante NULL | Las 2 queries restantes con esta ambigüedad (guard de NC vigentes antes de cancelar una Factura, suma de NC previas antes de emitir una nueva) ya no filtran `estado_sifen` en el `where` — traen todo y filtran explícito en JS con `esCancelado`/`esRechazado`, sin depender de cómo Prisma trate NULL | `facturaService.js`, `notaDeCreditoService.js` |
| AUD-008 (P2) — parseo SOAP ambiguo | `buscarValorPorSufijo`/`extraerCodigoYMensaje` aceptan `excluirSufijos` — usado en `consultarLotes`/`enviarLotesConstruidos` para que la extracción del código a nivel de sobre/lote nunca pueda descender a leer por error el código de un documento individual dentro de `gResProcLoteDe`. Sigue siendo una mitigación, no una confirmación — el spike #3 (respuesta real de SIFEN) sigue descartado | `utils/sifen/respuestaSoap.js`, `services/sifen/loteService.js` |
| AUD-009 (P2) — firma/armado sin claim atómico | `firmarPendientes` reclama cada documento (`GENERADO -> FIRMANDO`, nuevo valor transitorio en `EstadoSifen`, migración aditiva `20260711124525_estado_sifen_firmando`) antes de firmarlo; libera el claim si falla. `crearLoteConDocumentos` agrega `lote_id: null` al `updateMany` de asignación (antes podía "robar" en silencio un documento ya tomado por otro lote concurrente) | `services/sifen/loteService.js`, `prisma/schema.prisma` |
| AUD-010 (P2) — PII en trazabilidad sin control de acceso | **No modificado en esa sesión.** Verificado al investigar el fix: no existía ningún controller/route que expusiera `trazabilidadService`/`certificadoService` (`src/routes/` no tenía `certificadoRoute`/`trazabilidadRoute`/`empresaRoute`) — sin superficie HTTP, el hallazgo quedaba acotado a exposición por acceso directo a BD, no por API. **La premisa cambió en Fase 5.2**: ahora existe `empresaRoute.js` (`POST /empresa`, gateado por `authJwt(['SUPERADMIN'])`), pero solo para alta — no expone lectura de `trazabilidadService` ni de `Certificado.clave`/`Empresa.csc` (la respuesta los omite explícitamente, ver `empresaService.js#obtenerEmpresaCompleta`). Retención (90 días) y minimización de payload de `SifenTrazabilidad` siguen siendo una decisión de producto/cumplimiento pendiente, no un bug de código | `routes/empresaRoute.js` |
| AUD-011 (P2) — cron sin mutex distribuido | **No es un fix de código** — ver nota operativa abajo | — |

**Verificación**: todos los cambios de código pasan `node --check`; el schema pasa `npx prisma
validate`; las 2 migraciones nuevas se generaron con `npx prisma migrate dev` y se aplicaron limpio
contra la BD MySQL local de desarrollo (mismo patrón sin test runner que el resto del proyecto). Los
claims atómicos (certificado activo, `Lote.estado`, `Factura/NotaCredito.estado_sifen`) y la lectura
dual de históricos se verificaron con scripts ad-hoc contra esa BD (no persistidos, mismo patrón que el
resto de Fases 2-5) — incluyendo una prueba adversarial que reprodujo el bug real de AUD-008 antes del
fix (mezcla de código de sobre y de documento) y confirmó que la exclusión lo corrige. Nada de esto se
probó contra SIFEN real (fuera de alcance, igual que el resto del pipeline).

**Nota operativa (AUD-011, no bloqueante)**: los jobs de `cronJobs.js` no tienen mutex distribuido —
dependen de que el despliegue sea de **una sola instancia** del proceso Node (confirmado hoy en
`docker-compose.yml`, sin `deploy.replicas`). Los claims atómicos agregados en AUD-003/AUD-009 ya
evitan el peor escenario (doble envío a SIFEN) incluso si esto cambiara a futuro, pero **antes de
escalar a múltiples instancias/réplicas, agregar un lock distribuido** (advisory lock de MySQL, o
equivalente) a los 5 jobs de `cronJobsSifen()` — hoy ninguno lo tiene.

### Fase 5.1 — Tercera tanda: AUD-012 a AUD-016 (misma sesión, 2026-07-11)

| Hallazgo | Resultado | Detalle |
|---|---|---|
| AUD-013 (P3) — `Lote` sin estado terminal | ✅ Ya resuelto | Efecto colateral del fix de AUD-003 (agregó `EstadoLote.AGOTADO`) — no requirió cambio nuevo, solo se confirmó y cerró en el registro de auditoría |
| AUD-014 (P3) — alerta de certificados solo por consola | ✅ Corregido | Nueva `correoService.js#enviarAlertaCertificadosPorVencer` (tabla HTML con empresa/estado/vencimiento, sin template de archivo — es un mail técnico, no de marca). `cronJobs.js` la invoca si `SIFEN_ALERTA_EMAIL` está configurada (nueva variable en `.env.example`), en su propio try/catch. El `console.warn` original se mantiene siempre como respaldo |
| AUD-012 (P3) — código muerto `dbApiFacturacion.js`/`pg` | ✅ Corregido (segunda vuelta) | El primer intento fue denegado por el clasificador de auto-mode del harness (archivo preexistente, borrado no nombrado explícitamente) — el usuario confirmó explícitamente y se completó: `src/db/dbApiFacturacion.js` eliminado, `pg` retirada de `package.json`, `package-lock.json` regenerado (`npm install`, -13 paquetes), y el bloque `HOST_API_FACT`/`URL_API_FACT`/`PORT_DB_API_FACT`/`DB_API_FACT`/`USER_DB_API_FACT`/`PW_DB_API_FACT` de `.env.example` retirado por quedar huérfano |
| AUD-015 (P4) — defaults fiscales aproximados | ➖ Sin cambio (justificado) | Cerrarlo de verdad requiere columnas nuevas (`Cliente.tipo_contribuyente`, plazo de crédito real, `NotaCredito.motivo`) **y** una forma real de que esos datos lleguen desde el frontend, que no vive en este repo — agregar solo las columnas sin el resto sería cosmético. Queda como decisión de producto coordinada backend+frontend |
| AUD-016 (P4) — bridge Java sensible a versión de Node | ➖ Sin cambio (limitación de entorno) | `docker` no está disponible en este entorno — no se pudo correr el smoke test de build real recomendado. Se reconfirmó la parte estática (Node de este entorno espera `NODE_MODULE_VERSION 137`, el binding de `node_modules/java` sigue sin cargar) — mismo síntoma ya documentado, sin cambios. Por instrucción explícita de este mismo `CLAUDE.md`, no se trata como algo a "arreglar" desde una sesión no relacionada |

**Pendiente real** (no bloqueado por falta de información, sino por falta de herramienta en esta
sesión): AUD-016 espera un entorno con Docker para el smoke test de build real.

### Fase 5.2 — Alta completa de empresa: `POST /empresa` (sesión 6, 2026-07-11)

Cierra el gap que AUD-006/AUD-010 dejaban explícitamente documentado: no existía ningún
endpoint para dar de alta `Empresa`/`Certificado`/`Establecimiento`/`Caja`/secuencias — el alta
era manual (Prisma Studio o SQL directo). Decisiones de diseño (confirmadas con el usuario antes
de implementar):

- **Autorización**: nuevo rol `SUPERADMIN` (migración de datos, no de schema —
  `prisma/migrations/20260711134651_add_superadmin_rol`, `INSERT` idempotente vía
  `WHERE NOT EXISTS` porque `rol.nombre` no tiene constraint `UNIQUE`), distinto de `ADMIN`
  (que es por-empresa). Solo staff de plataforma puede onboardear una empresa nueva.
- **Alcance atómico**: una sola request crea, en una única `prisma.$transaction`, la `Empresa`
  con **todos** sus campos fiscales (incluidos los que el schema marca nullable para permitir
  backfill de filas legacy — acá son obligatorios, ver `empresaRoute.js`), al menos un
  `Establecimiento` con al menos una `Caja`, las 3 secuencias de esa caja
  (`SecuenciaFactura`/`SecuenciaNotaCredito`/`SecuenciaRecibo`, inicializadas en 0 o en el valor
  que mande el caller), el primer `Usuario` con rol `ADMIN` de esa empresa, y el `Certificado`.
  Si algo falla, no queda estado parcial (verificado con script ad-hoc: contraseña de
  certificado incorrecta y RUC duplicado no dejan ninguna fila huérfana ni el `.p12` huérfano en
  disco).
- **Certificado**: se sube como archivo binario (`multipart/form-data`, campo `certificado`,
  `.p12`/`.pfx`, máx. 2MB) vía nueva dependencia `multer@^2` (se instaló la v2, no la v1 —
  la v1 tiene vulnerabilidades conocidas sin fix). Se guarda en `certificados/` en la raíz del
  repo (ya estaba en `.gitignore`, confirmando que era la ubicación prevista) — **no** en
  `public/`, que se sirve estático y expondría la clave privada del certificado por HTTP. Path
  configurable vía `SIFEN_CERTIFICADOS_DIR` (nueva variable en `.env.example`). La vigencia del
  `.p12` se valida contra el archivo real (`firmadorService.obtenerVencimientoCertificado`)
  **antes** de escribir nada en la base de datos.
- **Contrato del payload**: multipart con dos campos — `data` (JSON con `empresa`,
  `establecimientos[].cajas[]`, `usuarioAdmin`, `certificado.alias`/`certificado.clave`) y
  `certificado` (el archivo). Los nombres de campo del JSON son camelCase (`rucSinDv`,
  `nombreEmpresa`, etc.), igual que `empresaId` en `POST /usuario/register` — el mapeo a las
  columnas `snake_case` de Prisma pasa por `empresaService.js`. La respuesta, en cambio, refleja
  la forma nativa de Prisma (`ruc_sin_dv`, `nombre_empresa`), igual que el resto de los endpoints
  de lectura del proyecto (p. ej. `rolService.getRoles`).
- **Validaciones de negocio agregadas** (más allá de tipos/formato en `empresaRoute.js`): el
  dígito verificador informado se recalcula con `calcularDigitoVerificador` (`utils/sifen/cdc.js`,
  el mismo Módulo 11 que ya usa el CDC) y se rechaza si no coincide con el RUC; RUC duplicado y
  email de usuario duplicado se rechazan con 400 antes de tocar la transacción.
- **Reuso**: se exportó `certificadoService.js#calcularEstadoPorVencimiento` (antes privado) para
  no duplicar la lógica de `VIGENTE`/`POR_VENCER`/`VENCIDO` al crear el certificado dentro de la
  transacción de `empresaService.js` — no se pudo reusar `certificadoService.crearCertificado`
  directamente porque abre su propia transacción y esta alta necesita que todo el certificado
  entre en la misma transacción que la empresa.

**Añadido en la misma sesión, a pedido del usuario**: `GET /empresa` (listado paginado,
`page`/`itemsPerPage`/`filter` por `ruc`/`nombre_empresa`/`email`, vista liviana con conteo de
establecimientos/usuarios y el certificado activo) y `GET /empresa/:id` (detalle completo, misma
forma que la respuesta de `POST /empresa`, reusando el mismo `select` vía
`EMPRESA_COMPLETA_SELECT` para no duplicarlo). Ambos gateados por `SUPERADMIN`, igual que el
alta. Contrato completo (bodies, query params, códigos de error) documentado en `api.txt` (raíz
del repo) para integración de frontend.

**Verificación**: `node --check` en los 5 archivos nuevos/tocados; smoke test end-to-end con
script ad-hoc (no persistido, mismo patrón que el resto del proyecto) contra la BD MySQL local
real — request `multipart/form-data` real vía `http`+`form-data` con un `.p12` autofirmado
generado con `openssl` para la prueba, contra un server Express que monta solo `empresaRoute.js`
(montar `src/routes/index.js` completo dispara el `ERR_DLOPEN_FAILED` ya documentado del bridge
Java — AUD-016, no relacionado con este cambio). Se verificó: creación exitosa con los 4 niveles
anidados + certificado cifrado + secuencias en 0; rollback limpio (sin empresa ni archivo
huérfano) con contraseña de certificado incorrecta; rechazo 400 por RUC duplicado sin crear una
segunda fila.

**Archivos**: `prisma/migrations/20260711134651_add_superadmin_rol/`, `src/routes/empresaRoute.js`,
`src/controllers/empresaController.js`, `src/services/empresaService.js`,
`src/middleware/uploadCertificado.js`, `src/services/sifen/certificadoService.js` (solo el
`export` nuevo), `src/routes/index.js`, `.env.example`, `package.json`/`package-lock.json`
(dependencia `multer`).

### Fase 5.3 — Usuario SUPERADMIN sin empresa + `PUT /empresa/:id` (sesión 7, 2026-07-11)

- **`Usuario.empresa_id` ahora nullable** (migración `20260711163646_usuario_empresa_id_opcional`,
  `Empresa? @relation(...)`, FK con `ON DELETE SET NULL`): staff de plataforma (`SUPERADMIN`) no
  pertenece a ninguna empresa cliente, a diferencia de `ADMIN`. `usuarioService.js#authenticateUsuario`
  ajustado para no asumir `user.empresa` no-null al armar el payload del JWT
  (`empresaNombre`/`empresaRuc` quedan `null` para un `SUPERADMIN` sin empresa).
- **`scripts/createSuperAdmin.js`** (reusable, `npm run create:superadmin -- --email=... --password=...
  --nombres=... --apellidos=... --documento=... --telefono=...`): crea el usuario con
  `empresa_id: null` y le asigna el rol `SUPERADMIN`. Es el único camino para dar de alta staff de
  plataforma — no hay endpoint HTTP para esto, a propósito (evita exponer creación de superadmins
  por API).
- **`PUT /empresa/:id`** (`empresaService.js#actualizarEmpresa`, gateado por `SUPERADMIN`): update
  PARCIAL de las columnas propias de `Empresa` únicamente — deliberadamente NO acepta
  establecimientos/cajas/secuencias/usuarios/certificado (editar secuencias por acá desalinearía la
  numeración fiscal ya emitida; esos siguen sin tener endpoint de edición). Revalida Módulo 11 si se
  toca `rucSinDv`/`digitoVerificador` (deben ir juntos, o el que falte se toma del valor ya persistido)
  y unicidad de RUC excluyéndose a sí misma. `csc` se re-cifra si viene en el body. Documentado en
  `api.txt` sección 5.
- **Verificación**: `node --check` en los archivos tocados; migración aplicada y `prisma generate`
  regenerado contra la BD MySQL local real; smoke tests ad-hoc (no persistidos) — creación de
  superadmin + login end-to-end vía `authenticateUsuario`; `actualizarEmpresa` con update parcial
  (secuencias/otros campos intactos verificados), rechazo de DV inconsistente, rechazo de RUC
  duplicado, 404 de empresa inexistente; smoke test HTTP completo de `PUT /empresa/:id` (sin token,
  rol `ADMIN` sin permiso, body vacío, `:id` inválido, email inválido, empresa inexistente, y update
  válido) contra un server Express que monta solo `empresaRoute.js` (mismo patrón que Fase 5.2, evita
  el `ERR_DLOPEN_FAILED` de `routes/index.js` completo). Todos los datos de prueba se crearon y
  borraron en el mismo script, sin dejar filas huérfanas.

### Fase 1 — Fundamentos: EN PROGRESO

| Ítem | Estado | Detalle |
|---|---|---|
| Migraciones Prisma (§2.2) | ✅ Hecho | Migración `20260710015934_add_sifen_domain` generada y aplicada contra la BD local (`localhost:3306/factyble`). 100% aditiva — sin `DROP`/`MODIFY COLUMN`, verificado leyendo el SQL generado. Ver `prisma/schema.prisma` y `prisma/migrations/20260710015934_add_sifen_domain/migration.sql`. El texto de §2.2 más abajo ya está actualizado para reflejar exactamente lo que se implementó (no lo que se planeó originalmente) — ver desvíos abajo. |
| Instalación de las 4 libs `facturacionelectronicapy-*` | ✅ Hecho | En `package.json`: `xmlgen@1.0.283`, `xmlsign@1.0.28`, `setapi@1.0.34`, `qrgen@1.0.9`. Las 4 cargan sin error (`require()` verificado). Exportan `{ default: ... }` (transpiladas desde ESM) — usar `.default` al importarlas en CJS. |
| Variables de entorno (`SIFEN_ENV`, etc.) | ✅ Hecho | Agregadas a `.env`/`.env.example`: `SIFEN_ENV` (`test`/`prod`) y `CERT_ENCRYPTION_KEY` (secreto de cifrado de la contraseña del P12, generado con `crypto.randomBytes(32).toString('hex')` para el `.env` local — en producción debe generarse/guardarse aparte). |
| Spikes de Fase 0 (§4.0, 3 ítems) | 🟡 2 de 3 resueltos | **#1 y #2 resueltos por lectura de código fuente de las libs** (sin necesidad de red ni certificado real — ver "Resultados de los spikes" abajo). **#3 (round-trip contra SIFEN test) sigue pendiente** — requiere RUC y certificado P12 de prueba emitidos por la SET, que no están disponibles en el repo; bloqueado hasta que el usuario los provea. |

### Fase 3 — SifenClient + certificados + trazabilidad: EN PROGRESO

| Ítem | Estado | Detalle |
|---|---|---|
| `services/sifen/sifenClientService.js` | ✅ Hecho | Wrapea `facturacionelectronicapy-setapi`. Expone solo `recibeLote`, `evento`, `consultaLote`, `consulta`, `consultaRuc` (nunca `recibe`, instrucción explícita §3.2). Confirmado por lectura de código (`SET.js`/`index.js`) que las 5 firmas son `(id, <dato>, env, certificado, passphase, config)` y todas devuelven una `Promise` que **resuelve** con el body SOAP ya parseado (`xml2js`, `explicitArray: false`) tanto en éxito como en rechazo de negocio de SIFEN — la lib solo *rechaza* la Promise ante fallas de red/parseo (respuesta no-XML, timeout, etc.), nunca ante un código de rechazo SIFEN en sí. Por eso este wrapper no interpreta el contenido de la respuesta (eso es trabajo de `codigosRespuesta.js`/`loteService`/`eventoService`, todavía no implementados) — solo pasa el objeto resuelto tal cual, y traduce errores de transporte a `ErrorApp` vía `handleServiceError`. `SIFEN_ENV` leído de `process.env` (mismo patrón que `qrService.js`); certificado (path + password ya descifrada) recibido explícito por parámetro en cada llamada, sin estado global (antipatrón G). El parámetro `id` (`dId` del sobre SOAP) lo genera el caller (`loteService`/`eventoService`, todavía no implementados) — este módulo no inventa un esquema de generación de IDs, no es su responsabilidad. `certificado` confirmado que es un **path de archivo** (`PKCS12.openFile` hace `fs.readFileSync(file)`), no un buffer — mismo contrato que `certificadoPath` de `firmadorService.js`. **Guarda propia agregada** (no solo confiar en la lib): `recibeLote` valida 1-50 documentos *antes* de llamar a `setapi.recibeLote`, porque la nota de robustez ya documentada en el spike #1 confirma que los `reject(...)` de validación de tamaño de la lib no cortan la ejecución con `return` — verificado con test ad-hoc (lote vacío y lote de 51 rechazados por nuestra guarda con `ErrorApp` 400, antes de tocar la lib). Verificado sin test runner (mismo patrón que el resto de Fase 2/3): `require()` manual confirma que carga sin error y expone las 5 funciones. **No probado contra SIFEN real** (mismo bloqueo que siempre: spike #3 pendiente, RUC/certificado P12 de prueba de la SET). |
| `services/sifen/trazabilidadService.js` | ✅ Hecho | Función central `registrarInteraccion({entidadTipo, entidadId, operacion, request, response, codigoRespuesta, exitoso})` (§3.2) — el punto de paso obligado para cualquier interacción con SIFEN una vez que `loteService`/`eventoService` (Fase 4, todavía sin escribir) empiecen a llamar a `sifenClientService`. Este módulo **no interpreta** el contenido de la respuesta (`codigoRespuesta`/`exitoso` los decide el caller, típicamente con `codigosRespuesta.js`, todavía no implementado) — solo persiste. `request`/`response` aceptan tanto `string` (el XML/SOAP ya armado, típico del request) como objeto JS (el body SOAP ya parseado que devuelve `sifenClientService`, típico del response) — `serializarPayload` hace `JSON.stringify` solo si no es ya un string, así el caller no tiene que serializar a mano. Se agregaron además `obtenerTrazabilidadPorEntidad({entidadTipo, entidadId})` (lectura ordenada por fecha, pensada para diagnosticar un rechazo tipo 0142 después del hecho, §3.5) y `limpiezaTrazabilidad()` (purga por retención, para el cron `limpiezaTrazabilidad` de §3.4 — el registro del cron en sí queda pendiente para cuando se conecte el resto de Fase 3/4 a `cronJobs.js`, acá solo está la función de servicio). Retención configurable vía variable de entorno nueva `SIFEN_TRAZABILIDAD_RETENCION_DIAS` (agregada a `.env`/`.env.example`, default 90 días en código si no está seteada — mismo patrón que `SIFEN_ENV`). Verificado contra la BD MySQL local real (mismo patrón que `certificadoService`, sin test runner): alta con request string + response objeto (confirmado que el objeto se guarda serializado y el string se guarda tal cual), alta con ambos payloads `null`, rechazo de un `entidadTipo` fuera del enum (`ErrorApp` 400 vía `Prisma.PrismaClientValidationError`), lectura filtrada por entidad (no trae registros de otras entidades), lectura vacía para una entidad sin trazabilidad, purga de un registro forzado a 91 días de antigüedad sin tocar uno reciente, y confirmación de que `SIFEN_TRAZABILIDAD_RETENCION_DIAS` efectivamente se lee de `process.env` (probado con retención de 1 día). Todas las filas de prueba se limpiaron al final del script ad-hoc (no persistido en el repo). |
| `services/sifen/certificadoService.js` | ✅ Hecho | CRUD de `Certificado` + chequeo de vencimiento vía `firmadorService.obtenerVencimientoCertificado` + selección del certificado activo por empresa (§3.2). Expone `crearCertificado`, `activarCertificado`, `obtenerCertificadoActivo`, `listarCertificadosPorEmpresa`, `actualizarEstadosPorVencimiento`. **"Un solo certificado activo por empresa a la vez"** (no garantizado por constraint de BD, ver §2.2) enforzado a nivel aplicación: tanto `crearCertificado(activo: true)` como `activarCertificado` corren dentro de la misma `prisma.$transaction` que hace `updateMany({activo:false})` sobre cualquier otro certificado activo de la empresa antes de crear/activar el nuevo — sin ventana de dos activos simultáneos. `estado` (`VIGENTE`/`POR_VENCER`/`VENCIDO`, ventana `POR_VENCER` de 30 días) se calcula al crear el certificado y se recalcula en `actualizarEstadosPorVencimiento` (pensada para el cron `alertaCertificadosPorVencer`, §3.4 — todavía no registrado como cron, solo la función de servicio). `obtenerCertificadoActivo` es el punto de entrada que van a usar `loteService`/`eventoService` (todavía no implementados): devuelve `{archivo, clave, ...}` con la contraseña **ya descifrada**, lista para pasar directo a `firmadorService`/`sifenClientService` sin que ellos sepan nada de cifrado — y lanza `ErrorApp` 400 si el certificado activo está `VENCIDO` (nunca deja pasar un certificado vencido a firmar/enviar en silencio, la falla proactiva que v1/v2 nunca tuvieron, causa raíz documentada del error 0142) o 404 si la empresa no tiene certificado activo. **Nuevo util `utils/crypto.js`** (no nombrado explícitamente en el texto original del plan, pero la responsabilidad ya estaba asignada a este servicio en §2.2/§3.2 — "el cifrado en sí es responsabilidad de certificadoService"): AES-256-GCM genérico y reusable (no atado a SIFEN), clave de 32 bytes leída de `CERT_ENCRYPTION_KEY` (`process.env`, nunca en BD), IV aleatorio de 12 bytes + auth tag de 16 bytes empaquetados junto al texto cifrado en un solo string base64 por valor cifrado. `Certificado.clave` se persiste siempre cifrada (nunca el plaintext recibido) — corrige antipatrón J (contraseña de P12 en texto plano en v1/v2). El mismo util queda listo para cifrar `Empresa.csc` más adelante (mismo comentario pendiente ya documentado en el schema, ver §2.2), aunque ese trabajo no se hizo en este módulo. Verificado sin test runner (mismo patrón del resto de Fases 2/3), pero esta vez **contra la BD MySQL local real** (no solo `require()`/lectura de código): script ad-hoc (no persistido) que generó un P12 autofirmado propio con `openssl` (vigencia de 3 días, para ejercitar el estado `POR_VENCER`) y corrió, con limpieza de filas al final, los casos: alta con cifrado (confirmado que `clave` persistida ≠ contraseña en texto plano), creación de un segundo certificado activo desactivando atómicamente el primero, `activarCertificado` revirtiendo la exclusividad, `obtenerCertificadoActivo` devolviendo la contraseña descifrada igual a la original, 404 para una empresa sin certificados, 400 al forzar un certificado a `VENCIDO` y consultarlo, y `actualizarEstadosPorVencimiento` recalculando/persistiendo el estado correcto. De paso se probó `utils/crypto.js` de forma aislada: round-trip cifrar/descifrar, rechazo con dato alterado (auth tag de GCM) y rechazo con clave incorrecta. **Nota de proceso, no bug de código**: la primera corrida del test ad-hoc arrojó `vigenteHasta` en epoch (1970) para el P12 recién generado — resultó ser un path con backslashes mal escapados en el propio script bash de test (`fs.existsSync` recibía un path corrupto y `getExpiration` de la lib devuelve silenciosamente su default 1970 sin lanzar error si el archivo "no existe" — comportamiento ya de la lib, no de este servicio), no un bug de `firmadorService`/`certificadoService`; con el path corregido (forward slashes) el vencimiento leído fue correcto. **No probado con un P12 real de la SET** (mismo bloqueo de siempre: spike #3). |

### Fase 4 — loteService + eventoService + jobs: COMPLETA (código escrito y encolado; la validación real contra SIFEN queda para el piloto de producción, no para un round-trip de test)

| Ítem | Estado | Detalle |
|---|---|---|
| `utils/sifen/codigosRespuesta.js` | ✅ Hecho | Mapa `{codigo: {categoria, mensajeInterno, alertar}}` + `interpretarCodigo(codigo)`/`esAprobado(codigo)`. Sembrado con `"0142"` (ya documentado desde el inicio del proyecto) más `"0260"` (documento Aprobado), `"0300"` (lote recibido con éxito, informativo) y `"0301"` (lote no encolado, rechazado) — **estos 3 códigos nuevos se verificaron por búsqueda web dirigida contra documentación oficial SET/DNIT** (Manual Técnico SIFEN v150 y la "Guía de Mejores Prácticas para la Gestión del Envío de DE" de dnit.gov.py), no inventados — instrucción explícita de §3.2 ("no inventar códigos"). Códigos no mapeados se tratan como `RECHAZADO` + `alertar:true` por default (no `REINTENTABLE`: ya es una respuesta de negocio resuelta, no una falla de transporte, así que reintentar sin cambios no ayuda) — para ampliar el mapa, consultar el Manual Técnico, nunca adivinar. |
| `utils/sifen/respuestaSoap.js` (nuevo, no nombrado explícitamente en el texto original del plan) | ✅ Hecho | Extracción de campos (`dCodRes`/`dMsgRes`/`dProtConsLote`/`gResProcLoteDe`/`CDC`) de la respuesta SOAP ya parseada, por *sufijo* de nombre de tag (case-insensitive, ignora prefijo de namespace) — no por clave exacta, porque `SET.js` (código fuente de `setapi`) tiene, comentado, un intento anterior de bajar a una clave específica con prefijo `ns2:` que fue reemplazado por devolver el body entero sin bajar más; el namespace/anidamiento real de una respuesta SIFEN de verdad no está confirmado por lectura de código (sigue dependiendo del spike #3). Nombres de campo sí confirmados contra la documentación oficial (misma fuente que `codigosRespuesta.js`). |
| `services/sifen/xmlBuilderService.js#construirXmlEventoCancelacion` | ✅ Hecho (agregado a un módulo ya existente de Fase 2) | Confirmado por lectura de `jsonEventoMain.service.js#eventosEmisorCancelacion` que el evento de cancelación solo necesita `cdc`+`motivo` (no datos de empresa/establecimiento — SIFEN identifica al emisor por el certificado mTLS de la llamada SOAP). A diferencia de `construirXmlFactura`/`construirXmlNotaCredito` (que devuelven solo el nodo `DE` suelto), esta función devuelve el **sobre SOAP completo** (`env:Envelope > env:Body > rEnviEventoDe > dEvReg > gGroupGesEve > rGesEve > rEve`) — confirmado leyendo `xmlgen`'s `envelopeEvent()`. `firmadorService.firmarXmlEvento` firma el `rEve` sin tocar el resto del sobre, y el resultado se pasa **tal cual** a `sifenClientService.evento` (que espera el sobre completo, no el fragmento — confirmado en `SET.js`: `"Para el evento, el xml ya viene con SoapData"`). |
| `services/sifen/loteService.js` | ✅ Hecho | Único camino de emisión (`armarLotes`, `enviarLotesConstruidos`, `consultarLotes`, `consultaIndividualRedDeSeguridad`), parametrizado por tipo de documento (Factura/NotaCredito) vía un mapa `TIPOS_DOCUMENTO` interno (mismo paralelismo que ya tenía `xmlBuilderService` entre sus dos builders). Aislamiento de error por documento, por lote y por empresa en las 3 etapas (armado/firma, envío, consulta) — corrige el antipatrón Q de `src/` en las 3, no solo en 2 de 3 como v2. `crearLoteConDocumentos` crea el `Lote` y asigna los documentos dentro de la misma `prisma.$transaction` (evita el antipatrón I: nunca un `Lote` sin documentos asignados o viceversa). Cola de reintentos (§3.3) con backoff exponencial (`SIFEN_LOTE_BACKOFF_BASE_SEGUNDOS`/`_CAP_SEGUNDOS`/`SIFEN_LOTE_MAX_INTENTOS`, nuevas env vars) — al agotar los intentos o ante un rechazo definitivo de SIFEN (`codigosRespuesta.js` categoría `RECHAZADO`), los documentos del lote pasan a `estado_sifen = ERROR` (el modelo `Lote` no tiene un estado terminal propio en el schema, la señal vive en los documentos). **Bug real encontrado y corregido durante la verificación ad-hoc** (ver abajo): la query de `armarLotes` original seleccionaba `estado_sifen IS NULL OR 'GENERADO'`, lo cual habría reprocesado **todas** las Facturas/NotasCredito legacy existentes (que tienen `estado_sifen = null` para siempre, ver desvío #1) en cada corrida del cron — corregido a seleccionar únicamente `'GENERADO'` (estado que solo va a setear el flujo de emisión nativo, todavía sin escribir — Fase 5). |
| `services/sifen/eventoService.js` | ✅ Hecho | `cancelarFactura`/`cancelarNotaCredito` (delegan a un `cancelarDocumento` interno parametrizado, mismo patrón que `loteService`). Guarda de estado `estado_sifen === 'APROBADO'` antes de cancelar — generaliza a Factura+NotaCredito el patrón que ya existía solo para Factura contra la API PHP legacy en `notaDeCreditoService.js:69-71` (corrige el antipatrón W de `src/`, que no validaba nada). El registro `EventoSifen` se crea **antes** de llamar a SIFEN (evita el antipatrón P: si el proceso se cae a mitad de camino, queda un registro consultable en vez de una llamada fantasma). Camino síncrono, no pasa por `loteService`. Sobre fallas de transporte: se registran en `EventoSifen.intentos_envio`/`ultimo_error` (mismos campos que `Lote`, por consistencia de schema) pero el error se relanza al caller síncrono — no hay todavía un cron que reintente eventos fallidos automáticamente (no está en la tabla de jobs de §3.4, a diferencia de `Lote`). |
| `src/services/cronJobs.js` | ✅ Hecho (registro de jobs, coexiste con `checkFacturaStatus` legacy) | `armarYEnviarLotes` (cada 5 min, llama `armarLotes`+`enviarLotesConstruidos` en secuencia), `consultarLotes` (cada 5 min), `consultaIndividualRedDeSeguridad` (cada hora), `alertaCertificadosPorVencer` (diario 06:00, llama `certificadoService.actualizarEstadosPorVencimiento` — el canal de notificación real, ej. email, todavía no está conectado, por ahora solo `console.warn`), `limpiezaTrazabilidad` (semanal, domingo 03:00). Ninguno de estos jobs va a encontrar trabajo real hasta que `facturaService.js`/`notaDeCreditoService.js` se reescriban para setear `estado_sifen = 'GENERADO'` al emitir (Fase 5, todavía sin empezar) — se registran ya para que el pipeline esté operativo desde el día en que se active la emisión nativa, sin otro deploy. |
| Verificación ad-hoc contra BD MySQL local real + red real a `sifen-test.set.gov.py` | ✅ Hecho | Mismo patrón sin test runner que el resto del repo. Empresa sintética con datos fiscales completos + P12 autofirmado (`openssl`, no es un certificado real de la SET) + 2 Facturas `GENERADO`, más una segunda empresa con datos fiscales incompletos (para probar aislamiento). Confirmado: firma + QR + persistencia atómica (`estado_sifen: FIRMADO`→`ENCOLADO`), agrupamiento en un `Lote` `CONSTRUIDO`, aislamiento del error de la empresa incompleta (no bloqueó a la otra), guarda de cancelación (rechaza documento no `APROBADO`), `EventoSifen` trazado aunque la llamada real falle. Las llamadas de red (`enviarLotesConstruidos`, `cancelarFactura` sobre documento `APROBADO`) **sí llegaron a la infraestructura real de SIFEN test** (`sifen-test.set.gov.py` es alcanzable desde este entorno) y fallaron de forma esperable por certificado autofirmado inválido (`"Error SIFEN BIG-IP logout page"` en `recibeLote`, `ECONNRESET` en `evento`) — confirma que la cadena completa arma/firma/envía correctamente hasta el punto de autenticación mTLS real; el resultado de negocio en sí (respuesta real de SIFEN con un certificado válido) queda para el piloto de producción, no para un round-trip contra test (spike #3 descartado, ver más abajo). Datos de prueba y P12 no persistidos en el repo (mismo patrón que el resto de fases). |
| Hallazgo de entorno (no relacionado al código de esta fase) | ⚠️ Anotado, no resuelto | `node_modules/java` (usado por `utils/generarPdf.js` para JasperReports, ya existía antes de esta migración) tiene un binding nativo (`nodejavabridge_bindings.node`) compilado para `NODE_MODULE_VERSION 93`, incompatible con el Node instalado en este entorno de verificación (`v24.13.1`, requiere `137`) — cualquier `require()` de `facturaService.js`/`notaDeCreditoService.js` falla con `ERR_DLOPEN_FAILED` bajo ese Node (confirmado que sigue igual tras el wiring de Fase 5 — `generarPdf.js` no se tocó). Confirmado que es preexistente (falla igual sobre el código sin tocar de `facturaService.js`, antes de esta sesión) — no se intentó arreglar (fuera de alcance de esta migración; probablemente el proyecto corre con una versión de Node distinta en desarrollo/producción). Desde Fase 5, `cronJobs.js` **ya no importa** `facturaService.js` (se eliminó `checkFacturaStatus`, ver abajo), así que este problema dejó de ser transitivo para `cronJobs.js` — se verificó con `require()` completo sin fallar (ver tabla de Fase 5). `facturaService.js`/`notaDeCreditoService.js` en sí se siguen verificando con `node --check` (sintaxis) en vez de `require()` completo por este motivo. |

### Fase 5 — Corte: `facturaService.js`/`notaDeCreditoService.js` reescritos sobre el pipeline nativo — COMPLETA (2026-07-11, sesión 4)

> Cierra el corte único decidido en "Decisiones cerradas" (sin flag de convivencia, sin bifurcación `LEGADO_PHP`/`NATIVO`). A partir de esta sesión, `emitirFactura`/`emitirNotaDeCredito` ya no llaman a la API PHP legacy (`apiFacturacionElectronica*` eliminadas) — usan `loteService`/`eventoService` directamente, igual que ya usaban los crons de Fase 4.

| Ítem | Estado | Detalle |
|---|---|---|
| `services/sifen/loteService.js#firmarDocumentoRecienCreado` (nuevo) | ✅ Hecho | Variante síncrona de `firmarYPersistirDocumento` (ya existía desde Fase 4 para el cron) pensada para que `facturaService`/`notaDeCreditoService` la llamen **dentro de la misma `prisma.$transaction`** que crea el documento — acepta un `client` explícito (la `tx` del caller, default `prisma`). Replica el comportamiento que ya tenía la API PHP legacy (`data.php` firmaba sincrónico, solo el envío a SIFEN por lote era asíncrono — ver "Conflictos detectados"): si la firma falla (certificado vencido/ausente, datos fiscales incompletos de la empresa), toda la transacción se revierte junto con la numeración recién asignada — no queda un número de Factura/NotaCredito "quemado" por un problema de configuración detectable en el momento. `firmarYPersistirDocumento` ahora también persiste `linkqr` (antes solo `xml_firmado`/`estado_sifen`/`fecha_firma`) — no es un campo legacy congelado como `xml`/`sifen_estado` (ver comentario ya existente en `qrService.js`), solo cambia quién lo calcula. Verificado con dos scripts ad-hoc contra la BD MySQL local real + P12 autofirmado (mismo patrón que el resto del repo, sin test runner, datos borrados al final): (1) camino feliz completo — Empresa sintética con datos fiscales completos + certificado activo, CDC calculado con `utils/sifen/cdc.js` (mismo código que ahora usa `facturaService`), `firmarDocumentoRecienCreado` deja `estado_sifen: FIRMADO` con `xml_firmado`/`linkqr` poblados, `armarLotes()` agrupa el documento en un `Lote CONSTRUIDO` (`estado_sifen → ENCOLADO`), y `enviarLotesConstruidos()` **llegó a la infraestructura real de `sifen-test.set.gov.py`** (mismo error esperable por certificado autofirmado que en Fase 4, `"Error SIFEN BIG-IP logout page"`), con trazabilidad registrada; (2) rollback — Empresa **sin** certificado activo, `firmarDocumentoRecienCreado(tx)` lanza dentro de la transacción y se confirmó que ni la `Factura` ni el incremento de `secuencia_factura` sobreviven al rollback (0 filas huérfanas, secuencia intacta) — confirma la propiedad atómica que motivó threadear `tx` en vez de firmar después de comitear. |
| `services/sifen/loteService.js#notificarResultadoDocumento` (nuevo) | ✅ Hecho | Reemplaza la lógica de envío de mail que antes vivía en `facturaService#checkFacturaStatus` (eliminado). Se invoca desde `actualizarDocumentoPorResultado` (dentro de `consultarLotes`) y desde `consultaIndividualRedDeSeguridad`, cada vez que un documento resuelve a `APROBADO`/`RECHAZADO`. Generalizado a Factura/NotaCredito vía nuevas claves en `TIPOS_DOCUMENTO`: `obtenerContactos`/`notificarAprobado`/`notificarRechazado` (antes solo tenían `entidadTipo`/`modelo`/`construirXml`/`include`). A diferencia del código legacy que reemplaza (que tenía un bug real: `enviarErrorNotaDeCredito({ email: notaDeCredito.usuario, ...})` pasaba el objeto `usuario` completo en vez de `usuario.email`), acá se usa `documento.usuario.email` correctamente para ambos tipos. Aislado con su propio try/catch — un fallo de envío de correo no interrumpe la sincronización de estado SIFEN del resto del lote/consulta (mismo criterio que el antipatrón Q, ya aplicado en el resto del módulo). `TIPOS_DOCUMENTO[*].include` se amplió con `usuario: true` para tener el email del emisor original disponible en el mail de rechazo. |
| `services/correoService.js#enviarFactura`/`enviarNotaDeCredito` | ✅ Hecho | Ya no hacen `axios.get('http://{HOST_API_FACT}/factyble-api/firmados/{cdc}.xml')` (antipatrón F — dependían del filesystem/servidor PHP legacy, que no tiene los XML de los documentos emitidos por el pipeline nativo). Ahora reciben `xmlFirmado` (el contenido de `Factura.xml_firmado`/`NotaCredito.xml_firmado`) como parámetro y arman el adjunto con `Buffer.from(xmlFirmado, 'utf-8')` directo — cierra el gap que ya estaba documentado en §2.2 ("Pendiente de implementar: correoService.js todavía arma el adjunto vía axios.get..."). Import de `axios` eliminado del archivo (ya no se usa para nada más en este módulo). |
| `services/facturaService.js` | ✅ Hecho | `apiFacturacionElectronica`/`apiFacturacionElectronicaCancelar` eliminadas (con sus imports `FormData`/`axios`/`obtenerPeriodicidad`). `emitirFactura`: el CDC se calcula localmente con `utils/sifen/cdc.js#construirCdc` (RUC/DV del emisor separados de `Empresa.ruc`, `tipoContribuyente` mapeado `FISICA=1`/`JURIDICA=2`, `tipoDocumento=1`, `tipoEmision=1`, mismo `codigoSeguridad` ya generado) — ya no lo devuelve la API PHP. La `Factura` se crea con `estado_sifen: 'GENERADO'` (sin `xml`/`linkqr`/`sifen_estado`, legacy congelados) y, dentro de la **misma transacción**, se llama a `loteService.firmarDocumentoRecienCreado('FACTURA', factura.id, tx)` — de paso se corrigió que el resto de la transacción (`codigosSeguridadRaw`, `factura.create`, `facturaDetalle.createMany`) usara `tx` consistentemente (antes usaban el `prisma` global pese a estar "dentro" de la transacción, un desvío silencioso del código original que rompía la atomicidad real que el comentario decía tener). `cancelarFactura`: delega en `eventoService.cancelarFactura` tras los chequeos propios de Factura (ya cancelada vía `estado_sifen`, notas de crédito pendientes) — `apiFacturacionElectronicaCancelar` eliminada. `checkFacturaStatus` y el import de `conectarDbApiFacturacion` eliminados (reemplazados por `notificarResultadoDocumento` de `loteService`). `reenviarFactura` filtra por `estado_sifen: 'APROBADO'` (antes `sifen_estado: 'Aprobado'`) y pasa `xmlFirmado: factura.xml_firmado` a `correoService.enviarFactura`. |
| `services/notaDeCreditoService.js` | ✅ Hecho | Mismo patrón que `facturaService.js`. `apiFacturacionElectronicaNotaDeCredito`/`apiFacturacionElectronicaCancelarNotaDeCredito` eliminadas. Los guards que todavía leían `sifen_estado` (texto libre legacy) se migraron a `estado_sifen` (enum nativo): el lookup de la Factura asociada (`not: 'CANCELADO'`), el chequeo `factura.estado_sifen !== 'APROBADO'` antes de emitir la NC, y el filtro de notas de crédito previas (`notIn: ['CANCELADO', 'RECHAZADO']`). CDC calculado igual que en Factura pero con `tipoDocumento=5`. `cancelarNotaDeCredito` delega en `eventoService.cancelarNotaCredito`. `reenviarNotaDeCredito` usa `estado_sifen: 'APROBADO'` y pasa `xmlFirmado`. |
| `services/cronJobs.js` | ✅ Hecho | Se eliminó el cron de 10 minutos que llamaba a `checkFacturaStatus` (ya no existe) — ahora `cronJobs()` solo registra los 5 jobs de `cronJobsSifen()` (Fase 4). Como efecto colateral, `cronJobs.js` dejó de importar `facturaService.js` — ya no hereda transitivamente el problema de entorno del bridge Java (ver tabla de Fase 4 arriba), y ahora carga con `require()` completo sin fallar. |
| `src/db/dbApiFacturacion.js` | ⚠️ Código muerto, no eliminado | Ya no lo referencia nada en `src/` (confirmado por grep) — es candidato a borrado per §3.2 ("Eliminar `src/db/dbApiFacturacion.js`"), pero el sandbox de esta sesión bloqueó el `rm` de un archivo preexistente sin pedido explícito del usuario. Borrar en la próxima sesión (o a mano) junto con la dependencia `pg` de `package.json` si no se usa para nada más — mismo checklist que §4.4, solo que antes de las 4 semanas de rollback en vez de después (no hay nada que revertir: el archivo no se ejecuta desde ningún camino vivo). |
| Verificación ad-hoc contra BD MySQL local real + red real a `sifen-test.set.gov.py` | ✅ Hecho | Ver detalle en la fila de `firmarDocumentoRecienCreado` arriba. Además: `node --check` en los 5 archivos tocados, grep de todo `src/` para confirmar 0 referencias vivas a `checkFacturaStatus`/`apiFacturacionElectronica*`/`FormData`/`axios` (legacy) fuera de comentarios explicativos. No se probó `emitirFactura`/`emitirNotaDeCredito` de punta a punta a través de un HTTP request real a los controllers (bloqueado por el mismo problema de entorno del bridge Java documentado arriba — `generarPdf.js` no puede cargarse en este Node) — la verificación se hizo llamando directo a `loteService.firmarDocumentoRecienCreado` con los mismos datos/orden que ahora arma `facturaService.emitirFactura`, que es el 100% del código nuevo de esta fase (el resto de `emitirFactura` — cálculo de totales, creación de `Cliente`/`ClienteEmpresa`, generación de PDF — no cambió en esta sesión). |

**Qué falta para poder avanzar al piloto de producción (ver "Actualización de estrategia de validación final")**: certificado P12 real de la SET registrado vía `certificadoService.crearCertificado` + datos fiscales completos de la empresa piloto (`tipo_contribuyente`/`tipo_impuesto`/actividad económica/`csc`/`csc_id`, hoy nullable — ver desvío #3) + `SIFEN_ENV=prod`. Con eso, `emitirFactura`/`emitirNotaDeCredito` ya emiten por el pipeline nativo de punta a punta (nada más de código pendiente en Fase 5). Pendiente menor, no bloqueante: canal de notificación de `alertaCertificadosPorVencer` sigue en `console.warn` (no conectado a `correoService.js`, ver tabla de Fase 4).

### Fase 2 — CDC + XML + firma + QR (sin envío): COMPLETA

| Ítem | Estado | Detalle |
|---|---|---|
| `utils/sifen/cdc.js` | ✅ Hecho | Cálculo y construcción del CDC (44 chars) y dígito verificador Módulo 11 SET/DGII (pesos cíclicos 2..11 de derecha a izquierda, `resto>1 ? 11-resto : 0`, ver §1.3). Expone `construirCdc(datos)`, `calcularDigitoVerificador(cuerpo)` y `validarCdc(cdc)` — pensado como red de verificación sobre el CDC que `xmlgen` ya calcula internamente, no como reemplazo. Autocontenido (solo depende de `utils/error.js`), verificado manualmente con un CDC de muestra (construcción, validación de DV correcto/alterado, y rechazo con `ErrorApp` de un campo que excede su longitud — probado `numero` a 8 dígitos). Sin test runner instalado en el repo (`package.json` no tiene Jest/Mocha) — verificación hecha con scripts ad-hoc, no hay suite unitaria persistida. **Nota de diseño a tener presente en `xmlBuilderService`**: `formatearFechaEmision` usa getters locales de `Date` (`getFullYear`/`getMonth`/`getDate`), no UTC — quien llame a `construirCdc` debe pasar un `Date` cuyos campos locales ya reflejen el día calendario real de emisión en Paraguay (un `new Date('YYYY-MM-DD')` se interpreta como medianoche UTC y puede correrse un día según el timezone del servidor). |
| `services/sifen/firmadorService.js` | ✅ Hecho | Wrapea `facturacionelectronicapy-xmlsign`: `firmarXmlDocumento` (nodo `DE`), `firmarXmlEvento` (nodo `rEve`), `obtenerVencimientoCertificado` (para el cron `alertaCertificadosPorVencer` de §3.4). Aplica la decisión de diseño ya tomada en el spike #2 (Fase 0): las 3 funciones llaman a la lib con el flag `signByNodeJS`/`useNodeJS` fijo en `true` (constante `FIRMAR_CON_NODEJS`, documentada inline con la razón — vía Java vulnerable a inyección de comandos vía la contraseña del P12, además de requerir JDK en el servidor). Certificado (path + password ya descifrada) recibido explícito por parámetro en cada llamada, sin estado global (antipatrón G). Errores normalizados con `ErrorApp.handleServiceError`, siguiendo la convención del resto de servicios. Verificado que carga sin error y expone las 3 funciones (`require()` manual); **no probado contra un P12 real** — eso depende del certificado de prueba de la SET (mismo bloqueo que el spike #3). |
| `services/sifen/xmlBuilderService.js` | ✅ Hecho | Mapea `Factura`/`NotaCredito` (con relaciones ya cargadas por el caller) al payload de `xmlgen.generateXMLDE`, y devuelve el XML del DE sin firmar (string). Separación `params`/`data` confirmada leyendo `jsonDeMain.service.js`/`jsonDeMainValidate.service.js`: `params` es 100% datos de la empresa emisora (RUC+DV como `"NNNNNNNN-D"`, razón social, timbrado+fecha, régimen, `establecimientos[]` con dirección/depto/distrito/ciudad, actividades económicas) y no varía entre documentos; `data` es 100% del documento puntual (tipo, fecha, receptor, items, condición de pago, CDC). `tipo_contribuyente`→`params.tipoContribuyente` (FISICA=1/JURIDICA=2) y `tipo_impuesto`→`data.tipoImpuesto` (IVA=1/ISC=2/RENTA=3/NINGUNO=4/IVA_RENTA=5) mapean 1:1 al orden de `constants.service.js#tiposImpuestos`, confirmado por lectura de código, no asumido. `SituacionTributaria.NO_DOMICILIADO`→`tipoOperacion=4 (B2F)` con `cliente.pais`/`direccion`/`numeroCasa`, igual que hacía la API PHP legacy pero sin el antipatrón T. **Escape de XML**: confirmado por prueba ad-hoc que `xmlgen` arma el XML con `xml2js.Builder` (`jsonDeMain.service.js:142-149`), que escapa `&`/`<`/`>` automáticamente en nodos de texto — no hace falta (ni se debe) escapar a mano; se verificó round-trip completo (texto con `&`, `<`, `>`, comillas → XML con entities → re-parseado con `xml2js.Parser` → texto original intacto). Además `xmlgen` **rechaza** (con su propia validación) cualquier descripción de ítem que contenga un patrón `<...>` tipo tag, aunque esté bien formado — restricción propia de la lib, no nuestra. **RUC/DV nullable de `Empresa`** (desvío #3): resuelto sin depender de `ruc_sin_dv`/`digito_verificador` — `xmlgen` internamente solo necesita `params.ruc` en formato `"NNNNNNNN-D"` (ya el formato de `Empresa.ruc` hoy, confirmado en `facturaService.js` que usa `usuario.empresa.ruc` tal cual) y él mismo hace el `split('-')`; `utils/sifen/cdc.js` se usa acá solo como red de verificación del CDC ya calculado por el caller (`validarCdc`), no para separar RUC/DV. Los códigos de `Establecimiento` (`cod_departamento`/`cod_distrito`/`cod_ciudad`, `String` en el schema) deben convertirse a `Number` antes de pasarlos en `params.establecimientos[]` — `xmlgen` los compara con `===` estricto contra su catálogo interno (a diferencia de `data.cliente.*`, donde sí coacciona con `+`); detectado en la verificación ad-hoc (fallaba con `Cannot read properties of undefined`). `NotaCredito` usa `documentoAsociado: { formato: 1, cdc: factura.cdc }` (no `cdcAsociado` como el payload viejo de la API PHP — nombre de campo distinto, confirmado en `jsonDteIdentificacionDocumento.service.js`). Verificado sin test runner (mismo patrón que `cdc.js`/`firmadorService.js`): script ad-hoc temporal (borrado al terminar) que construye `Factura`/`NotaCredito`/`Empresa`/`Cliente` sintéticos (caso contado+contribuyente, caso crédito+`NO_DOMICILIADO`, caso Nota de Crédito con `documentoAsociado`, todos con texto libre con `&`/`<`/`>`/comillas en la descripción), llama a `construirXmlFactura`/`construirXmlNotaCredito`, parsea el XML resultante con `xml2js.Parser` y confirma nodo `DE` con CDC/receptor/items correctos; también se probó el camino de error (CDC con dígito verificador inválido rechazado antes de llamar a `xmlgen`). |
| `services/sifen/qrService.js` | ✅ Hecho | Wrapea `qrgen.generateQR(xmlFirmado, idCSC, csc, env)`. Expone una sola función, `generarQr({ xmlFirmado, idCSC, csc })`, que lee `SIFEN_ENV` de `process.env` (mismo patrón previsto para `sifenClientService` en Fase 3 — el único otro módulo que habla con un endpoint de SIFEN dependiente de ambiente). **Confirmado por lectura de código (`QRGen.js` transpilado) y verificación ad-hoc que la lib reemplaza por completo el string-splicing frágil de la API PHP legacy** (§1.8): parsea el XML firmado con `xml2js`, arma el `preLinkQR` (CDC/fecha/receptor/totales/cantidad de ítems/`DigestValue` de la firma/`IdCSC`), calcula `cHashQR` (confirmado: SHA-256 plano de `preLink + CSC` vía `crypto-js/sha256` — el nombre "HMAC-SHA256" del manual de SIFEN es engañoso, no hay `hash_hmac` real, tal como anticipaba el plan) y reserializa el XML completo con `xml2js.Builder`, agregando el nodo `rDE > gCamFuFD > dCarQR`. **Exige que el XML ya tenga el nodo `Signature`** (lanza `"XML debe estar firmado digitalmente"` si no lo encuentra) — o sea, el orden real del pipeline es `xmlBuilderService` → `firmadorService` → `qrService`, no al revés. Como `generateQR` solo devuelve el XML completo (no el link QR por separado, que hoy alimenta `linkqr` en BD y el KUDE como URL plana — ver `generarPdf.js`/`facturaService.js:213-214`), `generarQr` reparsea el resultado con `xml2js.parseStringPromise` y extrae `rDE.gCamFuFD[0].dCarQR[0]` — confirmado con un script ad-hoc que ese nodo queda como string plano (sin wrapper `{ _ }`) al reparsear, así que no hace falta lógica adicional de desempaquetado. Devuelve `{ xmlConQr, linkQr }`. Guard de negocio: lanza `ErrorApp` 400 si `Empresa.csc`/`csc_id` no están cargados (ambos nullable en el schema, ver desvío #3) antes de llamar a la lib. Verificado sin test runner (mismo patrón que el resto de Fase 2): casos ad-hoc de éxito (link + XML con `dCarQR`), falta de CSC/CSC ID, y XML sin firmar — los 3 se comportan como se esperaba.

Fase 2 completa, **incluyendo validación XSD end-to-end** (ver debajo). Fases 3 a 6: no arrancadas.

### Validación end-to-end de Fase 2 contra el XSD oficial de SIFEN — ✅ Hecho (2026-07-10)

Cierra el criterio de aceptación de Fase 2 (§4.1) que quedaba pendiente: se encadenó `xmlBuilderService` → `firmadorService` → `qrService` con datos sintéticos (Factura contado/contribuyente, Factura crédito/`NO_DOMICILIADO`, Nota de Crédito vinculada — los 3 con texto libre `&`/`<`/`>`/comillas) y se validó el XML final contra el **XSD oficial real** `siRecepDE_v150.xsd` (descargado de `https://ekuatia.set.gov.py/sifen/xsd/`, con sus includes — `DE_v150.xsd`, `DE_Types_v150.xsd`, `Departamentos_v141.xsd`, `Monedas_v150.xsd`, `Paises_v100.xsd`, `Unidades_Medida_v141.xsd`, `xmldsig-core-schema.xsd` — resueltos localmente para no depender de red durante la validación), usando `javax.xml.validation` (JDK 8, ya presente en el servidor para JasperReports — sin instalar nada nuevo). Certificado: P12 autofirmado generado ad-hoc con `openssl` (no es el certificado real de la SET — spike #3 sigue bloqueado igual, esto solo prueba la mecánica de firma en código).

**2 bugs reales encontrados y corregidos como consecuencia de la validación XSD real** (no aparecían en las verificaciones ad-hoc previas de Fase 2, que no validaban contra el XSD real):

1. **Bug confirmado en `facturacionelectronicapy-xmlgen`** (`jsonDeMain.service.js`): `if (typeof params['tipoRegimen'] != undefined)` compara contra el valor `undefined`, no contra el string `"undefined"` — `typeof` siempre devuelve un string, así que la condición es **siempre `true`** y el tag `cTipReg` se emite aunque `tipoRegimen` no se pase, quedando `<cTipReg/>` vacío. El XSD (`tcTipReg`) exige un dígito `[1-8]` si el tag está presente. Como `Empresa` no tiene hoy un campo `tipo_regimen` (regímenes especiales: turismo, importador, exportador, maquila, Ley 60/90, etc. — no aplica a la generalidad de las empresas), no hay de dónde tomar un valor real. **Workaround aplicado en `xmlBuilderService.js`** (`repararCTipRegVacio`): se remueve el tag vacío del XML después de generarlo, ya documentado inline con la causa raíz. Si se agrega `Empresa.tipo_regimen` en el futuro, pasar `params.tipoRegimen` real en vez de confiar en este parche.
2. **Gap en `xmlBuilderService.js` (nuestro, no de la lib)**: `dEmailE` (email del emisor) es **obligatorio** en el XSD (`tgEmis`, sin `minOccurs="0"`), pero `xmlgen` solo lo emite si recibe `params.establecimientos[i].email` — sin validación propia que lo exija, omite el tag en silencio si falta. `construirParamsEmpresa` no lo estaba mapeando. **Corregido**: cada establecimiento ahora incluye `email: empresa.email` (el campo vive a nivel `Empresa`, obligatorio y no nullable en el schema — `Establecimiento` no tiene email propio).

Los 3 XML finales (con `DE` + `Signature` + `gCamFuFD`, orden correcto) validan limpio contra `siRecepDE_v150.xsd` tras estas 2 correcciones. Script ad-hoc y XSDs descargados no persistidos en el repo (mismo patrón que el resto de Fase 2 — sin test runner instalado).

### Desvíos respecto del texto original del plan (documentados con motivo — no revertir sin razón nueva)

1. **`sifen_estado` de `Factura`/`NotaCredito` NO se convirtió a enum**, a diferencia de lo que decía el §2.2 original ("`sifen_estado String?` → `EstadoSifen?`"). Motivo: `checkFacturaStatus` (`facturaService.js`) sigue escribiendo texto libre ahí mientras la API PHP siga viva, y convertir el tipo ahora rompería ese flujo antes del corte — el propio criterio de aceptación de la Fase 1 en §4.1 exige "endpoints existentes sin cambios de comportamiento". En su lugar se aplicó el mismo patrón dual que el plan ya preveía para `xml`/`xml_firmado`: `sifen_estado` (String, legacy) queda intacto y congelado; se agregó un campo **nuevo** `estado_sifen` (enum `EstadoSifen`, nullable) que va a usar el pipeline nativo desde la Fase 2 en adelante. En el corte (Fase 5) `estado_sifen` pasa a ser el campo real, y `sifen_estado` se dropea en el apagado (Fase 6), igual que `xml`.
2. **`Certificado.fecha_carga` no existe como campo separado** — se usa `fecha_creacion` (convención ya establecida en todos los demás modelos del schema: `fecha_creacion`/`fecha_modificacion`). Mismo dato, mismo nombre que el resto del schema.
3. **Los campos fiscales nuevos de `Empresa`** (`csc`, `csc_id`, `tipo_contribuyente`, `tipo_impuesto`, actividad económica, etc.) **son `nullable`**, aunque el texto original los describía sin `?`. Motivo: son columnas nuevas sobre una tabla con filas existentes en producción — Prisma/MySQL no permite agregar `NOT NULL` sin default a una tabla con datos, y no hay de dónde backfillear estos valores automáticamente. Quedan nullable hasta cargar el dato real por empresa (a mano o vía script, antes del corte).
4. **`Cliente` no distingue Física/Jurídica** (sin campo `tipo_contribuyente` en el schema), pero `xmlgen` exige `data.cliente.tipoContribuyente` (1/2) para todo receptor contribuyente. `xmlBuilderService.js` asume Jurídica (2) por defecto para estos casos — perfil típico de facturación B2B con RUC — documentado inline como gap, no como bug. Si se necesita precisión real, agregar `Cliente.tipo_contribuyente` en una migración aditiva futura. En la misma línea, ni `Factura` ni `NotaCredito` registran datos reales de plazo/cuotas de crédito (sin `fecha_vencimiento` ni tabla de cuotas) ni `NotaCredito` registra un motivo de emisión propio — `xmlBuilderService.js` usa defaults documentados (`condicion.credito.tipo=1` "Plazo" fijo en 30 días; `notaCreditoDebito.motivo=1` "Devolución y Ajuste de precios") en vez de inventar datos que no existen. Ninguno de estos gaps bloquea la generación de XML válido, pero son candidatos a ampliar el schema si se necesita mayor precisión antes del corte a producción.

### Hallazgo de seguridad al instalar las libs (no estaba en el plan original — insumo directo para el spike #2)

`npm audit` sobre las 4 libs recién instaladas encontró vulnerabilidades reales en dependencias transitivas ancladas a versiones viejas:

- **`xmldom` (crítica, sin fix disponible bajo ese nombre)** — dependencia de `facturacionelectronicapy-xmlsign`. El paquete está abandonado (última versión publicada: 0.6.0, ya instalada; no existe versión que resuelva el advisory bajo el nombre `xmldom` — la comunidad migró a `@xmldom/xmldom`, pero `xmlsign` hace `require('xmldom')` a mano, no es algo que se arregle con un bump de versión ni con `overrides`).
- **`node-forge` (alta)** — `facturacionelectronicapy-setapi` trae anclado `node-forge@0.10.0`, con fallas de verificación de firma criptográfica ya parcheadas en versiones posteriores (`xmlsign`, en cambio, usa `node-forge@1.4.0`, ya fuera del rango vulnerable `<=1.3.3`).
- **`xml2js` (moderada, prototype pollution) — YA RESUELTO**: se agregó `"overrides": { "xml2js": "^0.6.2" }` en `package.json`. Confirmado que las 4 libs resuelven a esa versión (`npm ls xml2js`) y siguen cargando sin error.
- **Resuelto (era "pendiente de investigar en el spike #2")**: el `DeprecationWarning DEP0190` de `child_process` al hacer `require()` de las libs viene de `find-java-home` (dependencia transitiva de `xmlsign`, usada por su vía de firma Java). El propio módulo ejecuta `findJavaHome.promise = findJavaHomePromise();` **a nivel de módulo** (`node_modules/facturacionelectronicapy-xmlsign/node_modules/find-java-home/dist/index.js`) — o sea, corre apenas se hace `require()`, sin que nadie lo invoque. En Windows esto dispara una consulta al registro vía el paquete `winreg`, que internamente hace `child_process.exec('reg query ...')` — de ahí el warning. Es una consulta de solo lectura con un comando fijo (no hay interpolación de datos externos ahí), así que no es un riesgo de seguridad en sí mismo — es ruido de una detección de JDK que ni vamos a usar (ver decisión de diseño abajo). No se puede evitar (pasa al importar el módulo, no al invocar una función), pero es inofensivo.

**No se tocó `xmldom` ni `node-forge`**: no hay arreglo directo sin arriesgar romper cómo firma `xmlsign`, pero con el spike #2 resuelto (abajo) ya no hace falta evaluar si se descarta la lib — sí sirve, incluido el caso de eventos.

### Resultados de los spikes de Fase 0 (§4.0) — spikes #1 y #2

> Ambos resueltos leyendo el código fuente transpilado en `node_modules/` (JS, no minificado) — no hicieron falta credenciales ni red. El spike #3 (round-trip real) no es resoluble así: queda pendiente, ver abajo.

**Spike #1 — ¿`setapi.recibeLote` arma el envoltorio `<rLoteDE>` + zip internamente, o solo transporta?**

**Arma todo internamente.** (`node_modules/facturacionelectronicapy-setapi/dist/SET.js:688-786`, método `recibeLote(id, xmls, env, certificado, passphase, config)`):
- Valida `xmls.length` (0 < n ≤ 50 — el límite real de SIFEN, mismo que ya asumía el plan).
- Concatena los XML firmados dentro de `<rLoteDE>...</rLoteDE>`, arma el ZIP en memoria con `jszip` (no toca filesystem salvo que se pase `config.saveRequestFile` explícito), lo codifica en base64 y arma el sobre SOAP completo (`rEnvioLote`) él mismo.
- Carga el P12 (`this.abrir(certificado, passphase)`) y hace el POST con mTLS (`https.Agent({cert, key})`) usando el cert/key ya extraídos del P12 — no hace falta que nosotros parseemos el P12 para esta llamada.
- El endpoint SOAP se resuelve por el parámetro `env` (`"test"` → `sifen-test.set.gov.py`, cualquier otro valor → producción) — confirma que `SIFEN_ENV` como variable de entorno alcanza para todo, no hace falta lógica propia de ambiente.
- **Conclusión para `loteService`**: no hay que armar el `<rLoteDE>` ni el ZIP a mano — el servicio nuestro solo necesita juntar los XML ya firmados de un lote (mismo RUC + tipo de documento, máx. 50) y llamar `recibeLote` con el array. Reduce bastante el alcance de `loteService` respecto de lo que se preveía en §3.1 ("Solo si la lib no arma el envoltorio de lote internamente" — ya no aplica).
- Nota menor de robustez de la lib (no nuestra, no se corrige): dentro del `Promise` executor, los `reject(...)` de validación (longitud 0 o >50) no cortan la ejecución con `return` — el código sigue corriendo después. En la práctica no debería importar (las promesas ya rechazadas ignoran un resolve posterior), pero como buena práctica **`loteService` debe validar el tamaño del lote (1-50) del lado nuestro antes de llamar `recibeLote`**, no confiar en que la lib corte ahí.

**Spike #2 — ¿`xmlsign` firma el nodo `rEve` de eventos, o solo `DE`?**

**Sí lo cubre, con un método dedicado — no hace falta fallback propio (`xml-crypto`/`node-forge` a mano).**

- La lib expone `signXMLEvento(xml, file, password, signByNodeJS)` (`node_modules/facturacionelectronicapy-xmlsign/dist/index.js:26-33`), que internamente llama `XMLDsigNode.signEvento(xml, "rEve", file, password)` (vía Node puro) o `XMLDsigJava.signEvento(...)` (vía Java, ver más abajo) según el flag `signByNodeJS`.
- La implementación Node (`XMLDsigNode.signEvento`, `dist/XMLDsigNode.js:134-192`) localiza el nodo a firmar navegando una ruta fija muy específica dentro del XML parseado: `env:Envelope → env:Body → rEnviEventoDe → dEvReg → gGroupGesEve → rGesEve → rEve`, lee su atributo `Id`, y firma con XML-DSig enveloped (RSA-SHA256, C14N exclusivo — mismo esquema que para `DE`), insertando el nodo `<Signature>` **después** de `rEve` (`location: {reference: ..., action: "after"}`).
- **Verificado que `xmlgen` genera exactamente esa estructura**: `generateXMLEventoCancelacion` (y el resto de los generadores de evento) arma el XML con `envelopeEvent()` (`node_modules/facturacionelectronicapy-xmlgen/dist/services/jsonEventoMain.service.js:159-169`), que produce literalmente `env:Envelope > env:Body > rEnviEventoDe > dEvReg > (el XML del evento, con gGroupGesEve > rGesEve > rEve adentro, armado en `jsonEventoMain.service.js:185-192`)`. Las dos libs son **wire-compatible sin adaptación**: el output de `xmlgen` se puede pasar tal cual a `xmlsign.signXMLEvento`.
- Detalle menor a tener presente (no bloqueante): el atributo `Id` del nodo `rEve` lo hardcodea la propia `xmlgen` a `1` (`jsonEventoMain.service.js:192`, `this.json['gGroupGesEve']['rGesEve']['rEve']['$']['Id'] = 1`). Es el mismo patrón que la Lista negra de antipatrones señaló como bug en v1 (`rEve Id="43"` fijo) — pero acá corresponde confirmar contra el Manual Técnico de SIFEN si ese `Id` tiene relevancia de negocio o es solo un identificador local de referencia para la firma (que es su único uso real en XML-DSig, similar a un anchor). Si el manual no exige que sea único/significativo entre eventos, un valor constante no es un bug real — a diferencia del caso v1 donde si podía haber colisión entre eventos reales de distinto tipo. Confirmar en la Fase 2 al mapear el payload, no bloquea el spike.

**Hallazgo de seguridad nuevo (no estaba en el plan original) — vía de firma Java de `xmlsign` tiene riesgo de inyección de comandos:**

`xmlsign` tiene **dos implementaciones intercambiables** por el parámetro `signByNodeJS` en cada método (`signXML`, `signXMLFiles`, `signXMLEvento`, `signXMLRecibo`, `getExpiration`):
- `signByNodeJS = true` → `XMLDsigNode` (`dist/XMLDsigNode.js`): Node puro, usa `xml-crypto` + `node-forge` para parsear el P12 y firmar en memoria. **Sin `child_process`, sin dependencia de Java.**
- `signByNodeJS` falsy (incluido *omitido*, que es el default si no se pasa el 4º argumento) → `XMLDsigJava` (`dist/XMLDsigJava.js`): escribe el XML a un archivo temporal en `node_modules/.../dist/xml_sign_temp_*.xml` (de ahí los archivos temporales ya vistos al instalar) y ejecuta un `.jar` propio vía `child_process.exec()` con un comando armado por **interpolación de string sin escapar** (`dist/XMLDsigJava.js:49`: `` `"${java8Path}" -Dfile.encoding=IBM850 -classpath "${classPath}" SignXML "${tmpXMLToSign}" "${file}" "${passphase}" "${tag}"` ``) — solo escapa `$` en Linux (línea 47), nada más, y nada en Windows. **La contraseña del P12 (`passphase`) viaja sin escapar dentro de un comando de shell** — si contuviera comillas dobles, backticks o `;`, es una inyección de comandos clásica. Además requiere JDK/JRE 8 instalado en el servidor (`find-java-home`), una dependencia operativa que no queremos.
- **Decisión de diseño, para `firmadorService` (Fase 2)**: llamar **siempre** con `signByNodeJS = true` en todos los métodos de `xmlsign` (`signXML`, `signXMLEvento`, `getExpiration`) — nunca omitir el parámetro ni pasar `false`/`undefined`. Elimina el riesgo de inyección, elimina la dependencia de Java en el servidor, y de paso evita depender de archivos temporales en disco (alineado con la Decisión cerrada "la BD es la fuente de verdad", antipatrón F). Documentar esto como constante/comentario en `firmadorService.js` cuando se escriba, dado que omitir el flag por descuido activaría silenciosamente la vía insegura.

### Spike #3 — DESCARTADO (2026-07-10, sesión 3): no se usa ambiente de test de SIFEN

No resoluble por lectura de código: hacía falta un **RUC y certificado P12 de prueba emitidos por la SET** (mencionados en §4.3 "Plan de pruebas") para poder hacer un envío real contra `sifen-test.set.gov.py` y validar la cadena completa (`xmlgen` → `xmlsign` → `setapi.recibeLote`/`consultaLote`).

**Decisión explícita del usuario: no se va a gestionar esa credencial ni a usar el ambiente de test en ningún momento.** La validación real contra SIFEN ocurre directamente en el piloto de producción (certificado real, montos bajos — ver "Actualización de estrategia de validación final"). No quedan pendientes de este spike ni env vars asociadas.

### Próximo paso sugerido

Fases 2, 3 y 4 100% completas (ver arriba). **Fase 5 — wiring de corte también completo** (2026-07-11, sesión 4, decisión explícita del usuario de avanzar con el corte): `facturaService.js`/`notaDeCreditoService.js` ya no llaman a la API PHP legacy — emiten a través de `loteService.firmarDocumentoRecienCreado` (dentro de la misma transacción que crea el documento) y `eventoService.cancelarFactura`/`cancelarNotaCredito`, seteando `estado_sifen = 'GENERADO'` al crear cada documento. Los jobs de `cronJobs.js` (Fase 4) ya tienen de dónde tomar trabajo real desde el próximo documento que se emita. Ver tabla de Fase 5 arriba para el detalle completo, incluyendo la verificación ad-hoc (camino feliz + rollback atómico) contra la BD MySQL local real y la red real a `sifen-test.set.gov.py`.

**Decisión explícita del usuario (2026-07-10, sesión 3): no se va a usar el ambiente de test de SIFEN en ningún momento.** Se descarta por completo el spike #3 tal como estaba planteado (RUC/certificado P12 de prueba de la SET, round-trip contra `sifen-test.set.gov.py`) — no se van a pedir ni gestionar credenciales de test. La validación real de `respuestaSoap.js`/`codigosRespuesta.js` contra una respuesta real de SIFEN ocurre **directamente en el piloto de producción** (certificado real, montos bajos — ver "Actualización de estrategia de validación final" más arriba, que ya preveía esto como la vía principal). Se revirtieron los env vars `SIFEN_TEST_RUC`/`SIFEN_TEST_CERT_PATH`/`SIFEN_TEST_CERT_PASSWORD` agregados en la sesión anterior para ese fin — no van más, ni ese ni ningún otro flujo pensado para el ambiente `test`.

**Lo que falta para poder arrancar el piloto de producción** (ya no queda código de Fase 5 pendiente, solo trabajo operativo/de datos):
1. **Certificado real de producción + datos fiscales de la empresa piloto**: registrar el P12 real (no de test) vía `certificadoService.crearCertificado`, y completar `Empresa.tipo_contribuyente`/`tipo_impuesto`/`cod_actividad_principal`/`csc`/`csc_id` (hoy nullable, ver desvío #3) para la empresa que arranque el piloto — `xmlBuilderService`/`qrService` rechazan con `ErrorApp` 400 si faltan, así que esto es un prerrequisito duro, no opcional.
2. **`SIFEN_ENV=prod`** antes de que la empresa piloto empiece a emitir de verdad (hoy el `.env` de este entorno de desarrollo está en `test`, correcto para no pegarle a producción por accidente mientras se sigue iterando).
3. **Canal de notificación de `alertaCertificadosPorVencer`** todavía no está conectado a `correoService.js` (por ahora solo `console.warn`) — menor, no bloquea el piloto si se monitorea el log del servidor mientras tanto.
4. **Borrar `src/db/dbApiFacturacion.js`** (código muerto desde este corte, ver tabla de Fase 5) y la dependencia `pg` de `package.json` si no se usa para nada más — quedó pendiente porque el sandbox de esta sesión bloqueó el borrado de un archivo preexistente sin pedido explícito.
5. Una vez arrancado el piloto: iterar bugs reales sobre la marcha (rechazos de SIFEN, mapeos, casos borde) hasta cerrar el criterio de salida ya documentado en "Actualización de estrategia de validación final" arriba.

---

## ⚠️ Hallazgo previo importante: factyble-api tiene DOS implementaciones

`factyble-api` no es un único código legacy — son dos:

| | `v1/` | `src/` |
|---|---|---|
| Estado | **Live en producción.** factyble-back llama `POST {URL_API_FACT}/data.php` y `/eventos.php` directamente (ver §1.1), y el server sirve `firmados/{cdc}.xml` estático. | Rewrite MVC (Flight PHP 8.2, `DocumentoElectronicoService`, `XmlBuilder`, `XmlSigner`, `SifenClientService`, etc.), con schema Postgres nuevo (`src/db/schema.sql`) documentado en `factyble-api/CLAUDE.md`. |
| Git | `git log -- v1/` → 1 commit ("carpeta temporal v1", el código original movido ahí). | `git log -- src/` → 2 commits ("ajustes ia", "feat: avances"). |
| Wiring | Servido directo por el webserver (no pasa por `index.php`). | `index.php` monta Flight y **solo** enruta `src/routes/api.php` — `v1/*.php` no está conectado a este bootstrap. |
| Cobertura | FE, NC, ND, autofactura, remisión (tipo_doc 1,4,5,6,7). Eventos 1 (inactivación), 2 (cancelación), 3 (nominación). | Solo FE y NC (tipo_doc 1,5) — `Validador.php:56-57` rechaza el resto. Solo evento 2 (cancelación). Sin fase "enviarDatos" (sync de XML). |

**Conclusión operativa:** `v1/` es la fuente de verdad del comportamiento real que hay que reemplazar (incluye todos los antipatrones documentados abajo). `src/` es un rewrite parcial, nunca desplegado, que **corrige dos problemas reales de v1** (SQL injection, falta de transacción lote↔documento) pero introduce los suyos propios (ver §2.2) — se usa aquí solo como referencia de diseño, nunca como oráculo de "cómo debe comportarse el sistema hoy".

Esto no cambia el objetivo del plan, pero sí evita una trampa: no migrar `src/` pensando que es "la versión buena ya lista" — está a mitad de camino y con huecos serios.

---

## Decisiones cerradas (resumen, ver detalle en cada fase)

| Tema | Decisión |
|---|---|
| Motor de BD | **MySQL**, definitivo — no hay migración de motor. Columnas de XML/payloads SOAP usan `@db.MediumText` (MySQL `TEXT` topea en 64 KB; un sobre SOAP de lote de 50 documentos lo supera). |
| Fuente de verdad del XML firmado | **La base de datos**, no el filesystem — columna nueva `xml_firmado`, nunca se repropósita la columna `xml` legacy. |
| Camino de emisión (FE/NC) | **Solo por lote** (`loteService`), incluso para lotes de 1 documento — se elimina la vía síncrona (`setapi.recibe`) como camino de emisión. |
| Estrategia de rollout | **Corte único**, sin flag de convivencia por empresa — se elimina `Empresa.motor_facturacion` y la bifurcación `LEGADO_PHP`/`NATIVO`. |
| Alcance de documentos | FE + Nota de Crédito. Autofactura/ND/Remisión quedan fuera (ampliación futura, aditiva). |
| Alcance de eventos | Solo Cancelación. El enum `TipoEventoSifen` sí cubre el universo completo para no migrarlo después. |
| Certificados P12 | Filesystem + contraseña cifrada a nivel aplicación (secreto de cifrado en variable de entorno). |
| **Estrategia de validación final (actualizado 2026-07-10)** | **Piloto real en producción con montos pequeños**, no una suite exhaustiva en ambiente de test de SIFEN como única red de seguridad — ver "Actualización de estrategia de validación final" más abajo (reemplaza el supuesto de §4.3 "no hay piloto en producción"). |

---

## Fase 1 — Inventario de la API PHP

### 1.1 Quién consume qué, desde factyble-back

| Integración | Archivo:línea en factyble-back | Qué hace |
|---|---|---|
| `POST {URL_API_FACT}/data.php` | `src/services/facturaService.js:426-433` (`apiFacturacionElectronica`) | Registra y firma una Factura. Devuelve `{status, cdc, link (QR), xmlLink}`. |
| `POST {URL_API_FACT}/data.php` | `src/services/notaDeCreditoService.js:349-356` (`apiFacturacionElectronicaNotaDeCredito`) | Igual, para Nota de Crédito (`tipoDocumento: 5`, con `documentoAsociado.cdcAsociado`). |
| `POST {URL_API_FACT}/eventos.php` | `src/services/facturaService.js:848-855` (`apiFacturacionElectronicaCancelar`) | Evento cancelación (`tipoEvento: 2`) de Factura. |
| `POST {URL_API_FACT}/eventos.php` | `src/services/notaDeCreditoService.js:552-559` | Igual para Nota de Crédito. |
| Conexión directa PostgreSQL a la BD de factyble-api | `src/db/dbApiFacturacion.js` + `src/services/facturaService.js:573-729` (`checkFacturaStatus`) | `SELECT * FROM datos_factura2 WHERE cdc IN (...)` cada 10 min (cron en `src/services/cronJobs.js:6-8`) para sincronizar `sifen_estado`. **Antipatrón #1 a eliminar** (ver Fase 3/instrucciones). |
| `GET http://{HOST_API_FACT}/factyble-api/firmados/{cdc}.xml` | `src/services/correoService.js:16,95,144(aprox),182(aprox)` | Descarga el XML firmado para adjuntarlo al mail de factura/NC (éxito y error). |

Alcance real de factyble-back hoy: **solo Factura (FE) y Nota de Crédito (NC)**. No emite autofactura, ND ni remisión — aunque `v1` sí las soporta. Esto acota el alcance de la migración, y queda cerrado así (ver "Decisiones cerradas" al inicio) — ampliarlo es una decisión futura, aditiva.

### 1.2 Generación de XML por tipo de documento

- **FE / NC**: `v1/generarXml.php`, plantilla v1.5 (`dVerFor=150`), namespace ekuatia. Construye grupos `gDatGralOpe`, `gEmis`, `gDatRec`, `gDtipDE`, `gTotSub` etc. a partir del JSON recibido. Incluye un bloque **hardcodeado** de procesador de tarjeta (`&lt;dRSProTar&gt;BANCARD SA&lt;/dRSProTar&gt;&lt;dRUCProTar&gt;80013884&lt;/dRUCProTar&gt;`, `generarXml.php:126-128`) que asume que todo comercio usa el mismo procesador — no aplica al flujo actual de factyble-back (paga en efectivo/crédito, no tarjeta), pero es una bandera roja si algún día se soporta pago con tarjeta.
- **Autofactura, ND, Remisión**: soportadas en `v1/validacionesCampos.php:54-80` (remisión trae campos de transporte/salida) y en el `tipo_doc` de `v1/data.php`, pero **no implementadas en `src/`** ni consumidas por factyble-back. Fuera del alcance actual salvo decisión explícita.
- **CDC**: ver §1.3.
- No hay una librería central compartida entre `data.php` y `eventosGenerarXML.php` para separar RUC/DV — cada archivo repite `substr($ruc,0,strpos($ruc,'-'))` a mano (`validacionesRucReceptor.php:42-43`, `generarXml.php:354-355`, `eventosGenerarXML.php:115-116,144-145`).

### 1.3 Cálculo y validación del CDC

Algoritmo (`v1/data.php:183-186`, confirmado también en `src/utils/CdcHelper.php:57-79`), 44 caracteres:

```
'0' + tipoDocumento(2) + RUC_sin_DV(8) + DV_emisor(1) + establecimiento(3)
    + punto(3) + numero(7) + tipoContribuyente(1) + fechaEmision[Ymd](8)
    + tipoEmision(1) + codigoSeguridad(9) + dígito_verificador(1)
```

Dígito verificador: Módulo 11 estándar SET/DGII (`v1/functions.php:8-45`), pesos cíclicos 2..11 de derecha a izquierda, `resto>1 ? 11-resto : 0`. Confirmado correcto en ambas versiones.

**Detalle importante**: el `codigoSeguridad` (9 dígitos) que entra en el CDC lo genera **factyble-back**, no la API PHP (`facturaService.js:183-187`, `generarCodigoSeguridad()`), con un loop check-then-generate contra los códigos ya usados por esa caja. La API PHP solo lo recibe como dato de entrada. Esto simplifica la migración: el CDC ya se puede calcular 100% en Node sin tocar la lógica de generación del código de seguridad, que ya vive ahí.

### 1.4 Firma digital (XAdES/XML-DSig) y certificados

- Librería: `robrichards/xmlseclibs` (vendorizada, sin Composer) en ambas versiones. Firma **XML-DSig plano** (RSA-SHA256, enveloped, C14N exclusivo) sobre el nodo `&lt;DE&gt;` (o `&lt;rEve&gt;` para eventos) — no es XAdES completo (sin `xades:QualifyingProperties`), pero es lo que SIFEN exige para el DE.
- Certificado: P12 cargado vía `openssl_pkcs12_read($pkcs12, $certs, $p12Clave)`. **v1 nunca chequea el valor de retorno** (`v1/firmarXML.php:20-23`, `v1/eventosFirmarXML.php:20-23`) — password incorrecta o P12 corrupto sigue de largo con `$priv_key=null`. **Cero chequeo de vencimiento de certificado en todo el codebase** (v1 y v2 por igual, confirmado por ambos agentes) — la única señal de un certificado vencido es que SIFEN lo rechace en el envío. Esto es exactamente el mecanismo detrás del error **0142** que motivó este proyecto: no hay ningún chequeo proactivo, local, de vencimiento o de asociación certificado↔RUC antes de firmar/enviar. Búsqueda explícita de "0142" en todo `factyble-api`: **cero resultados** — no hay ni un manejo ad-hoc de ese código, se trata como rechazo genérico de texto libre.
- Contraseña del P12: **texto plano** en la tabla `empresas.p12FilePass` / `p12_clave` (confirmado en `src/db/schema.sql:57`).
- Rotación de certificados: manual, por sufijo de archivo (`firmas/80052922-7_old_2024.p12` junto a `firmas/80052922-7.p12`) — sin tabla de versionado/auditoría.
- v1 usa dos mecanismos distintos para cargar el certificado según el entrypoint: `setEmpresa()` que fija ~20 constantes globales PHP vía `define()` (`v1/functions.php:760-821`, solo funciona porque cada request PHP es un proceso nuevo) para `data.php`, vs. un array devuelto por `getEmpresa()` para `eventos.php`/`enviarLotes.php`/`consultarLotes.php` (que necesitan iterar N empresas en un mismo proceso). **Este patrón de estado global no es portable a Node** (un solo proceso Node atiende requests concurrentes de distintas empresas) — el diseño nuevo debe pasar el certificado explícitamente por parámetro en toda la cadena de llamadas, nunca como singleton/global mutable.

### 1.5 Envío a SIFEN

- **No es un cliente SOAP real** en ninguna versión: XML de sobre SOAP 1.2 armado a mano como string, enviado por `curl` con mTLS (`CURLOPT_SSLCERT` + `CURLOPT_SSLCERTTYPE=P12` + `CURLOPT_SSLCERTPASSWD`).
- Endpoints **hardcodeados a producción** en ambas versiones — no existe ninguna variable de ambiente para apuntar a homologación/test (confirmado: sin `SIFEN_ENV` ni similar en `.env`/`.env.example` de ninguna versión).
- WSDLs usados:
  - Envío de lotes: `https://sifen.set.gov.py/de/ws/async/recibe-lote.wsdl`
  - Consulta de lotes: `https://sifen.set.gov.py/de/ws/consultas/consulta-lote.wsdl`
  - Eventos: `https://sifen.set.gov.py/de/ws/eventos/evento.wsdl` (enviado **síncrono**, no por lote, directo desde `eventos.php`)
  - Consulta QR pública: `https://ekuatia.set.gov.py/consultas/qr?`
- `v1`: sin `CURLOPT_TIMEOUT`, sin chequeo de HTTP status code (solo `$response === false`), sin retry/backoff, sin idempotencia — el único "retry" es que el estado sigue en pendiente y el próximo cron (5 min) lo vuelve a tomar, sin límite de intentos.
- `src/SifenClientService.php` mejora el parseo (evita "doble parseo" documentado en el propio código, línea ~150) pero **hereda el hardcode de producción** y tampoco detecta un `&lt;Fault&gt;` SOAP explícitamente (busca únicamente los nodos de éxito esperados).

### 1.6 Consulta de estado de documentos y lotes

- `v1/consultarLotes.php`: polling por `lote_control` con heurística de texto libre `ILIKE '%procesamiento%'` para saber si un lote sigue en curso (`v1/functions.php:968`). Actualiza cada documento individual con `UPDATE ... WHERE sifen_estado != 'Aprobado' AND cdc = $5` (parametrizado, correcto).
- `src/LoteConsultaService.php` reproduce esto con una guarda de idempotencia explícita (`!= 'aprobado'`) y normaliza el estado SIFEN a un enum fijo, defaulteando a `pendiente` ante valores desconocidos — mejora real sobre v1.
- factyble-back hoy **no consulta a SIFEN**: consulta directo la BD Postgres de la API vía `dbApiFacturacion.js` (antipatrón a eliminar, ver instrucciones).

### 1.7 Eventos

| Tipo | Soportado en v1 | Soportado en src/ (v2) | Nota |
|---|---|---|---|
| 1 — Inactivación de rango de timbrado | Sí | **No** | Sin ruta/controlador/XML builder en `src/`. |
| 2 — Cancelación | Sí | Sí | Único evento usado hoy por factyble-back. |
| 3 — Nominación de receptor de tasa turística | Sí (con bug: motivo hardcodeado, ver Lista negra) | **No** | Sin implementación en `src/`. |

`v1` no valida que el documento esté en estado `Aprobado` antes de cancelar. factyble-back **sí** lo valida hoy del lado Node antes de llamar a `/eventos.php` (`notaDeCreditoService.js:69-71`, chequeo de `sifen_estado`) — buen patrón existente a preservar/generalizar en el diseño nuevo.

### 1.8 Generación de KUDE y QR

- **KUDE (PDF)**: ya se genera 100% en factyble-back con JasperReports vía el bridge `java` npm (`src/utils/generarPdf.js`, `src/resources/Factura.jrxml`/`.jasper`) — **no depende de la API PHP en absoluto**. No tocar esta parte salvo para alimentarla con el CDC/QR que generemos nosotros mismos en vez de recibirlos de la API PHP.
- **QR**: `v1/agregarLinkXML.php` + `v1/functions.php:540-560`.
  1. Arma un `preLinkQR` con CDC, fecha, receptor, totales, cantidad de ítems, `DigestValue` de la firma, `IdCSC`.
  2. `cHashQR = sha256(preLink + CSC)` — **ojo con el nombre**: tanto el código como la documentación del proyecto lo llaman "HMAC-SHA256", pero es un SHA-256 plano de la concatenación, **no** un HMAC real (`hash_hmac()` nunca se usa). Es así porque es lo que exige el manual de SIFEN, pero hay que replicarlo exacto (no "corregirlo" a un HMAC real) si se implementa a mano.
  3. Inyección del QR en el XML firmado por **string splicing** (`substr_replace` sobre la posición de `&lt;/Signature&gt;`, con un off-by-one deliberado que depende de que el tag no tenga prefijo de namespace) — fragilísimo, no replicar tal cual.

### 1.9 Crontabs / procesos programados existentes

`cron.sh` (raíz de factyble-api), cada 5 minutos:

```
enviarDatos.php  → sleep 3s → enviarLotes.php → sleep 5s → consultarLotes.php
```

- `enviarDatos.php`: descarga XML firmado desde `FIRMADOS_URL`, marca `enviado='Y'` — **no tiene equivalente en `src/`**, es la fase que sincroniza el XML firmado a un "sistema interno" (aparentemente el propio servidor de archivos). Con la absorción, esta fase desaparece por completo: no hay a dónde sincronizar, el XML vive en nuestra propia BD.
- `enviarLotes.php`: agrupa pendientes por RUC+tipo_doc (máx. 50 docs/lote, límite real de SIFEN), arma `&lt;rLoteDE&gt;`, zip, SOAP a `recibe-lote.wsdl`.
- `consultarLotes.php`: SOAP a `consulta-lote.wsdl`, actualiza estado por documento.

factyble-back hoy solo tiene un cron equivalente parcial: `checkFacturaStatus` cada 10 min (`src/services/cronJobs.js:6-8`), que en vez de hablar con SIFEN lee directo la BD de la API PHP (antipatrón).

---

## Lista negra de antipatrones (NO migrar tal cual)

### De `v1/` (comportamiento real en producción hoy)

| # | Qué hace mal | Por qué es grave | Cómo lo hacemos bien en factyble-back |
|---|---|---|---|
| A | **Autenticación del endpoint principal es un string hardcodeado**: `data.php:29` compara `$_POST['recordID'] !== '123'`. Cualquiera que lea este archivo (o lo intuya) puede llamar directo a `data.php`. | Endpoint de emisión fiscal sin auth real. | El endpoint desaparece — la emisión pasa a ser una función interna de factyble-back, protegida por el `authJwt` que ya existe. |
| B | **SQL injection por concatenación cruda**, no aislado: `data.php:220-221` (UPDATE/DELETE con `$data_json`/`$receiptid` sin escapar), 9 funciones en `functions.php` (líneas 171-270) para datos de establecimiento, y el caso más grave, `enviarLotes.php:190-198`, que inyecta **la respuesta cruda de SIFEN** (contenido de un tercero) en SQL sin escapar. | Vector de inyección explotable con datos de cliente o con una respuesta SIFEN adversarial/corrupta. | Prisma parametrizado en el 100% de las queries, sin excepción, sin SQL crudo con interpolación de strings. |
| C | **Fallos silenciosos**: `openssl_pkcs12_read()` sin chequear retorno (firma con P12 inválido sin error), múltiples `pg_query()` sin chequear `false` antes de `pg_fetch_array()`. | Un certificado con password mal cargado no produce error visible — recién falla (o peor, no falla) en el envío a SIFEN. | Todo call a DB/cripto/IO valida su resultado y propaga un error tipado (`ErrorApp` ya existe en el proyecto). |
| D | **Reglas de negocio y credenciales hardcodeadas en código**: lista de RUCs B2G duplicada en 2 archivos (`eventosGenerarXML.php:117`, `validacionesRucReceptor.php:36`), identidad de procesador de tarjeta fija para todos los comercios (`generarXml.php:126-128`), paths (`cron.sh:6-7`). | Cualquier cambio de estas reglas requiere tocar código PHP en 2+ lugares. | Config en variables de entorno o tabla, no en código; sin duplicación. |
| E | **Sin retry/timeout/idempotencia en las llamadas a SIFEN**: sin `CURLOPT_TIMEOUT`, sin backoff, sin límite de intentos — un lote permanentemente rechazado reintenta para siempre. | Un WSDL colgado bloquea la cadena entera de cron (5 min) indefinidamente; sin corte de reintentos infinitos. | Cola con backoff exponencial y máximo de intentos explícito (ver Fase 3), timeouts configurados. |
| F | **El filesystem es la fuente de verdad**: XML firmado, ZIPs de lote, eventos — todo en disco (`firmados/`, `xmlLote/`, `zip/`, `eventos/`), la BD solo guarda el path. `enviarDatos.php` incluso hace un `file_get_contents()` contra una URL HTTP construida en SQL. | Cualquier problema de disco/permisos rompe el pipeline de forma invisible para la BD. | El XML firmado se guarda como contenido en la columna nueva `xml_firmado` (`@db.MediumText`) de `Factura`/`NotaCredito`/`EventoSifen` — la BD es la única fuente de verdad (ver §2.2). |
| G | **Lógica duplicada + estado global no portable**: dos formas de cargar la empresa (`define()` global vs array), clasificación de RUC/receptor reimplementada 2 veces con nombres distintos, separación RUC/DV repetida en 3+ archivos. El patrón `define()` de `setEmpresa()` solo "funciona" porque cada request PHP es un proceso aislado. | Deuda de mantenimiento; y el patrón de globals **no es portable a Node**, donde un solo proceso atiende requests concurrentes de distintas empresas. | Un solo `CdcHelper`/`RucHelper` reusado, certificado y datos de empresa pasados explícitamente por parámetro en toda la cadena — cero estado global mutable. |
| H | **Estados como texto libre / substring matching como lógica de negocio**: `'Y'/'N'`, el string de respuesta de SIFEN adoptado tal cual como estado interno (`'Aprobado'`, `'Rechazado'`), y filtros SQL como `ILIKE '%procesamiento%'` / `'%no encolado%'` usados como predicados de negocio. | Nada impide un typo o un cambio de wording de SIFEN rompiendo silenciosamente la máquina de estados. | Enum Prisma cerrado + máquina de estados explícita (ver Fase 3). |
| I | **Sin transacciones en escrituras multi-paso**: marcar `zipeado='Y'` + `INSERT INTO lote_control` son 2 statements sueltos — un crash entre medio deja documentos huérfanos (marcados como zipeados pero sin lote real, y ya no vuelven a ser tomados por el filtro `zipeado='N'`). | Pérdida silenciosa de documentos del pipeline de envío. | `prisma.$transaction` en cada operación multi-tabla (patrón que factyble-back ya usa para la secuencia de numeración con `FOR UPDATE`, extenderlo aquí). |
| J | **Certificados en texto plano**: password del P12 sin cifrar en BD, sin chequeo de vencimiento, rotación manual por sufijo de nombre de archivo sin auditoría. | Riesgo de seguridad + causa raíz del error 0142 (nadie se entera hasta que SIFEN rechaza). | Modelo `Certificado` con contraseña cifrada a nivel aplicación, chequeo de vencimiento proactivo + cron de alerta (ver Fase 3). |
| K | **CORS mal configurado**: refleja cualquier `Origin` + `Access-Control-Allow-Credentials: true` (`utils/utils.php:55-65`) — equivalente a `*` pero con credenciales habilitadas. | Vulnerabilidad CORS clásica. | N/A — el endpoint desaparece; las llamadas pasan a ser internas dentro del mismo proceso Node. |
| L | **Validación tardía y débil**: comparaciones con `==` no estricto, sin schema/tipo, la validación de campos corre **después** de ya haber calculado el CDC y hecho lookups a BD con datos no validados. | Datos corruptos pueden llegar más lejos de lo esperado antes de fallar. | `express-validator` (ya usado en factyble-back) validando antes de cualquier cómputo, con schema explícito. |
| M/N | `die()` como control de flujo en cada entrypoint; `display_errors` prendido en producción (`data.php:2-5`), filtrando paths/stack traces en la respuesta HTTP. | Imposible reusar lógica de negocio fuera de un contexto HTTP; fuga de información en producción. | N/A directamente — el patrón `ErrorApp`/`try-catch`/middleware de error ya existente en factyble-back es el correcto, seguir usándolo. |
| O | **Sin gestión de dependencias**: `xmlseclibs-master` vendorizado a mano, sin `composer.json`/lockfile, sin tracking de CVEs. `libxml_disable_entity_loader(false)` (no-op desde PHP 8, código muerto arrastrado). | Dependencia crítica de seguridad (firma XML) sin gestión de versiones. | Librerías npm versionadas con lockfile (`package-lock.json`), auditoría de dependencias estándar. |
| — | **Bugs de datos confirmados en producción**: evento de cancelación siempre firma con `&lt;rEve Id="43"&gt;` hardcodeado (`eventosGenerarXML.php:85`, verificado contra XMLs reales en `v1/eventos/event_*.xml`); evento de nominación siempre envía `&lt;mOtEve&gt;No se puso nombre&lt;/mOtEve&gt;` (`eventosGenerarXML.php:135`) ignorando el motivo real. | Si se migran datos históricos de eventos, hay que saber que esos campos son basura, no datos reales. | No replicar; si se migra data histórica, marcar estos campos como no confiables. |

### De `src/` (rewrite v2, útil como referencia pero con problemas propios)

| # | Qué hace mal | Por qué es grave | Nota |
|---|---|---|---|
| P | **Falla silenciosa después de firmar**: el `UPDATE`/`INSERT` final en `documentos` dentro de `upsertDocumento()` (`DocumentoElectronicoService.php:226-250`) no chequea el retorno de `pg_query_params()`, a diferencia del resto de la clase. Si falla (p. ej. colisión de `codigo_seguridad`), el XML firmado ya quedó escrito en disco pero **sin fila en la BD**, y el controller igual responde HTTP 200 `status: true`. | Documento fiscal firmado, "fantasma" — nunca entra a un lote, nunca se envía a SIFEN, pero el cliente cree que se emitió bien. Es el peor tipo de bug para un sistema fiscal. | Diseño nuevo: firmar y persistir deben ser atómicos (o al menos la firma solo se considera válida si la persistencia fue confirmada). |
| Q | **Aislamiento de errores inconsistente entre los 3 servicios de lote**: `LoteEnvioService`/`LoteConsultaService` aíslan errores por lote (try/catch individual), pero `LoteBuilderService::construir()` no — una excepción en un lote aborta *todo* el batch de *todas* las empresas. | Un problema puntual (p. ej. colisión de secuencia) bloquea el armado de lotes de empresas no relacionadas. | Aislar por lote en los 3 servicios, sin excepción. |
| R | **Race condition (TOCTOU) en generación de `codigo_seguridad`**: SELECT de códigos usados + generación random + verificación en memoria, no atómico — mitigado solo por el `UNIQUE` de BD, cuya violación cae en el antipatrón P. | Bajo concurrencia real puede fallar de forma silenciosa. | Reservar el código de forma atómica (ya existe un patrón mejor en factyble-back: `FOR UPDATE` sobre la secuencia, ver `facturaService.js:162-170`). |
| S | **Endpoints SIFEN hardcodeados a producción**, igual que v1 — sin variable de ambiente test/producción pese a ser una reescritura nueva. | No se puede probar contra homologación sin editar código. | Ver Decisiones pendientes / Fase 4 — variable `SIFEN_ENV`. |
| T | **Sin escape de XML en campos de texto libre** (`XmlBuilder.php` — cero uso de `htmlspecialchars`), pese a que el propio `EventoXmlBuilder.php:17-20` sí lo hace correctamente en otro lugar del mismo codebase — inconsistencia, no falta de conocimiento. | Un nombre/descripción con `&`, `&lt;` o `&gt;` genera XML malformado que puede fallar la firma o alterar la estructura del documento. | Escapar sistemáticamente cualquier valor de texto libre insertado en XML. |
| U | **`documentos.sincronizado` es un campo muerto**: existe, tiene índice, pero nada lo pone en `TRUE` en ningún lado de `src/`. | Índice y columna sin propósito — señal de una fase (`enviarDatos.php`) que quedó a mitad de portar. | No migrar campos "aspiracionales" sin uso real; si no aplica, no crearlo. |
| V | **Schema más permiso que el código**: `documentos.tipo_doc` permite `(1,4,5,6,7)` a nivel BD pero la app solo acepta `(1,5)`; la tabla `eventos` tiene columnas completas para tipo 1 y 3 que ningún código llena. | Deriva entre schema y comportamiento real — quien lea solo el schema se lleva una idea equivocada del sistema. | El schema Prisma debe reflejar exactamente lo que el código soporta; ampliar ambos a la vez, nunca uno solo. |
| W | **Sin guarda de estado antes de cancelar**: `EventoService::cargarDocumentoPorCdc()` solo chequea que el documento exista, no que esté `aprobado`, pese a que la propia documentación interna (`api.json:245`) dice que debería. | Se podría intentar cancelar un documento no aprobado. | factyble-back **ya hace este chequeo bien** del lado Node hoy (`notaDeCreditoService.js:69-71`) — generalizar ese patrón a todos los eventos. |

---

## Fase 2 — Gap analysis de base de datos

**Motor de BD: MySQL, decisión cerrada.** `factyble-back/prisma/schema.prisma:12` declara `provider = "mysql"` — se confirma como definitivo, no hay migración de motor. Consecuencia directa para el diseño: MySQL topea `TEXT` en 64 KB. Cualquier columna que guarde XML firmado o payloads SOAP completos (un sobre de lote de 50 documentos supera holgadamente 64 KB) debe declararse `@db.MediumText` (hasta 16 MB), no `@db.Text`. Aplica a: `xml_firmado` de `Factura`/`NotaCredito`/`EventoSifen`, `sifen_respuesta_xml`, y `request_payload`/`response_payload` de `SifenTrazabilidad`.

### 2.1 Resumen del gap

factyble-back hoy (`prisma/schema.prisma`) ya tiene, en `Factura`/`NotaCredito`: `cdc`, `xml`, `linkqr`, `sifen_estado` (String libre), `sifen_estado_mensaje`, `codigo_seguridad`. Falta todo lo demás que la API PHP resolvía por su cuenta:

| Responsabilidad de factyble-api | Existe hoy en factyble-back | Gap |
|---|---|---|
| Datos fiscales de empresa (tipo contribuyente, tipo impuesto, actividad económica, moneda, CSC/CSC ID) | `Empresa` solo tiene `ruc`, `timbrado`, `direccion`, etc. | Faltan columnas fiscales completas + CSC/CSC ID (necesarios para QR). |
| Certificado P12 por empresa (con vencimiento, rotación) | No existe ningún modelo. | Nuevo modelo `Certificado`. |
| Lotes SIFEN | No existe. | Nuevo modelo `Lote`. |
| Eventos SIFEN | No existe (cancelación se resuelve solo actualizando `sifen_estado` en Factura/NotaCredito, sin registro propio). | Nuevo modelo `EventoSifen`. |
| Trazabilidad request/response SIFEN | No existe. | Nuevo modelo `SifenTrazabilidad` — clave para diagnosticar 0142 y similares. |
| Estado SIFEN como máquina de estados | `sifen_estado String? @db.Text` — texto libre (`'En Proceso'`, `'Aprobado'`, `'N'`...) | ✅ Nuevo enum `EstadoSifen`, campo `estado_sifen` agregado en paralelo (no reemplaza `sifen_estado` todavía — ver desvío #1 en "Estado de implementación"). |
| Reintentos/cola de envío | No existe. | Campos de reintento en `Lote`/`EventoSifen` (o cola real si el volumen lo justifica — ver Decisión pendiente #2). |
| Catálogo departamentos/distritos/ciudades | `Establecimiento` guarda `cod_distrito`/`cod_ciudad`/`cod_departamento` como strings libres, sin catálogo. | Solo necesario si se agrega Remisión al alcance (usa estos catálogos en el XML) — diferir. |

### 2.2 Migraciones — ✅ IMPLEMENTADO (migración `20260710015934_add_sifen_domain`)

> Esta sección ya no es una propuesta: describe lo que efectivamente quedó en `prisma/schema.prisma` y en la migración aplicada. Ver "Estado de implementación" al inicio del documento para los 3 desvíos respecto del texto original (marcados `⚠️` abajo) y su justificación.

**Extendido `Empresa`** (no duplicado — instrucción explícita):
- `ruc_sin_dv String?`, `digito_verificador String?` (⚠️ nullable — ver desvío #3, no se derivan de `ruc` automáticamente, quedan para backfill)
- `tipo_contribuyente` → enum `TipoContribuyente { FISICA JURIDICA }` (⚠️ nullable)
- `tipo_impuesto` → enum `TipoImpuesto { IVA ISC RENTA NINGUNO IVA_RENTA }` (⚠️ nullable)
- `cod_actividad_principal String?`, `desc_actividad_principal String?`, `cod_actividad_secundaria String?`, `desc_actividad_secundaria String?`
- `cod_moneda String @default("PYG")`, `desc_moneda String?`
- `csc String?` (cifrado a nivel aplicación — el cifrado en sí todavía no está implementado, hoy es un `VarChar` plano a la espera de que `certificadoService`/`empresaService` lo escriban cifrado), `csc_id String?`

**Nuevo modelo `Certificado`** — ✅:
- `id`, `empresa_id` FK, `archivo` (path o referencia a storage — no el binario en BD), `clave` (cifrada, no plaintext — mismo comentario que `Empresa.csc`, el cifrado en sí es responsabilidad de `certificadoService`, no de la BD), `alias` (para versionado: "2024", "2026", en vez del sufijo de filename actual), `fecha_vencimiento`, `activo Boolean`, `estado` → enum `EstadoCertificado { VIGENTE POR_VENCER VENCIDO REVOCADO }`, `fecha_creacion`/`fecha_modificacion` (⚠️ desvío #2: no existe `fecha_carga` como campo separado, se usa `fecha_creacion` por convención del resto del schema).
- Un certificado `activo` por empresa a la vez, historial de los anteriores conservado (a diferencia del hack de renombrar archivos). **Nota**: esta regla de "solo un activo a la vez" NO está garantizada por constraint de BD (MySQL no tiene índice único parcial) — hay que enforzarla en `certificadoService` a nivel aplicación.

**Nuevo modelo `Lote`** — ✅ (único camino de emisión — ver Decisión de diseño §3.1/§3.2, aplica incluso a lotes de 1 solo documento):
- `id`, `empresa_id` FK, `secuencia String @unique`, `tipo_doc` → enum nuevo `TipoDocumentoSifen { FACTURA NOTA_CREDITO }` (discrimina qué relación del lote está poblada, ya que SIFEN exige lotes de un solo tipo de documento), `estado` → enum `EstadoLote { CONSTRUIDO ENVIADO CONSULTADO }`, `archivo_zip String?`, `sifen_numero_lote`, `sifen_envio_codigo`, `sifen_envio_mensaje`, `sifen_consulta_codigo`, `sifen_consulta_mensaje String? @db.MediumText`, `intentos_envio Int @default(0)`, `proximo_intento_en DateTime?`, `ultimo_error String? @db.Text`, `fecha_creacion`/`fecha_modificacion`.
- `Factura.lote_id Int? FK` y `NotaCredito.lote_id Int? FK` (nullable, no unificar en una tabla `documentos` — instrucción explícita de extender los modelos existentes, no duplicar/fusionar).

**Nuevo modelo `EventoSifen`** — ✅:
- `id`, `empresa_id` FK, `tipo_evento` → enum `TipoEventoSifen { CANCELACION INACTIVACION_RANGO NOMINACION_RECEPTOR INUTILIZACION CONFORMIDAD DISCONFORMIDAD DESCONOCIMIENTO NOTIFICACION }` (cubre el universo completo aunque hoy solo se implemente `CANCELACION`, para no tener que migrar el enum después)
- `factura_id Int?` FK, `nota_credito_id Int?` FK (uno de los dos, según a qué documento aplica)
- `datos_evento Json?` (payload específico del tipo de evento — inactivación necesita rango/timbrado, nominación necesita RUC/nombre nominado; JSON en vez de columnas dispersas nulleable como hace `src/db/schema.sql`, para no repetir el antipatrón V)
- `motivo String? @db.Text`, `secuencia_sifen String?`, `xml_firmado String? @db.MediumText` (el XML firmado del evento — mismo criterio que en Factura/NotaCredito, ver abajo), `sifen_respuesta_codigo`, `sifen_respuesta_mensaje`, `sifen_respuesta_xml String? @db.MediumText`, `intentos_envio Int @default(0)`, `proximo_intento_en DateTime?`, `ultimo_error String? @db.Text` (la cancelación es síncrona contra SIFEN — ver §3.1/§3.2 — pero igual puede fallar por timeout/red y necesita el mismo mecanismo de reintento que un lote), `fecha_creacion`/`fecha_modificacion`.

**Nuevo modelo `SifenTrazabilidad`** — ✅ (la tabla de trazabilidad pedida explícitamente):
- `id`, `entidad_tipo` → enum `EntidadSifen { FACTURA NOTA_CREDITO LOTE EVENTO }`, `entidad_id Int`
- `operacion` → enum `OperacionSifen { FIRMA ENVIO_LOTE CONSULTA_LOTE CONSULTA_DOCUMENTO EVENTO }` (sin `ENVIO_SINCRONO` — no existe ese camino, ver Decisión de diseño §3.1/§3.2)
- `request_payload String? @db.MediumText`, `response_payload String? @db.MediumText`
- `codigo_respuesta String?`, `exitoso Boolean`, `fecha_creacion DateTime @default(now())`

**Modificado `Factura`/`NotaCredito`** — ✅ (extendidos, no duplicados):
- ⚠️ **`sifen_estado` NO se convirtió a enum** (desvío #1 respecto del texto original — ver "Estado de implementación" al inicio del doc). Se agregó en su lugar `estado_sifen EstadoSifen?` (enum: `GENERADO FIRMADO ENCOLADO ENVIADO APROBADO RECHAZADO ERROR CANCELADO`) como campo **nuevo**, en paralelo. `sifen_estado` (String, legacy) sigue existiendo tal cual, congelado, y se dropea en el apagado (§4.4).
- Agregado `sifen_cod_respuesta String?`, `sifen_num_transaccion String?` (protocolo devuelto por SIFEN — antes no se guardaba)
- Agregado `fecha_firma DateTime?`, `fecha_envio_sifen DateTime?`, `fecha_respuesta_sifen DateTime?` (trazabilidad temporal — antes no existía)
- **Agregada columna nueva `xml_firmado String? @db.MediumText`** — el XML firmado en contenido, no un link. La BD es la única fuente de verdad (ver antipatrón F, "filesystem como fuente de verdad" — no se repite acá).
- **La columna `xml` existente NO se repropositó**: sigue guardando el link legacy de la API PHP tal cual está hoy, queda congelada (no se le escribe más luego del corte) y se dropea recién en la fase de apagado (§4.4), junto con `sifen_estado` y el resto de la limpieza de campos legacy.
- Se agregaron índices `@@index([lote_id])` y `@@index([estado_sifen])` en ambos modelos.
- **Pendiente de implementar (no es parte de la migración de schema, es lógica de aplicación de la Fase 2)**: persistencia atómica — la firma del XML y la transición de `estado_sifen` (p. ej. `GENERADO → FIRMADO`) deben escribirse en la **misma `prisma.$transaction`** cuando se implemente `xmlBuilderService`/`firmadorService`. Esto es lo que elimina por construcción el antipatrón P de `src/` (documento firmado sin fila en BD) — la migración de schema ya lo permite (columnas ahí), falta el código que lo aplique.
- **Pendiente de implementar**: `correoService.js` todavía arma el adjunto del mail vía `axios.get('http://.../firmados/{cdc}.xml')` (`correoService.js:16,95,144,182` aprox.) — el cambio a leer `xml_firmado` desde la BD es trabajo de la Fase 2/5, no se tocó en esta migración.
- Opcional, baja prioridad, solo en fase final: utilidad de export de XMLs a disco como conveniencia operativa (soporte, debugging), siempre regenerable desde la BD — nunca fuente de verdad.
- El backup regular de la BD MySQL de factyble-back cubre, a partir del corte, la obligación de conservación de comprobantes electrónicos de la SET — documentar esto explícitamente como requisito operativo (ver también §4.4 sobre el archivado de la BD legada de factyble-api).

**Diferido (fuera de alcance salvo decisión explícita)**: `Departamento`/`Distrito`/`Ciudad` como catálogos — solo necesarios si se agrega Remisión electrónica al alcance.

---

## Fase 3 — Diseño en factyble-back

### 3.1 Cobertura por librería `facturacionelectronicapy-*`

| Responsabilidad | xmlgen | xmlsign | setapi | qrgen | Implementamos nosotros |
|---|---|---|---|---|---|
| Generación XML DE (FE, NC) | **Cubre** (`generateXMLDE`) | — | — | — | Mapeo de nuestros datos Prisma → payload de la lib |
| Generación XML ND / Autofactura / Remisión (si se amplía alcance) | Cubre los tipos de documento en general (a confirmar en spike qué tan completo es para ND/remisión) | — | — | — | Mapeo si se decide incluir |
| Cálculo del CDC | **Cubre** (automático dentro de `generateXMLDE`) | — | — | — | — |
| XML eventos: cancelación, inutilización, conformidad, disconformidad, desconocimiento, notificación | **Cubre** (`generateXMLEventoCancelacion`, `...Inutilizacion`, `...Conformidad`, `...Disconformidad`, `...Desconocimiento`, `...Notificacion`) | — | — | — | — |
| XML evento nominación de receptor de tasa turística | **No cubre** | — | — | — | Implementación propia (solo si se retoma este tipo de evento) |
| Firma XML-DSig del DE | — | **Cubre** (`signXML(xml, certPath, certPassword)`) | — | — | — |
| Firma de eventos (nodo `rEve`, no `DE`) | — | A confirmar por spike — la firma de v1/v2 firma un nodo distinto para eventos; no está documentado si `signXML` es genérico para cualquier nodo raíz o específico del DE | — | — | Fallback propio si la lib no cubre este caso |
| Validación/vencimiento de certificado | — | Parcial (recibe path+password, no valida vencimiento) | — | — | Chequeo de vencimiento propio (modelo `Certificado` + cron) |
| Envío síncrono individual | — | — | Cubre (`recibe`) — **decidido no usarlo**: el único camino de emisión es por lote (§3.2/§3.3), incluso para lotes de 1 documento. Se deja documentado que la lib lo soporta por si alguna vez se reconsidera, pero no forma parte del diseño. | — | — |
| Envío de lote (armado + zip + envío) | — | — | **Cubre** (`recibeLote`, recibe array de XML firmados — a confirmar por spike #1 si arma el `&lt;rLoteDE&gt;`/zip internamente, lo que simplificaría mucho vs. v1/v2). Es el **único** camino de emisión (decisión de diseño). | — | Solo si la lib no arma el envoltorio de lote internamente (depende del spike #1) |
| Consulta de estado de lote | — | — | **Cubre** (`consultaLote`) — parte del pipeline regular (`consultarLotes`, cada 5 min). | — | — |
| Consulta de documento por CDC | — | — | **Cubre** (`consulta`) — **no** se usa como vía de emisión ni como reemplazo de la consulta por lote; se usa únicamente en el job de red de seguridad (`consultaIndividualRedDeSeguridad`, §3.4) para documentos en `ENVIADO` sin resolución tras un umbral. | — | — |
| Consulta de RUC | — | — | **Cubre** (`consultaRuc`) | — | — |
| Envío de eventos a SIFEN | — | — | **Cubre** (`evento`) — camino **síncrono**, igual que hoy en v1/v2 (SIFEN no ofrece envío de eventos por lote; esto no contradice la decisión de "solo lotes", que aplica a la emisión de documentos FE/NC, no a eventos). | — | — |
| Ambiente test/producción | — | — | **Cubre** (parámetro `env: "test"|"prod"`) | — | — |
| Generación de QR/link | — | — | — | **Cubre** (`generateQR(xmlSigned, idCSC, CSC, env)`) | — |
| Generación de KUDE (PDF) | — | — | — | — | **Ya lo hacemos nosotros** (`utils/generarPdf.js`, JasperReports) — no usar `facturacionelectronicapy-kude` (instrucción explícita) |
| Gestión de certificados (alta, vencimiento, alertas) | — | — | — | — | Implementamos nosotros |
| Cola de reintentos y backoff | — | — | — | — | Implementamos nosotros |
| Trazabilidad request/response | — | — | — | — | Implementamos nosotros |
| Máquina de estados SIFEN | — | — | — | — | Implementamos nosotros |

> Ítems marcados "a confirmar por spike": ver **§4.0 Spikes de Fase 0** — deben resolverse antes de comprometerse al diseño final de `loteService`/`firmadorService`.

### 3.2 Módulos nuevos (routes → controllers → services → utils, patrón existente)

- `utils/sifen/cdc.js` — cálculo de CDC y dígito verificador (Módulo 11), como red de verificación aunque `xmlgen` lo calcule internamente.
- `services/sifen/xmlBuilderService.js` — wrapea `xmlgen`, mapea modelos Prisma (`Factura`, `NotaCredito`) al payload esperado.
- `services/sifen/firmadorService.js` — wrapea `xmlsign`. Recibe certificado explícito por parámetro (nunca global/singleton — ver antipatrón G).
- `services/sifen/qrService.js` — wrapea `qrgen`.
- `services/sifen/sifenClientService.js` — wrapea `setapi`, pero **solo expone `recibeLote`, `evento`, `consultaLote`, `consulta` y `consultaRuc`** — deliberadamente no expone `recibe` (envío síncrono) como opción de uso, para que no exista ni la tentación de bifurcar el camino de emisión. `SIFEN_ENV` (`test`/`prod`) desde variable de entorno.
- `services/sifen/certificadoService.js` — CRUD de `Certificado`, chequeo de vencimiento, selección del certificado activo por empresa.
- `services/sifen/loteService.js` — **único camino de emisión** de Factura/NotaCredito. Arma/agrupa `Lote`s (incluso de 1 solo documento cuando no hay más pendientes en el momento — no hay atajo síncrono para "urgente"), con aislamiento de error por lote y por empresa (corrige antipatrón Q de v2: una excepción en un lote nunca bloquea los lotes de otras empresas).
- `services/sifen/eventoService.js` — cancelación primero, extensible a los demás tipos que cubre `xmlgen`. Camino síncrono contra `evento.wsdl` (no pasa por `loteService`). Reusa el patrón de guarda de estado que ya existe en `notaDeCreditoService.js:69-71` (documento debe estar `APROBADO` antes de cancelar).
- `services/sifen/trazabilidadService.js` — función central `registrarInteraccion({entidadTipo, entidadId, operacion, request, response, codigoRespuesta, exitoso})`, invocada desde cada uno de los servicios anteriores — ningún llamado a SIFEN debe hacerse sin pasar por acá.
- `utils/sifen/codigosRespuesta.js` — mapa extensible `{codigo: {categoria, mensajeInterno, accionSugerida}}`, sembrado inicialmente con `0142` (certificado no asociado/vencido → alerta a admin, no reintentar automáticamente) y ampliado con el Manual Técnico oficial de SIFEN como fuente de verdad (no inventar códigos).
- Modificar `facturaService.js`/`notaDeCreditoService.js`: eliminar `apiFacturacionElectronica*` (llamadas HTTP a la API PHP) y reemplazar por llamadas directas a los servicios de arriba. Sin bifurcación por flag — el reemplazo es incondicional, efectivo desde el corte único (§4.2).
- Eliminar `src/db/dbApiFacturacion.js` y `checkFacturaStatus` tal como está — reemplazado por el worker de `loteService`/`sifenClientService` que consulta a SIFEN directamente y escribe en nuestra propia BD.

### 3.3 Cola de envío con reintentos

Sin Redis/BullMQ (instrucción explícita) salvo que el volumen lo justifique (Decisión pendiente #2). Diseño tabla + worker:

- Campos `intentos_envio Int @default(0)`, `proximo_intento_en DateTime?`, `ultimo_error String? @db.Text` en `Lote` (camino principal de reintento — toda la emisión pasa por acá) y en `EventoSifen` (la cancelación es síncrona pero puede fallar por timeout/red y necesita el mismo mecanismo).
- Worker (cron `node-cron`) selecciona filas en estado reintentable con `proximo_intento_en <= now()`, calcula backoff exponencial en JS (`min(baseSeconds * 2^intentos, capSeconds)`), tope de intentos configurable (a diferencia de v1, que reintenta para siempre).
- Distinción explícita, vía `codigosRespuesta.js`, entre rechazo **definitivo** (código de negocio SIFEN → no reintentar, pasa a `RECHAZADO`) y fallo **reintentable** (timeout / error de red / 5xx → permanece en estado de reintento hasta agotar el tope de intentos, luego pasa a `ERROR` y requiere intervención).

### 3.4 Crontabs / jobs (registrar en `src/services/cronJobs.js`)

| Job | Frecuencia sugerida | Reemplaza / justificación |
|---|---|---|
| `armarYEnviarLotes` (build + send, único camino de emisión, try/catch aislado por lote y por empresa — corrige antipatrón Q) | cada 5 min | `enviarLotes.php` |
| `consultarLotes` | cada 5 min | `consultarLotes.php` |
| `consultaIndividualRedDeSeguridad` (documentos en `ENVIADO` sin resolución definitiva tras un umbral — ej. 2 horas — se consultan individualmente por CDC vía `setapi.consulta`) | cada 1 hora | No existe hoy — red de seguridad nueva, complementaria a `consultarLotes` (no reemplaza el flujo por lote, solo cubre el caso borde de una consulta de lote que nunca resuelve) |
| `alertaCertificadosPorVencer` (`Certificado.fecha_vencimiento` dentro de N días → notificación) | diario | No existe hoy — nuevo, previene el error 0142 de forma proactiva |
| `limpiezaTrazabilidad` (purga de `SifenTrazabilidad` más allá de un período de retención configurable) | semanal | No existe hoy — nuevo |

`enviarDatos.php` **no tiene reemplazo** — esa fase entera desaparece porque ya no hay un "sistema externo" al que sincronizar el XML (el XML vive en la BD desde el momento de la firma, ver §2.2).

### 3.5 Manejo de errores SIFEN por código

- Todo `sifen_cod_respuesta` que devuelva SIFEN se persiste crudo en `Factura`/`NotaCredito`/`Lote`/`EventoSifen`, **y además** cada interacción completa (request+response) se persiste en `SifenTrazabilidad` — esto es lo que permite diagnosticar un 0142 después del hecho, cosa que hoy es imposible (cero trazabilidad en v1 y v2).
- `codigosRespuesta.js` como capa de interpretación: dado un código, decide la transición de estado (`RECHAZADO` vs `ERROR` reintentable) y si dispara alerta a un operador humano (0142 es un buen candidato a alerta inmediata, ya que no se resuelve reintentando).

---

## Fase 4 — Plan de ejecución

**Sin convivencia**: no hay flag por empresa ni bifurcación `LEGADO_PHP`/`NATIVO`. Se corta de una sola vez para todas las empresas. La API PHP queda instalada e inactiva 4 semanas después del corte como plan de rollback de emergencia (revert de deploy), antes de ejecutar el apagado definitivo.

### Actualización de estrategia de validación final (2026-07-10)

> Esta sección reemplaza el criterio de "Fase 4 — E2E completo en test" de §4.1 y el supuesto "sin piloto en producción" de §4.3 de abajo. Se conserva el resto del texto original de §4.1/§4.2/§4.3 sin borrar (mismo criterio que el resto del documento: no revertir sin razón nueva), pero donde contradiga lo siguiente, **manda esta sección**.

**Objetivo real, en orden:**

1. **Migración al 100%**: terminar de escribir todo el código de las Fases 1-4 originales (`loteService`, `eventoService`, jobs de §3.4, `certificadoService`, `trazabilidadService`, y el reemplazo de `apiFacturacionElectronica*` en `facturaService.js`/`notaDeCreditoService.js`) — es decir, el sistema completo tiene que estar implementado y pasar las verificaciones ad-hoc de cada módulo (mismo patrón usado en Fases 2-3: sin test runner instalado, verificación manual por módulo), aunque no haya corrido todavía contra SIFEN real.
2. **Piloto real en producción, con un certificado real y montos pequeños**: en vez de una suite exhaustiva contra el ambiente de test de SIFEN cubriendo *todas* las empresas activas (lo que decía el §4.1/§4.3 originales), la validación final ocurre **directamente en producción**, con un certificado P12 real (no el ambiente `test` de SIFEN) y emitiendo documentos de **montos bajos**, para acotar el impacto económico/operativo de un eventual rechazo o bug mientras se valida el pipeline nuevo contra SIFEN real.
3. **Iterar bugs sobre la marcha**: los problemas que aparezcan durante este piloto (rechazos de SIFEN, errores de mapeo, casos borde no cubiertos) se resuelven a medida que se detectan, no se bloquea el piloto esperando una cobertura perfecta de antemano.
4. **Criterio de salida del piloto**: se considera terminado cuando (a) la emisión de **todos** los documentos en alcance (FE y NC, en sus variantes contado/crédito, receptor local/extranjero) se aprueba correctamente en SIFEN de forma consistente, y (b) los **eventos de cancelación** funcionan correctamente end-to-end (firma, envío síncrono, actualización de estado). Recién ahí se considera cerrada la validación y se puede avanzar con confianza al resto de empresas / al apagado de la API PHP (§4.4).

**Qué NO cambia respecto del texto original:**
- El **spike #3** (round-trip contra el ambiente de **test** de SIFEN, §4.0) sigue siendo útil como primera validación de bajo riesgo *antes* del piloto en producción, si se consigue RUC/certificado de prueba de la SET — no es obligatorio como gate, pero si aparece la oportunidad de correrlo antes, se corre.
- La validación estructural contra el XSD oficial (`siRecepDE_v150.xsd`, ya aplicada en Fase 2 — ver "Validación end-to-end de Fase 2" arriba) sigue siendo parte del trabajo de cada módulo, no se reemplaza por el piloto.
- `loteService`/`eventoService` siguen aislando errores por lote/empresa (antipatrón Q) y usando la cola de reintentos (§3.3) — el piloto con montos pequeños no exime de esas protecciones, al contrario, las necesita más (es la primera vez que el código nuevo toca SIFEN real).
- La API PHP sigue quedando instalada e inactiva como plan de rollback (§4.2), independientemente de si el corte fue precedido por una suite de test o por un piloto en producción.

**Por qué este cambio**: una suite exhaustiva en ambiente de test, aunque necesaria en teoría, no reemplaza la señal real de SIFEN producción — variantes de timbrado, RUCs reales, certificados reales y el comportamiento real del ambiente productivo de SIFEN solo se validan ahí. Emitir con montos bajos acota el riesgo económico de un documento mal emitido mientras se gana esa señal real.

### 4.0 Spikes de Fase 0 (correr antes de las migraciones — su resultado puede afectar el diseño)

1. ✅ **RESUELTO** — ¿`facturacionelectronicapy-setapi.recibeLote` arma internamente el envoltorio `&lt;rLoteDE&gt;` + zip, o solo transporta? **Arma todo internamente** (rLoteDE + zip + sobre SOAP + mTLS) — ver "Resultados de los spikes" en "Estado de implementación" al inicio del doc.
2. ✅ **RESUELTO** — ¿`facturacionelectronicapy-xmlsign` firma el nodo `rEve` de eventos, o solo el nodo `DE`? **Sí lo cubre** (`signXMLEvento`), wire-compatible con el output de `xmlgen` sin adaptación — ver misma sección, incluye hallazgo de seguridad nuevo sobre la vía Java de la lib (usar siempre `signByNodeJS: true`).
3. ⬜ **PENDIENTE** — Round-trip mínimo contra el ambiente de test de SIFEN con certificado de prueba. Bloqueado: requiere RUC/certificado P12 de prueba de la SET, no disponibles todavía.

### 4.1 Fases incrementales

> ⚠️ El criterio de aceptación de la Fase 4 de esta tabla quedó **superado** por "Actualización de estrategia de validación final (2026-07-10)" de arriba: no es una suite exhaustiva contra SIFEN test para todas las empresas, es un piloto real en producción con certificado real y montos pequeños, iterando bugs hasta cobertura completa de documentos + cancelación. Se conserva la fila original por trazabilidad histórica del razonamiento previo.

| Fase | Contenido | Criterio de aceptación |
|---|---|---|
| **1 — Fundamentos** | Migraciones Prisma (§2.2) ✅, instalación de las 4 libs `facturacionelectronicapy-*` ✅, variables de entorno (`SIFEN_ENV`, `CERT_ENCRYPTION_KEY`) ✅, spikes de §4.0 🟡 2/3 | Migraciones aplican limpio sobre copia de BD real (✅ verificado); spikes #1 y #2 resueltos y documentados (✅), spike #3 pendiente de credenciales de test de la SET (⬜); endpoints existentes sin cambios de comportamiento (✅ verificado — ninguna columna/tabla legacy tocada) |
| **2 — CDC + XML + firma + QR (sin envío)** | `cdc.js`, `xmlBuilderService`, `firmadorService`, `qrService` | ✅ Completo (2026-07-10): validado que el XML final valida contra el XSD oficial `siRecepDE_v150.xsd` (ver "Validación end-to-end de Fase 2" arriba). Pendiente, no bloqueante: comparación estructural contra fixtures reales de `factyble-api/v1/firmados/` (no se hizo, solo datos sintéticos) |
| **3 — SifenClient + certificados + trazabilidad** | `sifenClientService` (recibeLote/evento/consultaLote/consulta/consultaRuc) ✅, `certificadoService` ✅, `trazabilidadService` ✅ | ✅ Completa (2026-07-10). Módulos escritos y verificados ad-hoc (sin test runner) — `certificadoService` y `trazabilidadService` además corridos contra la BD MySQL local real, no solo `require()`. Round-trip real contra SIFEN (test o producción) sigue quedando para el piloto de Fase 4, ver "Actualización de estrategia" arriba |
| **4 — Código completo + piloto en producción con montos pequeños** | `loteService`, `eventoService`, jobs de §3.4 — ✅ código 100% escrito y verificado ad-hoc (2026-07-10, sesión 2). Spike #3 descartado (sesión 3): no hay ambiente de test de por medio. **Wiring de `facturaService.js`/`notaDeCreditoService.js` (Fase 5) ✅ completo (2026-07-11, sesión 4, con pedido explícito del usuario)** — ver tabla de Fase 5 arriba. Falta únicamente el certificado real de producción + datos fiscales de la empresa piloto antes de poder arrancar: montos bajos, iterando bugs | Ver los 4 puntos del criterio de salida del piloto, arriba ("Actualización de estrategia de validación final") — ~~ya no es "suite completa contra SIFEN test para todas las empresas"~~ |
| **5 — Corte a producción para el resto de empresas** | Una vez cerrado el piloto de Fase 4: todas las empresas emiten por el nuevo pipeline | Documentos reales aprobados por SIFEN para todas las empresas, trazabilidad completa, monitoreo reforzado activo |
| **6 — Apagado de factyble-api** | Ver checklist §4.4, recién tras 4 semanas de la API PHP inactiva | Checklist §4.4 completo, servidor PHP decomisionado |

### 4.2 Estrategia de corte único

> Esta sección describe el corte para el **resto de las empresas** una vez cerrado el piloto de producción de Fase 4 (ver "Actualización de estrategia de validación final" arriba). El piloto en sí (una o pocas empresas, montos bajos) es la excepción deliberada a "sin flag de convivencia" que sigue debajo — mientras dura el piloto, sí puede convivir el piloto en producción con el resto de empresas todavía en la API PHP, hasta cerrar el criterio de salida del piloto.

- **Sin flag de convivencia** (para el corte del resto de las empresas, tras el piloto). El reemplazo de `apiFacturacionElectronica*` (HTTP a la API PHP) por las llamadas internas nuevas es incondicional y simultáneo para todas las empresas, en un único deploy.
- **Rollback = revert de deploy.** Si el corte muestra un problema, se revierte el deploy (vuelve a llamar a la API PHP) — por eso la API PHP se mantiene **instalada pero inactiva 4 semanas** después del corte, en vez de decomisionarse el mismo día.
- El checklist de apagado (§4.4), incluido el export/archivado de la BD Postgres legada (obligación de conservación de la SET), corre recién cumplidas esas 4 semanas sin necesidad de rollback.
- `dbApiFacturacion.js`, `checkFacturaStatus` (versión actual) y las funciones `apiFacturacionElectronica*` se eliminan **en el corte**, no gradualmente — no hay estado intermedio donde convivan ambos caminos de emisión en el código.

### 4.3 Plan de pruebas contra ambiente de test de SIFEN

> ⚠️ El último punto de esta sección ("al no haber piloto en producción...") quedó **superado** por "Actualización de estrategia de validación final (2026-07-10)": **sí hay** piloto en producción, y es la validación real (no la suite de test). Lo demás de esta sección sigue vigente como buena práctica adicional, sin ser bloqueante: si se consigue RUC/certificado de prueba de la SET, correr esto antes del piloto reduce riesgo, pero no es requisito para arrancar el piloto.

- Certificado y RUC de prueba provistos por SET (si están disponibles — spike #3, sigue sin estarlo a la fecha).
- Suite de fixtures (referencia, no bloqueante): FE contado, FE crédito (cuota y a plazo), NC vinculada a FE, cancelación de FE, receptor extranjero (`NO_DOMICILIADO`), y casos borde que ejercitan específicamente el antipatrón T (descripciones con `&`, `<`, `>`) para confirmar que el escape de XML sí funciona en el nuevo código.
- Validación estructural del XML generado contra el XSD oficial de SIFEN (`siRecepDE_v150.xsd`), no solo comparación de string — esto **ya se hizo** en Fase 2 con datos sintéticos (ver "Validación end-to-end de Fase 2" arriba), independientemente del piloto.
- La red de seguridad real antes del corte al resto de empresas es el **piloto en producción** de Fase 4 (montos bajos, certificado real, iterando bugs) — ver "Actualización de estrategia de validación final" arriba.

### 4.4 Checklist de apagado definitivo de factyble-api

Ejecutar recién cumplidas las 4 semanas de la API PHP instalada-pero-inactiva post-corte (§4.2):

- [ ] Confirmado: 4 semanas desde el corte sin necesidad de rollback
- [ ] Ningún cron/crontab del sistema sigue invocando `v1/*.php`
- [ ] `dbApiFacturacion.js`, `checkFacturaStatus` (versión antigua) y las funciones `apiFacturacionElectronica*` eliminadas del código (ya debería estar hecho desde el corte, §4.2 — confirmar que no quedó código muerto)
- [ ] Variables de entorno `URL_API_FACT`, `HOST_API_FACT`, `*_DB_API_FACT` retiradas
- [ ] Dependencia `pg` retirada de `package.json` si no se usa para nada más
- [ ] Columna legacy `xml` (link a la API PHP) dropeada de `Factura`/`NotaCredito` una vez confirmado que `xml_firmado` la reemplaza en el 100% de los flujos (mail, KUDE, consultas)
- [ ] Datos históricos de la BD Postgres de factyble-api **exportados y archivados** (obligación de conservación de comprobantes electrónicos de la SET — ver Decisión pendiente #1 sobre la duración exacta)
- [ ] Servidor PHP decomisionado

---

## Estimado de esfuerzo por fase

> ⚠️ Estimados originales, escritos antes de la "Actualización de estrategia de validación final" (2026-07-10). La Fase 4 ya no es una suite E2E de duración acotada y predecible — es un piloto real en producción cuya duración depende de cuántos bugs aparezcan emitiendo contra SIFEN real, no solo de horas de desarrollo. Los números de abajo quedan como referencia de esfuerzo de **desarrollo** (escribir el código), no como estimado de calendario del piloto en sí.

La eliminación de la convivencia (sin flag por empresa) reduce el total frente al plan original.

| Fase | Estimado |
|---|---|
| 1 — Fundamentos + spikes | ~1 semana |
| 2 — CDC/XML/firma/QR (fixtures + XSD) | 1.5–2 semanas |
| 3 — SifenClient/certificados/trazabilidad (round-trip test) | 1–1.5 semanas |
| 4 — Completar código (`loteService`/`eventoService`/jobs) | 2–2.5 semanas de desarrollo — **más** el tiempo del piloto en producción en sí, que no es estimable de antemano (depende de bugs reales encontrados emitiendo con montos bajos, ver "Actualización de estrategia" arriba) |
| 5 — Corte a producción para el resto de empresas (una vez cerrado el piloto) | ~1 semana |
| 6 — Apagado (trabajo efectivo; ver nota de calendario abajo) | ~0.5 semana |
| **Total — esfuerzo de desarrollo** | **~6–7 semanas** de desarrollo puro, para el alcance actual de factyble-back (FE + NC + cancelación) — sin contar la duración del piloto de Fase 4, que es variable. Autofactura/ND/Remisión y los demás tipos de evento quedan fuera salvo decisión explícita de ampliar alcance. |

**Nota de calendario**: el sistema queda 100% migrado (código) antes de arrancar el piloto de Fase 4. El corte al resto de empresas (Fase 5) ocurre recién cuando se cumple el criterio de salida del piloto (emisión correcta de todos los documentos + cancelación funcionando, ver arriba) — no hay una fecha fija de antemano. El apagado definitivo (Fase 6) no es trabajo continuo: son ~0.5 semana de trabajo efectivo, pero recién ejecutable 4 semanas de calendario después del corte de Fase 5 (ventana de rollback de emergencia, §4.2).

---

## Decisiones pendientes

1. **Retención de datos históricos** de la BD Postgres de factyble-api tras el apagado: el checklist (§4.4) ya exige exportar/archivar antes de decomisionar; falta confirmar la **duración exacta** exigida por la SET para la guarda de comprobantes electrónicos, que determina dónde y por cuánto tiempo se conserva ese archivo.
2. **Volumen esperado** de documentos/lotes a mediano plazo: confirma si `node-cron` + tabla de reintentos (§3.3) alcanza indefinidamente, o si hay picos previstos que justifiquen introducir una cola real (Redis/BullMQ) — la instrucción del proyecto pide evitarla salvo justificación de volumen.

(Las decisiones sobre librería de firma para eventos y armado de lote pasaron a ser spikes de ejecución, §4.0 — no bloquean la planificación, se resuelven al arrancar Fase 1.)

---

## Conflictos detectados

Ninguna de las decisiones tomadas contradice lo relevado en el código. Una aclaración, no un conflicto: la decisión "envío por lotes como único camino de emisión" aplica a la emisión de documentos (FE/NC) — los **eventos** (cancelación) nunca pasaron por lote ni en v1 ni en v2 (SIFEN no ofrece envío de eventos por lote, solo el WSDL síncrono `evento.wsdl`), así que `eventoService` sigue siendo síncrono como hoy. Esto no es una excepción a la decisión, es simplemente que "emisión" y "eventos" son dos operaciones SIFEN distintas con transportes distintos, tal como ya funciona en el sistema actual.

De hecho, "lotes como único camino de emisión" no es un cambio de comportamiento respecto de hoy: v1 **ya** funciona así — `data.php` solo firma y devuelve CDC/QR de forma síncrona, y el envío real a SIFEN siempre ocurrió de forma asíncrona vía `enviarLotes.php` por cron. El diseño nuevo formaliza y endurece (aislamiento por lote/empresa, reintentos con tope) un patrón que ya era el real, no introduce uno nuevo.
