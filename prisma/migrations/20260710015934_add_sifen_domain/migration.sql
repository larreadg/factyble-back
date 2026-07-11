-- AlterTable
ALTER TABLE `empresa` ADD COLUMN `cod_actividad_principal` VARCHAR(10) NULL,
    ADD COLUMN `cod_actividad_secundaria` VARCHAR(10) NULL,
    ADD COLUMN `cod_moneda` VARCHAR(3) NOT NULL DEFAULT 'PYG',
    ADD COLUMN `csc` VARCHAR(255) NULL,
    ADD COLUMN `csc_id` VARCHAR(10) NULL,
    ADD COLUMN `desc_actividad_principal` VARCHAR(255) NULL,
    ADD COLUMN `desc_actividad_secundaria` VARCHAR(255) NULL,
    ADD COLUMN `desc_moneda` VARCHAR(50) NULL,
    ADD COLUMN `digito_verificador` VARCHAR(1) NULL,
    ADD COLUMN `ruc_sin_dv` VARCHAR(15) NULL,
    ADD COLUMN `tipo_contribuyente` ENUM('FISICA', 'JURIDICA') NULL,
    ADD COLUMN `tipo_impuesto` ENUM('IVA', 'ISC', 'RENTA', 'NINGUNO', 'IVA_RENTA') NULL;

-- AlterTable
ALTER TABLE `factura` ADD COLUMN `estado_sifen` ENUM('GENERADO', 'FIRMADO', 'ENCOLADO', 'ENVIADO', 'APROBADO', 'RECHAZADO', 'ERROR', 'CANCELADO') NULL,
    ADD COLUMN `fecha_envio_sifen` DATETIME(3) NULL,
    ADD COLUMN `fecha_firma` DATETIME(3) NULL,
    ADD COLUMN `fecha_respuesta_sifen` DATETIME(3) NULL,
    ADD COLUMN `lote_id` INTEGER NULL,
    ADD COLUMN `sifen_cod_respuesta` VARCHAR(10) NULL,
    ADD COLUMN `sifen_num_transaccion` VARCHAR(50) NULL,
    ADD COLUMN `xml_firmado` MEDIUMTEXT NULL;

-- AlterTable
ALTER TABLE `nota_credito` ADD COLUMN `estado_sifen` ENUM('GENERADO', 'FIRMADO', 'ENCOLADO', 'ENVIADO', 'APROBADO', 'RECHAZADO', 'ERROR', 'CANCELADO') NULL,
    ADD COLUMN `fecha_envio_sifen` DATETIME(3) NULL,
    ADD COLUMN `fecha_firma` DATETIME(3) NULL,
    ADD COLUMN `fecha_respuesta_sifen` DATETIME(3) NULL,
    ADD COLUMN `lote_id` INTEGER NULL,
    ADD COLUMN `sifen_cod_respuesta` VARCHAR(10) NULL,
    ADD COLUMN `sifen_num_transaccion` VARCHAR(50) NULL,
    ADD COLUMN `xml_firmado` MEDIUMTEXT NULL;

-- CreateTable
CREATE TABLE `certificado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `alias` VARCHAR(100) NOT NULL,
    `archivo` VARCHAR(500) NOT NULL,
    `clave` VARCHAR(500) NOT NULL,
    `fecha_vencimiento` DATETIME(3) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `estado` ENUM('VIGENTE', 'POR_VENCER', 'VENCIDO', 'REVOCADO') NOT NULL DEFAULT 'VIGENTE',
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    INDEX `certificado_empresa_id_idx`(`empresa_id`),
    INDEX `certificado_empresa_id_activo_idx`(`empresa_id`, `activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `secuencia` VARCHAR(50) NOT NULL,
    `tipo_doc` ENUM('FACTURA', 'NOTA_CREDITO') NOT NULL,
    `estado` ENUM('CONSTRUIDO', 'ENVIADO', 'CONSULTADO') NOT NULL DEFAULT 'CONSTRUIDO',
    `archivo_zip` VARCHAR(255) NULL,
    `sifen_numero_lote` VARCHAR(50) NULL,
    `sifen_envio_codigo` VARCHAR(10) NULL,
    `sifen_envio_mensaje` TEXT NULL,
    `sifen_consulta_codigo` VARCHAR(100) NULL,
    `sifen_consulta_mensaje` MEDIUMTEXT NULL,
    `intentos_envio` INTEGER NOT NULL DEFAULT 0,
    `proximo_intento_en` DATETIME(3) NULL,
    `ultimo_error` TEXT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lote_secuencia_key`(`secuencia`),
    INDEX `lote_empresa_id_idx`(`empresa_id`),
    INDEX `lote_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evento_sifen` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `tipo_evento` ENUM('CANCELACION', 'INACTIVACION_RANGO', 'NOMINACION_RECEPTOR', 'INUTILIZACION', 'CONFORMIDAD', 'DISCONFORMIDAD', 'DESCONOCIMIENTO', 'NOTIFICACION') NOT NULL,
    `factura_id` INTEGER NULL,
    `nota_credito_id` INTEGER NULL,
    `datos_evento` JSON NULL,
    `motivo` TEXT NULL,
    `secuencia_sifen` VARCHAR(50) NULL,
    `xml_firmado` MEDIUMTEXT NULL,
    `sifen_respuesta_codigo` VARCHAR(10) NULL,
    `sifen_respuesta_mensaje` TEXT NULL,
    `sifen_respuesta_xml` MEDIUMTEXT NULL,
    `intentos_envio` INTEGER NOT NULL DEFAULT 0,
    `proximo_intento_en` DATETIME(3) NULL,
    `ultimo_error` TEXT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_modificacion` DATETIME(3) NOT NULL,

    INDEX `evento_sifen_empresa_id_idx`(`empresa_id`),
    INDEX `evento_sifen_factura_id_idx`(`factura_id`),
    INDEX `evento_sifen_nota_credito_id_idx`(`nota_credito_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sifen_trazabilidad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entidad_tipo` ENUM('FACTURA', 'NOTA_CREDITO', 'LOTE', 'EVENTO') NOT NULL,
    `entidad_id` INTEGER NOT NULL,
    `operacion` ENUM('FIRMA', 'ENVIO_LOTE', 'CONSULTA_LOTE', 'CONSULTA_DOCUMENTO', 'EVENTO') NOT NULL,
    `request_payload` MEDIUMTEXT NULL,
    `response_payload` MEDIUMTEXT NULL,
    `codigo_respuesta` VARCHAR(20) NULL,
    `exitoso` BOOLEAN NOT NULL,
    `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sifen_trazabilidad_entidad_tipo_entidad_id_idx`(`entidad_tipo`, `entidad_id`),
    INDEX `sifen_trazabilidad_fecha_creacion_idx`(`fecha_creacion`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `factura_lote_id_idx` ON `factura`(`lote_id`);

-- CreateIndex
CREATE INDEX `factura_estado_sifen_idx` ON `factura`(`estado_sifen`);

-- CreateIndex
CREATE INDEX `nota_credito_lote_id_idx` ON `nota_credito`(`lote_id`);

-- CreateIndex
CREATE INDEX `nota_credito_estado_sifen_idx` ON `nota_credito`(`estado_sifen`);

-- AddForeignKey
ALTER TABLE `factura` ADD CONSTRAINT `factura_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `lote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nota_credito` ADD CONSTRAINT `nota_credito_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `lote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificado` ADD CONSTRAINT `certificado_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lote` ADD CONSTRAINT `lote_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evento_sifen` ADD CONSTRAINT `evento_sifen_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evento_sifen` ADD CONSTRAINT `evento_sifen_factura_id_fkey` FOREIGN KEY (`factura_id`) REFERENCES `factura`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evento_sifen` ADD CONSTRAINT `evento_sifen_nota_credito_id_fkey` FOREIGN KEY (`nota_credito_id`) REFERENCES `nota_credito`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
