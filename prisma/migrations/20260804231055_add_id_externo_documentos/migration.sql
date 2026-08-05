-- AlterTable
ALTER TABLE `factura` ADD COLUMN `id_externo` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `nota_credito` ADD COLUMN `id_externo` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `recibo` ADD COLUMN `id_externo` VARCHAR(255) NULL;
