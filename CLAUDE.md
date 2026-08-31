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
- The consultation uses the library's default **90 s** timeout (explicit decision: prefer exhausting the wait over emitting unverified). Be aware this can hang a caja emission that long when SIFEN is unresponsive.

There is a **second** call site for the same service: a local *hit* whose state is blocking is revalidated against SIFEN before the degradation described in the next section runs. `padron_ruc` is a manually refreshed snapshot and over half its rows are in a blocking state (`SUSPENSION TEMPORAL` alone is ~408k, and it's a transitory state — the taxpayer settles up with the SET and returns to `ACTIVO`), so without this a contribuyente regularized after the last import would be silently and irreversibly degraded to consumidor final over a stale row. Sampling 12 suspended RUCs against the production WS found 1 already regularized.

Properties to preserve here too:
- **It runs only on the blocking path, and never twice per request.** Both `emitirFactura` and `getDatosByRuc` track whether `registroPadron`/`registro` already came from a fresh SIFEN answer (`registroVerificadoEnSifen`) and skip the revalidation if so — otherwise a single emission could wait out two 90 s timeouts to answer the same question.
- **`indeterminado` and `noExiste` keep the local blocking state and degrade as before.** A SIFEN outage must not become a way to bypass a real block — the asymmetry with the miss path is deliberate: there, not knowing means "don't reject"; here, not knowing means "don't unblock".
- **When SIFEN confirms the block, its registro is adopted anyway**, so the error message and the degradation name the state currently in force rather than the one in the stale snapshot (a RUC can move between blocking states).
- **The searcher must run this too.** If only the emission revalidated, the front would show the client degraded to consumidor final while the emission resolved them as contribuyente — the two paths would disagree on the receptor.

### Receptor fallback: RUC bloqueado en el padrón

A RUC in a blocking state (`CANCELADO` / `CANCELADO DEFINITIVO` / `SUSPENSION TEMPORAL`, see `utils/sifen/estadoPadronRuc.js`) does **not** reject the emission anymore. `services/receptorFallbackService.js` degrades the receptor to a consumidor final identified by cédula: for a persona física the RUC base *is* the CI, so it is looked up against the identity registry (`URL_CI`) and, if found, `emitirFactura` rewrites `datos` in place to `NO_CONTRIBUYENTE` / `CEDULA`. SIFEN accepts this because D206c/d only run when the DE informs a RUC.

Properties to preserve when touching this:
- **The blocking state that triggers this is revalidated against SIFEN first** (see the previous section) — the degradation never fires straight off a local `padron_ruc` hit. Everything below applies once SIFEN has confirmed the block, or couldn't be reached.
- **The degradation is automatic and unconfirmed** (product decision). It is irreversible for the receptor — the invoice can't be used as crédito fiscal, and a Nota de Crédito does not fix it (the NC doesn't change the receptor's naturaleza). The `[receptorFallback]` log line is the only trace; don't remove it.
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

The JasperReports classpath is registered once in `src/utils/jvm.js` — require that instead of `java` directly, since node-java freezes the classpath on the first call into the JVM and a later `classpath.push` throws.

`src/utils/imprimirJasper.js` prints a filled report straight to a named Windows printer (`JRPrintServiceExporter` + `PrinterName`), reusing the same `jasperPrint` the PDF is exported from — so paper and archived PDF can't drift. Enabled per-emission via `datos.impresora`, which only the on-prem Starsoft flow sets (from `IMPRESORA_TICKETS`). Every emission on that flow is person-triggered from the caja screen (the innominadas cron that emitted in unattended batches is gone), so `procesarFacturaService` sets it unconditionally. Printing is wrapped in its own try/catch inside `generarPdf` on purpose — by then the invoice is already emitted and signed, so a paper jam must not fail the request and send the outbox lock back to `PENDIENTE`, which would double-emit the sale.

### Starsoft/PVTA integration (`starsoft/`)

The on-prem deployment reads sales from `PVTA`, the MSSQL database of Starsoft (a third-party POS). Everything we install *inside* that database lives in `starsoft/`: the two views (`FACTYBLE_VENTAS_SIFEN`, `FACTYBLE_VENTAS_SIFEN_MIN`), the append-only event queue (`FACTYBLE_SIFEN_OUTBOX`) and its trigger, plus migrations and diagnostics. **Read `starsoft/README.md` before touching any of it** — it documents the install order, the SQL Server 2008 R2 syntax ceiling, and two performance rules learned from real incidents (no window functions in views that get filtered by key; no `RTRIM()` on join/`WHERE` columns — both destroy seeks on that optimizer).

Non-obvious invariants documented there and easy to break: the outbox has no `IDENTITY` column on purpose (it would clobber `@@IDENTITY` inside Starsoft's own transaction), its trigger is `AFTER INSERT, UPDATE` (Starsoft writes the sale as a `TipCmp=0` draft first), and a `PROCESADO` row *is* the "already invoiced" record — deleting one lets the trigger re-enqueue and double-emit. Only `PENDIENTE`/`PROCESANDO` rows are ever safe to delete.

Tables owned by Starsoft (`FACVEN`, `FACVENLEVEL1`, `CLIENTE`, `CFGEMP`) are off-limits: read-only through our views, no DDL. `starsoft/PVTA-modelo-datos.md` has the reverse-engineered data model — note that `CliId` is *not* unique, clients join on the composite `(CliId, CliEmp)`.

### Auth

JWT-based (`src/utils/jwt.js` + `src/middleware/authJwt.js`), role-gated per route. There's no session store — roles come from the decoded JWT payload, refreshed only on login.

### Environment variables

`.env.example` is the authoritative list. Notable groups: SIFEN config (`SIFEN_ENV=test|prod`, `CERT_ENCRYPTION_KEY`, retry/backoff tuning, `SIFEN_TRAZABILIDAD_RETENCION_DIAS`), legacy PHP API DB connection (`*_API_FACT` — being phased out, `src/db/dbApiFacturacion.js` is already dead code pending removal), email (`EMAIL*`), and Docker-specific ports. Never commit real values — `.env` is gitignored.

## Other notes

- `.claude/skills/factyble-sifen-auditor/` is a project-level Claude Code skill (`SKILL.md`) for running a static, read-only forensic audit of the SIFEN pipeline — it never connects to a DB, SIFEN, or any external service, and never modifies code. If asked to audit the migration, this skill's process is the one to follow.
- Prefer reading vendored library source under `node_modules/facturacionelectronicapy-*` directly when its documented behavior is unclear or you need to confirm a contract — several documented workarounds exist because of bugs found by reading that source rather than trusting the library's own docs.
