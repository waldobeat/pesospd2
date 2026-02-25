/**
 * WHATSAPP BRIDGE FOR PD2 SCALE INVENTORY
 * ---------------------------------------
 * Este script se corre localmente en tu PC.
 * Escucha la base de datos de Firebase y envía mensajes a WhatsApp.
 */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

// 1. CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. CONFIGURACIÓN DE WHATSAPP
const TARGET_GROUP_NAME = process.env.WA_GROUP_NAME || 'Inventario PD2'; // Cambia esto al nombre de tu grupo

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './wa_auth'
    }),
    puppeteer: {
        args: ['--no-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('--- CÓDIGO QR RECIBIDO ---');
    console.log('Escanea este código con tu WhatsApp (Dispositivos vinculados):');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ WhatsApp Conectado y Listo!');

    // 0. AUTENTICACIÓN EN FIREBASE (Para evitar error de permisos)
    const auth = getAuth(app);
    const email = process.env.WA_BOT_EMAIL;
    const password = process.env.WA_BOT_PASSWORD;

    try {
        if (email && password) {
            console.log(`🔐 Autenticando en Firebase como: ${email}...`);
            await signInWithEmailAndPassword(auth, email, password);
            console.log('🔓 Autenticado exitosamente con credenciales.');
        } else {
            console.log('🔐 Autenticando en Firebase de forma anónima...');
            await signInAnonymously(auth);
            console.log('🔓 Autenticado Anónimamente.');
        }
    } catch (error) {
        console.error('❌ Error de autenticación:', error.code || error.message);
        if (error.code === 'auth/admin-restricted-operation') {
            console.log('⚠️ El ingreso anónimo está desactivado por seguridad.');
            console.log('💡 SOLUCIÓN: Agrega tu email y clave al archivo .env');
        }
    }

    // Buscar el grupo
    const chats = await client.getChats();
    const group = chats.find(chat => chat.name === TARGET_GROUP_NAME);

    if (group) {
        console.log(`📌 Encontrado el grupo: "${TARGET_GROUP_NAME}"`);
        startFirebaseListener(group);
    } else {
        console.warn(`❌ No se encontró el grupo "${TARGET_GROUP_NAME}".`);
        console.log('Grupos disponibles en tu cuenta:');
        chats.filter(c => c.isGroup).forEach(c => console.log(` - ${c.name}`));
    }
});

// 3. MONITOR DE FIREBASE
function startFirebaseListener(waGroup) {
    console.log('📡 Escuchando cambios en Firebase...');

    const notificationsRef = collection(db, 'notifications');
    // Escuchar solo notificaciones nuevas (creadas después de ahora)
    const q = query(
        notificationsRef,
        orderBy('createdAt', 'desc'),
        limit(5)
    );

    let isFirstLoad = true;

    onSnapshot(q, (snapshot) => {
        if (isFirstLoad) {
            isFirstLoad = false;
            console.log('Primeras notificaciones cargadas. Esperando nuevas...');
            return;
        }

        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                // Filtramos localmente para evitar la necesidad de crear un índice compuesto
                if (data.resolved === false) {
                    sendWhatsAppAlert(waGroup, data);
                }
            }
        });
    });
}

const BRANCH_NAMES = {
    'chacao': 'Sucursal Chacao',
    'valencia': 'Sucursal Valencia',
    'maracay': 'Sucursal Maracay',
    'central': 'LUXOR CENTRAL',
    'taller': 'Taller Central'
};

function sendWhatsAppAlert(group, notification) {
    const { title, message, targetBranch, relatedModel, relatedSerial } = notification;

    // Obtener nombre legible de la sucursal
    const branchName = BRANCH_NAMES[targetBranch?.toLowerCase()] || targetBranch || 'N/A';

    // Formatear el mensaje exactamente como pidió el usuario (Solo en el BOT)
    const waMessage = `📢 *MENSAJE DEL SISTEMA*\n` +
        `📍 *SUCURSAL:* ${branchName.toUpperCase()}\n\n` +
        `🛠️ *${title.replace('🛠️ ', '').toUpperCase()}*\n` +
        `📦 *EQUIPO:* ${relatedModel || 'N/A'}\n` +
        `🔢 *SERIAL:* ${relatedSerial || 'N/A'}\n` +
        `👤 *ATENDIDO POR:* Taller Central\n` +
        `📝 *ESTADO:* ${message}\n\n` +
        `_Sistema de Inventario Automatizado_`;

    group.sendMessage(waMessage).then(() => {
        console.log(`🚀 Mensaje enviado a WhatsApp: ${relatedSerial}`);
    }).catch(err => {
        console.error('❌ Error enviando a WhatsApp:', err);
    });
}

client.initialize();
