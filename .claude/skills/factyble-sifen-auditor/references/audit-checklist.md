# Checklist de auditoría estática Factyble/SIFEN

## 1. Plan, Git y evidencia

- Verificar que cada archivo citado exista y esté versionado.
- Comparar estados declarados con código y diff real.
- Detectar afirmaciones basadas únicamente en scripts ad-hoc no persistidos.
- Identificar contradicciones: test descartado pero dependencias de test, corte único pero convivencia, API inactiva pero necesaria para históricos.

## 2. Prisma y MySQL

- Leer schema y SQL de migraciones; no conectarse a BD.
- Confirmar `MediumText`, índices, FKs, `onDelete`, enums y nulabilidad.
- Razonar el efecto sobre filas existentes y columnas nuevas `NULL`.
- Revisar si índices soportan las queries de workers.
- Verificar si la exclusividad de certificado activo está cerrada por constraint o solo por una secuencia vulnerable a carreras.
- Revisar huérfanos posibles del modelo polimórfico de trazabilidad.

## 3. Máquina de estados

- Inventariar todas las lecturas y escrituras de estados legacy y nuevos.
- Construir la tabla de transiciones derivada del código.
- Detectar saltos, regresiones y sobrescritura de estados terminales.
- Trazar respuesta tardía, repetición e históricos con estado nuevo nulo.

## 4. CDC, fechas y montos

- Inspeccionar padding, longitudes, DV, RUC y código de seguridad.
- Revisar getters locales/UTC y dependencia de timezone cerca de medianoche.
- Revisar precisión numérica, conversión de tipos, IVA, descuentos y redondeos.
- Confirmar que CDC local y XML reciben los mismos campos y fecha.
- Señalar casos que requieren fixtures posteriores.

## 5. XML, firma y QR

- Trazar mapeos para FE contado, crédito, NC, receptor local y extranjero.
- Revisar escape, Unicode, longitudes y defaults fiscales.
- Confirmar nodo firmado, algoritmo, `signByNodeJS=true` y orden firma/QR.
- Verificar que ningún camino modifique campos firmados después de la firma.
- Revisar guards de CSC/CSC ID y exposición accidental en logs.
- Tratar validación XSD real como prueba futura si no hay fixtures.

## 6. Cliente SOAP y códigos

- Confirmar validación estricta de `SIFEN_ENV`; cualquier fallback a producción es P0/P1.
- Inspeccionar timeouts, límites, HTTP, TLS, SOAP Fault y parseo inválido.
- Revisar el algoritmo recursivo con namespaces y nodos repetidos por su estructura, sin inventar respuestas.
- Verificar origen documentado de códigos.
- Analizar el default para códigos desconocidos.
- Confirmar trazabilidad y correlación sin secretos.

## 7. Certificados y criptografía

- Revisar AES-GCM, formato, versionado y rotación de clave.
- Revisar path traversal, symlink, existencia y permisos del P12.
- Confirmar rechazo de `VENCIDO` y `REVOCADO` en todos los caminos.
- Verificar que el recalculo por fecha preserve `REVOCADO`.
- Analizar la carrera de dos activaciones concurrentes.
- Confirmar el estado real del cifrado de `Empresa.csc`.
- Revisar comportamiento fail-open/fail-closed ante error de parsing.

## 8. Lotes y concurrencia

- Trazar dos invocaciones simultáneas de armado y envío.
- Buscar claim atómico, lock, compare-and-set o constraint.
- Revisar creación/asignación en una misma transacción.
- Analizar crash antes/después de llamadas externas.
- Confirmar backoff, tope, selección por próximo intento y estados terminales.
- Revisar máximo 50 y homogeneidad empresa/tipo.

## 9. Eventos

- Trazar cancelación repetida y timeout incierto.
- Buscar unicidad o idempotencia por documento/evento.
- Confirmar registro antes del envío y transición solo tras aprobación.
- Verificar si existe realmente un worker de reintento de eventos.
- Analizar históricos con campos nuevos nulos.

## 10. Cron y despliegue

- Revisar prevención de solapamiento local.
- Revisar lock distribuido para múltiples pods/PM2 workers.
- Confirmar timezone de `node-cron` o dependencia del host.
- Inventariar métricas y alertas operativas presentes en código.
- Señalar `console.warn` como alerta no garantizada.

## 11. Corte y compatibilidad legacy

- Buscar referencias vivas a API PHP, Postgres, env vars y filesystem remoto.
- Trazar reenvío, NC, cancelación y XML de históricos.
- Determinar necesidad de backfill o dual-read.
- Revisar compatibilidad de rollback después de escribir modelos/campos nuevos.
- Confirmar que no exista doble procesamiento durante convivencia operativa.

## 12. Correo, PDF y runtime

- Trazar adjunto XML nuevo e histórico.
- Confirmar que fallo de correo esté aislado del estado fiscal.
- Revisar I/O externo dentro de transacciones.
- Comparar versión Node esperada con bindings nativos declarados.
- Señalar defaults fiscales aproximados aunque produzcan XML estructuralmente válido.
