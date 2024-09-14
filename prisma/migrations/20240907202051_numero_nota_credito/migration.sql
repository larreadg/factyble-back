/*
  Warnings:

  - Added the required column `numero_nota_credito` to the `nota_credito` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `nota_credito` ADD COLUMN `numero_nota_credito` INTEGER NOT NULL;
