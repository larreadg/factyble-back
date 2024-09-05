-- CreateTable
CREATE TABLE `establecimiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` TEXT NOT NULL,
    `direccion` TEXT NOT NULL,
    `numero_casa` VARCHAR(255) NULL,
    `telefono` VARCHAR(255) NULL,
    `codigo` VARCHAR(255) NOT NULL,
    `cod_distrito` VARCHAR(255) NOT NULL,
    `cod_ciudad` VARCHAR(255) NOT NULL,
    `cod_departamento` VARCHAR(255) NOT NULL,
    `empresa_id` INTEGER NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `caja` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` TEXT NOT NULL,
    `codigo` VARCHAR(255) NOT NULL,
    `establecimiento_id` INTEGER NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `establecimiento` ADD CONSTRAINT `establecimiento_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `caja` ADD CONSTRAINT `caja_establecimiento_id_fkey` FOREIGN KEY (`establecimiento_id`) REFERENCES `establecimiento`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
