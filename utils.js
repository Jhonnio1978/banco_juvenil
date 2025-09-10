// utils.js

import { db, appId } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, increment, Timestamp, deleteDoc, updateDoc, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { auth } from './firebase-config.js'; // Necesario para obtener currentUser

const messageBox = document.getElementById('messageBox');
const messageText = document.getElementById('messageText');
const transactionStatusMsg = document.getElementById('transactionStatusMsg');
const transactionStatusText = document.getElementById('transactionStatusText');

// --- Elementos del Panel de Admin ---
const adminPanelSection = document.getElementById('adminPanelSection');
const adminDashboardTab = document.getElementById('adminDashboardTab');
const adminPendingRequestsTab = document.getElementById('adminPendingRequestsTab');
// const adminApprovedHistoryTab = document.getElementById('adminApprovedHistoryTab');

const adminDashboardView = document.getElementById('adminDashboardView');
const adminPendingRequestsView = document.getElementById('adminPendingRequestsView');
// const adminApprovedHistoryView = document.getElementById('adminApprovedHistoryView');

const pendingRequestsBody = document.getElementById('pendingRequestsBody'); // Tabla del panel de admin

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

// Muestra una sección específica y oculta las demás
function showSection(...sectionsToShow) {
    const allSections = [
        document.getElementById('loginSection'),
        document.getElementById('registerSection'),
        document.getElementById('dashboardSection'),
        document.getElementById('adminPanelSection') // Incluir el panel de admin
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

// Función para verificar si un usuario es administrador (requiere que exista el rol en el doc del usuario)
async function isAdmin(userId) {
    if (!userId) return false;
    try {
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            // El rol 'admin' debe estar definido en el documento del usuario en Firestore
            return userDocSnap.data().role === 'admin';
        }
        return false;
    } catch (error) {
        console.error("Error al verificar rol de admin:", error);
        return false;
    }
}

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
    // Implementación de visualización de recibo, si es necesaria
    console.log("Mostrando recibo para transacción:", transaction);
}


export { 
    showMessage, 
    hideMessage, 
    showTransactionStatus, 
    hideTransactionStatus, 
    showSection, 
    isAdmin, // Exportar isAdmin
    generateUserDisplayId, 
    getUserDisplayName, 
    showReceipt 
};
