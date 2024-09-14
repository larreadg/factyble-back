/*
  Warnings:

  - Added the required column `caja_id` to the `nota_credito` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `nota_credito` ADD COLUMN `caja_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `nota_credito` ADD CONSTRAINT `nota_credito_caja_id_fkey` FOREIGN KEY (`caja_id`) REFERENCES `caja`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
