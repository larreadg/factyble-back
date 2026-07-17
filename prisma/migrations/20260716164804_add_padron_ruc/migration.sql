-- CreateTable
CREATE TABLE `padron_ruc` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ruc` VARCHAR(15) NOT NULL,
    `razon_social` VARCHAR(255) NOT NULL,
    `digito_verificador` VARCHAR(2) NOT NULL,
    `ruc_anterior` VARCHAR(20) NULL,
    `estado` VARCHAR(50) NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    UNIQUE INDEX `padron_ruc_ruc_key`(`ruc`),
    INDEX `padron_ruc_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
