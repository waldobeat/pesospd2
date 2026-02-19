@echo off
echo Configurando entorno para instalar dependencias PDF...
SET PATH=%PATH%;C:\Program Files\nodejs

echo Instalando jspdf y jspdf-autotable...
call npm install jspdf jspdf-autotable

if %errorlevel% neq 0 (
    echo Error al instalar dependencias.
    pause
    exit /b %errorlevel%
)

echo Instalacion completada con exito.
pause
