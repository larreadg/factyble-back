-- AlterTable
ALTER TABLE `padron_ruc` ADD COLUMN `fecha_verificacion_sifen` DATETIME(3) NULL,
    ADD COLUMN `origen` ENUM('BATCH', 'SIFEN', 'FABRICADO') NULL;

-- CreateIndex
CREATE INDEX `padron_ruc_origen_fecha_verificacion_sifen_idx` ON `padron_ruc`(`origen`, `fecha_verificacion_sifen`);

