# Script para generar el ejecutable de Pass the host!
# Este script compila la aplicación sin incluir java_runtime, rclone ni server

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Pass the host! - Build Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en el entorno virtual
if (-not $env:VIRTUAL_ENV) {
    Write-Host "⚠️  No estás en el entorno virtual" -ForegroundColor Yellow
    Write-Host "Activando entorno virtual..." -ForegroundColor Yellow
    & ".\venv\Scripts\Activate.ps1"
    if (-not $?) {
        Write-Host "❌ Error al activar el entorno virtual" -ForegroundColor Red
        Write-Host "Ejecuta: .\venv\Scripts\Activate.ps1" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "✅ Entorno virtual activo" -ForegroundColor Green
Write-Host ""

# Verificar que PyInstaller está instalado
Write-Host "Verificando PyInstaller..." -ForegroundColor Cyan
python -c "import PyInstaller" 2>$null
if (-not $?) {
    Write-Host "❌ PyInstaller no está instalado" -ForegroundColor Red
    Write-Host "Instalando PyInstaller..." -ForegroundColor Yellow
    pip install pyinstaller
    if (-not $?) {
        Write-Host "❌ Error al instalar PyInstaller" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ PyInstaller disponible" -ForegroundColor Green
Write-Host ""

# Limpiar builds anteriores
Write-Host "Limpiando builds anteriores..." -ForegroundColor Cyan
if (Test-Path "build") {
    Remove-Item -Recurse -Force "build"
    Write-Host "  - Eliminada carpeta 'build'" -ForegroundColor Gray
}
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "  - Eliminada carpeta 'dist'" -ForegroundColor Gray
}
if (Test-Path "PassTheHost.spec") {
    Remove-Item -Force "PassTheHost.spec"
    Write-Host "  - Eliminado archivo spec antiguo" -ForegroundColor Gray
}
Write-Host "✅ Limpieza completada" -ForegroundColor Green
Write-Host ""

# Compilar con PyInstaller usando el archivo .spec
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Compilando aplicación..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Esto puede tardar varios minutos..." -ForegroundColor Yellow
Write-Host ""

pyinstaller build_exe.spec

if (-not $?) {
    Write-Host ""
    Write-Host "❌ Error al compilar la aplicación" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ Compilación exitosa!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Verificar que el ejecutable fue creado
if (Test-Path "dist\PassTheHost.exe") {
    $size = (Get-Item "dist\PassTheHost.exe").Length / 1MB
    Write-Host "📦 Ejecutable generado:" -ForegroundColor Cyan
    Write-Host "   Ubicación: dist\PassTheHost.exe" -ForegroundColor White
    Write-Host "   Tamaño: $([math]::Round($size, 2)) MB" -ForegroundColor White
    Write-Host ""
    
    Write-Host "📝 Notas importantes:" -ForegroundColor Yellow
    Write-Host "   • El ejecutable NO incluye java_runtime, rclone ni server" -ForegroundColor Gray
    Write-Host "   • Rclone se descargará automáticamente al primer uso" -ForegroundColor Gray
    Write-Host "   • Debes distribuir config.example.json junto al .exe" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "🚀 Para ejecutar:" -ForegroundColor Cyan
    Write-Host "   .\dist\PassTheHost.exe" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "❌ No se encontró el ejecutable en dist\" -ForegroundColor Red
    exit 1
}

Write-Host "Presiona Enter para continuar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
