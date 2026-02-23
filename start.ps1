# Script de inicio automático para PD-2 Scale Interface
Write-Host "Configurando entorno..." -ForegroundColor Cyan

# Agregar NodeJS al PATH temporalmente
$env:Path += ";C:\Program Files\nodejs"

# Verificar si npm funciona
if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "Node.js detectado. Iniciando aplicación..." -ForegroundColor Green
    npm run dev
} else {
    Write-Host "Error: No se pudo encontrar Node.js en C:\Program Files\nodejs" -ForegroundColor Red
    Write-Host "Por favor, asegura que Node.js esté instalado."
    Pause
}
