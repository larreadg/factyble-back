-- CreateTable
CREATE TABLE `nota_credito` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `factura_id` INTEGER NOT NULL,
    `total_iva` DOUBLE NOT NULL,
    `total` DOUBLE NOT NULL,
    `cdc` VARCHAR(255) NOT NULL,
    `xml` TEXT NULL,
    `linkqr` TEXT NULL,
    `sifen_estado` TEXT NULL,
    `sifen_estado_mensaje` TEXT NULL,
    `codigo_seguridad` VARCHAR(10) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nota_credito_detalle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nota_credito_id` INTEGER NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `precio_unitario` DOUBLE NOT NULL,
    `tasa` ENUM('T0', 'T5', 'T10') NOT NULL,
    `impuesto` DOUBLE NOT NULL,
    `total` DOUBLE NOT NULL,
    `descripcion` VARCHAR(255) NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `secuencia_nota_credito` (
    `caja_id` INTEGER NOT NULL,
    `valor` INTEGER NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    PRIMARY KEY (`caja_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `nota_credito` ADD CONSTRAINT `nota_credito_factura_id_fkey` FOREIGN KEY (`factura_id`) REFERENCES `factura`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nota_credito_detalle` ADD CONSTRAINT `nota_credito_detalle_nota_credito_id_fkey` FOREIGN KEY (`nota_credito_id`) REFERENCES `nota_credito`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `secuencia_nota_credito` ADD CONSTRAINT `secuencia_nota_credito_caja_id_fkey` FOREIGN KEY (`caja_id`) REFERENCES `caja`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
