@echo off
echo Configurando entorno para PD-2 Scale Interface...
SET PATH=%PATH%;C:\Program Files\nodejs

echo Verificando Node.js...
node --version
if %errorlevel% neq 0 (
    echo Error: No se encuentra Node.js.
    pause
    exit /b
)

echo Iniciando aplicacion...
call npm run dev
pause
