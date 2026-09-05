-- Imprime el KuDE por duplicado (2-up en A4 horizontal) para las plantillas de hoja.
-- NOT NULL con DEFAULT false: MySQL lo agrega sin backfill y todas las empresas existentes
-- conservan el comportamiento actual (PDF vertical, una sola copia).
ALTER TABLE `empresa` ADD COLUMN `duplicar_doc` BOOLEAN NOT NULL DEFAULT false;
