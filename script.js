// script.js (nuevo archivo principal)

import { auth, db } from './firebase-config.js';
import { handleLogout, onAuthStateChanged } from './auth.js';
import { showSection, showMessage } from './utils.js';
import './ui-handlers.js'; // Importa el manejador de la UI

let currentBalanceUSD = 0;
let currentBalanceDOP = 0;
let showCurrencyUSD = true;

const dashboardUserName = document.getElementById('dashboardUserName');
const dashboardDisplayId = document.getElementById('dashboardDisplayId');
const accountBalance = document.getElementById('accountBalance');
const toggleCurrencyBtn = document.getElementById('toggleCurrency');

function updateBalanceDisplay() {
    if (showCurrencyUSD) {
        accountBalance.textContent = `$${currentBalanceUSD.toFixed(2)} USD`;
        toggleCurrencyBtn.textContent = 'Cambiar a DOP';
    } else {
        currentBalanceDOP = currentBalanceUSD * 58.0; // Tasa de ejemplo
        accountBalance.textContent = `RD$${currentBalanceDOP.toFixed(2)} DOP`;
        toggleCurrencyBtn.textContent = 'Cambiar a USD';
    }
}

toggleCurrencyBtn.addEventListener('click', () => {
    showCurrencyUSD = !showCurrencyUSD;
    updateBalanceDisplay();
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userId = user.uid;
        const userDocRef = doc(db, 'artifacts', 'banco-juvenil-12903', 'users', userId);

        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                dashboardUserName.textContent = `${userData.name} ${userData.surname}`;
                dashboardDisplayId.textContent = userData.userDisplayId;
                currentBalanceUSD = userData.balanceUSD;
                currentBalanceDOP = userData.balanceDOP;
                showSection(dashboardSection, loginSection, registerSection);
                updateBalanceDisplay();
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

