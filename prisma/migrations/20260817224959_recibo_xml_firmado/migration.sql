-- AlterTable
ALTER TABLE `recibo` ADD COLUMN `fecha_firma` DATETIME(3) NULL,
    ADD COLUMN `xml_firmado` TEXT NULL;
