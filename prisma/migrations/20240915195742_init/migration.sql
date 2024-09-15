-- CreateTable
CREATE TABLE `usuario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombres` VARCHAR(255) NOT NULL,
    `apellidos` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `documento` VARCHAR(20) NOT NULL,
    `telefono` VARCHAR(20) NOT NULL,
    `password` VARCHAR(100) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,
    `empresa_id` INTEGER NOT NULL,

    UNIQUE INDEX `usuario_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rol` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuario_rol` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `rol_id` INTEGER NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `empresa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ruc` VARCHAR(255) NOT NULL,
    `nombre_empresa` VARCHAR(255) NOT NULL,
    `timbrado` VARCHAR(255) NOT NULL,
    `direccion` VARCHAR(255) NOT NULL,
    `vigente_desde` DATETIME(3) NOT NULL,
    `telefono` VARCHAR(20) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `ciudad` VARCHAR(100) NOT NULL,
    `logo` VARCHAR(255) NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cliente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ruc` VARCHAR(255) NOT NULL,
    `documento` VARCHAR(255) NOT NULL,
    `dv` TINYINT NULL,
    `razon_social` VARCHAR(255) NULL,
    `tipo_identificacion` ENUM('CEDULA', 'CARNE_DE_RESIDENCIA', 'PASAPORTE', 'IDENTIFICACION_TRIBUTARIA', 'RUC') NOT NULL,
    `nombres` VARCHAR(255) NOT NULL,
    `apellidos` VARCHAR(255) NOT NULL,
    `pais` VARCHAR(255) NULL,
    `direccion` TEXT NULL,
    `email` VARCHAR(255) NULL,
    `telefono` VARCHAR(20) NULL,
    `situacion_tributaria` ENUM('CONTRIBUYENTE', 'NO_CONTRIBUYENTE', 'NO_DOMICILIADO') NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cliente_empresa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `empresa_id` INTEGER NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `factura` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero_factura` INTEGER NOT NULL,
    `factura_uuid` VARCHAR(255) NOT NULL,
    `usuario_id` INTEGER NOT NULL,
    `cliente_empresa_id` INTEGER NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,
    `condicion_venta` ENUM('CONTADO', 'CREDITO') NOT NULL,
    `total_iva` DOUBLE NOT NULL,
    `total` DOUBLE NOT NULL,
    `cdc` VARCHAR(255) NOT NULL,
    `xml` TEXT NULL,
    `linkqr` TEXT NULL,
    `sifen_estado` TEXT NULL,
    `sifen_estado_mensaje` TEXT NULL,
    `codigo_seguridad` VARCHAR(10) NOT NULL,
    `caja_id` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `factura_detalle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_factura` INTEGER NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `precio_unitario` DOUBLE NOT NULL,
    `tasa` ENUM('T0', 'T5', 'T10') NOT NULL,
    `impuesto` DOUBLE NOT NULL,
    `total` DOUBLE NOT NULL,
    `descripcion` TEXT NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `captcha` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `captcha` VARCHAR(6) NOT NULL,
    `ip` VARCHAR(40) NOT NULL,
    `fecha_expiracion` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `secuencia_factura` (
    `caja_id` INTEGER NOT NULL,
    `valor` INTEGER NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    PRIMARY KEY (`caja_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nota_credito` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero_nota_credito` INTEGER NOT NULL,
    `factura_id` INTEGER NOT NULL,
    `nota_credito_uuid` VARCHAR(255) NOT NULL,
    `usuario_id` INTEGER NOT NULL,
    `total_iva` DOUBLE NOT NULL,
    `total` DOUBLE NOT NULL,
    `cdc` VARCHAR(255) NOT NULL,
    `xml` TEXT NULL,
    `linkqr` TEXT NULL,
    `sifen_estado` TEXT NULL,
    `sifen_estado_mensaje` TEXT NULL,
    `codigo_seguridad` VARCHAR(10) NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,
    `caja_id` INTEGER NULL,

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
ALTER TABLE `usuario` ADD CONSTRAINT `usuario_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario_rol` ADD CONSTRAINT `usuario_rol_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario_rol` ADD CONSTRAINT `usuario_rol_rol_id_fkey` FOREIGN KEY (`rol_id`) REFERENCES `rol`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cliente_empresa` ADD CONSTRAINT `cliente_empresa_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cliente_empresa` ADD CONSTRAINT `cliente_empresa_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `factura` ADD CONSTRAINT `factura_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `factura` ADD CONSTRAINT `factura_cliente_empresa_id_fkey` FOREIGN KEY (`cliente_empresa_id`) REFERENCES `cliente_empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `factura` ADD CONSTRAINT `factura_caja_id_fkey` FOREIGN KEY (`caja_id`) REFERENCES `caja`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `factura_detalle` ADD CONSTRAINT `factura_detalle_id_factura_fkey` FOREIGN KEY (`id_factura`) REFERENCES `factura`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `establecimiento` ADD CONSTRAINT `establecimiento_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `caja` ADD CONSTRAINT `caja_establecimiento_id_fkey` FOREIGN KEY (`establecimiento_id`) REFERENCES `establecimiento`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `secuencia_factura` ADD CONSTRAINT `secuencia_factura_caja_id_fkey` FOREIGN KEY (`caja_id`) REFERENCES `caja`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nota_credito` ADD CONSTRAINT `nota_credito_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nota_credito` ADD CONSTRAINT `nota_credito_factura_id_fkey` FOREIGN KEY (`factura_id`) REFERENCES `factura`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nota_credito` ADD CONSTRAINT `nota_credito_caja_id_fkey` FOREIGN KEY (`caja_id`) REFERENCES `caja`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nota_credito_detalle` ADD CONSTRAINT `nota_credito_detalle_nota_credito_id_fkey` FOREIGN KEY (`nota_credito_id`) REFERENCES `nota_credito`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `secuencia_nota_credito` ADD CONSTRAINT `secuencia_nota_credito_caja_id_fkey` FOREIGN KEY (`caja_id`) REFERENCES `caja`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
