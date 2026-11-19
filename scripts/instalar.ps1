# Instala Hail en este computador para probarlo en local (Windows).
# Se ejecuta con doble clic en instalar.cmd. Se puede repetir sin problema:
# no borra datos ni vuelve a pedir la cuenta si ya existe.
#
# Modo simple: base de datos SQLite (un archivo), sin Docker.

$ErrorActionPreference = 'Continue'
$Raiz = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Raiz 'backend'
$Frontend = Join-Path $Raiz 'frontend'
$VenvPython = Join-Path $Backend '.venv\Scripts\python.exe'
$EnvFile = Join-Path $Backend '.env'
$TotalPasos = 6

function Paso($numero, $texto) {
    Write-Host ''
    Write-Host "[$numero/$TotalPasos] $texto" -ForegroundColor Cyan
}

function Ok($texto) {
    Write-Host "      OK  $texto" -ForegroundColor Green
}

function Falla($texto) {
    Write-Host ''
    Write-Host "  ERROR: $texto" -ForegroundColor Red
    Write-Host '  Revisa la sección "Si algo falla" de docs\GUIA_PRUEBA_LOCAL.md' -ForegroundColor Yellow
    Write-Host '  o mándale a Seba una captura de esta ventana.' -ForegroundColor Yellow
    exit 1
}

function Revisar($descripcion) {
    if ($LASTEXITCODE -ne 0) { Falla "no se pudo $descripcion (código $LASTEXITCODE)." }
}

# Devuelve la versión "3.12" si el comando funciona, o $null.
function Version-Python($exe, $extra) {
    if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { return $null }
    try {
        $v = & $exe @extra -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null
    } catch {
        return $null
    }
    if ($LASTEXITCODE -ne 0 -or -not $v) { return $null }
    return "$v".Trim()
}

function Escribir-Utf8($ruta, $texto) {
    [System.IO.File]::WriteAllText($ruta, $texto, (New-Object System.Text.UTF8Encoding $false))
}

Write-Host ''
Write-Host '  Hail · instalación local' -ForegroundColor White
Write-Host '  Carpeta del proyecto:' $Raiz
Write-Host '  La primera vez tarda entre 5 y 10 minutos (descarga librerías).'

# ---------------------------------------------------------------- 1. Python
Paso 1 'Buscando Python 3.12 o superior'
$Python = $null
$PythonExtra = @()
$Candidatos = @(
    @{ exe = 'py'; extra = @('-3') },
    @{ exe = 'python'; extra = @() },
    @{ exe = 'python3'; extra = @() }
)
foreach ($c in $Candidatos) {
    $v = Version-Python $c.exe $c.extra
    if ($v -and ([version]$v -ge [version]'3.12')) {
        $Python = $c.exe
        $PythonExtra = $c.extra
        Ok "Python $v"
        break
    }
}
if (-not $Python) {
    Falla 'no encontré Python 3.12 o superior. Instálalo desde https://www.python.org/downloads/ marcando "Add python.exe to PATH", cierra esta ventana y vuelve a hacer doble clic en instalar.cmd.'
}

# ---------------------------------------------------------------- 2. Node.js
Paso 2 'Buscando Node.js'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Falla 'no encontré Node.js. Instala la versión LTS desde https://nodejs.org/ , cierra esta ventana y vuelve a hacer doble clic en instalar.cmd.'
}
$NodeVersion = "$(node --version)".Trim()
$NodeMayor = [int]($NodeVersion.TrimStart('v').Split('.')[0])
if ($NodeMayor -lt 20) {
    Falla "tienes Node.js $NodeVersion y se necesita la 22 o superior. Instala la versión LTS desde https://nodejs.org/"
}
Ok "Node.js $NodeVersion"

# ---------------------------------------------------------------- 3. Backend
Paso 3 'Preparando el backend (librerías de Python)'
if (-not (Test-Path $VenvPython)) {
    & $Python @PythonExtra -m venv (Join-Path $Backend '.venv')
    Revisar 'crear el entorno de Python'
}
& $VenvPython -m pip install --disable-pip-version-check --quiet -r (Join-Path $Backend 'requirements-dev.txt')
Revisar 'instalar las librerías de Python'
Ok 'librerías instaladas'

# ---------------------------------------------------------------- 4. Configuración
Paso 4 'Configuración'
if (Test-Path $EnvFile) {
    Ok 'backend\.env ya existe, no lo toco'
} else {
    $texto = [System.IO.File]::ReadAllText((Join-Path $Backend '.env.example'))
    $clave = "$(& $VenvPython -c 'import secrets; print(secrets.token_urlsafe(50))')".Trim()
    $texto = $texto -replace '(?m)^DJANGO_SECRET_KEY=.*$', "DJANGO_SECRET_KEY=$clave"
    $texto = $texto -replace '(?m)^DATABASE_URL=.*$', 'DATABASE_URL=sqlite:///db.sqlite3'
    Escribir-Utf8 $EnvFile $texto
    Ok 'creado backend\.env (base de datos SQLite, sin Docker)'
}

# ---------------------------------------------------------------- 5. Base de datos
Paso 5 'Base de datos y proyectos de demostración'
Push-Location $Backend
try {
    & $VenvPython manage.py migrate -v 0
    Revisar 'crear las tablas de la base de datos'
    & $VenvPython manage.py seed_demo --demo-users
    Revisar 'cargar los proyectos de demostración'

    $salida = & $VenvPython manage.py shell -v 0 -c 'from django.contrib.auth import get_user_model as g; print(g().objects.filter(is_superuser=True).count())'
    $admins = "$($salida | Select-Object -Last 1)".Trim()
    if ($admins -ne '0') {
        Ok 'ya hay una cuenta de administrador'
    } else {
        Write-Host ''
        Write-Host '      Crea tu cuenta de administrador (la usarás para entrar a la administración).' -ForegroundColor White
        $correo = ''
        while ($correo -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
            $correo = (Read-Host '      Tu correo').Trim()
        }
        Write-Host '      La contraseña no se ve mientras escribes; es normal.' -ForegroundColor DarkGray
        while ($true) {
            $s1 = Read-Host '      Contraseña' -AsSecureString
            $s2 = Read-Host '      Repite la contraseña' -AsSecureString
            $p1 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s1))
            $p2 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s2))
            if ($p1.Length -lt 8) { Write-Host '      Usa al menos 8 caracteres.' -ForegroundColor Yellow; continue }
            if ($p1 -ne $p2) { Write-Host '      No coinciden, inténtalo de nuevo.' -ForegroundColor Yellow; continue }
            break
        }
        $env:DJANGO_SUPERUSER_EMAIL = $correo
        $env:DJANGO_SUPERUSER_PASSWORD = $p1
        & $VenvPython manage.py createsuperuser --noinput
        $codigo = $LASTEXITCODE
        Remove-Item Env:DJANGO_SUPERUSER_EMAIL, Env:DJANGO_SUPERUSER_PASSWORD -ErrorAction SilentlyContinue
        $p1 = $null; $p2 = $null
        if ($codigo -ne 0) { Falla 'no se pudo crear la cuenta de administrador.' }
        Ok "cuenta creada: $correo"
    }
} finally {
    Pop-Location
}

# ---------------------------------------------------------------- 6. Pantallas
Paso 6 'Preparando las pantallas (librerías de Node.js)'
Push-Location $Frontend
try {
    & npm.cmd install --no-audit --no-fund --loglevel=error
    Revisar 'instalar las librerías de las pantallas'
} finally {
    Pop-Location
}
Ok 'librerías instaladas'

Write-Host ''
Write-Host '  Listo. Ahora haz doble clic en iniciar.cmd para abrir Hail.' -ForegroundColor Green
Write-Host ''
