// Túnel de desarrollo con Cloudflare (cloudflared) para exponer la API local por HTTPS.
//
// No se termina TLS en Node: cloudflared publica una URL pública (https://*.trycloudflare.com para el
// "quick tunnel", o tu hostname estable para un "named tunnel") y reenvía el tráfico en claro a
// http://localhost:PORT, así el server de src/index.js sigue escuchando HTTP sin cambios.
//
// Uso:  npm run tunnel        (en una terminal aparte, con `npm run dev` corriendo en otra)
//
// Requiere el binario `cloudflared` en el PATH:
//   Windows:  winget install --id Cloudflare.cloudflared
//   otros:    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
require('dotenv').config()
const { spawn } = require('child_process')

const port = process.env.PORT
if (!port) {
  console.error('[tunnel] Falta PORT en el .env — no sé a qué puerto local apuntar el túnel.')
  process.exit(1)
}

const target = `http://localhost:${port}`

// Named tunnel (URL estable): si CLOUDFLARE_TUNNEL_NAME está seteado se asume que ya creaste el túnel
// (`cloudflared tunnel create <nombre>`) y su ruta DNS, y que el ingress (hostname -> service) vive en
// tu config de cloudflared (~/.cloudflared/config.yml o el dashboard). Si está vacío, quick tunnel.
const nombreTunel = process.env.CLOUDFLARE_TUNNEL_NAME

const args = nombreTunel
  ? ['tunnel', 'run', nombreTunel]
  : ['tunnel', '--url', target]

console.log(
  nombreTunel
    ? `[tunnel] named tunnel "${nombreTunel}"  (ingress definido en tu config de cloudflared)  ->  ${target}`
    : `[tunnel] quick tunnel  ->  ${target}\n[tunnel] Cloudflare va a imprimir la URL pública https://*.trycloudflare.com abajo.`
)

const proc = spawn('cloudflared', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

proc.on('error', (err) => {
  if (err.code === 'ENOENT') {
    console.error('\n[tunnel] No se encontró "cloudflared" en el PATH.')
    console.error('[tunnel] Instalalo con:  winget install --id Cloudflare.cloudflared')
    console.error(
      '[tunnel] o descargá el binario: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/\n'
    )
    process.exit(1)
  }
  throw err
})

proc.on('exit', (code) => process.exit(code ?? 0))

// Cerrar cloudflared limpio junto con el script.
;['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => proc.kill(sig)))
