-- CreateTable
CREATE TABLE `secuencia_recibo` (
    `caja_id` INTEGER NOT NULL,
    `valor` INTEGER NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    PRIMARY KEY (`caja_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recibo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero_recibo` INTEGER NOT NULL,
    `recibo_uuid` VARCHAR(255) NOT NULL,
    `cliente_empresa_id` INTEGER NOT NULL,
    `usuario_id` INTEGER NOT NULL,
    `total_efectivo` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_cheques` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(15, 2) NOT NULL,
    `total_letras` VARCHAR(255) NOT NULL,
    `concepto` TEXT NULL,
    `fecha_emision` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,
    `caja_id` INTEGER NULL,

    UNIQUE INDEX `uk_recibo_caja_numero`(`caja_id`, `numero_recibo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recibo_factura` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `recibo_id` INTEGER NOT NULL,
    `factura_id` INTEGER NOT NULL,
    `monto_aplicado` DECIMAL(15, 2) NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    INDEX `recibo_factura_factura_id_idx`(`factura_id`),
    UNIQUE INDEX `uk_recibo_factura`(`recibo_id`, `factura_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recibo_cheque` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `recibo_id` INTEGER NOT NULL,
    `banco` VARCHAR(120) NOT NULL,
    `numero_cheque` VARCHAR(50) NOT NULL,
    `monto` DECIMAL(15, 2) NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    INDEX `recibo_cheque_recibo_id_idx`(`recibo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `secuencia_recibo` ADD CONSTRAINT `secuencia_recibo_caja_id_fkey` FOREIGN KEY (`caja_id`) REFERENCES `caja`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recibo` ADD CONSTRAINT `recibo_cliente_empresa_id_fkey` FOREIGN KEY (`cliente_empresa_id`) REFERENCES `cliente_empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recibo` ADD CONSTRAINT `recibo_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recibo` ADD CONSTRAINT `recibo_caja_id_fkey` FOREIGN KEY (`caja_id`) REFERENCES `caja`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recibo_factura` ADD CONSTRAINT `recibo_factura_recibo_id_fkey` FOREIGN KEY (`recibo_id`) REFERENCES `recibo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recibo_factura` ADD CONSTRAINT `recibo_factura_factura_id_fkey` FOREIGN KEY (`factura_id`) REFERENCES `factura`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recibo_cheque` ADD CONSTRAINT `recibo_cheque_recibo_id_fkey` FOREIGN KEY (`recibo_id`) REFERENCES `recibo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
