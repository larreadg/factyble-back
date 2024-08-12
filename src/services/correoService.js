const nodemailer = require('nodemailer')
const path = require('path')
const fs = require('fs')
const axios = require('axios')

const enviarFactura = async ({ email, cdc, cliente, uuid, nroFactura, empresa, emailEmpresa }) => {

    let filePath = path.join(__dirname, '..', 'resources', 'facturaTemplate.html')
    let html = fs.readFileSync(filePath, {encoding:'utf-8'})
    let pdfPath = path.join(__dirname, '..', '..', 'public', `${uuid}.pdf`)

    html = html.replace(/\$cdc/g, cdc)
    html = html.replace(/\$cliente/g, cliente)
    html = html.replace(/\$emailEmpresa/g, emailEmpresa)

    const xmlResponse = await axios.get(`http://${process.env.HOST_API_FACT}/facturacion-api/firmados/${cdc}.xml`, { responseType: 'arraybuffer' });
    const xmlBuffer = Buffer.from(xmlResponse.data, 'binary');

    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT),
        secure: Number(process.env.EMAIL_SECURE) === 1, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PW,
        },
    })

    let mailObj = {
        from: process.env.EMAIL_FROM, // sender address
        to: email, // list of receivers
        subject: `Factura electrónica Nro. ${nroFactura} | ${empresa}`,
        html,
        attachments: [
            {
                filename: `${uuid}.pdf`, 
                path: pdfPath,
                contentType: 'application/pdf'
            },
            {
                filename: `${cdc}.xml`, // nombre del archivo XML
                content: xmlBuffer, // contenido del archivo XML
                contentType: 'application/xml'
            }
        ]
    }

    let info = await transporter.sendMail(mailObj)

    console.log("Message sent: %s", info.messageId)

}

const enviarErrorFactura = async ({ email, nroFactura, errorFactura, empresa }) => {

    let filePath = path.join(__dirname, '..', 'resources', 'facturaErrorTemplate.html')
    let html = fs.readFileSync(filePath, {encoding:'utf-8'})

    html = html.replace(/\$nroFactura/g, nroFactura)
    html = html.replace(/\$errorFactura/g, errorFactura)

    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT),
        secure: Number(process.env.EMAIL_SECURE) === 1, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PW,
        },
    })

    let mailObj = {
        from: process.env.EMAIL_FROM, // sender address
        to: email, // list of receivers
        subject: `Error Factura Nro.: ${nroFactura} | ${empresa}`,
        html
    }

    let info = await transporter.sendMail(mailObj)

    console.log("Message sent: %s", info.messageId)

}

module.exports = {
    enviarFactura,
    enviarErrorFactura
}