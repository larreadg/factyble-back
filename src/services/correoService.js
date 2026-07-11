const nodemailer = require('nodemailer')
const path = require('path')
const fs = require('fs')

const enviarFactura = async ({ email, cdc, cliente, uuid, nroFactura, empresa, emailEmpresa, xmlFirmado }) => {

    let filePath = path.join(__dirname, '..', 'resources', 'facturaTemplate.html')
    let html = fs.readFileSync(filePath, {encoding:'utf-8'})
    let pdfPath = path.join(__dirname, '..', '..', 'public', `${uuid}.pdf`)

    html = html.replace(/\$cdc/g, cdc)
    html = html.replace(/\$cliente/g, cliente)
    html = html.replace(/\$emailEmpresa/g, emailEmpresa)

    // El XML firmado vive en la BD (`xml_firmado`), no en un archivo servido por la API PHP legacy
    // (antipatrón F, MIGRATION_PLAN.md §2.2) — se recibe ya como contenido, sin fetch por HTTP.
    const xmlBuffer = Buffer.from(xmlFirmado, 'utf-8');

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

const enviarNotaDeCredito = async ({ email, cdc, cliente, uuid, nroNotaDeCredito, empresa, emailEmpresa, xmlFirmado }) => {

    let filePath = path.join(__dirname, '..', 'resources', 'notaDeCreditoTemplate.html')
    let html = fs.readFileSync(filePath, {encoding:'utf-8'})
    let pdfPath = path.join(__dirname, '..', '..', 'public', `${uuid}.pdf`)

    html = html.replace(/\$cdc/g, cdc)
    html = html.replace(/\$cliente/g, cliente)
    html = html.replace(/\$emailEmpresa/g, emailEmpresa)

    // El XML firmado vive en la BD (`xml_firmado`), no en un archivo servido por la API PHP legacy
    // (antipatrón F, MIGRATION_PLAN.md §2.2) — se recibe ya como contenido, sin fetch por HTTP.
    const xmlBuffer = Buffer.from(xmlFirmado, 'utf-8');

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
        subject: `Nota de crédito electrónica Nro. ${nroNotaDeCredito} | ${empresa}`,
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

const enviarRecibo = async ({ email, cliente, uuid, reciboId, nroRecibo, empresa, emailEmpresa }) => {

    let filePath = path.join(__dirname, '..', 'resources', 'reciboTemplate.html')
    let html = fs.readFileSync(filePath, {encoding:'utf-8'})
    let pdfPath = path.join(__dirname, '..', '..', 'public', `${uuid}.pdf`)

    html = html.replace(/\$cliente/g, cliente)
    html = html.replace(/\$reciboId/g, reciboId)
    html = html.replace(/\$emailEmpresa/g, emailEmpresa)

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
        subject: `Recibo Nro. ${nroRecibo} | ${empresa}`,
        html,
        attachments: [
            {
                filename: `${uuid}.pdf`,
                path: pdfPath,
                contentType: 'application/pdf'
            }
        ]
    }

    let info = await transporter.sendMail(mailObj)

    console.log("Message sent: %s", info.messageId)

}

const enviarErrorNotaDeCredito = async ({ email, nroNotaDeCredito, errorNotaDeCredito, empresa }) => {

    let filePath = path.join(__dirname, '..', 'resources', 'notaDeCreditoErrorTemplate.html')
    let html = fs.readFileSync(filePath, {encoding:'utf-8'})

    html = html.replace(/\$nroNotaDeCredito/g, nroNotaDeCredito)
    html = html.replace(/\$errorNotaDeCredito/g, errorNotaDeCredito)

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
        subject: `Error Nota de crédito Nro.: ${nroNotaDeCredito} | ${empresa}`,
        html
    }

    let info = await transporter.sendMail(mailObj)

    console.log("Message sent: %s", info.messageId)

}

module.exports = {
    enviarFactura,
    enviarErrorFactura,
    enviarNotaDeCredito,
    enviarRecibo,
    enviarErrorNotaDeCredito
}
