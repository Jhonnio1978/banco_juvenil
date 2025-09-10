// script.js

import { auth, db, appId } from './firebase-config.js'; // ¡CORREGIDO! appId ahora está disponible.
import { handleLogout, onAuthStateChanged } from './auth.js';
import { showSection, showMessage } from './utils.js';
import './ui-handlers.js';
import { doc, onSnapshot, collection, query, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js"; // Importaciones necesarias para historial y admin

document.addEventListener('DOMContentLoaded', () => {

    let currentBalanceUSD = 0;
    let currentBalanceDOP = 0;
    let showCurrencyUSD = true;
    let currentUserAuthId = null; // Para almacenar el ID del usuario actual

    const dashboardUserName = document.getElementById('dashboardUserName');
    const dashboardDisplayId = document.getElementById('dashboardDisplayId');
    const accountBalance = document.getElementById('accountBalance');
    const toggleCurrencyBtn = document.getElementById('toggleCurrency');
    const transactionHistoryBody = document.getElementById('transactionHistoryBody');
    const adminPanelSection = document.getElementById('adminPanelSection'); // Asumimos que este ID existe en tu HTML
    const userPanelSection = document.getElementById('userPanelSection'); // Asumimos que este ID existe en tu HTML

    // --- Funciones de UI para el Dashboard ---
    function updateBalanceDisplay() {
        if (accountBalance) {
            if (showCurrencyUSD) {
                accountBalance.textContent = `$${currentBalanceUSD.toFixed(2)} USD`;
            } else {
                // Asegúrate de que la tasa de cambio esté definida o importada si es dinámica
                const USD_TO_DOP_RATE = 58.0;
                currentBalanceDOP = currentBalanceUSD * USD_TO_DOP_RATE;
                accountBalance.textContent = `RD$${currentBalanceDOP.toFixed(2)} DOP`;
            }
        }
        if (toggleCurrencyBtn) {
            toggleCurrencyBtn.textContent = showCurrencyUSD ? 'Cambiar a DOP' : 'Cambiar a USD';
        }
    }

    if (toggleCurrencyBtn) {
        toggleCurrencyBtn.addEventListener('click', () => {
            showCurrencyUSD = !showCurrencyUSD;
            updateBalanceDisplay();
        });
    }

    // --- Lógica para el Historial de Transacciones ---
    async function loadTransactionHistory() {
        if (!transactionHistoryBody || !currentUserAuthId) return;

        try {
            // Limpiar el historial anterior
            transactionHistoryBody.innerHTML = '';

            // Crear una consulta para obtener las transacciones del usuario actual
            // Aquí asumimos que las transacciones se guardan en la colección 'transactions'
            // y cada transacción tiene senderId o recipientId que coincide con currentUserAuthId.
            const transactionsRef = collection(db, 'artifacts', appId, 'transactions');
            const q = query(transactionsRef, 
                where('senderId', '==', currentUserAuthId), 
                orderBy('timestamp', 'desc')
            );
            const querySnapshot = await getDocs(q);

            const q2 = query(transactionsRef, 
                where('recipientId', '==', currentUserAuthId), 
                orderBy('timestamp', 'desc')
            );
            const querySnapshot2 = await getDocs(q2);

            // Combinar y ordenar los resultados
            const allTransactions = [...querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
                                   ...querySnapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() }))];
            
            // Ordenar por timestamp para asegurar el orden correcto
            allTransactions.sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime());

            if (allTransactions.length === 0) {
                const row = transactionHistoryBody.insertRow();
                const cell = row.insertCell();
                cell.colSpan = 5; // Ajusta según el número de columnas en tu tabla
                cell.textContent = 'Aún no has realizado ninguna transacción.';
                cell.classList.add('text-center', 'text-gray-500', 'py-4');
                return;
            }

            allTransactions.forEach(transaction => {
                const row = transactionHistoryBody.insertRow();
                const typeCell = row.insertCell();
                const amountCell = row.insertCell();
                const currencyCell = row.insertCell();
                const dateCell = row.insertCell();
                const statusCell = row.insertCell(); // Para retiros/depositos, si es que se manejan aquí

                typeCell.textContent = transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1); // Capitalizar tipo
                
                let amountDisplay = '';
                let currencyDisplay = '';

                if (transaction.type === 'transfer') {
                    amountDisplay = transaction.amount.toFixed(2);
                    currencyDisplay = transaction.currency;
                    if (transaction.senderId === currentUserAuthId) {
                        typeCell.textContent = 'Envío';
                        amountCell.textContent = `-${amountDisplay}`;
                        amountCell.classList.add('text-red-600');
                    } else {
                        typeCell.textContent = 'Recepción';
                        amountCell.textContent = `+${amountDisplay}`;
                        amountCell.classList.add('text-green-600');
                    }
                } else if (transaction.type === 'deposit') {
                    amountDisplay = transaction.amount.toFixed(2);
                    currencyDisplay = transaction.currency;
                    amountCell.textContent = `+${amountDisplay}`;
                    amountCell.classList.add('text-green-600');
                    // Aquí puedes añadir lógica para mostrar el serialNumber si es relevante
                } else if (transaction.type === 'withdrawal') {
                    amountDisplay = transaction.amount.toFixed(2);
                    currencyDisplay = transaction.currency;
                    amountCell.textContent = `-${amountDisplay}`;
                    amountCell.classList.add('text-red-600');
                    // Aquí podrías mostrar el estado 'pending', 'approved', 'rejected'
                }
                
                currencyCell.textContent = currencyDisplay;
                dateCell.textContent = transaction.timestamp.toDate().toLocaleDateString();
                statusCell.textContent = transaction.status ? transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1) : '';
            });

        } catch (error) {
            console.error("Error al cargar el historial de transacciones:", error);
            showMessage('Error al cargar el historial de transacciones. Por favor, inténtalo de nuevo.', 'error');
        }
    }

    // --- Lógica de Autenticación y Carga de Datos ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserAuthId = user.uid; // Guarda el ID del usuario actual
            const userDocRef = doc(db, 'artifacts', appId, 'users', currentUserAuthId);

            // Configurar el listener para actualizaciones en tiempo real del documento del usuario
            const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    if (dashboardUserName) dashboardUserName.textContent = `${userData.name} ${userData.surname}`;
                    if (dashboardDisplayId) dashboardDisplayId.textContent = userData.userDisplayId;
                    currentBalanceUSD = userData.balanceUSD;
                    currentBalanceDOP = userData.balanceDOP;
                    updateBalanceDisplay();
                    
                    // Mostrar la sección del dashboard y ocultar las de autenticación
                    showSection(dashboardSection, loginSection, registerSection);
                    
                    // Cargar historial de transacciones una vez que tenemos el userId
                    loadTransactionHistory();
                    
                    // Aquí podrías añadir lógica para mostrar/ocultar el panel de admin basado en el rol del usuario
                    // if (userData.role === 'admin') { showAdminPanel(); } else { hideAdminPanel(); }

                } else {
                    console.log("No such user document!");
                    handleLogout(); // Cierra sesión si el documento del usuario no existe
                }
            }, (error) => { // Manejo de errores para onSnapshot
                console.error("Error al escuchar cambios en el documento del usuario:", error);
                showMessage('Error al cargar tu información. Por favor, inténtalo de nuevo.', 'error');
            });
        } else {
            currentUserAuthId = null; // Limpia el ID del usuario cuando cierra sesión
            console.log("User is signed out.");
            showSection(loginSection, registerSection, dashboardSection); // Muestra las secciones de autenticación
            if (transactionHistoryBody) transactionHistoryBody.innerHTML = ''; // Limpiar historial si el usuario cierra sesión
        }
    });
});
