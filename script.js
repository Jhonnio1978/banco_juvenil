// script.js

// Importaciones necesarias
import { auth, db } from './firebase-config.js';
import { handleLogout, onAuthStateChanged } from './auth.js';
import { showSection, showMessage, hideMessage, showTransactionStatus, hideTransactionStatus } from './utils.js';
import './ui-handlers.js'; // Importa el manejador de la UI
import { doc, onSnapshot, collection, query, where, getDocs, deleteDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // Variables de estado
    let currentBalanceUSD = 0;
    let currentBalanceDOP = 0;
    let showCurrencyUSD = true;
    let currentUser = null; // Guardaremos el usuario actual aquí

    // Elementos del DOM para el Dashboard
    const dashboardUserName = document.getElementById('dashboardUserName');
    const dashboardDisplayId = document.getElementById('dashboardDisplayId');
    const accountBalance = document.getElementById('accountBalance');
    const toggleCurrencyBtn = document.getElementById('toggleCurrency');

    // Elementos para el historial de transacciones
    const transactionHistoryBody = document.getElementById('transactionHistoryBody');
    const transactionHistorySection = document.getElementById('transactionHistorySection'); // Necesitarás añadir esta sección en tu HTML
    const backToDashboardBtn = document.getElementById('backToDashboardBtn'); // Botón para volver al dashboard

    // --- Estructura para Retiro (se completará en detalle si lo necesitas) ---
    const withdrawalMoneyBtn = document.getElementById('withdrawalMoneyBtn'); // Botón para abrir modal de retiro
    const withdrawalModal = document.getElementById('withdrawalModal');
    const cancelWithdrawalBtn = document.getElementById('cancelWithdrawalBtn');
    const withdrawalForm = document.getElementById('withdrawalForm');
    const withdrawalAmountInput = document.getElementById('withdrawalAmount');
    const withdrawalCurrencyInput = document.getElementById('withdrawalCurrency');

    // --- Estructura para Panel de Administración (se completará si lo necesitas) ---
    const adminPanelSection = document.getElementById('adminPanelSection'); // Necesitarás añadir esta sección en tu HTML
    const pendingDepositsList = document.getElementById('pendingDepositsList'); // Necesitarás un elemento para listar depósitos
    const pendingWithdrawalsList = document.getElementById('pendingWithdrawalsList'); // Necesitarás un elemento para listar retiros

    // --- Funciones de Ayuda UI ---
    function updateBalanceDisplay() {
        if (!accountBalance || !toggleCurrencyBtn) return;
        if (showCurrencyUSD) {
            accountBalance.textContent = `$${currentBalanceUSD.toFixed(2)} USD`;
            toggleCurrencyBtn.textContent = 'Cambiar a DOP';
        } else {
            currentBalanceDOP = currentBalanceUSD * 58.0; // Tasa de ejemplo, ajústala si es necesario
            accountBalance.textContent = `RD$${currentBalanceDOP.toFixed(2)} DOP`;
            toggleCurrencyBtn.textContent = 'Cambiar a USD';
        }
    }

    // --- Lógica de Carga del Historial de Transacciones ---
    async function loadTransactionHistory() {
        if (!transactionHistoryBody || !currentUser) return;

        transactionHistoryBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Cargando historial...</td></tr>';

        try {
            const userId = currentUser.uid;
            // Consulta para obtener transacciones donde el usuario es remitente O destinatario
            // Usamos OR lógico || dentro de la consulta.
            // NOTA: Firestore no soporta directamente un operador OR entre múltiples `where` en una sola consulta.
            // La forma correcta es hacer dos consultas separadas y combinar los resultados.
            
            // Consulta para transacciones donde el usuario es remitente
            const sentQuery = query(
                collection(db, 'artifacts', appId, 'transactions'),
                where('senderId', '==', userId)
            );
            // Consulta para transacciones donde el usuario es destinatario
            const receivedQuery = query(
                collection(db, 'artifacts', appId, 'transactions'),
                where('recipientId', '==', userId)
            );

            const [sentSnapshot, receivedSnapshot] = await Promise.all([
                getDocs(sentQuery),
                getDocs(receivedQuery)
            ]);

            const transactions = [];
            sentSnapshot.forEach(doc => transactions.push({ id: doc.id, ...doc.data(), type: 'sent' }));
            receivedSnapshot.forEach(doc => transactions.push({ id: doc.id, ...doc.data(), type: 'received' }));

            // Ordenar por fecha (más reciente primero)
            transactions.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());

            transactionHistoryBody.innerHTML = ''; // Limpiar el mensaje de carga

            if (transactions.length === 0) {
                transactionHistoryBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No hay transacciones aún.</td></tr>';
                return;
            }

            transactions.forEach(async (tx) => {
                const row = document.createElement('tr');
                row.classList.add('border-b', 'hover:bg-gray-50');

                const typeCell = document.createElement('td');
                typeCell.classList.add('px-4', 'py-2', 'text-left');
                typeCell.textContent = tx.type === 'transfer' ? (tx.type === 'sent' ? 'Envío' : 'Recepción') : tx.type;
                row.appendChild(typeCell);

                const recipientCell = document.createElement('td');
                recipientCell.classList.add('px-4', 'py-2', 'text-left');
                if (tx.type === 'sent') {
                    const recipientName = await getUserDisplayName(tx.recipientId);
                    recipientCell.textContent = recipientName;
                } else { // received
                    const senderName = await getUserDisplayName(tx.senderId);
                    recipientCell.textContent = senderName;
                }
                row.appendChild(recipientCell);

                const amountCell = document.createElement('td');
                amountCell.classList.add('px-4', 'py-2', 'text-right');
                amountCell.textContent = `${tx.amount.toFixed(2)} ${tx.currency}`;
                row.appendChild(amountCell);
                
                const dateCell = document.createElement('td');
                dateCell.classList.add('px-4', 'py-2', 'text-center');
                dateCell.textContent = tx.timestamp.toDate().toLocaleDateString(); // Formato de fecha local
                row.appendChild(dateCell);

                const actionCell = document.createElement('td');
                actionCell.classList.add('px-4', 'py-2', 'text-center');
                // Aquí podrías añadir un botón para ver detalles o algo más
                actionCell.innerHTML = `<button class="text-blue-600 hover:underline">Ver</button>`;
                row.appendChild(actionCell);

                transactionHistoryBody.appendChild(row);
            });

        } catch (error) {
            console.error("Error al cargar el historial de transacciones:", error);
            if (transactionHistoryBody) {
                transactionHistoryBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-600">Error al cargar el historial.</td></tr>';
            }
            showMessage('Error al cargar tu historial de transacciones.', 'error');
        }
    }

    // --- Lógica para el Botón de Retiro ---
    if (withdrawalMoneyBtn) {
        withdrawalMoneyBtn.addEventListener('click', () => {
            if (withdrawalModal) withdrawalModal.classList.remove('hidden');
        });
    }
    if (cancelWithdrawalBtn) {
        cancelWithdrawalBtn.addEventListener('click', () => {
            if (withdrawalModal) withdrawalModal.classList.add('hidden');
            if (withdrawalForm) withdrawalForm.reset();
        });
    }
    if (withdrawalForm) {
        withdrawalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideMessage();
            // Aquí irá la lógica de handleWithdrawal que se implementará pronto
            // Por ahora, mostramos un mensaje de que está en desarrollo
            showMessage("La funcionalidad de retiro está en desarrollo.", "info");
            if (withdrawalModal) withdrawalModal.classList.add('hidden');
            if (withdrawalForm) withdrawalForm.reset();
        });
    }

    // --- Lógica para el Panel de Administración ---
    // Esta parte es básica y se expandirá para mostrar aprobaciones, etc.
    function loadAdminPanel() {
        if (!adminPanelSection) return;
        // Aquí se cargarían las listas de depósitos y retiros pendientes
        // Por ahora, solo mostramos un mensaje
        if (pendingDepositsList) pendingDepositsList.innerHTML = '<li>Cargando depósitos pendientes...</li>';
        if (pendingWithdrawalsList) pendingWithdrawalsList.innerHTML = '<li>Cargando retiros pendientes...</li>';
        
        // TODO: Implementar la carga real de pending_requests, pending_deposits, pending_withdrawals
        // y la lógica para que el admin pueda aprobar/rechazar.
    }

    // --- Event Listeners del Dashboard ---
    if (toggleCurrencyBtn) {
        toggleCurrencyBtn.addEventListener('click', () => {
            showCurrencyUSD = !showCurrencyUSD;
            updateBalanceDisplay();
        });
    }

    if (backToDashboardBtn) {
        backToDashboardBtn.addEventListener('click', () => {
            showSection(dashboardSection, transactionHistorySection, adminPanelSection);
        });
    }
    
    // --- Observador de Estado de Autenticación ---
    onAuthStateChanged(auth, async (user) => {
        currentUser = user; // Guarda el usuario actual
        if (user) {
            const userId = user.uid;
            const userDocRef = doc(db, 'artifacts', appId, 'users', userId);

            const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    if (dashboardUserName) dashboardUserName.textContent = `${userData.name} ${userData.surname}`;
                    if (dashboardDisplayId) dashboardDisplayId.textContent = userData.userDisplayId;
                    currentBalanceUSD = userData.balanceUSD;
                    currentBalanceDOP = userData.balanceDOP;
                    updateBalanceDisplay();

                    // Ocultar todas las secciones principales
                    showSection(dashboardSection); 
                    
                    // Aquí puedes determinar si es admin para mostrar el panel
                    // Por ahora, todos ven el dashboard y el historial.
                    
                    // Cargar historial de transacciones del usuario
                    loadTransactionHistory();

                    // Si el usuario es un admin (necesitarías un campo 'role' en user data)
                    // if (userData.role === 'admin') {
                    //     loadAdminPanel();
                    // }

                } else {
                    console.log("No existe el documento del usuario!");
                    handleLogout(); // Si el documento no existe, cerrar sesión
                }
            }, (error) => {
                console.error("Error al escuchar cambios en el documento de usuario:", error);
                showMessage("Hubo un error al cargar tus datos.", "error");
            });
            // Guardar la función de unsubscribe si es necesario
            // return () => unsubscribeUser(); 
        } else {
            console.log("Usuario ha cerrado sesión.");
            // Asegúrate de que todas las suscripciones se limpien al cerrar sesión
            // if (unsubscribeUser) unsubscribeUser();
            showSection(loginSection, registerSection); // Mostrar secciones de login/registro
        }
    });
});
