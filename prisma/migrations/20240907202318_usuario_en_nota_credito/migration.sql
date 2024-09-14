/*
  Warnings:

  - Added the required column `usuario_id` to the `nota_credito` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `nota_credito` ADD COLUMN `usuario_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `nota_credito` ADD CONSTRAINT `nota_credito_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
