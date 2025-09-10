// script.js

// Importar las funciones necesarias de firebase-firestore.js
import { auth, db } from './firebase-config.js';
import { handleLogout, onAuthStateChanged } from './auth.js';
import { showSection } from './utils.js';
import './ui-handlers.js'; // Importa el manejador de la UI

// Importaciones necesarias para script.js que usan Firestore directamente
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', () => {

    let currentBalanceUSD = 0;
    let currentBalanceDOP = 0;
    let showCurrencyUSD = true;

    const dashboardUserName = document.getElementById('dashboardUserName');
    const dashboardDisplayId = document.getElementById('dashboardDisplayId');
    const accountBalance = document.getElementById('accountBalance');
    const toggleCurrencyBtn = document.getElementById('toggleCurrency');
    // Asegúrate de que estos elementos existan en tu HTML
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    const dashboardSection = document.getElementById('dashboardSection');


    function updateBalanceDisplay() {
        if (showCurrencyUSD) {
            accountBalance.textContent = `$${currentBalanceUSD.toFixed(2)} USD`;
            if (toggleCurrencyBtn) toggleCurrencyBtn.textContent = 'Cambiar a DOP';
        } else {
            // Usar una tasa de cambio de ejemplo. Deberías obtenerla de una fuente confiable o config.
            currentBalanceDOP = currentBalanceUSD * 58.0; 
            accountBalance.textContent = `RD$${currentBalanceDOP.toFixed(2)} DOP`;
            if (toggleCurrencyBtn) toggleCurrencyBtn.textContent = 'Cambiar a USD';
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
            // Asegúrate de que la ruta de Firestore sea correcta según tu configuración
            const userDocRef = doc(db, 'artifacts', 'banco-juvenil-12903', 'users', userId);

            // onSnapshot escucha cambios en tiempo real en el documento del usuario
            const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    if (dashboardUserName) dashboardUserName.textContent = `${userData.name} ${userData.surname}`;
                    if (dashboardDisplayId) dashboardDisplayId.textContent = userData.userDisplayId;
                    currentBalanceUSD = userData.balanceUSD || 0; // Asignar 0 si no existe el balance
                    currentBalanceDOP = userData.balanceDOP || 0; // Asignar 0 si no existe el balance
                    
                    // Mostrar la sección del dashboard y ocultar las de autenticación
                    showSection(dashboardSection, loginSection, registerSection); 
                    updateBalanceDisplay();
                } else {
                    console.log("No such user document!");
                    // Si el documento del usuario no existe, cerrar sesión
                    handleLogout(); 
                }
            }, (error) => {
                console.error("Error fetching user data:", error);
                showMessage('Error al cargar tus datos. Por favor, inténtalo de nuevo.', 'error');
                handleLogout();
            });
        } else {
            console.log("User is signed out.");
            // Si no hay usuario autenticado, mostrar la sección de login/registro
            showSection(loginSection, registerSection, dashboardSection); 
        }
    });
});
