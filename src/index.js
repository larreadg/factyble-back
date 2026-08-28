require('dotenv').config()

const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const cors = require('cors')
const routes = require('./routes')
const path = require('path')
const cronJobs = require('./services/cronJobs')
const cronJobsPvta = require('./services/cronJobsPvta')

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended : false }))

// Los cronjobs SIFEN sólo corren en producción. Si ENTORNO es 'desa' o no está definido, no se registran.
if (process.env.ENTORNO === 'prod') {
    cronJobs()
    cronJobsPvta()
} else {
    console.log(`Cronjobs deshabilitados (ENTORNO=${process.env.ENTORNO || 'no definido'})`)
}

app.use('/public', express.static(path.join(__dirname, '..', 'public')))
app.use(routes)

// HTTPS opcional, sólo para el despliegue on-prem: la caja es OTRA máquina de la LAN y el navegador
// trata a http://<ip-de-la-red> como origen inseguro. Si HTTPS_PFX no está definido el server arranca
// en HTTP plano, que es como corre en desarrollo y como corre en la nube detrás del proxy (ahí el TLS
// lo termina el proxy, no este proceso).
//
// El .pfx lo genera scripts/https-lan.ps1 contra la IP de WiFi de la máquina. Si esa IP cambia hay que
// volver a correrlo: el certificado queda atado a la IP y el navegador lo rechaza si no coincide.
if (process.env.HTTPS_PFX) {
    const fs = require('fs')
    const https = require('https')

    const opciones = {
        pfx: fs.readFileSync(process.env.HTTPS_PFX),
        passphrase: process.env.HTTPS_PFX_PASSWORD || ''
    }

    https.createServer(opciones, app).listen(process.env.PORT, ()=> {
        console.log(`Server running on port ${process.env.PORT} (HTTPS)`)
    })
} else {
    app.listen(process.env.PORT, ()=> {
        console.log(`Server running on port ${process.env.PORT}`)
    })
}