// script.js (archivo principal)

import { auth, db } from './firebase-config.js';
import { handleLogout, onAuthStateChanged } from './auth.js';
import { showSection } from './utils.js';
import './ui-handlers.js'; // Importa el manejador de la UI
// ¡Importamos las funciones necesarias de Firebase Firestore aquí!
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js"; 

document.addEventListener('DOMContentLoaded', () => {

    let currentBalanceUSD = 0;
    let currentBalanceDOP = 0;
    let showCurrencyUSD = true;

    const dashboardUserName = document.getElementById('dashboardUserName');
    const dashboardDisplayId = document.getElementById('dashboardDisplayId');
    const accountBalance = document.getElementById('accountBalance');
    const toggleCurrencyBtn = document.getElementById('toggleCurrency');
    const dashboardSection = document.getElementById('dashboardSection'); // Asegurarse de que esté disponible
    const loginSection = document.getElementById('loginSection'); // Asegurarse de que esté disponible
    const registerSection = document.getElementById('registerSection'); // Asegurarse de que esté disponible

    function updateBalanceDisplay() {
        if (showCurrencyUSD) {
            accountBalance.textContent = `$${currentBalanceUSD.toFixed(2)} USD`;
            toggleCurrencyBtn.textContent = 'Cambiar a DOP';
        } else {
            currentBalanceDOP = currentBalanceUSD * 58.0; // Tasa de ejemplo, ¡ajusta si es necesario!
            accountBalance.textContent = `RD$${currentBalanceDOP.toFixed(2)} DOP`;
            toggleCurrencyBtn.textContent = 'Cambiar a USD';
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
            // Usamos 'doc' que ahora está importado
            const userDocRef = doc(db, 'artifacts', 'banco-juvenil-12903', 'users', userId);

            // Usamos 'onSnapshot' que ahora está importado
            const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    if (dashboardUserName) dashboardUserName.textContent = `${userData.name} ${userData.surname}`;
                    if (dashboardDisplayId) dashboardDisplayId.textContent = userData.userDisplayId;
                    currentBalanceUSD = userData.balanceUSD;
                    currentBalanceDOP = userData.balanceDOP;
                    // Asegurarse de que las secciones existen antes de intentar mostrarlas
                    if (dashboardSection && loginSection && registerSection) {
                        showSection(dashboardSection, loginSection, registerSection);
                    }
                    updateBalanceDisplay();
                } else {
                    console.log("No such user document!");
                    handleLogout();
                }
            });
        } else {
            console.log("User is signed out.");
            // Asegurarse de que las secciones existen antes de intentar mostrarlas
            if (dashboardSection && loginSection && registerSection) {
                showSection(loginSection, registerSection, dashboardSection);
            }
        }
    });
});
