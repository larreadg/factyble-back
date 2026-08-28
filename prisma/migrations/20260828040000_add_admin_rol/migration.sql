-- DataMigration: alta idempotente del rol ADMIN.
--
-- ADMIN es el rol por-empresa: lo asigna empresaService al crear la empresa (ver
-- ROL_ADMIN_EMPRESA en empresaService.js) y lo exige authJwt(['ADMIN']) en casi todas
-- las rutas de negocio. Existía en la base histórica porque se insertó a mano en algún
-- momento, pero NINGUNA migración lo creaba: sobre una base nueva las migraciones dejaban
-- la tabla `rol` solo con SUPERADMIN, y el alta de empresa fallaba con
-- "El rol ADMIN no existe, debe crearse antes de dar de alta una empresa".
--
-- Mismo patrón que 20260711134651_add_superadmin_rol: `rol.nombre` no tiene constraint
-- UNIQUE en el schema, así que el WHERE NOT EXISTS es lo que evita duplicar la fila si
-- esta migración corre sobre una base donde el rol ya está.
INSERT INTO `rol` (`nombre`, `fecha_creacion`, `fecha_modificacion`)
SELECT 'ADMIN', NOW(3), NOW(3)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `rol` WHERE `nombre` = 'ADMIN');
