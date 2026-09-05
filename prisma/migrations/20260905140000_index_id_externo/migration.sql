-- `id_externo` es la clave de relectura de los ERP integrados y, desde los endpoints
-- `POST /<recurso>/id-externo/consultar-lote`, se consulta con `WHERE id_externo IN (<=100 valores)`.
-- Sin índice esas consultas escanean la tabla completa.
-- Índice NO único: la columna admite repetidos a propósito (un reintento del ERP puede dejar dos
-- documentos con el mismo id externo); el desempate por `id` lo resuelve la consulta.
CREATE INDEX `factura_id_externo_idx` ON `factura`(`id_externo`);
CREATE INDEX `nota_credito_id_externo_idx` ON `nota_credito`(`id_externo`);
CREATE INDEX `recibo_id_externo_idx` ON `recibo`(`id_externo`);
