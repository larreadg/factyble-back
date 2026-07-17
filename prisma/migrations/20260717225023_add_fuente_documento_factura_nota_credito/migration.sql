-- AlterTable
ALTER TABLE `factura` ADD COLUMN `fuente` ENUM('APP', 'API', 'BOT') NULL;

-- AlterTable
ALTER TABLE `nota_credito` ADD COLUMN `fuente` ENUM('APP', 'API', 'BOT') NULL;
