# Informe de auditoría estática — migración SIFEN (factyble-back)

**Fecha:** 2026-07-11 · **Commit auditado:** `9be741909b885654794a5f44ba04ea90bd7242f2` (rama `prisma-claude`) ·
**Plan auditado:** `MIGRATION_PLAN.md` íntegro (559 líneas, última actualización 2026-07-11 sesión 4) ·
**Naturaleza:** exclusivamente estática — sin BD, sin certificados, sin red, sin SIFEN. Ver
`STATIC_AUDIT_COMMANDS.log` para el detalle de comandos/lecturas.

> **Actualización 2026-07-11 (post-auditoría):** de los 16 hallazgos, **14 quedaron resueltos** en
> esta misma sesión (AUD-001 a AUD-009, AUD-012, AUD-013, AUD-014 corregidos en código o cerrados por
> efecto colateral; AUD-010 y AUD-011 investigados sin requerir código — ver su `remediacion`/
> `nota_operativa`). **AUD-012** (borrar `dbApiFacturacion.js`/`pg`) necesitó dos vueltas: el primer
> intento fue denegado por el clasificador de auto-mode del harness (archivo preexistente, borrado no
> nombrado explícitamente por el usuario); el usuario lo confirmó explícitamente después y se completó.
> **AUD-015** y **AUD-016** se investigaron y se documentó por qué no tienen un fix de código puntual
> disponible en este repo/entorno (requieren, respectivamente, trabajo coordinado con el frontend fuera
> de este repo, y Docker — no disponible en este entorno — para el smoke test real). El detalle de cada
> fix está en el campo `remediacion` de `STATIC_AUDIT_FINDINGS.json`, y el resumen consolidado en
> `MIGRATION_PLAN.md` sección "Fase 5.1 — Correcciones de la auditoría estática". Al implementar AUD-003
> se encontró y corrigió además un bug no reportado en la pasada original: un lote rechazado/agotado
> nunca salía de `Lote.estado = CONSTRUIDO`, lo que lo hacía reenviarse a SIFEN indefinidamente. El
> resto de este documento (secciones 1-12) se deja tal cual quedó redactado al momento de la auditoría
> original, como registro histórico de lo encontrado — no se reescribió para reflejar el estado
> post-fix.

## 1. Resumen ejecutivo

**Veredicto estático: `APTO PARA PRUEBAS CONTROLADAS CON CONDICIONES`.**

No se encontró ningún hallazgo `P0`. Se encontraron **3 hallazgos `P1`**, **8 `P2`**, **3 `P3`** y
**2 `P4`** (detalle completo en `STATIC_AUDIT_FINDINGS.json`). El código de la migración es, en
general, cuidadoso: usa transacciones donde corresponde, aísla errores por documento/lote/empresa de
forma consistente, evita el patrón de estado global de la API PHP legacy, cifra la contraseña del
certificado P12, fuerza deliberadamente la vía de firma segura (Node, no Java) y documenta sus propias
decisiones y desvíos con un nivel de detalle inusual. **Los 3 hallazgos P1, sin embargo, son
reales y accionables antes de ampliar el piloto**:

1. **AUD-001 — Históricos rotos**: reenviar, cancelar, o emitir una Nota de Crédito contra cualquier
   Factura/Nota de Crédito emitida *antes* del corte (100% del volumen de producción anterior a esta
   sesión) falla de forma determinista, porque el código nuevo lee exclusivamente `estado_sifen`
   (nulo para todo registro histórico) sin ningún fallback hacia `sifen_estado` (el campo legacy que sí
   tiene el dato real).
2. **AUD-002 — Timezone del CDC/XML**: el cálculo de la fecha de emisión usa getters locales de `Date`
   sin que exista ninguna variable `TZ` configurada en el Dockerfile, docker-compose ni `.env.example`
   — el contenedor Alpine por defecto expone UTC como zona local, lo que puede correr la fecha del CDC
   un día para cualquier documento emitido entre las 20:00 y las 23:59 hora de Paraguay.
3. **AUD-003 — Doble envío de lote**: `enviarLotesConstruidos` no reclama el lote de forma atómica
   antes de llamar a SIFEN — si una corrida del cron (cada 5 min) tarda más de 5 minutos, la siguiente
   puede tomar y reenviar el mismo lote antes de que la primera termine de persistir su resultado.

Ninguno de estos tres es un hallazgo que "invente" un escenario improbable: los tres se derivan
directamente de código alcanzable con datos/timing perfectamente plausibles en producción (facturación
histórica real, un contenedor sin timezone configurada, y una llamada SOAP lenta a un servicio externo).

**Alcance y limitación explícita**: esta auditoría no validó datos reales, base de datos, certificados,
red, ni respuestas reales de SIFEN, ni ejecutó el sistema. La ausencia de hallazgos estáticos en un área
no demuestra que esa área funcione correctamente en ejecución — en particular, el parseo de la respuesta
SOAP real (AUD-008) y la validación XSD (Fase 2) dependen de datos que este repo no contiene y que la
propia MIGRATION_PLAN.md ya reconoce como pendientes del piloto de producción.

## 2. Alcance técnico

- **Repositorio:** `factyble-back`, rama `prisma-claude`, commit `9be7419`. Working tree limpio al
  iniciar la auditoría.
- **Plan auditado:** `MIGRATION_PLAN.md` (versión en el repo, no el snapshot de referencia de la
  skill).
- **Versiones relevantes:** Node v24.13.1 en el entorno de esta sesión (el Dockerfile de despliegue usa
  `node:20-alpine`); Prisma/`@prisma/client` 5.16.1; `facturacionelectronicapy-xmlgen@1.0.283`,
  `-xmlsign@1.0.28`, `-setapi@1.0.34`, `-qrgen@1.0.9`; `xml2js@0.6.2` (vía `overrides`).
- **Comandos ejecutados:** exclusivamente de solo lectura (`git`, `grep`, `wc`, `node --version`,
  lectura de `package-lock.json` vía `node -e`). Detalle completo en `STATIC_AUDIT_COMMANDS.log`.
- **No disponible / fuera de esta pasada:** no se releyó el código fuente de las 4 libs
  `facturacionelectronicapy-*` en `node_modules/` de cero (se confirmaron sus contratos vía lo ya
  documentado y citado con archivo:línea en `MIGRATION_PLAN.md`, que a su vez cita esas rutas). No se
  leyeron `src/controllers/*`, `src/routes/*`, ni `src/middleware/authJwt.js` en profundidad — se
  usaron greps dirigidos para confirmar ausencia/presencia de patrones puntuales (p. ej. exposición de
  XML histórico), no una revisión línea por línea de esa capa. No se validó el XSD oficial (el propio
  repo no contiene el XSD ni el script de esa validación — el plan mismo documenta que no quedó
  persistido).

## 3. Matriz plan contra código

Ver `STATIC_AUDIT_MATRIX.md` — tabla completa por fase con columna de evidencia y resultado. Resumen:
ninguna fase resultó `NO CONFIRMADO` (el plan no contiene afirmaciones fabricadas), pero las Fases 2, 3,
4 y 5 tienen cada una al menos un ítem `PARCIAL`/`CONTRADICCIÓN` que corresponde a uno de los hallazgos
P1/P2 de este informe.

## 4. Hallazgos — P0/P1 primero

*(Formato completo, con evidencia archivo:línea, camino de ejecución, corrección mínima y prueba
dinámica recomendada por hallazgo, en `STATIC_AUDIT_FINDINGS.json`. Aquí solo el resumen accionable.)*

### P0 — Crítico
Ninguno.

### P1 — Alto

- **AUD-001 · Históricos rotos** — `facturaService.js:455-457`, `notaDeCreditoService.js:75-77,422-424`,
  `eventoService.js:65-70`. Reenvío, cancelación y emisión de NC sobre cualquier documento con
  `estado_sifen = NULL` (100% de lo emitido antes de esta sesión) fallan con 404/400. Causa raíz: el
  desvío #1 del propio plan (mantener `sifen_estado` congelado y agregar `estado_sifen` en paralelo)
  nunca implementó el lado de lectura dual que la propia sección "Compatibilidad histórica obligatoria"
  del plan anticipa como necesario.
- **AUD-002 · Timezone del CDC** — `utils/sifen/cdc.js:33-41`, `xmlBuilderService.js:80-100`,
  `Dockerfile` (sin `TZ`/`tzdata`). Riesgo alto de confianza: sin timezone explícita, el contenedor
  Alpine expone UTC, y Paraguay es UTC-4 fijo — ~4 horas de cada día operativo (20:00-23:59 hora
  Paraguay) calculan el CDC con el día calendario equivocado.
- **AUD-003 · Doble envío de lote** — `loteService.js:401-492`, `cronJobs.js:16-23`. Sin claim atómico
  entre la selección del lote `CONSTRUIDO` y la llamada SOAP, dos corridas de cron solapadas (job más
  lento que el intervalo de 5 min) pueden enviar el mismo lote dos veces a SIFEN.

### P1 — no encontrados en otras categorías
No se encontraron hallazgos adicionales de severidad P1 más allá de los tres citados.

## 5. Hallazgos P2 (resumen — detalle completo en el JSON)

| ID | Título | Tipo |
|---|---|---|
| AUD-004 | `obtenerCertificadoActivo` no rechaza certificados `REVOCADO` | BUG CONFIRMADO |
| AUD-005 | Exclusividad de certificado activo vulnerable a carrera entre transacciones concurrentes | RIESGO |
| AUD-006 | `Empresa.csc` persistido y usado en texto plano | BUG CONFIRMADO |
| AUD-007 | Filtros Prisma `not`/`notIn` sobre `estado_sifen` nullable — semántica ante NULL no verificada, afecta guard de cancelación y cálculo de crédito previo | LIMITACIÓN |
| AUD-008 | Parseo SOAP por sufijo de tag no confirmado contra respuesta real de SIFEN | LIMITACIÓN |
| AUD-009 | `firmarPendientes`/`armarLotes` sin claim atómico — firma/QR duplicados en ejecuciones solapadas (sin duplicar el envío a SIFEN) | RIESGO |
| AUD-010 | `SifenTrazabilidad` persiste PII sin controles de acceso/minimización, retención 90 días | RIESGO |
| AUD-011 | Cron sin mutex distribuido — riesgo latente si se escala a múltiples instancias (hoy: 1 sola, según `docker-compose.yml`) | RIESGO |

## 6. Hallazgos P3/P4 (resumen)

| ID | Título | Severidad |
|---|---|---|
| AUD-012 | `dbApiFacturacion.js` y dependencia `pg` no eliminadas (ya reconocido por el plan) | P3 |
| AUD-013 | `EstadoLote` sin estado terminal para rechazo/agotamiento (decisión de diseño documentada) | P3 |
| AUD-014 | `alertaCertificadosPorVencer` solo hace `console.warn`, sin canal de notificación real | P3 |
| AUD-015 | Defaults fiscales aproximados (cliente jurídica, plazo 30 días, motivo fijo de NC) | P4 |
| AUD-016 | Bridge Java (`node-java`) sensible a versión de Node — riesgo preexistente, no introducido por esta migración | P4 |

## 7. Compatibilidad con datos legacy

Trazado estático de los 8 escenarios pedidos por el prompt maestro, asumiendo la forma de datos real
que permite el schema (`sifen_estado` con valor de texto legacy, `xml`/`linkqr` con link, `estado_sifen
= NULL`, `xml_firmado = NULL`):

1. **Reenvío de Factura histórica** → **ROTO** (AUD-001). `reenviarFactura` filtra
   `estado_sifen:'APROBADO'`, nunca verdadero para NULL.
2. **Reenvío de Nota de Crédito histórica** → **ROTO** (AUD-001), mismo patrón en
   `reenviarNotaDeCredito`.
3. **Emisión de NC sobre Factura histórica aprobada** → **ROTO** (AUD-001).
   `notaDeCreditoService.js:75-77` exige `factura.estado_sifen === 'APROBADO'` explícitamente.
4. **Cancelación de Factura histórica** → **ROTO** (AUD-001). `eventoService.cancelarDocumento` exige
   `documento.estado_sifen === 'APROBADO'`.
5. **Cancelación de NC histórica** → **ROTO** (AUD-001), mismo guard vía `eventoService`.
6. **Obtención del XML histórico** → **NO ROTO** (verificado por ausencia de contraevidencia): no se
   encontró ningún controller que intente leer `xml_firmado` de forma exclusiva para servir el XML de un
   documento — la lectura de `getFacturaById`/`getFacturas` no filtra por `estado_sifen` y devuelve el
   registro completo (incluyendo el `xml`/`linkqr` legacy tal cual), así que el dato histórico sigue
   accesible vía esos endpoints. No se auditó en profundidad la capa de controllers/frontend en esta
   pasada — ver limitación §2.
7. **Listados y guards que usan solo `estado_sifen`** → `getFacturas`/`getNotasDeCredito` **no**
   filtran por `estado_sifen` (correcto, no rompen históricos); los guards de *acción* (reenviar,
   cancelar, emitir NC) sí filtran exclusivamente por `estado_sifen` → **ROTO**, ya cubierto en 1-5.
8. **Rollback al deploy legacy después de crear documentos nuevos** → **NO VERIFICABLE
   ESTÁTICAMENTE**: un rollback de deploy (volver a la API PHP) dejaría documentos ya creados por el
   pipeline nativo (con `estado_sifen`/`xml_firmado`/`lote_id` poblados) que la API PHP legacy no sabe
   interpretar (ella lee/escribe `sifen_estado` de texto libre). El propio `MIGRATION_PLAN.md` reconoce
   esto como parte del plan de rollback ("revert de deploy") sin detallar el tratamiento de esos
   documentos híbridos — no hay código que lo aborde, ni falta: es una decisión operativa pendiente, no
   un bug de código.

**Conclusión de esta sección**: se requiere backfill o dual-read antes de que la operación pueda confiar
en que reenviar/cancelar/emitir-NC funcione sobre el histórico completo. Esto es exactamente lo que la
sección "Compatibilidad histórica obligatoria" del propio `MIGRATION_PLAN.md` pide auditar — y el
resultado es que el código, tal como está, no lo resuelve.

## 8. Concurrencia, idempotencia y recuperación

- **Claim atómico de lotes**: ausente. `enviarLotesConstruidos` selecciona por `findMany` y solo
  transiciona el estado *después* de la respuesta de SIFEN — ver AUD-003.
- **Claim atómico de documentos** (firma/armado de lote): ausente. `firmarPendientes`/`armarLotes`
  seleccionan por `findMany` sin reservar filas — ver AUD-009. El `updateMany` de asignación de
  `lote_id` en `crearLoteConDocumentos` no vuelve a filtrar por `lote_id: null`, lo que permite que un
  documento sea "robado" de un lote a otro bajo una carrera (efecto: lote zombie, no duplicación de
  envío real — la relación FK `lote_id` es de un solo dueño a la vez, así que `enviarLotesConstruidos`
  siempre relee el dueño vigente al momento del envío).
- **Exclusividad de certificado activo**: enforzada por aplicación (`updateMany`+`create`/`update`
  dentro de `$transaction`), sin constraint de BD ni lock explícito — ver AUD-005. El propio
  `MIGRATION_PLAN.md` ya admite que MySQL no soporta el índice único parcial necesario.
- **Idempotencia de cancelación**: el guard `estado_sifen === 'APROBADO'` (pre-condición) más la
  transición a `CANCELADO` (post-condición) hacen que una segunda cancelación sobre el mismo documento
  ya cancelado falle limpio (`estado_sifen` ya no es `'APROBADO'`) — correcto para el caso de dos
  cancelaciones *secuenciales*. Para dos cancelaciones *concurrentes* sobre el mismo documento (ambas
  leen `APROBADO` antes de que la primera transicione a `CANCELADO`), no hay lock — ambas podrían
  avanzar hasta llamar a SIFEN dos veces para el mismo CDC. No se pudo determinar estáticamente si
  SIFEN idempotiza esto del lado servidor (rechazaría la segunda cancelación por evento ya aplicado) —
  **NO VERIFICABLE ESTÁTICAMENTE**, marcado como HIPÓTESIS de menor severidad que AUD-003 porque
  cancelar es una acción manual de usuario (mucho menos probable que dos clics simultáneos que un cron
  de 5 minutos solapándose), no incluida como hallazgo numerado independiente pero documentada aquí
  para trabajo futuro.
- **Reintentos**: `Lote`/`EventoSifen` tienen campos de reintento; solo `Lote` tiene un cron que
  efectivamente reintenta (`enviarLotesConstruidos`, que re-selecciona por `proximo_intento_en`).
  `EventoSifen` registra `intentos_envio`/`ultimo_error` pero **no existe ningún cron que reintente
  eventos fallidos** — confirmado por lectura de `cronJobs.js` (solo 5 jobs, ninguno referencia
  `eventoService`). Esto ya está documentado explícitamente por el propio plan como decisión consciente
  (cancelación síncrona, sin cola de reintento automática) — no se reporta como hallazgo nuevo porque
  coincide exactamente con lo que el plan declara, pero se señala aquí porque el prompt maestro lo pide
  explícitamente: un evento de cancelación que falla por timeout queda con el error registrado, pero
  requiere que un humano reintente manualmente (re-invocar el endpoint de cancelación), no hay
  recuperación automática.
- **Multi-instancia / multi-réplica**: `docker-compose.yml` define una sola instancia del servicio
  `app`. Si eso cambiara, ver AUD-011.

## 9. Seguridad y cumplimiento

- **Certificado P12**: contraseña cifrada con AES-256-GCM (`utils/crypto.js`), clave de cifrado
  (`CERT_ENCRYPTION_KEY`) validada por longitud (32 bytes) antes de usar, nunca en BD. **Correcto.**
- **CSC (`Empresa.csc`)**: texto plano, pese a que el propio proyecto ya reconoce que debería cifrarse
  igual que `Certificado.clave` — ver AUD-006.
- **Vía de firma**: siempre `signByNodeJS: true` en las 3 funciones de `firmadorService.js`, nunca
  omitido — mitiga correctamente el riesgo de inyección de comandos de la vía Java documentado en el
  propio plan. **Correcto y verificado.**
- **`SIFEN_ENV`**: normalización explícita a `'prod'`/`'test'` con fail-safe hacia `'test'` ante
  cualquier valor que no sea exactamente `"prod"` (typos, mayúsculas, `undefined`, espacios) — **el
  diseño es correcto en la dirección segura** (nunca cae a producción por accidente; en el peor caso,
  un typo real en producción haría que el sistema le pegue a `test` de SIFEN en vez de a producción,
  un bug funcional pero no un riesgo de seguridad). No se reporta como hallazgo porque el comportamiento
  es el deseado (fail-closed hacia el ambiente de menor impacto).
- **SQL injection**: no se encontró ningún punto de concatenación cruda de SQL. Los dos usos de
  `$queryRaw`/`$executeRaw` (`facturaService.js`, `notaDeCreditoService.js`, para el `FOR UPDATE` de
  secuencias) usan template literals parametrizados por Prisma, no interpolación de string. **Correcto.**
- **Secretos en logs/trazabilidad**: los `console.error`/`console.warn` revisados solo registran
  `error.message` o datos de negocio (código/mensaje SIFEN, ids), nunca contraseñas ni claves. La
  trazabilidad (`SifenTrazabilidad`) persiste el XML/SOAP completo, que sí contiene PII de clientes
  (no credenciales) — ver AUD-010.
- **PII**: ver AUD-010 (trazabilidad) — retención 90 días por defecto, sin control de acceso granular
  verificado en esta pasada (la capa de controllers/routes que expone `obtenerTrazabilidadPorEntidad`
  no se auditó en profundidad).

## 10. Cobertura estática

| Flujo | Camino trazado | Error trazado | Repetición/concurrencia | Legacy | Resultado |
|---|---|---|---|---|---|
| Emisión de Factura (`emitirFactura`) | Sí, completo | Sí (rollback atómico con firma) | Sí (AUD-009 aplica a la fase de armado de lote posterior, no a la emisión síncrona en sí) | N/A (siempre crea `estado_sifen:'GENERADO'`) | Cubierto |
| Emisión de Nota de Crédito (`emitirNotaDeCredito`) | Sí, completo | Sí | Igual que Factura | **ROTO** para NC contra Factura histórica (AUD-001) | Parcial |
| Armado y envío de lote (`armarLotes`/`enviarLotesConstruidos`) | Sí, completo | Sí (aislado por lote/empresa) | **RIESGO** (AUD-003/AUD-009) | N/A (nunca toca históricos, por diseño) | Parcial |
| Consulta de lote (`consultarLotes`) | Sí, completo | Sí | Sin claim (menor severidad — solo lectura+update de estado, no envío) | N/A | Cubierto, con LIMITACIÓN de parseo (AUD-008) |
| Red de seguridad (`consultaIndividualRedDeSeguridad`) | Sí, completo | Sí | No evaluado en profundidad (frecuencia baja, 1h) | N/A | Cubierto |
| Cancelación (`cancelarFactura`/`cancelarNotaCredito`) | Sí, completo | Sí (evento creado antes de llamar a SIFEN) | HIPÓTESIS sin numerar (§8) para el caso concurrente | **ROTO** para documentos históricos (AUD-001) | Parcial |
| Reenvío por mail | Sí, completo | Sí | N/A | **ROTO** para documentos históricos (AUD-001) | Parcial |
| Gestión de certificados | Sí, completo | Sí | RIESGO (AUD-005) | N/A | Parcial |

## 11. Validaciones dinámicas futuras (resumen)

Cada hallazgo P0-P2 en `STATIC_AUDIT_FINDINGS.json` incluye su propia prueba dinámica recomendada, con
archivo sugerido, setup, acción, aserciones y entorno. Resumen priorizado:

| Prioridad | Hallazgo | Tipo de prueba | Entorno requerido |
|---|---|---|---|
| 1 | AUD-001 (históricos) | Test con BD local | MySQL local, sin red |
| 2 | AUD-002 (timezone) | Test unitario puro | Ninguno (forzar `process.env.TZ`) |
| 3 | AUD-003 (doble envío de lote) | Test de concurrencia con BD local + mock de SIFEN lento | MySQL local, sin red real |
| 4 | AUD-007 (semántica NULL de Prisma) | Test con BD local | MySQL local |
| 5 | AUD-004 (certificado revocado) | Test con BD local | MySQL local |
| 6 | AUD-005 (carrera de activación) | Test de concurrencia con BD local | MySQL local |
| 7 | AUD-009 (firma/armado duplicado) | Test de concurrencia con BD local | MySQL local |
| 8 | AUD-008 (parseo SOAP) | Fixture SOAP sintético + primera respuesta real del piloto | Ninguno para el fixture; producción real para cerrarlo del todo |
| 9 | AUD-006 (CSC en texto plano) | Test con BD local | MySQL local |
| — | Validación XSD real | Ya identificada por el propio plan como pendiente de re-persistir como fixture reproducible | JDK local (ya usado para JasperReports) |
| — | Round-trip real contra SIFEN | Piloto de producción, ya en curso según el plan | Certificado real, SIFEN prod, montos bajos |

## 12. Gate para pruebas controladas

**Antes de ampliar el piloto de producción a más empresas/documentos**, condiciones binarias:

- [ ] **AUD-001 resuelto o mitigado**: al menos un plan explícito de qué pasa con el histórico
      (backfill de `estado_sifen`, o lectura dual permanente) — hoy cualquier usuario que intente
      reenviar/cancelar una factura vieja recibe un error sin explicación.
- [ ] **AUD-002 resuelto**: `TZ=America/Asuncion` fijada en el entorno de despliegue real (o
      conversión explícita de timezone en código) — verificar además que el entorno de producción real
      (no solo este repo) tenga esto resuelto, dado que no es visible desde el código si ya está
      configurado a nivel de infraestructura fuera del repo.
- [ ] **AUD-003 mitigado**: al menos un timeout explícito configurado para las llamadas SOAP (no
      confirmado en el código — `sifenClientService.js` pasa un `config` opcional que hoy nunca se
      llena con timeout desde ningún caller) y/o el claim atómico implementado, para acotar la ventana
      de solapamiento.
- [ ] Confirmado explícitamente que el despliegue de producción sigue siendo de una sola instancia
      (mitiga AUD-011 sin necesidad de código nuevo).

El resto de hallazgos (P2 en adelante) no bloquean el piloto ya en curso descrito por
`MIGRATION_PLAN.md`, pero sí deberían resolverse antes del corte al **resto de empresas** (Fase 5 del
plan, posterior al piloto).

**Esta auditoría no valida ni invalida el piloto de producción en curso** — no se ejecutó código, no se
consultó BD, no se generaron documentos ni eventos reales, y no se tuvo acceso a ninguna respuesta real
de SIFEN. La ausencia de hallazgos `P0` no implica que el sistema vaya a comportarse correctamente en
producción: implica únicamente que, en el código leído durante esta pasada, no se encontró un defecto
determinista de máxima severidad. Las pruebas dinámicas listadas en §11 siguen siendo necesarias antes
de dar por cerrada la migración.
