# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`factyble-back` is an Express + Prisma (MySQL) backend for Factyble, a Paraguayan electronic-invoicing (facturación electrónica) SaaS. It is mid-migration: it is absorbing the functionality of a legacy PHP service (`factyble-api`) and replacing it with a native SIFEN (Paraguay's tax authority e-invoicing system) integration written directly in this repo. **Before touching anything under `services/sifen/`, `utils/sifen/`, SIFEN-related Prisma models, or `cronJobs.js`, read `MIGRATION_PLAN.md`** — specifically the "Estado de implementación" section at the top, which tracks phase-by-phase what's done, what deliberately deviated from the original plan (and why), and what's still pending. Treat it as living documentation, not a historical record: update it when you change SIFEN-pipeline behavior.

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

Where a new native pipeline replaces a legacy one but both must temporarily coexist, this codebase freezes the legacy field and adds a new one rather than repurposing it in place — e.g. `Factura.sifen_estado` (free-text, written historically by the now-removed legacy sync) is frozen and untouched, while `Factura.estado_sifen` (`EstadoSifen` enum) is the field the native pipeline reads/writes. Same pattern for `xml` (legacy, frozen) vs `xml_firmado` (native). If you're asked to extend behavior that touches one of these pairs, check `MIGRATION_PLAN.md`'s "Desvíos respecto del texto original del plan" section before assuming which field is authoritative for new code paths — and never resurrect the legacy field for new writes.

### SIFEN native pipeline (`src/services/sifen/`, `src/utils/sifen/`)

This is the core of the ongoing migration — native (no PHP intermediary) Paraguayan e-invoicing:

- **`sifenClientService.js`** — thin wrapper over the `facturacionelectronicapy-setapi` SOAP client. Only exposes `recibeLote`, `evento`, `consultaLote`, `consulta`, `consultaRuc` (never `recibe`, a single-document send). Certificate (path + already-decrypted password) is passed explicitly per call — no global cert state.
- **`certificadoService.js`** — CRUD for `Certificado`, enforces "one active certificate per company" via `prisma.$transaction` (deactivate-then-activate atomically), encrypts the P12 password at rest with `utils/crypto.js` (AES-256-GCM, key from `CERT_ENCRYPTION_KEY` env var, never stored in the DB), and refuses to hand back an expired certificate.
- **`xmlBuilderService.js`** — maps `Factura`/`NotaCredito` + relations to the DE XML payload consumed by `facturacionelectronicapy-xmlgen`. Contains documented workarounds for real bugs found in that vendored library (e.g. `repararCTipRegVacio` — see MIGRATION_PLAN.md for why) — don't "clean up" that code without re-reading the linked explanation, the workaround is load-bearing.
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

`.env.example` is the authoritative list. Notable groups: SIFEN config (`SIFEN_ENV=test|prod`, `CERT_ENCRYPTION_KEY`, retry/backoff tuning, `SIFEN_TRAZABILIDAD_RETENCION_DIAS`), legacy PHP API DB connection (`*_API_FACT` — being phased out, `src/db/dbApiFacturacion.js` is already dead code pending removal, see MIGRATION_PLAN.md), email (`EMAIL*`), and Docker-specific ports. Never commit real values — `.env` is gitignored.

## Other notes

- `.claude/skills/factyble-sifen-auditor/` is a project-level Claude Code skill (`SKILL.md`) for running a static, read-only forensic audit of the SIFEN migration against `MIGRATION_PLAN.md` — it never connects to a DB, SIFEN, or any external service, and never modifies code. If asked to audit the migration, this skill's process is the one to follow.
- Prefer reading vendored library source under `node_modules/facturacionelectronicapy-*` directly when its documented behavior is unclear or you need to confirm a contract — MIGRATION_PLAN.md's "spikes" were resolved exactly this way, and several documented workarounds exist because of bugs found by reading that source rather than trusting the library's own docs.
