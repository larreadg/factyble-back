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

// Los dos fronts compilados se sirven desde este mismo proceso: en el despliegue on-prem no hay un
// nginx delante, y servirlos acá los deja en el MISMO origen que la API, así que la caja no arrastra
// preflight de CORS ni un segundo certificado que aceptar.
//
// Cada uno está BUILDEADO para su prefijo (vite base '/portal/' + basename del router; <base
// href="/portal-admin/"> en el Angular), así que estas rutas no se pueden renombrar sin recompilar
// el front correspondiente.
const portales = [
    { ruta: '/portal', carpeta: 'portal' },
    { ruta: '/portal-admin', carpeta: 'portal-admin' }
]

for (const portal of portales) {
    const raiz = path.join(__dirname, '..', 'portales', portal.carpeta)

    app.use(portal.ruta, express.static(raiz))

    // Fallback de SPA: las rutas del router viven sólo en el navegador, así que un F5 sobre
    // /portal/ventas llega al server como un GET de un archivo que no existe. Va DESPUÉS del static
    // (si no, se comería los assets) y acotado al prefijo, para no tocar las rutas de la API.
    app.get(`${portal.ruta}/*`, (req, res) => {
        res.sendFile(path.join(raiz, 'index.html'))
    })
}

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