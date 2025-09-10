// utils.js

import { db, appId } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const messageBox = document.getElementById('messageBox');
const messageText = document.getElementById('messageText');
const transactionStatusMsg = document.getElementById('transactionStatusMsg');
const transactionStatusText = document.getElementById('transactionStatusText');

function showMessage(msg, type = 'info') {
    if (messageText && messageBox) {
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
}

function hideMessage() {
    if (messageBox) {
        messageBox.classList.add('hidden');
    }
}

function showTransactionStatus(msg) {
    if (transactionStatusText && transactionStatusMsg) {
        transactionStatusText.textContent = msg;
        transactionStatusMsg.classList.remove('hidden');
    }
}

function hideTransactionStatus() {
    if (transactionStatusMsg) {
        transactionStatusMsg.classList.add('hidden');
    }
}

/**
 * Muestra un elemento y oculta todos los demás que se le pasen.
 * @param {HTMLElement} showElement El elemento a mostrar.
 * @param {...HTMLElement} hideElements Los elementos a ocultar.
 */
function showSection(showElement, ...hideElements) {
    if (showElement) {
        showElement.classList.remove('hidden');
    }
    hideElements.forEach(el => {
        if (el) {
            el.classList.add('hidden');
        }
    });
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
    // ... La lógica para mostrar el recibo es la misma, se mantiene en este archivo
    // Lógica para crear y mostrar el recibo visualmente
    console.log("Recibo de Transacción:", transaction);
}

// *** EXPORTACIÓN CORREGIDA ***
export { 
    showMessage, 
    hideMessage, 
    showTransactionStatus, 
    hideTransactionStatus, 
    generateUserDisplayId, 
    getUserDisplayName, 
    showReceipt, 
    showSection 
};
