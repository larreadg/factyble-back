/*
  Warnings:

  - Added the required column `nota_credito_uuid` to the `nota_credito` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `factura` ADD COLUMN `caja_id` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `nota_credito` ADD COLUMN `nota_credito_uuid` VARCHAR(255) NOT NULL;

-- AddForeignKey
ALTER TABLE `factura` ADD CONSTRAINT `factura_caja_id_fkey` FOREIGN KEY (`caja_id`) REFERENCES `caja`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
