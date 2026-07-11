-- DropForeignKey
ALTER TABLE `usuario` DROP FOREIGN KEY `usuario_empresa_id_fkey`;

-- AlterTable
ALTER TABLE `usuario` MODIFY `empresa_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `usuario` ADD CONSTRAINT `usuario_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
