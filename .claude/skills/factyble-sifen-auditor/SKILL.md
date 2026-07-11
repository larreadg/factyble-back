---
name: factyble-sifen-auditor
description: auditar estaticamente la migracion de factyble-api hacia factyble-back y el pipeline nativo de sifen. usar cuando se necesite contrastar migration_plan.md contra el codigo, detectar bugs deterministas, inconsistencias, regresiones legacy, carreras potenciales, fallas de atomicidad, seguridad, estados, lotes, eventos, certificados, xml, cdc, qr, cron jobs y riesgos del corte sin disponer de base de datos, certificados, credenciales ni acceso a sifen.
---

# Factyble SIFEN Auditor

## Objetivo

Realizar una auditoría estática forense del plan y del código de la migración SIFEN. Tratar cada `✅ Hecho` del plan como una afirmación pendiente de comprobación. Basar las conclusiones en rutas de ejecución, schema, migraciones, configuración, dependencias, contratos entre módulos y propiedades demostrables del código.

La auditoría no requiere ni presupone datos reales, una BD disponible, certificados P12, credenciales, red, acceso a SIFEN ni ejecución end-to-end.

## Entradas

Localizar:

1. Raíz de `factyble-back`.
2. `MIGRATION_PLAN.md` vigente.
3. Opcional: `factyble-api` legacy para comparar comportamiento y compatibilidad.
4. Rama, commit o diff que delimita la implementación auditada.

Usar `references/MIGRATION_PLAN_SNAPSHOT.md` solo como respaldo. El plan dentro del repositorio tiene prioridad.

## Límites obligatorios

- Trabajar en modo lectura.
- No conectarse a bases de datos, SIFEN, servicios externos ni endpoints productivos.
- No emitir documentos, generar eventos fiscales reales ni usar certificados reales.
- No ejecutar migraciones, seeds, escrituras, borrados, `prisma db push`, `prisma migrate reset` ni `npm audit fix`.
- No exigir fixtures, P12, CSC, datos fiscales ni respuestas reales para completar la revisión.
- No imprimir secretos de `.env`, claves, tokens, CSC, contraseñas o contenido de certificados.
- Permitir solo comandos locales de inspección sin efectos laterales: `git`, búsqueda de texto, lectura de archivos, `node --check`, lint estático, `prisma validate` y validadores equivalentes cuando no requieran conexión.
- Marcar explícitamente cualquier comportamiento que solo pueda confirmarse dinámicamente como `NO VERIFICABLE ESTÁTICAMENTE`.

## Modelo de evidencia

Aceptar como evidencia estática:

- código alcanzable y su flujo de control;
- firmas y contratos entre funciones;
- queries Prisma y límites transaccionales;
- schema y SQL de migraciones;
- configuración y defaults;
- dependencias bloqueadas en lockfile;
- búsquedas globales de referencias y código muerto;
- sintaxis, lint y validaciones de schema sin conexión;
- código fuente de dependencias instaladas cuando sea relevante.

No aceptar como evidencia suficiente:

- comentarios;
- nombres de funciones;
- estados `✅` del plan;
- relatos de pruebas ad-hoc no persistidas;
- suposiciones sobre datos o respuestas reales;
- “debería funcionar” sin trazar el camino completo.

## Flujo

### 1. Congelar el alcance

Registrar commit, rama, `git status`, diff, archivos no rastreados, versiones declaradas, scripts de `package.json`, lockfile y archivos que el plan declara implementados.

Ejecutar `scripts/collect_evidence.py` como inventario inicial si existe acceso al repositorio. Su salida es orientativa y no sustituye la revisión manual.

### 2. Convertir el plan en matriz

Por cada fase e ítem crear una fila con:

- afirmación del plan;
- estado declarado;
- evidencia estática esperada;
- evidencia encontrada;
- resultado: `CONFIRMADO ESTÁTICAMENTE`, `PARCIAL`, `NO CONFIRMADO`, `CONTRADICCIÓN` o `NO VERIFICABLE ESTÁTICAMENTE`;
- riesgo;
- validación dinámica futura necesaria, si aplica.

### 3. Auditar por capas

Revisar en este orden:

1. Coherencia del plan, alcance y decisiones contradictorias.
2. Schema Prisma, migraciones MySQL, nulabilidad, índices, FKs y compatibilidad con filas existentes.
3. CDC, fechas, timezone, padding, precisión y construcción de identificadores.
4. Mapeo XML de FE/NC, firma, QR, CSC y orden de transformación.
5. Cliente SIFEN, ambiente, timeouts, parseo SOAP y clasificación de códigos.
6. Certificados, cifrado, revocación, activación y manejo de paths.
7. Trazabilidad, PII, retención y correlación.
8. Lotes, eventos, estados, atomicidad, idempotencia y recuperación inferida.
9. Cron jobs, solapamiento y ejecución multi-instancia.
10. Wiring de Factura, Nota de Crédito, correo, PDF y cancelación.
11. Compatibilidad estática con documentos legacy.
12. Rollback, código muerto, env vars y apagado de la API PHP.

Consultar `references/audit-checklist.md` y `references/high-risk-hypotheses.md`.

### 4. Analizar escenarios sin ejecutarlos

Para cada flujo crítico, trazar manualmente:

- precondiciones y selección de registros;
- límites de transacción;
- cambios de estado;
- punto de llamada externa;
- persistencia antes y después de la llamada;
- comportamiento ante excepción en cada punto;
- repetición de la misma operación;
- dos workers leyendo el mismo estado;
- documentos legacy con campos nuevos nulos.

Cuando un fallo sea consecuencia necesaria del código, clasificarlo como bug confirmado estáticamente. Cuando dependa del aislamiento de BD, respuesta remota, datos concretos o comportamiento no visible de una dependencia, clasificarlo como riesgo o hipótesis con confianza explícita.

### 5. Compatibilidad histórica obligatoria

Trazar qué ocurre con Facturas y Notas de Crédito antiguas que tengan:

- `sifen_estado` con valor;
- `xml` con link legacy;
- `estado_sifen = NULL`;
- `xml_firmado = NULL`.

Inspeccionar estáticamente:

- reenvío;
- emisión de NC sobre factura histórica;
- cancelación;
- obtención del XML;
- filtros y guards basados solo en campos nuevos;
- rollback hacia el deploy legacy.

Determinar si el código requiere backfill, dual-read temporal, migración de XML/estado o manejo explícito de históricos.

### 6. Concurrencia e idempotencia por razonamiento

Buscar evidencia de:

- claim atómico;
- `FOR UPDATE`, `SKIP LOCKED`, update condicional o versión optimista;
- constraint único que cierre la carrera;
- mutex o lock distribuido;
- transición compare-and-set;
- clave idempotente o reconciliación posterior.

Un `findMany` seguido de `update` no demuestra exclusión mutua. Una transacción tampoco elimina por sí sola una carrera entre dos transacciones.

### 7. Clasificar hallazgos

- **P0 Crítico:** el código permite de forma determinista emisión fiscal incorrecta, pérdida/duplicación, secreto expuesto o selección accidental de producción.
- **P1 Alto:** históricos rotos, carrera probable, estado inconsistente, cancelación no recuperable o rollback incompatible.
- **P2 Medio:** recuperación manual, observabilidad insuficiente, caso borde relevante o contrato ambiguo.
- **P3 Bajo:** deuda técnica, mantenibilidad o código muerto.
- **P4 Informativo:** mejora o decisión pendiente sin defecto demostrado.

Incluir confianza `alta`, `media` o `baja` y distinguir `BUG CONFIRMADO`, `RIESGO`, `HIPÓTESIS` y `LIMITACIÓN`.

### 8. Entregar

Seguir `references/report-template.md` y crear:

1. `STATIC_AUDIT_REPORT.md`
2. `STATIC_AUDIT_FINDINGS.json`
3. `STATIC_AUDIT_MATRIX.md`
4. `STATIC_AUDIT_COMMANDS.log`

Para cada hallazgo incluir archivo/línea, camino de ejecución, escenario de fallo derivado, impacto, causa raíz, corrección mínima y prueba dinámica futura recomendada.

No modificar el código salvo pedido expreso del usuario.

## Veredicto permitido

Usar solo uno:

- `BLOQUEADO POR HALLAZGOS ESTÁTICOS`
- `APTO PARA PRUEBAS CONTROLADAS CON CONDICIONES`
- `SIN BLOQUEANTES ESTÁTICOS DETECTADOS`
- `INCONCLUSO POR EVIDENCIA INSUFICIENTE`

Nunca declarar `LISTO PARA PRODUCCIÓN` a partir de una revisión estática. Explicar que ausencia de hallazgos estáticos no demuestra corrección en ejecución.
