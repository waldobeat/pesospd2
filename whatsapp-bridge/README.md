# 🚀 GUÍA DE INICIO: WhatsApp Bridge

Este script conecta tu sistema de inventario con un grupo de WhatsApp de forma gratuita.

## 📋 Requisitos Previos
1. Tener **Node.js** instalado en tu PC.
2. Tener tu celular a la mano para escanear un código QR.

## 🛠️ Pasos para la Instalación

1.  **Abrir una Terminal**:
    Abre una terminal (CMD o PowerShell) en esta carpeta:
    `c:\Users\luxur\Desktop\pesospd2-main\pesospd2-main\whatsapp-bridge`

2.  **Instalar dependencias**:
    Ejecuta el siguiente comando:
    ```bash
    npm install
    ```

3.  **Configurar credenciales**:
    Copia el contenido de tu archivo `.env` de la carpeta principal del proyecto a un nuevo archivo `.env` en esta carpeta.
    Asegúrate de agregar también esta línea:
    `WA_GROUP_NAME=Nombre exacto de tu grupo`

4.  **Iniciar el Bot**:
    Corre el script con:
    ```bash
    npm start
    ```

5.  **Vincular WhatsApp**:
    Aparecerá un **código QR** en la terminal. Escanéalo con tu celular desde:
    *WhatsApp > Ajustes > Dispositivos vinculados > Vincular un dispositivo.*

## ✨ ¡Listo!
Mientras dejes esa ventana de terminal abierta, cada vez que hagas un cambio en la web, el mensaje se enviará automáticamente al grupo de WhatsApp.

---
> **Nota**: Si cierras la terminal, el bot dejará de enviar mensajes. Puedes volver a iniciarlo con `npm start` cuando quieras.
