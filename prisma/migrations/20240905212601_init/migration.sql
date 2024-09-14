-- CreateTable
CREATE TABLE `secuencia_factura` (
    `empresa_id` INTEGER NOT NULL,
    `valor` INTEGER NOT NULL,

    PRIMARY KEY (`empresa_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `secuencia_factura` ADD CONSTRAINT `secuencia_factura_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
