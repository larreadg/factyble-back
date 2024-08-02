const { PrismaClient } = require("@prisma/client")
const dayjs = require("dayjs")
const svgCaptcha = require("svg-captcha")

/**
 * Función que genera una captcha por ip
 * @param {Object} data Datos a insertar
 * @param {string} data.ip IP del usuario
 * @returns {Promise<Object>}
 */
const generarCaptcha = async ({ ip }) => {
  const prisma = new PrismaClient()

  try {
    const captchaImg = svgCaptcha.create({
      size: 6,
      noise: 4,
      width: 200,
      height: 100,
      background: "#fafafa",
      ignoreChars: "oOlI",
    })

    const { text } = captchaImg

    await prisma.captcha.deleteMany({ where: { ip } })
    await prisma.captcha.create({
      data: {
        ip,
        captcha: text,
        fecha_expiracion: dayjs().add(3, "minute"),
      },
    })

    return captchaImg.data

  } catch (error) {
    ErrorApp.handleServiceError(error, "Error al crear factura")
  } finally {
    prisma.$disconnect()
  }

  
}

module.exports = {
  generarCaptcha,
}
