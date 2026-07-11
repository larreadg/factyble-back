-- DataMigration: alta idempotente del rol SUPERADMIN, usado por el nuevo endpoint
-- POST /empresa (alta completa de empresa, ver empresaRoute.js) para restringirlo a
-- staff de plataforma, distinto del rol ADMIN (que es por-empresa).
-- `rol.nombre` no tiene constraint UNIQUE en el schema, por eso el WHERE NOT EXISTS
-- para que correr esta migración más de una vez no duplique la fila.
INSERT INTO `rol` (`nombre`, `fecha_creacion`, `fecha_modificacion`)
SELECT 'SUPERADMIN', NOW(3), NOW(3)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `rol` WHERE `nombre` = 'SUPERADMIN');
