// script.js

import { auth, db, appId } from './firebase-config.js'; // ¡CORREGIDO!
import { handleLogout, onAuthStateChanged } from './auth.js';
import { showSection } from './utils.js';
import './ui-handlers.js'; // Importa el manejador de la UI
import { doc, onSnapshot, collection, query, where, getDocs, or } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js"; // ¡CORREGIDO!

let currentBalanceUSD = 0;
let currentBalanceDOP = 0;
let showCurrencyUSD = true;

const dashboardUserName = document.getElementById('dashboardUserName');
const dashboardDisplayId = document.getElementById('dashboardDisplayId');
const accountBalance = document.getElementById('accountBalance');
const toggleCurrencyBtn = document.getElementById('toggleCurrency');
const transactionsList = document.getElementById('transactionsList');

function updateBalanceDisplay() {
    if (showCurrencyUSD) {
        accountBalance.textContent = `$${currentBalanceUSD.toFixed(2)} USD`;
        if (toggleCurrencyBtn) {
            toggleCurrencyBtn.textContent = 'Cambiar a DOP';
        }
    } else {
        const USD_TO_DOP_RATE = 58.0; // Tasa de cambio de ejemplo
        currentBalanceDOP = currentBalanceUSD * USD_TO_DOP_RATE;
        accountBalance.textContent = `RD$${currentBalanceDOP.toFixed(2)} DOP`;
        if (toggleCurrencyBtn) {
            toggleCurrencyBtn.textContent = 'Cambiar a USD';
        }
    }
}

async function loadTransactionHistory(userId) {
    if (!transactionsList) return;
    transactionsList.innerHTML = '<li class="text-gray-500 text-center">Cargando historial...</li>';

    const transactionsRef = collection(db, 'artifacts', appId, 'transactions');
    
    // Obtener transacciones donde el usuario es remitente o destinatario
    const q = query(transactionsRef, or(where('senderId', '==', userId), where('recipientId', '==', userId)));
    
    try {
        const querySnapshot = await getDocs(q);
        transactionsList.innerHTML = '';
        if (querySnapshot.empty) {
            transactionsList.innerHTML = '<li class="text-gray-500 text-center">No hay transacciones todavía.</li>';
            return;
        }

        querySnapshot.forEach(doc => {
            const transaction = doc.data();
            const li = document.createElement('li');
            li.className = 'p-3 border-b border-gray-200 last:border-0';
            
            const isSender = transaction.senderId === userId;
            const amountText = isSender 
                ? `<span class="text-red-500">-${transaction.amount} ${transaction.currency}</span>`
                : `<span class="text-green-500">+${transaction.amount} ${transaction.currency}</span>`;
            
            const recipientIdOrSenderId = isSender ? transaction.recipientId : transaction.senderId;

            li.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <span class="font-bold">${transaction.type.toUpperCase()}</span>
                        <p class="text-sm text-gray-500">ID del ${isSender ? 'Destinatario' : 'Remitente'}: ${recipientIdOrSenderId}</p>
                    </div>
                    <div class="font-bold">${amountText}</div>
                </div>
            `;
            transactionsList.appendChild(li);
        });

    } catch (error) {
        console.error("Error al cargar el historial de transacciones:", error);
        transactionsList.innerHTML = '<li class="text-red-500 text-center">Error al cargar historial.</li>';
    }
}

if (toggleCurrencyBtn) {
    toggleCurrencyBtn.addEventListener('click', () => {
        showCurrencyUSD = !showCurrencyUSD;
        updateBalanceDisplay();
    });
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userId = user.uid;
        const userDocRef = doc(db, 'artifacts', 'banco-juvenil-12903', 'users', userId);

        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                if (dashboardUserName) dashboardUserName.textContent = `${userData.name} ${userData.surname}`;
                if (dashboardDisplayId) dashboardDisplayId.textContent = userData.userDisplayId;
                currentBalanceUSD = userData.balanceUSD;
                currentBalanceDOP = userData.balanceDOP;
                showSection(dashboardSection, loginSection, registerSection);
                updateBalanceDisplay();
                loadTransactionHistory(userId); // ¡Cargar el historial al iniciar sesión!
            } else {
                console.log("No such user document!");
                handleLogout();
            }
        });
    } else {
        console.log("User is signed out.");
        showSection(loginSection, registerSection, dashboardSection);
    }
});
