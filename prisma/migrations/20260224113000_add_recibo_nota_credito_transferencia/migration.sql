ALTER TABLE `recibo`
    ADD COLUMN `total_transferencias` DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER `total_cheques`;

CREATE TABLE `recibo_nota_credito` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `recibo_id` INTEGER NOT NULL,
    `nota_credito_id` INTEGER NOT NULL,
    `monto_aplicado` DECIMAL(15, 2) NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    INDEX `recibo_nota_credito_nota_credito_id_idx`(`nota_credito_id`),
    UNIQUE INDEX `uk_recibo_nota_credito`(`recibo_id`, `nota_credito_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `recibo_transferencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `recibo_id` INTEGER NOT NULL,
    `banco` VARCHAR(120) NOT NULL,
    `numero_referencia` VARCHAR(50) NOT NULL,
    `monto` DECIMAL(15, 2) NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    INDEX `recibo_transferencia_recibo_id_idx`(`recibo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `recibo_nota_credito`
    ADD CONSTRAINT `recibo_nota_credito_recibo_id_fkey`
    FOREIGN KEY (`recibo_id`) REFERENCES `recibo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `recibo_nota_credito`
    ADD CONSTRAINT `recibo_nota_credito_nota_credito_id_fkey`
    FOREIGN KEY (`nota_credito_id`) REFERENCES `nota_credito`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `recibo_transferencia`
    ADD CONSTRAINT `recibo_transferencia_recibo_id_fkey`
    FOREIGN KEY (`recibo_id`) REFERENCES `recibo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
