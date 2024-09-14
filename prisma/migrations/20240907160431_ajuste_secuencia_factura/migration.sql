/*
  Warnings:

  - The primary key for the `secuencia_factura` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `empresa_id` on the `secuencia_factura` table. All the data in the column will be lost.
  - Added the required column `caja_id` to the `secuencia_factura` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fecha_modificacion` to the `secuencia_factura` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `secuencia_factura` DROP FOREIGN KEY `secuencia_factura_empresa_id_fkey`;

-- AlterTable
ALTER TABLE `secuencia_factura` DROP PRIMARY KEY,
    DROP COLUMN `empresa_id`,
    ADD COLUMN `caja_id` INTEGER NOT NULL,
    ADD COLUMN `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `fecha_modificacion` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`caja_id`);

-- AddForeignKey
ALTER TABLE `secuencia_factura` ADD CONSTRAINT `secuencia_factura_caja_id_fkey` FOREIGN KEY (`caja_id`) REFERENCES `caja`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
