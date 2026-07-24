-- AlterTable
ALTER TABLE `factura` ADD COLUMN `intentos_firma` INTEGER NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `nota_credito` ADD COLUMN `intentos_firma` INTEGER NULL DEFAULT 0;
