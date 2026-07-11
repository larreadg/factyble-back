# Informe de auditoría estática de migración SIFEN

## 1. Resumen ejecutivo

- Veredicto estático: `BLOQUEADO POR HALLAZGOS ESTÁTICOS` / `APTO PARA PRUEBAS CONTROLADAS CON CONDICIONES` / `SIN BLOQUEANTES ESTÁTICOS DETECTADOS` / `INCONCLUSO POR EVIDENCIA INSUFICIENTE`.
- Hallazgos: P0 __, P1 __, P2 __, P3 __, P4 __.
- Principales riesgos.
- Alcance y limitaciones: sin BD, datos reales, certificados, red ni SIFEN.
- Advertencia: ausencia de hallazgos estáticos no demuestra corrección en runtime.

## 2. Alcance técnico

- Repositorios, rama, commit y diff.
- Plan auditado y fecha.
- Versiones declaradas y lockfile.
- Comandos locales de solo lectura ejecutados.
- Archivos o dependencias no disponibles.

## 3. Matriz plan contra código

| Fase | Ítem | Estado declarado | Resultado estático | Evidencia | Validación futura |
|---|---|---:|---|---|---|

## 4. Hallazgos

### [AUD-XXX] [P0-P4] Título accionable

- **Tipo:** BUG CONFIRMADO / RIESGO / HIPÓTESIS / LIMITACIÓN
- **Fase/componente:**
- **Confianza:** alta/media/baja
- **Evidencia:** `archivo:línea`, commit o comando/salida
- **Camino de ejecución:**
- **Escenario de fallo derivado:**
- **Comportamiento esperado:**
- **Comportamiento que impone o permite el código:**
- **Impacto:**
- **Causa raíz:**
- **Corrección mínima:**
- **Prueba dinámica futura recomendada:**
- **Riesgo del fix:**

## 5. Compatibilidad con datos legacy

Documentar reenvío, NC, cancelación, XML, estados, backfill, dual-read y rollback derivados del código.

## 6. Concurrencia, idempotencia y recuperación

Documentar claims, locks, constraints, puntos de crash, llamadas inciertas, retries y multi-réplica inferidos.

## 7. Seguridad y cumplimiento

Certificados, CSC, secretos, trazas, PII, dependencias y retención.

## 8. Cobertura estática

| Flujo | Camino trazado | Error trazado | Repetición | Concurrencia | Legacy | Resultado |
|---|---:|---:|---:|---:|---:|---|

## 9. Validaciones dinámicas futuras

| Prioridad | Hallazgo/riesgo | Prueba necesaria | Datos/entorno requerido | Criterio de éxito |
|---:|---|---|---|---|

## 10. Plan de corrección

| Orden | Hallazgo | Acción | Riesgo | Evidencia de cierre estática |
|---:|---|---|---|---|

## 11. Gate para pruebas controladas

Lista binaria de bloqueantes estáticos y condiciones antes de cualquier piloto. No declarar preparación productiva mediante esta auditoría.
