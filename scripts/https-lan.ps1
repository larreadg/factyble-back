<#
.SYNOPSIS
    Deja la API corriendo en HTTPS sobre la IP de WiFi de esta máquina, bajo PM2.

.DESCRIPTION
    En el despliegue on-prem la caja es OTRA computadora de la misma red, así que el navegador ve la
    API como http://<ip-de-la-lan> y la trata como origen inseguro. Este script:

      1. Detecta la IPv4 del adaptador WiFi.
      2. Genera un certificado autofirmado PARA ESA IP (con la IP en el SAN, que es lo que el
         navegador valida — un cert con la IP sólo en el CN o como DNS name lo rechaza igual).
      3. Lo exporta a certificados/lan/ como .pfx (lo lee Node) y como .cer (para instalar en la caja).
      4. Escribe HTTPS_PFX / HTTPS_PFX_PASSWORD en el .env.
      5. Arranca o reinicia la app en PM2.

    Es idempotente: si ya existe un certificado válido para la IP actual, no genera uno nuevo.

.NOTES
    - No requiere permisos de administrador (el cert se crea en Cert:\CurrentUser\My).
    - Si la IP cambia (DHCP), volvé a correrlo. Para que no cambie, pedí una reserva DHCP en el router
      o poné IP fija: es el certificado atado a la IP lo que se rompe, no el script.
    - El certificado es autofirmado: en la caja hay que instalar el .cer en "Entidades de certificación
      raíz de confianza" una sola vez, o Chrome va a mostrar la advertencia en cada arranque.

.EXAMPLE
    .\scripts\https-lan.ps1
    .\scripts\https-lan.ps1 -Force          # regenera el certificado aunque el actual sirva
#>

[CmdletBinding()]
param(
    [string] $NombreApp = 'factyble-back',
    [int]    $AniosValidez = 5,
    [switch] $Force
)

$ErrorActionPreference = 'Stop'

$raiz    = Split-Path -Parent $PSScriptRoot
$destino = Join-Path $raiz 'certificados\lan'
$envPath = Join-Path $raiz '.env'

# ── 1. IP de WiFi ────────────────────────────────────────────────────────────────────────────────
# Se busca primero un adaptador inalámbrico activo. Si no hay (la máquina podría estar por cable),
# se cae a la interfaz que tiene la ruta por defecto, que es la que efectivamente ve la LAN.
function Get-IpLan {
    $wifi = Get-NetAdapter |
        Where-Object { $_.Status -eq 'Up' -and $_.PhysicalMediaType -like '*802.11*' } |
        Select-Object -First 1

    if ($wifi) {
        $ip = Get-NetIPAddress -InterfaceIndex $wifi.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike '169.254.*' } |
            Select-Object -First 1 -ExpandProperty IPAddress
        if ($ip) {
            Write-Host "Adaptador WiFi: $($wifi.Name) -> $ip"
            return $ip
        }
        Write-Warning "El adaptador WiFi '$($wifi.Name)' está activo pero sin IPv4 utilizable."
    }

    $ruta = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
        Sort-Object RouteMetric | Select-Object -First 1
    if (-not $ruta) { throw 'No se encontró ninguna interfaz de red con salida a la LAN.' }

    $ip = Get-NetIPAddress -InterfaceIndex $ruta.InterfaceIndex -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notlike '169.254.*' } |
        Select-Object -First 1 -ExpandProperty IPAddress
    if (-not $ip) { throw 'La interfaz con ruta por defecto no tiene IPv4.' }

    Write-Warning "No hay WiFi activo; se usa la interfaz de la ruta por defecto -> $ip"
    return $ip
}

$ip = Get-IpLan

# ── 2. Certificado ───────────────────────────────────────────────────────────────────────────────
$asunto = "CN=$ip"

# ¿Ya hay uno vigente para esta misma IP? Sin esto cada corrida generaría un cert nuevo y habría que
# reinstalarlo en la caja cada vez.
$existente = Get-ChildItem Cert:\CurrentUser\My -ErrorAction SilentlyContinue |
    Where-Object { $_.Subject -eq $asunto -and $_.NotAfter -gt (Get-Date).AddDays(30) } |
    Sort-Object NotAfter -Descending | Select-Object -First 1

if ($existente -and -not $Force) {
    Write-Host "Certificado ya existente para $ip (vence $($existente.NotAfter.ToString('yyyy-MM-dd'))). Se reutiliza."
    $cert = $existente
} else {
    Write-Host "Generando certificado autofirmado para $ip ..."
    # El SAN es lo que importa: IPAddress=<ip>. Un certificado que sólo tenga la IP en el CN, o que la
    # declare como DNS name, es rechazado igual por Chrome/Edge al navegar a https://<ip>.
    $cert = New-SelfSignedCertificate `
        -Subject $asunto `
        -TextExtension @("2.5.29.17={text}IPAddress=$ip&DNS=$env:COMPUTERNAME") `
        -KeyAlgorithm RSA -KeyLength 2048 `
        -KeyUsage DigitalSignature, KeyEncipherment `
        -Type SSLServerAuthentication `
        -NotAfter (Get-Date).AddYears($AniosValidez) `
        -CertStoreLocation 'Cert:\CurrentUser\My'
}

# ── 3. Exportar ──────────────────────────────────────────────────────────────────────────────────
if (-not (Test-Path $destino)) { New-Item -ItemType Directory -Path $destino | Out-Null }

$pfxPath = Join-Path $destino "factyble-$ip.pfx"
$cerPath = Join-Path $destino "factyble-$ip.cer"

# Clave aleatoria: no la tipea nadie, la lee Node desde el .env. certificados/ está en .gitignore.
$bytes = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$password = [Convert]::ToBase64String($bytes)
$passwordSegura = ConvertTo-SecureString -String $password -Force -AsPlainText

Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $passwordSegura | Out-Null
Export-Certificate  -Cert $cert -FilePath $cerPath -Type CERT | Out-Null

Write-Host "PFX: $pfxPath"
Write-Host "CER: $cerPath   <- este es el que se instala en la caja"

# ── 4. .env ──────────────────────────────────────────────────────────────────────────────────────
# Se escribe sin BOM: dotenv trata el BOM como parte del nombre de la primera variable.
function Set-EnvVar {
    param([string] $Path, [string] $Clave, [string] $Valor)

    $lineas = @()
    if (Test-Path $Path) { $lineas = @(Get-Content -Path $Path) }

    $encontrada = $false
    $salida = foreach ($linea in $lineas) {
        if ($linea -match "^\s*$Clave\s*=") { $encontrada = $true; "$Clave=$Valor" }
        else { $linea }
    }
    if (-not $encontrada) { $salida = @($salida) + "$Clave=$Valor" }

    $utf8SinBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($Path, [string[]]$salida, $utf8SinBom)
}

Set-EnvVar -Path $envPath -Clave 'HTTPS_PFX'          -Valor $pfxPath
Set-EnvVar -Path $envPath -Clave 'HTTPS_PFX_PASSWORD' -Valor $password
Write-Host 'Actualizado .env (HTTPS_PFX, HTTPS_PFX_PASSWORD)'

# ── 5. PM2 ───────────────────────────────────────────────────────────────────────────────────────
# `pm2 restart` falla si la app nunca se levantó, así que se decide según lo que ya haya registrado.
$pm2 = (Get-Command pm2.cmd -ErrorAction SilentlyContinue)
if (-not $pm2) { $pm2 = (Get-Command pm2 -ErrorAction SilentlyContinue) }
if (-not $pm2) { throw 'No se encontró pm2 en el PATH. Instalalo con: npm install -g pm2' }

Push-Location $raiz
try {
    & $pm2.Source describe $NombreApp *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Reiniciando $NombreApp ..."
        & $pm2.Source restart $NombreApp --update-env
    } else {
        Write-Host "Arrancando $NombreApp ..."
        & $pm2.Source start (Join-Path $raiz 'src\index.js') --name $NombreApp
    }
    & $pm2.Source save | Out-Null
} finally {
    Pop-Location
}

$puerto = (Select-String -Path $envPath -Pattern '^\s*PORT\s*=\s*(.+)$' | Select-Object -First 1).Matches.Groups[1].Value
Write-Host ''
Write-Host "API en https://${ip}:$puerto" -ForegroundColor Green
Write-Host ''
Write-Host 'En la CAJA, una sola vez:' -ForegroundColor Yellow
Write-Host "  1. Copiar $cerPath"
Write-Host '  2. Doble clic -> Instalar certificado -> Equipo local ->'
Write-Host '     "Colocar todos los certificados en el siguiente almacen" ->'
Write-Host '     Entidades de certificacion raiz de confianza'
Write-Host '  3. Reiniciar el navegador'
