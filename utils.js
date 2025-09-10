// utils.js

import { db, appId } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { auth } from './firebase-config.js'; // Necesario para obtener el currentUser Auth ID

// Elementos comunes de la UI
const messageBox = document.getElementById('messageBox');
const messageText = document.getElementById('messageText');
const transactionStatusMsg = document.getElementById('transactionStatusMsg');
const transactionStatusText = document.getElementById('transactionStatusText');

// Elementos para el Historial y Administración
const transactionHistoryBody = document.getElementById('transactionHistoryBody'); // Asegúrate de que este ID exista en tu HTML
const adminPanelSection = document.getElementById('adminPanelSection'); // Asegúrate de que este ID exista en tu HTML
const userPanelSection = document.getElementById('userPanelSection'); // Asegúrate de que este ID exista en tu HTML

// --- Mensajes ---
function showMessage(msg, type = 'info') {
    if (!messageBox || !messageText) return;
    messageText.textContent = msg;
    messageBox.classList.remove('hidden', 'bg-red-100', 'text-red-800', 'bg-green-100', 'text-green-800', 'bg-blue-100', 'text-blue-800');
    messageBox.classList.add('block');
    if (type === 'error') {
        messageBox.classList.add('bg-red-100', 'text-red-800');
    } else if (type === 'success') {
        messageBox.classList.add('bg-green-100', 'text-green-800');
    } else {
        messageBox.classList.add('bg-blue-100', 'text-blue-800');
    }
}

function hideMessage() {
    if (messageBox) {
        messageBox.classList.add('hidden');
    }
}

function showTransactionStatus(msg) {
    if (transactionStatusMsg && transactionStatusText) {
        transactionStatusText.textContent = msg;
        transactionStatusMsg.classList.remove('hidden');
    }
}

function hideTransactionStatus() {
    if (transactionStatusMsg) {
        transactionStatusMsg.classList.add('hidden');
    }
}

// --- Secciones de la UI ---
function showSection(...sectionsToShow) {
    const allSections = [
        document.getElementById('loginSection'),
        document.getElementById('registerSection'),
        document.getElementById('dashboardSection'),
        adminPanelSection, // Incluir secciones de admin/usuario si existen
        userPanelSection
    ];
    allSections.forEach(section => {
        if (section) {
            section.classList.add('hidden');
        }
    });
    sectionsToShow.forEach(section => {
        if (section) {
            section.classList.remove('hidden');
        }
    });
}

// --- Funciones de Ayuda ---
function generateUserDisplayId(name, surname) {
    const initials = `${name.substring(0, 1).toUpperCase()}${surname.substring(0, 1).toUpperCase()}`;
    const randomNumber = Math.floor(1000 + Math.random() * 9000);
    return `${initials}#${randomNumber}`;
}

const userDisplayNamesCache = {};

async function getUserDisplayName(userId) {
    if (userDisplayNamesCache[userId]) {
        return userDisplayNamesCache[userId];
    }
    try {
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const displayName = `${userData.name} ${userData.surname} (${userData.userDisplayId || userData.userId.substring(0, 5) + '...'})`;
            userDisplayNamesCache[userId] = displayName;
            return displayName;
        }
    } catch (error) {
        console.error("Error al obtener el nombre de visualización del usuario:", error);
    }
    return `ID: ${userId.substring(0, 5)}...`;
}

async function showReceipt(transaction) {
    // Esta función puede ser expandida para mostrar un modal con detalles de la transacción.
    console.log("Mostrando recibo para transacción:", transaction);
}

// --- Funciones de Administración ---
async function loadPendingRequests() {
    // Esta función debería cargar solicitudes de depósitos/retiros pendientes para el admin
    // Necesitará acceso a 'pending_requests', 'pending_deposits', 'pending_withdrawals'
    // Y lógica para aprobar/rechazar.
    console.log("Cargando solicitudes pendientes para el administrador...");
    if (!adminPanelSection) return; // Si el panel de admin no existe, no hacer nada

    const adminUserId = auth.currentUser?.uid;
    // Asumiendo que el admin tiene un rol 'admin' en su documento de usuario
    // Esta lógica debería ir en el listener de authStateChanged o al cargar el panel de admin
    // if (!isAdmin(adminUserId)) { return; }

    try {
        // Crear referencias a las colecciones relevantes
        const pendingDepositsRef = collection(db, 'artifacts', appId, 'public', 'data', 'pending_deposits');
        const pendingWithdrawalsRef = collection(db, 'artifacts', appId, 'public', 'data', 'pending_withdrawals');
        
        // Consultas para obtener las solicitudes pendientes
        const depositsQuery = query(pendingDepositsRef, where('status', '==', 'pending'), orderBy('timestamp'));
        const withdrawalsQuery = query(pendingWithdrawalsRef, where('status', '==', 'pending'), orderBy('timestamp'));

        const [depositsSnapshot, withdrawalsSnapshot] = await Promise.all([
            getDocs(depositsQuery),
            getDocs(withdrawalsQuery)
        ]);

        // Aquí iría la lógica para mostrar estas solicitudes en el HTML del panel de admin
        // Por ejemplo, podrías tener tablas para depósitos y retiros pendientes.
        console.log(`Depósitos pendientes: ${depositsSnapshot.size}`);
        console.log(`Retiros pendientes: ${withdrawalsSnapshot.size}`);

    } catch (error) {
        console.error("Error al cargar solicitudes pendientes para el admin:", error);
        showMessage('Error al cargar las solicitudes pendientes.', 'error');
    }
}

// Ejemplo de función para mostrar el panel de admin
function showAdminPanel() {
    if (adminPanelSection) {
        adminPanelSection.classList.remove('hidden');
        loadPendingRequests(); // Cargar las solicitudes cuando se muestre el panel
    }
    if (userPanelSection) {
        userPanelSection.classList.add('hidden'); // Ocultar panel de usuario si se muestra el de admin
    }
}

// Ejemplo de función para mostrar el panel de usuario (dashboard)
function showUserPanel() {
    if (userPanelSection) {
        userPanelSection.classList.remove('hidden');
    }
    if (adminPanelSection) {
        adminPanelSection.classList.add('hidden'); // Ocultar panel de admin si se muestra el de usuario
    }
}


export { 
    showMessage, 
    hideMessage, 
    showTransactionStatus, 
    hideTransactionStatus, 
    showSection, 
    generateUserDisplayId, 
    getUserDisplayName, 
    showReceipt,
    loadTransactionHistory, // Exportar la función para cargar historial
    loadPendingRequests,    // Exportar para carga de admin
    showAdminPanel,         // Exportar función para mostrar panel admin
    showUserPanel           // Exportar función para mostrar panel usuario
};
