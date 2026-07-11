# Hipótesis estáticas de alto riesgo

Estas son líneas de investigación, no conclusiones. Confirmar, refutar o marcar no verificable mediante lectura del código.

1. Históricos inutilizables porque los servicios nuevos leen `estado_sifen`/`xml_firmado` y los legacy solo tienen `sifen_estado`/`xml`.
2. Doble procesamiento porque workers distintos pueden seleccionar los mismos documentos antes de reclamarlos.
3. Dos certificados activos porque `updateMany` más create/update no cierra necesariamente una carrera entre transacciones.
4. Certificado revocado reutilizado si el selector rechaza solo vencidos o el recalculo sobrescribe `REVOCADO`.
5. Typo de `SIFEN_ENV` apunta a producción porque la dependencia trata cualquier valor distinto de `test` como prod.
6. Evento fallido sin recuperación porque hay campos de reintento pero no job de reenvío.
7. Cancelación duplicada después de timeout por falta de idempotencia o reconciliación.
8. Parseo SOAP ambiguo por búsqueda recursiva de la primera clave con determinado sufijo.
9. Código desconocido clasificado como rechazo definitivo aunque pueda representar procesamiento pendiente.
10. Transacción larga por XML, P12, firma y QR dentro del bloqueo de numeración.
11. CSC almacenado en texto plano.
12. Trazabilidad con PII sin controles de acceso, minimización o retención adecuada.
13. Fecha del CDC dependiente del timezone local del proceso.
14. Defaults fiscalmente inexactos: cliente jurídica, plazo 30 días o motivo fijo de NC.
15. Rollback incompleto porque el deploy legacy desconoce estados/modelos escritos por el pipeline nuevo.
16. Bridge Java incompatible con la versión Node real.
17. Alertas de certificado solo por consola.
18. Retención de 90 días insuficiente o no justificada.
19. Falta de timeout explícito porque el wrapper delega enteramente en defaults de la librería.
20. Un estado terminal puede ser sobrescrito por una respuesta tardía o un cron de red de seguridad.
