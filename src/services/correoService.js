const nodemailer = require('nodemailer')
const path = require('path')
const fs = require('fs')
const axios = require('axios')

const enviarFactura = async ({ email, cdc, cliente, pdf }) => {

    let filePath = path.join(__dirname, '..', 'resources', 'facturaTemplate.html')
    let html = fs.readFileSync(filePath, {encoding:'utf-8'})
    let pdfPath = path.join(__dirname, '..', '..', 'public', pdf)

    html = html.replace('$cdc', cdc)
    html = html.replace('$cliente', cliente)

    const xmlResponse = await axios.get(`${process.env.API_FACT_XML_PATH}/${cdc}.xml`, { responseType: 'arraybuffer' });
    const xmlBuffer = Buffer.from(xmlResponse.data, 'binary');

    let transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PW,
        },
    })

    let mailObj = {
        from: `"Dynamus" <factyble@gmail.com>`, // sender address
        to: email, // list of receivers
        subject: 'Factura electronica',
        html,
        attachments: [
            {
                filename: pdf, 
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

module.exports = enviarFactura