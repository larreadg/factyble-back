# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`factyble-back` is an Express + Prisma (MySQL) backend for Factyble, a Paraguayan electronic-invoicing (facturación electrónica) SaaS. It absorbed the functionality of a legacy PHP service (`factyble-api`) and replaced it with a native SIFEN (Paraguay's tax authority e-invoicing system) integration written directly in this repo. When touching anything under `services/sifen/`, `utils/sifen/`, SIFEN-related Prisma models, or `cronJobs.js`, read the load-bearing inline comments in those files first — they document the deliberate deviations and workarounds (several stem from bugs found by reading vendored library source).

## Commands

```bash
npm run dev      # nodemon src/index.js — local dev server, reads .env
npm start        # node src/index.js — production start

npx prisma generate                      # regenerate Prisma client after schema changes
npx prisma migrate dev --name <name>      # create + apply a new migration locally
npx prisma studio                         # inspect the DB visually
```

**There is no automated test suite** (`npm test` is a placeholder that exits 1). Verification in this codebase has historically been done via disposable ad-hoc scripts run against a real local MySQL DB (and, for SIFEN, against `sifen-test.set.gov.py` over the network), `node --check` for syntax-only validation when a module can't be safely `require()`'d, and manual/spike reads of vendored library source under `node_modules/`. When you make a change, follow the same pattern — write a throwaway verification script, run it, then discard it — rather than assuming a test command exists. If you add a real test framework, update this file.

There is no lint command configured.

## Architecture

### Request flow

`src/index.js` wires Express, `cors`, `body-parser`, mounts `/public` as a static dir, calls `cronJobs()` once at boot, and mounts all routes from `src/routes/index.js`. Each resource follows the same three-layer shape:

- **`routes/*Route.js`** — `express-validator` chains (`body(...)`, `param(...)`) inline in the route definition, followed by `authJwt(['ROLE'])` and the controller method. Validation rules live here, not in controllers or services.
- **`controllers/*Controller.js`** — thin: run `validationResult(req)`, call the matching service, wrap the result with `Response.success`/`Response.error`, and catch errors via `ErrorApp.handleControllerError`. Controllers never talk to Prisma directly.
- **`services/*Service.js`** — all business logic and Prisma access. Errors are normalized with `ErrorApp.handleServiceError(error, context, code)`, which special-cases `AxiosError` and Prisma's `PrismaClientValidationError`/`PrismaClientInitializationError` before falling back to a generic `ErrorApp`.

`src/utils/response.js` (`Response`) and `src/utils/error.js` (`ErrorApp`) are the two shared conventions every layer uses — reuse them rather than inventing ad-hoc response shapes.

`src/middleware/authJwt.js` exports `authJwt(roles)`, a middleware factory: it verifies the bearer JWT, attaches the decoded payload to `req.usuario`, and requires the user to hold **every** role in `roles` (`req.usuario.roles.every(...)`, not `.some(...)`).

Prisma client is a single shared instance at `src/prisma/cliente.js` — import that, never instantiate a new `PrismaClient()` elsewhere.

### Database (Prisma / MySQL)

Single schema file at `prisma/schema.prisma`. Conventions to follow when extending it:
- Every model maps to a `snake_case` table via `@@map(...)`; model/field names are Spanish and match the domain vocabulary used throughout the code (`Factura`, `NotaCredito`, `Recibo`, `Empresa`, `Establecimiento`, `Caja`, etc.).
- Every model has `fecha_creacion DateTime @default(now())` and `fecha_modificacion DateTime @updatedAt` — match this pattern on new models.
- New columns added to tables with existing production rows must be `nullable` (MySQL/Prisma can't add `NOT NULL` without a default to a populated table, and there's no automatic backfill path here) — see the SIFEN fiscal fields on `Empresa` for the precedent, documented inline in the schema.
- The SIFEN domain (bottom of the file, `Certificado`, `Lote`, `EventoSifen`, `SifenTrazabilidad`, and their enums) was added additively in a single migration — no `DROP`/`MODIFY COLUMN` against legacy tables. Keep that property for any further SIFEN schema work.
- `FacturaDetalle.cantidad` / `NotaCreditoDetalle.cantidad` are `Decimal(10,4)` (not `Int`): SIFEN's E711 `dCantProSer` accepts up to **4 decimals** (Manual Técnico v150, field spec `N 1-10p(0-4)`), so item quantities support values like `1.5` or `5.34`. Input is validated by `validarCantidad` (`utils/facturacion.js`: numeric, `> 0`, `≤ 999999.9999`, ≤ 4 decimals) wired into the route chains. Two consequences to preserve: (1) Prisma returns `cantidad` as a `Prisma.Decimal` (serializes to a JSON *string*), so every GET runs it through `normalizarCantidadDetalles` to keep the historical `number` contract — do the same for any new read path that exposes `detalles`; and (2) the per-item total is guaraní-integer via `calcularTotalItem` (`Math.round`), matching how `xmlgen` rounds `dTotBruOpeItem`/`dTotOpeItem` for PYG (`pygDecimals=0`). Don't reintroduce raw `cantidad * precio` for the stored/printed total.

### The legacy-to-native dual-field pattern

Where a new native pipeline replaces a legacy one but both must temporarily coexist, this codebase freezes the legacy field and adds a new one rather than repurposing it in place — e.g. `Factura.sifen_estado` (free-text, written historically by the now-removed legacy sync) is frozen and untouched, while `Factura.estado_sifen` (`EstadoSifen` enum) is the field the native pipeline reads/writes. Same pattern for `xml` (legacy, frozen) vs `xml_firmado` (native). If you're asked to extend behavior that touches one of these pairs, the native field is the authoritative one for new code paths — and never resurrect the legacy field for new writes.

### Padrón RUC resolution: local table first, SIFEN `siConsRUC` as fallback

`padron_ruc` is a batch-imported snapshot (`padronRucImportService`, fed by uploading the SET's ZIPs through the endpoint — **there is no cron**), so a RUC registered after the last import is legitimately absent from it. Both consumers of the padrón (`emitirFactura` and `genericoService.getDatosByRuc` — the only two callers of `buscarPorRuc`) hit the local table first and, **only on a miss**, fall back to SIFEN's `siConsRUC` WS through `services/sifen/consultaRucService.js`. A local hit never touches the network or the certificate.

`consultarRucEnSifen` returns a **three-way** result, and the distinction is the whole point of the module:

| result | when | caller's behavior |
|---|---|---|
| `encontrado` | `0502` | adopt SIFEN's registro (then the blocking-state degradation below still applies normally) |
| `noExiste` | `0500` | **reject** the emission — the only path by which a RUC missing from the local padrón blocks |
| `indeterminado` | timeout, network failure, no usable certificate, `0501`, unexpected response shape | keep the previous behavior: fabricate the registro and emit **without** verifying |

Properties to preserve:
- **Never collapse `noExiste` and `indeterminado` into a boolean.** "SIFEN says it doesn't exist" is a positive answer; "we couldn't reach SIFEN" is not. Merging them makes a SIFEN outage reject perfectly valid RUCs.
- **`0501` is `indeterminado`, not a rejection.** It means *our* emisor RUC (the cert we consult with) isn't authorized to use the WS — it says nothing about the RUC being consulted.
- **`consultarRucEnSifen` never throws.** Every failure — including "no active certificate for this company" — is translated to `indeterminado`. An exception escaping would let a SIFEN outage break both emission and the client searcher, which is exactly what the local padrón exists to prevent.
- **Response codes and state codes are sourced, not guessed** — Manual Técnico v150 §9.6 (`siConsRUC`, `ContenedorRUC_v150.xsd`) and §12.3.5, local copy `Manual Técnico Versión 150.md`; additionally verified against the production WS (`0502` for an existing RUC, `0500` for nonexistent ones). Same rule as `utils/sifen/codigosRespuesta.js`.
- **`dCodEstCons` is translated to the padrón's textual vocabulary, not stored as the 3-letter code** (`ACT`→`ACTIVO`, `SUS`→`SUSPENSION TEMPORAL`, `SAD`→`SUSPENSION ADMINISTRATIVA`, `BLQ`→`BLOQUEADO`, `CAN`→`CANCELADO`, `CDE`→`CANCELADO DEFINITIVO`). This keeps `padron_ruc.estado` in one dialect and lets `bloqueaEmision()` keep working untouched. An unknown `dCodEstCons` is `indeterminado` — never assumed `ACTIVO`.
- **The WS does not return the DV** (there is no `dDVCons` in `ContRUC01-06`), so it's computed with Módulo 11 via `calcularDigitoVerificador` — the same algorithm the emission already used for RUCs missing from the padrón.
- **The RUC is pre-validated to 5–8 digits before the call** (`dRUCCons` is `A 5-8`). Outside that range SIFEN doesn't even answer a `rResEnviConsRUC` — it returns a `rRetEnviDe` with `0160 "XML Mal Formado"`, so the response parser must tolerate a body without the expected node.
- **SIFEN's answer is cached into `padron_ruc`.** That's the SET's own data, not an assumption of ours, and it's strictly better than the `estado: "ACTIVO"` the emission used to fabricate. A failure to cache is logged and swallowed — the registro is already in memory. (This does not contradict "`padron_ruc` is not written on degradation" below: that rule is about not overwriting a state we didn't observe.)
- **The searcher keeps a 404 on `indeterminado`, with a distinct message.** It can't degrade the way the emission does because it receives no `razonSocial` to build the `Cliente` with, while `emitirFactura` gets one in the request body — that asymmetry is why the two paths differ *only* in this case.
- **No `sifen_trazabilidad` record** (product decision): that table requires an `entidad_tipo`/`entidad_id` of a document, and the consultation happens before any Factura exists. The `[consultaRucSifen]` log line is the only trace — don't remove it, same role as `[receptorFallback]`.
- **The consultation is capped at 5 s, and the cap lives in `sifenClientService.consultaRuc`, not in the call sites.** The library defaults to 90 s for every operation, which is fine for the lote pipeline (cron, can wait) but not here: this consultation hangs off a synchronous user request (the client searcher and the caja emission), so a SIFEN outage would block the UI that long per search. Putting the default in the wrapper means any present or future RUC consultation inherits it without each caller having to remember a `config`; a caller can still raise it by passing its own `config.timeout`. Tunable via `SIFEN_CONSULTA_RUC_TIMEOUT_MS`. Shortening the wait is safe precisely because exhausting it is `indeterminado`, never `noExiste` — it cannot turn "we don't know" into "the RUC doesn't exist". Do **not** extend this cap to `recibeLote`/`consultaLote`/`consulta`/`evento`: those run in cron and legitimately need the long default.

There is a **second** call site for the same service: a local *hit* whose state is blocking is revalidated against SIFEN before the degradation described in the next section runs. `padron_ruc` is a manually refreshed snapshot and over half its rows are in a blocking state (`SUSPENSION TEMPORAL` alone is ~408k, and it's a transitory state — the taxpayer settles up with the SET and returns to `ACTIVO`), so without this a contribuyente regularized after the last import would be silently and irreversibly degraded to consumidor final over a stale row. Sampling 12 suspended RUCs against the production WS found 1 already regularized.

Properties to preserve here too:
- **It runs only on the blocking path, and never twice per request.** Both `emitirFactura` and `getDatosByRuc` track whether `registroPadron`/`registro` already came from a fresh SIFEN answer (`registroVerificadoEnSifen`) and skip the revalidation if so — otherwise a single emission could wait out two network timeouts to answer the same question.
- **`indeterminado` and `noExiste` keep the local blocking state and degrade as before.** A SIFEN outage must not become a way to bypass a real block — the asymmetry with the miss path is deliberate: there, not knowing means "don't reject"; here, not knowing means "don't unblock".
- **When SIFEN confirms the block, its registro is adopted anyway**, so the error message and the degradation name the state currently in force rather than the one in the stale snapshot (a RUC can move between blocking states).
- **The searcher must run this too.** If only the emission revalidated, the front would show the client degraded to consumidor final while the emission resolved them as contribuyente — the two paths would disagree on the receptor.

### Procedencia de las filas de `padron_ruc` (`origen`) y el cron que verifica lo fabricado

`padron_ruc` mezcla tres fuentes que antes eran indistinguibles entre sí, y la columna `origen` (nullable `OrigenPadronRuc`) las separa:

| `origen` | Escrito por | `fecha_verificacion_sifen` | `razon_social` en el upsert |
|---|---|---|---|
| `BATCH` | `padronRucZipService` (import de los ZIP del DNIT) | no la toca (COALESCE conserva) | **la pisa** |
| `SIFEN` | `adoptarRegistroDeSifen` en `emitirFactura` / `getDatosByRuc`, y el cron | `NOW()` | la conserva (salvo `pisarRazonSocial: true`) |
| `FABRICADO` | `emitirFactura` cuando el RUC no está y SIFEN salió `indeterminado` | no la toca | la conserva |

`NULL` = anterior a esta trazabilidad (en la práctica `BATCH`); no se hizo backfill para no correr un UPDATE sobre ~2M filas. Propiedades a preservar:

- **`origen` es obligatorio en `guardarLote`** y se valida; un valor fuera de la lista lanza. No agregar un default: el punto entero es que cada call site declare de dónde sale el dato.
- **Solo `BATCH` pisa `razon_social`.** El TXT del DNIT trae a las personas físicas como `"APELLIDOS, NOMBRES"` y `genericoService.separarNombre` usa esa coma para poblar `cliente.nombres`/`apellidos`; `dRazCons` del WS la devuelve corrida y sin coma. Pisar una fila del batch con la versión de SIFEN **destruye** el límite apellido/nombre y no se puede reconstruir. De SIFEN lo que se necesita es el `estado` — ese sí se actualiza siempre. Contrapartida asumida: un cambio real de razón social espera a la próxima importación batch. (La coma **no** indica procedencia: ~164k filas del propio batch no la tienen, son personas jurídicas.)
- **`fecha_verificacion_sifen` no es `fecha_modificacion`.** `guardarLote` pisa `fecha_modificacion` con `NOW()` en cada upsert, así que tras una importación las 2M filas dicen "modificada hoy" y no sirve para medir frescura por RUC. Un upsert `BATCH` **conserva** el valor previo vía `COALESCE`: una importación masiva no debe borrar el hecho de que un RUC se verificó individualmente.
- **`FABRICADO` existe porque la invención se auto-sella.** `emitirFactura` la escribe con `estado: "ACTIVO"`, y ACTIVO es justamente el único estado que **no** dispara revalidación en el camino de lectura — sin la marca, nada volvía a cuestionarla salvo una importación batch manual. Bajar el timeout de `siConsRUC` a 5 s aumentó la frecuencia de este camino (más `indeterminado`), así que la marca dejó de ser teórica.

`padronRucVerificacionService.verificarRucsFabricados` (cron diario **08:00**, `cronJobs.js`) cierra ese ciclo:

- **Solo toca `origen = 'FABRICADO'`.** Nunca recorre el padrón: son ~2M filas, `siConsRUC` es una llamada por RUC, y el Manual Técnico §7 reserva a la SET el derecho de *"limitar y/o restringir la utilización de los servicios por contribuyente, por direcciones IP u otros"* — la misma IP y el mismo certificado con los que emitimos.
- **El certificado sale de la empresa que tiene ese RUC como cliente** (`cliente` + `cliente_empresa`), que por construcción es la que lo fabricó al emitirle. Mantiene el invariante de que cada empresa consulta con **su** certificado; nadie gasta la cuota del WS de un contribuyente ajeno. Sin cliente que lo reclame la fila se omite y se reintenta — no se cae a "cualquier certificado".
- **Los tres desenlaces, otra vez distintos.** `encontrado` → se adopta el registro (con `pisarRazonSocial: true`: ahí la razón social guardada es la que tipeó el usuario, no dato del DNIT) y la fila **se gradúa** a `SIFEN`, saliendo del universo del job. `noExiste` → se **elimina** la fila (es una invención nuestra que la SET desmiente; dejarla sería peor, seguiría respondiendo ACTIVO) y se loguea entera antes de borrar. `indeterminado` → se deja como está y se reintenta mañana; una caída de SIFEN nunca confirma nuestra suposición.
- **Alerta por Telegram** cuando un fabricado resulta bloqueante o inexistente: significa que ya se emitió un DE a un receptor al que no correspondía, y eso se revisa a mano.
- **Techo por corrida** (`PADRON_RUC_VERIFICACION_MAX_POR_CORRIDA`) y pausa entre consultas (`PADRON_RUC_VERIFICACION_PAUSA_MS`), con log explícito cuando el techo trunca. No es por el volumen actual: es para que un bug que marque de más no se convierta en un barrido del padrón.
- Cada fila está aislada en su propio try/catch — un RUC que falle no aborta la corrida.

### Receptor fallback: RUC bloqueado en el padrón

A RUC in a blocking state (`CANCELADO` / `CANCELADO DEFINITIVO` / `SUSPENSION TEMPORAL`, see `utils/sifen/estadoPadronRuc.js`) does **not** reject the emission anymore. `services/receptorFallbackService.js` degrades the receptor to a consumidor final identified by cédula: for a persona física the RUC base *is* the CI, so it is looked up against the identity registry (`URL_CI`) and, if found, `emitirFactura` rewrites `datos` in place to `NO_CONTRIBUYENTE` / `CEDULA`. SIFEN accepts this because D206c/d only run when the DE informs a RUC.

Properties to preserve when touching this:
- **The blocking state that triggers this is revalidated against SIFEN first** (see the previous section) — the degradation never fires straight off a local `padron_ruc` hit. Everything below applies once SIFEN has confirmed the block, or couldn't be reached.
- **The degradation is automatic and unconfirmed** (product decision). It is irreversible for the receptor — the invoice can't be used as crédito fiscal, and a Nota de Crédito does not fix it (the NC doesn't change the receptor's naturaleza). The `[receptorFallback]` log line is the only trace; don't remove it.
- **The `URL_CI` lookup is capped at 5 s too** (`cedulaService`, tunable via `TIMEOUT_CI`). It runs in the same two synchronous request paths as the RUC consultation and immediately after it, so leaving axios' no-timeout default here would just move the hang one call down. The timeout is translated to an `ErrorApp` 504 rather than propagating as a raw `AxiosError` (which, having no `response`, would surface as a 500 reading "timeout of 5000ms exceeded"); `resolverReceptorPorCedula` still swallows it and keeps the original 400, so this path is unchanged. A timeout is never `null` — only an actual answer from the service means "the cédula doesn't exist".
- **It applies to personas físicas only.** RUCs with the `80` prefix (personas jurídicas) are discarded before hitting the network; the `URL_CI` lookup is the second barrier. If neither passes — including when `URL_CI` is down, whose error is deliberately swallowed — the caller keeps the original 400 about the RUC state, never a 500.
- **The searcher and the emission must stay in sync.** `genericoService.getDatosByRuc` runs the same degradation so the client the front resolves is the same receptor `emitirFactura` ends up emitting to. Both call `resolverReceptorPorCedula`; don't fork the logic.
- `padron_ruc` is **not** written on degradation — the RUC's state is the SET's fact, not ours to overwrite.
- **Receptor lookup is scoped by `situacion_tributaria`, not by document alone** (`emitirFactura`, and `genericoService` already did it). The same number can legitimately exist as a `CONTRIBUYENTE` row (in the legacy base-without-DV format) and as a `NO_CONTRIBUYENTE` one — they are different SIFEN receptors (different `iNatRec`/`iTiOpe`, `dRucRec`/`dDVRec` vs `dNumIDRec`/`iTipIDRec`). Matching on `ruc` alone let a cédula emission pick up the contribuyente row and flip its `situacion_tributaria`/`tipo_identificacion`, mutating a Cliente shared by other invoices. Don't widen this lookup back.

### SIFEN native pipeline (`src/services/sifen/`, `src/utils/sifen/`)

This is the core of the ongoing migration — native (no PHP intermediary) Paraguayan e-invoicing:

- **`sifenClientService.js`** — thin wrapper over the `facturacionelectronicapy-setapi` SOAP client. Only exposes `recibeLote`, `evento`, `consultaLote`, `consulta`, `consultaRuc` (never `recibe`, a single-document send). Certificate (path + already-decrypted password) is passed explicitly per call — no global cert state.
- **`certificadoService.js`** — CRUD for `Certificado`, enforces "one active certificate per company" via `prisma.$transaction` (deactivate-then-activate atomically), encrypts the P12 password at rest with `utils/crypto.js` (AES-256-GCM, key from `CERT_ENCRYPTION_KEY` env var, never stored in the DB), and refuses to hand back an expired certificate.
- **`consultaRucService.js`** — fallback to the `siConsRUC` WS when a RUC isn't in the local `padron_ruc`. Returns the three-way `encontrado`/`noExiste`/`indeterminado` result described above and never throws; see the padrón resolution section for the properties that must hold.
- **`xmlBuilderService.js`** — maps `Factura`/`NotaCredito` + relations to the DE XML payload consumed by `facturacionelectronicapy-xmlgen`. Contains documented workarounds for real bugs found in that vendored library (e.g. `repararCTipRegVacio`, and the innominado receptor's `razonSocial` override — see the inline comments for why) — don't "clean up" that code without re-reading those explanations, the workarounds are load-bearing.
- **`firmadorService.js`** — wraps `facturacionelectronicapy-xmlsign`, always signs via the Node implementation (`signByNodeJS: true`), never the Java path — the Java signing path in that library is vulnerable to command injection via the P12 password, so it's deliberately never used here.
- **`qrService.js`** — wraps `facturacionelectronicapy-qrgen` to append the KUDE QR node to a signed XML. Requires the XML to already be signed.
- **`loteService.js`** — the only path documents are emitted through: builds batches (`armarLotes`), sends them (`enviarLotesConstruidos`), polls status (`consultarLotes`), and does redundant individual polling (`consultaIndividualRedDeSeguridad`). Retries use exponential backoff (`SIFEN_LOTE_BACKOFF_BASE_SEGUNDOS`/`_CAP_SEGUNDOS`/`SIFEN_LOTE_MAX_INTENTOS`). Errors are isolated per-document/per-lot/per-company at every stage — a failure for one company/document must never abort processing for others.
- **`eventoService.js`** — synchronous cancellation flow (`cancelarFactura`/`cancelarNotaCredito`), separate from the batch pipeline; guards that a document is `APROBADO` before allowing cancellation.
- **`trazabilidadService.js`** — the mandatory logging point (`registrarInteraccion`) for every SIFEN interaction; doesn't interpret response content, only persists it. Has its own retention/cleanup job.
- **`utils/sifen/codigosRespuesta.js`** — the map of known SIFEN response codes to categories. **Never invent a code here** — codes must be verified against the official SET/DNIT technical manual before being added; unmapped codes default to `RECHAZADO` + `alertar: true`.
- **`utils/sifen/cdc.js`** — CDC (unique document code) construction and Módulo 11 check-digit calculation. Self-contained; note `formatearFechaEmision` uses local `Date` getters, not UTC — callers must pass a `Date` whose local calendar fields already reflect the real Paraguay emission day.

`cronJobs.js` (`src/services/cronJobs.js`) registers the SIFEN batch/poll/cleanup/cert-expiry jobs via `node-cron`. Each job is wrapped in its own try/catch that only logs — a failure in one scheduled job must never crash the process or block the others.

### Known environment constraint: PDF generation

`src/utils/generarPdf.js` (and `generarPdfRecibo.js`) render invoices/receipts via JasperReports through the `java` npm package (a native Node↔JVM bridge, classpath pointed at jars in `src/resources/lib/`). This bridge's native binding is compiled against a specific `NODE_MODULE_VERSION` and will hard-fail (`ERR_DLOPEN_FAILED`) to even load on a Node version it wasn't built for — this is a pre-existing, environment-level constraint, not something to "fix" as part of unrelated work. If a `require()` of `facturaService.js`/`notaDeCreditoService.js` fails this way, verify with `node --check` (syntax only) instead of trying to load the module, and don't treat the dlopen failure as a regression you introduced.

### Auth

JWT-based (`src/utils/jwt.js` + `src/middleware/authJwt.js`), role-gated per route. There's no session store — roles come from the decoded JWT payload, refreshed only on login.

### Environment variables

`.env.example` is the authoritative list. Notable groups: SIFEN config (`SIFEN_ENV=test|prod`, `CERT_ENCRYPTION_KEY`, retry/backoff tuning, `SIFEN_TRAZABILIDAD_RETENCION_DIAS`), legacy PHP API DB connection (`*_API_FACT` — being phased out, `src/db/dbApiFacturacion.js` is already dead code pending removal), email (`EMAIL*`), and Docker-specific ports. Never commit real values — `.env` is gitignored.

## Other notes

- `.claude/skills/factyble-sifen-auditor/` is a project-level Claude Code skill (`SKILL.md`) for running a static, read-only forensic audit of the SIFEN pipeline — it never connects to a DB, SIFEN, or any external service, and never modifies code. If asked to audit the migration, this skill's process is the one to follow.
- Prefer reading vendored library source under `node_modules/facturacionelectronicapy-*` directly when its documented behavior is unclear or you need to confirm a contract — several documented workarounds exist because of bugs found by reading that source rather than trusting the library's own docs.
