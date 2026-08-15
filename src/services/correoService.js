const nodemailer = require('nodemailer')
const path = require('path')
const fs = require('fs')

// Logo de Factyble embebido por CID (Content-ID), no como data-URI base64 ni como imagen remota:
// Outlook de escritorio no renderiza imágenes base64 inline, y varios webmails (Gmail incluido)
// bloquean o filtran ese formato de forma inconsistente. El adjunto con `cid` + `contentDisposition:
// 'inline'` es el mecanismo estándar que garantiza que el logo se vea en todos los clientes de correo.
const LOGO_FACTYBLE_PATH = path.join(__dirname, '..', 'resources', 'factyble-logo.png')
const LOGO_FACTYBLE_CID = 'factybleLogo'
const adjuntoLogoFactyble = () => ({
    filename: 'factyble-logo.png',
    path: LOGO_FACTYBLE_PATH,
    cid: LOGO_FACTYBLE_CID,
    contentDisposition: 'inline',
})

// Un receptor puede no tener email: facturas innominadas (consumidor final no identificado, sin
// destinatario) y facturas simples emitidas sin `personaEmail`. En esos casos se omite el envío en vez
// de dejar que nodemailer falle con "No recipients defined" (que igual se traga el try/catch del
// llamador, pero ensucia los logs con un error que no es tal). Chequeo mínimo de formato de email.
const esEmailEnviable = (email) => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

const enviarFactura = async ({ email, cdc, cliente, uuid, nroFactura, empresa, emailEmpresa, xmlFirmado }) => {

    if (!esEmailEnviable(email)) {
        console.log(`Factura Nro. ${nroFactura} sin email de destinatario válido — se omite el envío por correo`)
        return
    }

    let filePath = path.join(__dirname, '..', 'resources', 'facturaTemplate.html')
    let html = fs.readFileSync(filePath, {encoding:'utf-8'})
    let pdfPath = path.join(__dirname, '..', '..', 'public', `${uuid}.pdf`)

    html = html.replace(/\$cdc/g, cdc)
    html = html.replace(/\$cliente/g, cliente)
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

    const attachments = [
        {
            filename: `${uuid}.pdf`,
            path: pdfPath,
            contentType: 'application/pdf'
        },
        adjuntoLogoFactyble()
    ]

    // El XML firmado vive en la BD (`xml_firmado`), no en un archivo servido por la API PHP legacy
    // (antipatrón F) — se recibe ya como contenido, sin fetch por HTTP.
    // Puede venir vacío para una Factura histórica (emitida antes del corte, sin xml_firmado propio —
    // AUD-001, STATIC_AUDIT_FINDINGS.json): en ese caso se manda el mail sin adjuntar el XML en vez de
    // fallar el envío completo (antes, `Buffer.from(undefined)` tiraba directo).
    if (xmlFirmado) {
        attachments.push({
            filename: `${cdc}.xml`, // nombre del archivo XML
            content: Buffer.from(xmlFirmado, 'utf-8'), // contenido del archivo XML
            contentType: 'application/xml'
        })
    }

    let mailObj = {
        from: process.env.EMAIL_FROM, // sender address
        to: email, // list of receivers
        subject: `Factura electrónica Nro. ${nroFactura} | ${empresa}`,
        html,
        attachments
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
        html,
        attachments: [adjuntoLogoFactyble()]
    }

    let info = await transporter.sendMail(mailObj)

    console.log("Message sent: %s", info.messageId)

}

const enviarNotaDeCredito = async ({ email, cdc, cliente, uuid, nroNotaDeCredito, empresa, emailEmpresa, xmlFirmado }) => {

    if (!esEmailEnviable(email)) {
        console.log(`Nota de crédito Nro. ${nroNotaDeCredito} sin email de destinatario válido — se omite el envío por correo`)
        return
    }

    let filePath = path.join(__dirname, '..', 'resources', 'notaDeCreditoTemplate.html')
    let html = fs.readFileSync(filePath, {encoding:'utf-8'})
    let pdfPath = path.join(__dirname, '..', '..', 'public', `${uuid}.pdf`)

    html = html.replace(/\$cdc/g, cdc)
    html = html.replace(/\$cliente/g, cliente)
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

    const attachments = [
        {
            filename: `${uuid}.pdf`,
            path: pdfPath,
            contentType: 'application/pdf'
        },
        adjuntoLogoFactyble()
    ]

    // El XML firmado vive en la BD (`xml_firmado`), no en un archivo servido por la API PHP legacy
    // (antipatrón F) — se recibe ya como contenido, sin fetch por HTTP.
    // Puede venir vacío para una Nota de Crédito histórica (AUD-001, STATIC_AUDIT_FINDINGS.json): en
    // ese caso se manda el mail sin adjuntar el XML en vez de fallar el envío completo.
    if (xmlFirmado) {
        attachments.push({
            filename: `${cdc}.xml`, // nombre del archivo XML
            content: Buffer.from(xmlFirmado, 'utf-8'), // contenido del archivo XML
            contentType: 'application/xml'
        })
    }

    let mailObj = {
        from: process.env.EMAIL_FROM, // sender address
        to: email, // list of receivers
        subject: `Nota de crédito electrónica Nro. ${nroNotaDeCredito} | ${empresa}`,
        html,
        attachments
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
            },
            adjuntoLogoFactyble()
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
        html,
        attachments: [adjuntoLogoFactyble()]
    }

    let info = await transporter.sendMail(mailObj)

    console.log("Message sent: %s", info.messageId)

}

/**
 * Alerta interna (no es un mail a un cliente) para el job `alertaCertificadosPorVencer`
 * (`cronJobs.js`) — antes solo quedaba en `console.warn` (AUD-014,
 * STATIC_AUDIT_FINDINGS.json). Envía a `destinatario` (configurable vía `SIFEN_ALERTA_EMAIL`, ver
 * `.env.example`) el listado de certificados en estado `POR_VENCER`/`VENCIDO`. No usa un template
 * HTML de archivo (a diferencia de `enviarFactura`/etc.) porque es un mail técnico/operativo, no
 * uno con la identidad de marca del cliente final.
 * @param {Object} datos
 * @param {string} datos.destinatario - Email del administrador a notificar
 * @param {Object[]} datos.certificados - Certificados por vencer/vencidos (con `empresa_id`, `estado`, `fecha_vencimiento`)
 */
const enviarAlertaCertificadosPorVencer = async ({ destinatario, certificados }) => {

    const filas = certificados.map((c) => `
        <tr>
            <td>${c.empresa_id}</td>
            <td>${c.estado}</td>
            <td>${new Date(c.fecha_vencimiento).toISOString().slice(0, 10)}</td>
        </tr>
    `).join('')

    const html = `
        <p>Los siguientes certificados SIFEN requieren atención (por vencer o ya vencidos):</p>
        <table border="1" cellpadding="6" cellspacing="0">
            <thead>
                <tr><th>Empresa (id)</th><th>Estado</th><th>Vencimiento</th></tr>
            </thead>
            <tbody>${filas}</tbody>
        </table>
    `

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
        from: process.env.EMAIL_FROM,
        to: destinatario,
        subject: `[Factyble] Certificados SIFEN por vencer o vencidos (${certificados.length})`,
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
    enviarErrorNotaDeCredito,
    enviarAlertaCertificadosPorVencer
}
