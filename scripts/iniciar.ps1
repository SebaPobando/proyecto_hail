# Levanta Hail en local: backend, simulador de datos y pantallas, cada uno en su
# ventana, y abre el navegador. Se ejecuta con doble clic en iniciar.cmd.
# Para apagar Hail basta con cerrar las tres ventanas.

$ErrorActionPreference = 'Continue'
$Raiz = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Raiz 'backend'
$Frontend = Join-Path $Raiz 'frontend'
$VenvPython = Join-Path $Backend '.venv\Scripts\python.exe'

$UrlSalud = 'http://127.0.0.1:8000/api/health'
$UrlPantallas = 'http://127.0.0.1:5173/'
$UrlPortal = 'http://127.0.0.1:5173/'
$UrlAdmin = 'http://127.0.0.1:5173/admin/'

function Falla($texto) {
    Write-Host ''
    Write-Host "  ERROR: $texto" -ForegroundColor Red
    Write-Host '  Revisa la sección "Si algo falla" de docs\GUIA_PRUEBA_LOCAL.md' -ForegroundColor Yellow
    Write-Host '  o mándale a Seba una captura de esta ventana.' -ForegroundColor Yellow
    exit 1
}

function Responde($url) {
    try {
        Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Esperar($url, $nombre) {
    Write-Host "  Esperando $nombre" -NoNewline
    for ($i = 0; $i -lt 90; $i++) {
        if (Responde $url) { Write-Host '  listo' -ForegroundColor Green; return $true }
        Write-Host '.' -NoNewline
        Start-Sleep -Seconds 1
    }
    Write-Host '  no respondió' -ForegroundColor Red
    return $false
}

# Abre una ventana de PowerShell que ejecuta un comando y queda abierta.
function Abrir-Ventana($titulo, $carpeta, $comando) {
    $script = @"
`$host.UI.RawUI.WindowTitle = 'Hail - $titulo'
Write-Host 'Hail - $titulo' -ForegroundColor Cyan
Write-Host 'No cierres esta ventana mientras uses Hail. Cerrarla apaga esta parte.' -ForegroundColor DarkGray
Write-Host ''
$comando
"@
    $codificado = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
    Start-Process powershell.exe -WorkingDirectory $carpeta -ArgumentList '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $codificado
}

Write-Host ''
Write-Host '  Hail · iniciando' -ForegroundColor White

if (-not (Test-Path $VenvPython) -or -not (Test-Path (Join-Path $Backend '.env')) -or -not (Test-Path (Join-Path $Frontend 'node_modules'))) {
    Falla 'Hail no está instalado todavía. Primero haz doble clic en instalar.cmd.'
}

if (Responde $UrlSalud) {
    Write-Host '  Hail ya estaba funcionando; abro el navegador.' -ForegroundColor Green
} else {
    # Aplica cambios de la base de datos si hubo una actualización (no hace nada si no los hay).
    Push-Location $Backend
    & $VenvPython manage.py migrate -v 0
    $codigo = $LASTEXITCODE
    Pop-Location
    if ($codigo -ne 0) { Falla 'no se pudo preparar la base de datos.' }

    Abrir-Ventana 'Backend' $Backend "& '.\.venv\Scripts\python.exe' manage.py runserver 127.0.0.1:8000"
    Abrir-Ventana 'Simulador de datos' $Backend "& '.\.venv\Scripts\python.exe' manage.py simulate_telemetry --direct"
    Abrir-Ventana 'Pantallas' $Frontend 'npm.cmd run dev'

    if (-not (Esperar $UrlSalud 'al backend')) { Falla 'el backend no partió. Mira la ventana "Hail - Backend".' }
    if (-not (Esperar $UrlPantallas 'a las pantallas')) { Falla 'las pantallas no partieron. Mira la ventana "Hail - Pantallas".' }
}

Start-Process $UrlPortal

Write-Host ''
Write-Host '  Hail está funcionando:' -ForegroundColor Green
Write-Host "    Pantallas:       $UrlPortal  (entra con tu cuenta de administrador)"
Write-Host "    Administración:  $UrlAdmin"
Write-Host ''
Write-Host '  Para apagarlo, cierra las ventanas "Hail - Backend", "Hail - Simulador de datos" y "Hail - Pantallas".'
Write-Host '  Esta ventana ya se puede cerrar.'
Write-Host ''
