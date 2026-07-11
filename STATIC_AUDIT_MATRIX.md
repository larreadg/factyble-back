# STATIC_AUDIT_MATRIX.md — Plan vs. implementación

Auditoría estática, commit `9be7419` (rama `prisma-claude`), 2026-07-11. Cada fila convierte una
afirmación de `MIGRATION_PLAN.md` en un veredicto basado en evidencia de código, no en el estado
`✅` que el propio plan se autoasigna.

Resultados posibles: `CONFIRMADO ESTÁTICAMENTE`, `PARCIAL`, `NO CONFIRMADO`, `CONTRADICCIÓN`,
`NO VERIFICABLE ESTÁTICAMENTE`.

## Fase 1 — Fundamentos

| Ítem | Estado declarado | Evidencia estática esperada | Evidencia encontrada | Resultado | Riesgo / hallazgo |
|---|---|---|---|---|---|
| Migración Prisma `20260710015934_add_sifen_domain` 100% aditiva | ✅ Hecho | SQL sin `DROP`/`MODIFY COLUMN` | `migration.sql` leído íntegro: solo `ADD COLUMN`, `CREATE TABLE`, `CREATE INDEX`, `ADD CONSTRAINT` (FK) | **CONFIRMADO ESTÁTICAMENTE** | — |
| Columnas fiscales nuevas de `Empresa` nullable | ✅ Hecho | `schema.prisma` sin `NOT NULL` en los campos fiscales nuevos | Confirmado línea a línea (ruc_sin_dv, tipo_contribuyente, tipo_impuesto, csc, csc_id, etc. todos `?`) | **CONFIRMADO ESTÁTICAMENTE** | — |
| 4 libs `facturacionelectronicapy-*` instaladas en las versiones declaradas | ✅ Hecho | `package-lock.json` con las versiones citadas | xmlgen 1.0.283, xmlsign 1.0.28, setapi 1.0.34, qrgen 1.0.9 — coinciden exactamente | **CONFIRMADO ESTÁTICAMENTE** | — |
| `overrides.xml2js` resuelve a `^0.6.2` | ✅ Hecho | `package-lock.json` | xml2js resuelto a 0.6.2 | **CONFIRMADO ESTÁTICAMENTE** | — |
| Variables de entorno SIFEN documentadas en `.env.example` | ✅ Hecho | `SIFEN_ENV`, `CERT_ENCRYPTION_KEY`, retry/backoff | Las 7 variables citadas están presentes | **CONFIRMADO ESTÁTICAMENTE** | Falta `TZ` — no declarada como necesaria por el plan, pero ver AUD-002 |
| Spikes #1 y #2 resueltos por lectura de código | ✅ 2/3 | N/A (resueltos en sesión previa, no re-verificable sin releer `node_modules/facturacionelectronicapy-*` fuente) | No se releyó el código fuente de las libs en esta pasada (ver limitaciones) | **NO VERIFICABLE ESTÁTICAMENTE** (en esta pasada) | Se acepta como ya documentado por el plan con cita de archivo:línea de la lib — no se encontró motivo para dudar, pero esta auditoría no re-verificó el código fuente de las libs de cero |
| Spike #3 (round-trip test) | ⬜ Descartado por decisión de usuario | N/A | Confirmado: no hay `SIFEN_TEST_*` env vars ni código de test | **CONFIRMADO ESTÁTICAMENTE** (como decisión, no como validación) | La ambigüedad de `respuestaSoap.js` (AUD-008) es consecuencia directa de este descarte |

## Fase 2 — CDC + XML + firma + QR

| Ítem | Estado declarado | Evidencia estática esperada | Evidencia encontrada | Resultado | Riesgo / hallazgo |
|---|---|---|---|---|---|
| `cdc.js` — Módulo 11 y armado de 44 caracteres | ✅ Hecho | Algoritmo correcto, longitudes validadas | Confirmado: pesos cíclicos 2-11, `resto>1?11-resto:0`, `rellenarNumerico` valida longitud y lanza si excede | **CONFIRMADO ESTÁTICAMENTE** | — |
| `cdc.js` usa getters locales de `Date`, con la responsabilidad de TZ delegada al caller | ✅ Hecho, documentado como riesgo a cargo del caller | Comentario explícito + verificación de que el caller pasa un `Date` correcto | `facturaService.js`/`notaDeCreditoService.js` pasan `new Date()` sin conversión de TZ; no hay `TZ` configurada en el entorno de despliegue | **CONTRADICCIÓN** (el riesgo que el propio código advierte nunca fue cerrado por el caller) | **AUD-002 (P1)** |
| `xmlBuilderService.js` — escape de XML delegado a `xml2js.Builder` | ✅ Hecho | Sin `.replace()` manual de `&`/`<`/`>` | Confirmado: no hay reemplazo manual de entities en el archivo | **CONFIRMADO ESTÁTICAMENTE** | — |
| `xmlBuilderService.js` — workaround `repararCTipRegVacio` documentado | ✅ Hecho | Función presente y aplicada a ambos builders (Factura/NC) | Confirmado: `repararCTipRegVacio` se aplica al resultado de `generateXMLDE` en ambos casos | **CONFIRMADO ESTÁTICAMENTE** | — |
| `xmlBuilderService.js` — email de establecimiento (`dEmailE`) obligatorio, mapeado desde `Empresa.email` | ✅ Hecho | Cada establecimiento recibe `item.email` | Confirmado línea 161 | **CONFIRMADO ESTÁTICAMENTE** | — |
| Códigos de establecimiento convertidos a `Number` para comparación estricta de xmlgen | ✅ Hecho | `Number(establecimiento.cod_departamento)` etc. | Confirmado líneas 149-151 | **CONFIRMADO ESTÁTICAMENTE** | — |
| `firmadorService.js` — `signByNodeJS`/`FIRMAR_CON_NODEJS` fijo en `true` en las 3 funciones | ✅ Hecho | Constante `true` pasada explícitamente en cada llamada a `xmlsign` | Confirmado: `firmarXmlDocumento`, `firmarXmlEvento`, `obtenerVencimientoCertificado` pasan `FIRMAR_CON_NODEJS` (=true) como último argumento, nunca omitido | **CONFIRMADO ESTÁTICAMENTE** | Mitiga el riesgo de inyección de comandos vía la vía Java de la lib |
| `qrService.js` — exige XML ya firmado, guard de CSC/CSC ID | ✅ Hecho | `if (!idCSC \|\| !csc) throw ...` antes de llamar a `qrgen` | Confirmado líneas 28-30 | **CONFIRMADO ESTÁTICAMENTE** | Pero `csc` se usa en texto plano — ver AUD-006 |
| Orden real del pipeline: XML → firma → QR | ✅ Hecho | `loteService.firmarYPersistirDocumento` invoca en ese orden | Confirmado: `construirXml` → `firmarXmlDocumento` → `generarQr`, en ese orden, línea 147-156 | **CONFIRMADO ESTÁTICAMENTE** | — |
| Validación XSD end-to-end contra `siRecepDE_v150.xsd` | ✅ Hecho (2026-07-10) | No verificable sin fixtures/XSD persistidos en el repo | Ni el XSD ni el script ad-hoc están en el repo (documentado como no persistido) | **NO VERIFICABLE ESTÁTICAMENTE** | Es exactamente lo que el propio plan admite — la validación XSD no dejó artefacto reproducible en el repo |

## Fase 3 — SifenClient + certificados + trazabilidad

| Ítem | Estado declarado | Evidencia estática esperada | Evidencia encontrada | Resultado | Riesgo / hallazgo |
|---|---|---|---|---|---|
| `sifenClientService.js` expone solo `recibeLote/evento/consultaLote/consulta/consultaRuc`, nunca `recibe` | ✅ Hecho | `module.exports` sin `recibe` | Confirmado: `module.exports` lista exactamente esas 5 funciones | **CONFIRMADO ESTÁTICAMENTE** | — |
| `SIFEN_ENV` normalizado, fail-safe hacia `test` ante cualquier valor ≠ `"prod"` | ✅ Hecho (implícito) | `SIFEN_ENV === 'prod' ? 'prod' : 'test'` | Confirmado en `sifenClientService.js:24` y `qrService.js:5`, idéntico patrón en ambos | **CONFIRMADO ESTÁTICAMENTE** | Diseño correcto y seguro (nunca cae a producción por typo) — ver nota en el informe narrativo |
| `recibeLote` valida 1-50 documentos antes de llamar a la lib | ✅ Hecho | Guard explícito antes del `try` | Confirmado líneas 44-50 | **CONFIRMADO ESTÁTICAMENTE** | — |
| `certificadoService` — "un activo por empresa" enforzado en transacción | ✅ Hecho, con advertencia propia de que no es constraint de BD | `updateMany`+`create`/`update` dentro de `$transaction` | Confirmado, patrón presente en `crearCertificado` y `activarCertificado` | **PARCIAL** | **AUD-005 (P2)** — el propio plan ya admite la limitación; el código no añade ninguna mitigación adicional (advisory lock, tabla auxiliar) más allá de la transacción |
| `obtenerCertificadoActivo` rechaza certificados vencidos | ✅ Hecho | `if (certificado.estado === 'VENCIDO') throw` | Confirmado línea 115-117 | **CONFIRMADO ESTÁTICAMENTE** (solo para VENCIDO) | **AUD-004 (P2)** — no rechaza REVOCADO |
| `Certificado.clave` cifrada con AES-256-GCM antes de persistir | ✅ Hecho | `encrypt()`/`decrypt()` de `utils/crypto.js` usados en el flujo de alta/lectura | Confirmado: `crearCertificado` cifra antes de `create`, `obtenerCertificadoActivo` descifra antes de devolver | **CONFIRMADO ESTÁTICAMENTE** | — |
| `trazabilidadService.registrarInteraccion` es punto central, no interpreta contenido | ✅ Hecho | Función pura de persistencia | Confirmado: solo serializa y persiste, `codigoRespuesta`/`exitoso` los decide el caller | **CONFIRMADO ESTÁTICAMENTE** | Ver AUD-010 sobre PII/retención |
| `limpiezaTrazabilidad` usa retención configurable, default 90 días | ✅ Hecho | `SIFEN_TRAZABILIDAD_RETENCION_DIAS` con default 90 | Confirmado línea 92 | **CONFIRMADO ESTÁTICAMENTE** | — |

## Fase 4 — loteService + eventoService + jobs

| Ítem | Estado declarado | Evidencia estática esperada | Evidencia encontrada | Resultado | Riesgo / hallazgo |
|---|---|---|---|---|---|
| `codigosRespuesta.js` — códigos sembrados con fuente oficial citada, no inventados | ✅ Hecho | Mapa con 0142/0260/0300/0301, comentarios de fuente | Confirmado: cada entrada documenta su origen; códigos desconocidos default a `RECHAZADO`+`alertar:true` (no inventa categorías optimistas) | **CONFIRMADO ESTÁTICAMENTE** (no se pudo re-verificar contra el Manual Técnico SIFEN externo en esta pasada — ver limitación) | — |
| `respuestaSoap.js` — extracción robusta a namespace, por sufijo | ✅ Hecho, con advertencia propia de no estar confirmada contra respuesta real | Búsqueda recursiva por sufijo de tag | Confirmado el algoritmo; confirmado que nunca se ejecutó contra una respuesta SOAP real (spike #3 descartado) | **PARCIAL** | **AUD-008 (P2)** |
| `loteService` — aislamiento de error por documento/lote/empresa en las 3 etapas | ✅ Hecho ("corrige antipatrón Q en las 3, no 2/3 como v2") | `try/catch` individual en cada etapa (armado, envío, consulta) | Confirmado: `firmarPendientes`, `enviarLotesConstruidos`, `consultarLotes`, `consultaIndividualRedDeSeguridad` aíslan cada uno por documento/lote con su propio try/catch | **CONFIRMADO ESTÁTICAMENTE** | — |
| `crearLoteConDocumentos` — creación de Lote + asignación de documentos en una sola transacción | ✅ Hecho ("evita antipatrón I") | `prisma.$transaction` envolviendo `lote.create` + `updateMany` | Confirmado líneas 321-338 | **CONFIRMADO ESTÁTICAMENTE** (atomicidad interna) | **AUD-003/AUD-009 (P1/P2)** — atómico puertas adentro, pero sin claim previo a la selección; la carrera ocurre *antes* de esta transacción, no dentro de ella |
| `armarLotes` selecciona solo `estado_sifen = 'GENERADO'`, nunca `IS NULL` (bug real ya corregido según el plan) | ✅ Hecho, con relato de bug encontrado y corregido | Query explícita sin `OR estado_sifen IS NULL` | Confirmado: `firmarPendientes` (línea 265) usa exactamente `estado_sifen: 'GENERADO'` | **CONFIRMADO ESTÁTICAMENTE** | Correcto y crítico — evita reprocesar todo el histórico, pero introduce el efecto colateral de AUD-001 (históricos nunca entran al pipeline nuevo, ni siquiera para ser re-tocados) |
| Cola de reintentos con backoff exponencial y tope configurable | ✅ Hecho | `BACKOFF_BASE/CAP/MAX_INTENTOS` desde env, `calcularBackoffSegundos` | Confirmado, y `marcarLoteAgotado` transiciona documentos a `ERROR` al agotar intentos | **CONFIRMADO ESTÁTICAMENTE** | — |
| Distinción rechazo definitivo vs. fallo reintentable | ✅ Hecho | Uso de `interpretarCodigo(...).categoria` para decidir `marcarLoteAgotado` vs. reintento | Confirmado en `enviarLotesConstruidos` (líneas 440-490) | **CONFIRMADO ESTÁTICAMENTE** | — |
| `eventoService` — guarda de estado `APROBADO` antes de cancelar, generalizada a Factura+NC | ✅ Hecho | `if (documento.estado_sifen !== 'APROBADO') throw` | Confirmado línea 65-70 | **CONFIRMADO ESTÁTICAMENTE** (para documentos con `estado_sifen` no nulo) | **AUD-001 (P1)** — el guard es correcto, pero excluye para siempre a los documentos históricos (`estado_sifen` NULL) |
| `EventoSifen` creado *antes* de llamar a SIFEN | ✅ Hecho | `prisma.eventoSifen.create` antes del `try` de red | Confirmado líneas 78-85 | **CONFIRMADO ESTÁTICAMENTE** | — |
| Jobs registrados: `armarYEnviarLotes`, `consultarLotes`, `consultaIndividualRedDeSeguridad`, `alertaCertificadosPorVencer`, `limpiezaTrazabilidad` | ✅ Hecho | 5 `cron.schedule` en `cronJobs.js` | Confirmados los 5, con las frecuencias declaradas (5 min / 5 min / 1h / diario 06:00 / semanal domingo 03:00) | **CONFIRMADO ESTÁTICAMENTE** | Ninguno tiene mutex/lock — **AUD-003/AUD-009/AUD-011** |

## Fase 5 — Corte (`facturaService.js`/`notaDeCreditoService.js` reescritos)

| Ítem | Estado declarado | Evidencia estática esperada | Evidencia encontrada | Resultado | Riesgo / hallazgo |
|---|---|---|---|---|---|
| `apiFacturacionElectronica*` eliminadas de `facturaService.js`/`notaDeCreditoService.js` | ✅ Hecho | Sin referencias a `axios`/`FormData` hacia la API PHP | Confirmado por grep global: 0 referencias vivas fuera de comentarios/el archivo muerto | **CONFIRMADO ESTÁTICAMENTE** | — |
| `firmarDocumentoRecienCreado` participa de la misma transacción que crea el documento | ✅ Hecho | `loteService.firmarDocumentoRecienCreado(tipo, id, tx)` invocado dentro de `prisma.$transaction` | Confirmado en ambos servicios (`facturaService.js:247`, `notaDeCreditoService.js:222`) | **CONFIRMADO ESTÁTICAMENTE** | Atomicidad real: si la firma falla, el rollback revierte también la numeración — buen diseño |
| `cronJobs.js` ya no importa `facturaService.js`, carga sin el problema de `node-java` | ✅ Hecho | `cronJobs.js` solo importa `loteService`/`certificadoService`/`trazabilidadService` | Confirmado: sin `require('./facturaService')` en `cronJobs.js` | **CONFIRMADO ESTÁTICAMENTE** | — |
| `correoService.js` arma el adjunto XML desde `xml_firmado` (BD), ya no hace `axios.get` a la API PHP | ✅ Hecho | Sin `axios` en `correoService.js`, `Buffer.from(xmlFirmado, 'utf-8')` | Confirmado: sin import de `axios`; `Buffer.from` usado en `enviarFactura`/`enviarNotaDeCredito` | **CONFIRMADO ESTÁTICAMENTE** | Ver AUD-001: solo alcanzable si `xmlFirmado` no es null, lo que a su vez depende del filtro `estado_sifen:'APROBADO'` que excluye históricos |
| `reenviarFactura`/`reenviarNotaDeCredito` filtran por `estado_sifen: 'APROBADO'` (antes `sifen_estado: 'Aprobado'`) | ✅ Hecho, declarado explícitamente como cambio de campo por el propio plan | Filtro nuevo presente | Confirmado — y el propio plan ya anticipa el cambio de campo sin notar la ruptura de histórico | **CONTRADICCIÓN** (el plan documenta el cambio como un hecho neutro, sin notar que rompe compatibilidad histórica) | **AUD-001 (P1)** |
| `src/db/dbApiFacturacion.js` código muerto, pendiente de borrado | ⚠️ Reconocido como pendiente por el propio plan | Archivo presente, sin referencias vivas | Confirmado | **CONFIRMADO ESTÁTICAMENTE** (como pendiente, tal cual lo declara el plan) | **AUD-012 (P3)** |
| Bridge Java incompatible con Node de verificación, ya no transitivo desde `cronJobs.js` | ⚠️ Anotado, no resuelto | `cronJobs.js` sin `require` de `facturaService.js` | Confirmado (ver arriba) | **CONFIRMADO ESTÁTICAMENTE** | **AUD-016 (P4)** |

## Resumen de resultado por fase

| Fase | Confirmado | Parcial/Contradicción | No verificable | Nota |
|---|---|---|---|---|
| 1 — Fundamentos | 6/7 | 0 | 1 | Spikes #1/#2 no re-verificados de cero en esta pasada |
| 2 — CDC/XML/firma/QR | 8/9 | 1 (CDC/TZ) | 1 (validación XSD) | AUD-002 es el hallazgo más importante de esta fase |
| 3 — SifenClient/certificados/trazabilidad | 7/8 | 1 (exclusividad de certificado activo) | 0 | AUD-004/AUD-005/AUD-006/AUD-010 |
| 4 — loteService/eventoService/jobs | 8/9 | 1 (parseo SOAP) | 0 | AUD-003/AUD-008/AUD-009/AUD-011 |
| 5 — Corte | 5/7 | 1 (reenvío histórico) | 0 | AUD-001 es la consecuencia directa de esta fase; AUD-012/AUD-016 ya reconocidos por el plan |

**Ninguna fase resultó `NO CONFIRMADO`** (es decir, ninguna afirmación del plan resultó ser falsa sin
matices) — los desvíos encontrados son en su mayoría consecuencias no anticipadas de decisiones ya
documentadas (el desvío #1 de `sifen_estado`/`estado_sifen` es la causa raíz directa de AUD-001), no
afirmaciones fabricadas. El plan es, en general, una representación fiel del código — la brecha
principal está entre "lo que el plan documenta como hecho" y "las consecuencias de esas decisiones que
el plan no llegó a trazar hasta el final" (compatibilidad histórica, timezone, concurrencia de cron).
