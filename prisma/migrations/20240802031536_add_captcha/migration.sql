-- CreateTable
CREATE TABLE `Captcha` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `captcha` VARCHAR(6) NOT NULL,
    `ip` VARCHAR(15) NOT NULL,
    `fecha_expiracion` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
