// script.js

import { auth, db } from './firebase-config.js';
import { handleLogout, onAuthStateChanged } from './auth.js';
import { showSection } from './utils.js';
import './ui-handlers.js';
import { doc, onSnapshot, collection, query, where, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    let currentBalanceUSD = 0;
    let currentBalanceDOP = 0;
    let showCurrencyUSD = true;
    let currentUserData = null; // Guardaremos los datos del usuario actual
    let adminUnsubscribe = null; // Para desuscribir el listener de admin si existe

    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const adminPanelSection = document.getElementById('adminPanelSection'); // Nuevo elemento HTML para el panel de admin

    const dashboardUserName = document.getElementById('dashboardUserName');
    const dashboardDisplayId = document.getElementById('dashboardDisplayId');
    const accountBalance = document.getElementById('accountBalance');
    const toggleCurrencyBtn = document.getElementById('toggleCurrency');

    // Elementos del historial
    const transactionHistoryBody = document.getElementById('transactionHistoryBody');

    // Funciones para actualizar la UI
    function updateBalanceDisplay() {
        if (!accountBalance || !toggleCurrencyBtn) return;
        if (showCurrencyUSD) {
            accountBalance.textContent = `$${currentBalanceUSD.toFixed(2)} USD`;
            toggleCurrencyBtn.textContent = 'Cambiar a DOP';
        } else {
            currentBalanceDOP = currentBalanceUSD * 58.0; // Tasa de ejemplo
            accountBalance.textContent = `RD$${currentBalanceDOP.toFixed(2)} DOP`;
            toggleCurrencyBtn.textContent = 'Cambiar a USD';
        }
    }

    async function loadTransactionHistory(userId) {
        if (!transactionHistoryBody) return;
        transactionHistoryBody.innerHTML = ''; // Limpiar historial previo

        try {
            // Construir la consulta para obtener transacciones donde el usuario sea remitente o destinatario
            const transactionsRef = collection(db, 'artifacts', 'banco-juvenil-12903', 'transactions');
            const q = query(transactionsRef, 
                where('senderId', '==', userId),
                or(where('recipientId', '==', userId)), // Usar 'or' para buscar en ambas condiciones
                orderBy('timestamp', 'desc')
            );
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                transactionHistoryBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No hay transacciones aún.</td></tr>';
                return;
            }

            querySnapshot.forEach(doc => {
                const transaction = doc.data();
                const row = document.createElement('tr');
                const date = transaction.timestamp ? new Date(transaction.timestamp.seconds * 1000).toLocaleDateString() : 'N/A';
                const time = transaction.timestamp ? new Date(transaction.timestamp.seconds * 1000).toLocaleTimeString() : 'N/A';
                let description = '';
                let amountDisplay = '';

                if (transaction.type === 'transfer') {
                    description = transaction.senderId === userId ? `Transferencia a ${transaction.recipientId}` : `Transferencia de ${transaction.senderId}`;
                    amountDisplay = `${transaction.amount.toFixed(2)} ${transaction.currency}`;
                } else {
                    // Manejar otros tipos de transacciones si existen
                    description = transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1);
                    amountDisplay = `${transaction.amount.toFixed(2)} ${transaction.currency}`;
                }

                row.innerHTML = `
                    <td class="py-2 px-4 border-b">${date} ${time}</td>
                    <td class="py-2 px-4 border-b">${description}</td>
                    <td class="py-2 px-4 border-b text-right">${amountDisplay}</td>
                    <td class="py-2 px-4 border-b text-center">${transaction.status || 'Completada'}</td> 
                `;
                transactionHistoryBody.appendChild(row);
            });
        } catch (error) {
            console.error("Error al cargar el historial de transacciones:", error);
            transactionHistoryBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Error al cargar historial.</td></tr>';
        }
    }

    async function checkAdminStatus(userId) {
        if (!userId) return false;
        try {
            const userDocRef = doc(db, 'artifacts', 'banco-juvenil-12903', 'users', userId);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                currentUserData = userDocSnap.data(); // Guardar datos del usuario
                return currentUserData.role === 'admin';
            }
            return false;
        } catch (error) {
            console.error("Error al verificar rol de admin:", error);
            return false;
        }
    }

    // Manejar la navegación entre secciones (incluyendo admin)
    function updateUIForUser(user, userData) {
        if (user) {
            const userId = user.uid;
            const userDocRef = doc(db, 'artifacts', 'banco-juvenil-12903', 'users', userId);

            // Limpiar listener anterior si existe
            if (adminUnsubscribe) {
                adminUnsubscribe();
                adminUnsubscribe = null;
            }

            // Listener para datos del usuario (incluye rol de admin)
            const unsubscribeUser = onSnapshot(userDocRef, async (docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    currentUserData = userData; // Actualizar datos del usuario

                    if (dashboardUserName) dashboardUserName.textContent = `${userData.name} ${userData.surname}`;
                    if (dashboardDisplayId) dashboardDisplayId.textContent = userData.userDisplayId;
                    currentBalanceUSD = userData.balanceUSD;
                    currentBalanceDOP = userData.balanceDOP;
                    updateBalanceDisplay();

                    const isAdmin = userData.role === 'admin';

                    // Mostrar u ocultar el panel de admin
                    if (isAdmin && adminPanelSection) {
                        adminPanelSection.classList.remove('hidden');
                        // Si el admin está visible, y el dashboard no, mostrar admin
                        if (!dashboardSection.classList.contains('hidden') && adminPanelSection.classList.contains('hidden')) {
                             showSection(adminPanelSection, loginSection, registerSection); // O puedes querer mostrar dashboard primero
                        } else if (dashboardSection.classList.contains('hidden')) {
                             showSection(adminPanelSection, loginSection, registerSection);
                        }
                        // También podrías querer cargar datos iniciales del admin aquí
                        await loadPendingRequests(); // Cargar solicitudes pendientes para el admin
                    } else if (adminPanelSection) {
                        adminPanelSection.classList.add('hidden');
                    }
                    
                    // Cargar historial para cualquier usuario
                    await loadTransactionHistory(userId);

                    showSection(dashboardSection, loginSection, registerSection); // Asegurarse de mostrar el dashboard

                } else {
                    console.log("No such user document!");
                    handleLogout();
                }
            });
        } else {
            // Usuario ha cerrado sesión
            if (dashboardUserName) dashboardUserName.textContent = '';
            if (dashboardDisplayId) dashboardDisplayId.textContent = '';
            currentBalanceUSD = 0;
            currentBalanceDOP = 0;
            updateBalanceDisplay();
            if (adminPanelSection) adminPanelSection.classList.add('hidden');
            
            showSection(loginSection, registerSection, dashboardSection); // Mostrar secciones de login/registro
        }
    }

    // --- Event Listeners para el Panel de Admin ---
    const adminDashboardTab = document.getElementById('adminDashboardTab');
    const adminPendingRequestsTab = document.getElementById('adminPendingRequestsTab');
    const adminApprovedHistoryTab = document.getElementById('adminApprovedHistoryTab'); // Asumiendo que esto existirá

    const adminDashboardView = document.getElementById('adminDashboardView');
    const adminPendingRequestsView = document.getElementById('adminPendingRequestsView');
    const adminApprovedHistoryView = document.getElementById('adminApprovedHistoryView'); // Vista para historial de admin

    // Función para mostrar vistas dentro del panel de admin
    function showAdminView(viewToShow) {
        const allAdminViews = [adminDashboardView, adminPendingRequestsView, adminApprovedHistoryView];
        allAdminViews.forEach(view => {
            if (view) view.classList.add('hidden');
        });
        if (viewToShow) {
            viewToShow.classList.remove('hidden');
        }
    }

    if (adminDashboardTab) {
        adminDashboardTab.addEventListener('click', () => {
            adminDashboardTab.classList.add('active');
            adminPendingRequestsTab.classList.remove('active');
            adminApprovedHistoryTab.classList.remove('active');
            showAdminView(adminDashboardView);
        });
    }

    if (adminPendingRequestsTab) {
        adminPendingRequestsTab.addEventListener('click', () => {
            adminPendingRequestsTab.classList.add('active');
            adminDashboardTab.classList.remove('active');
            adminApprovedHistoryTab.classList.remove('active');
            showAdminView(adminPendingRequestsView);
            loadPendingRequests(); // Cargar solicitudes cuando se muestra esta vista
        });
    }
    
    // --- Funciones para el Panel de Administración ---
    async function loadPendingRequests() {
        const pendingRequestsBody = document.getElementById('pendingRequestsBody');
        if (!pendingRequestsBody) return;
        pendingRequestsBody.innerHTML = ''; // Limpiar

        const adminUserId = auth.currentUser ? auth.currentUser.uid : null;
        if (!isAdmin(adminUserId)) { // Asegurarse de que el usuario es admin para ver esto
             // Ocultar el panel de admin o redirigir
            if (adminPanelSection) adminPanelSection.classList.add('hidden');
            return;
        }

        const pendingRequestsRef = collection(db, 'artifacts', 'banco-juvenil-12903', 'public', 'data', 'pending_requests');
        const q = query(pendingRequestsRef, where('status', '==', 'pending'), orderBy('timestamp', 'asc'));

        // Usamos onSnapshot para tener actualizaciones en tiempo real
        adminUnsubscribe = onSnapshot(q, (querySnapshot) => {
            pendingRequestsBody.innerHTML = ''; // Limpiar antes de actualizar
            if (querySnapshot.empty) {
                pendingRequestsBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">No hay solicitudes pendientes.</td></tr>';
                return;
            }

            querySnapshot.forEach(async (docSnap) => {
                const request = docSnap.data();
                const requestDocId = docSnap.id;
                const userName = await getUserDisplayName(request.userId);
                const date = request.timestamp ? new Date(request.timestamp.seconds * 1000).toLocaleDateString() : 'N/A';
                const time = request.timestamp ? new Date(request.timestamp.seconds * 1000).toLocaleTimeString() : 'N/A';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="py-2 px-4 border-b">${userName}</td>
                    <td class="py-2 px-4 border-b">${request.type === 'deposit' ? 'Depósito' : 'Retiro'}</td>
                    <td class="py-2 px-4 border-b">${request.amount ? `${request.amount.toFixed(2)} ${request.currency}` : 'N/A'}</td>
                    <td class="py-2 px-4 border-b">${request.serialNumber || request.withdrawalId || 'N/A'}</td>
                    <td class="py-2 px-4 border-b">${date} ${time}</td>
                    <td class="py-2 px-4 border-b text-center">
                        <button class="approve-request-btn bg-green-500 text-white py-1 px-3 rounded mr-2" data-id="${requestDocId}" data-type="${request.type}" data-userid="${request.userId}" data-amount="${request.amount}" data-currency="${request.currency}">Aprobar</button>
                        <button class="reject-request-btn bg-red-500 text-white py-1 px-3 rounded" data-id="${requestDocId}" data-userid="${request.userId}">Rechazar</button>
                    </td>
                `;
                pendingRequestsBody.appendChild(row);
            });
        }, (error) => {
            console.error("Error en onSnapshot para solicitudes pendientes:", error);
            pendingRequestsBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-red-500">Error al cargar solicitudes.</td></tr>';
        });
    }

    // --- Manejo de eventos para botones de Aprobar/Rechazar ---
    document.body.addEventListener('click', async (e) => {
        const target = e.target;

        // Aprobación de Solicitud
        if (target.classList.contains('approve-request-btn')) {
            const requestId = target.dataset.id;
            const requestType = target.dataset.type;
            const userId = target.dataset.userid;
            const amount = parseFloat(target.dataset.amount);
            const currency = target.dataset.currency;

            try {
                // 1. Eliminar la solicitud pendiente
                await deleteDoc(doc(db, 'artifacts', 'banco-juvenil-12903', 'public', 'data', 'pending_requests', requestId));

                // 2. Actualizar saldos o registrar transacción según el tipo
                if (requestType === 'deposit') {
                    // Actualizar saldo del usuario y marcar que ya no tiene depósito pendiente
                    await updateDoc(doc(db, 'artifacts', 'banco-juvenil-12903', 'users', userId), {
                        balanceUSD: increment(requestType === 'DOP' ? (amount / 58.0) : amount), // Asumiendo tasa de cambio
                        balanceDOP: increment(requestType === 'USD' ? (amount * 58.0) : amount),
                        hasPendingDeposit: false // Liberar para nuevos depósitos
                    });
                    
                    // Registrar en historial de transacciones
                    await addDoc(collection(db, 'artifacts', 'banco-juvenil-12903', 'transactions'), {
                        type: 'deposit_approved',
                        userId: userId, // O senderId si se registra desde el admin
                        amount: amount,
                        currency: currency,
                        timestamp: serverTimestamp(),
                        status: 'completed'
                    });
                    showMessage('Depósito aprobado y saldo actualizado.', 'success');

                } else if (requestType === 'withdrawal') {
                    // Aquí deberías tener lógica para verificar si la cuenta del admin tiene fondos
                    // o si el retiro se hace desde una cuenta de reserva.
                    // Por ahora, asumimos que el admin tiene fondos y se descuenta del usuario.
                    await updateDoc(doc(db, 'artifacts', 'banco-juvenil-12903', 'users', userId), {
                        balanceUSD: increment(-(requestType === 'DOP' ? (amount / 58.0) : amount)), // Asumiendo tasa de cambio
                        balanceDOP: increment(-(requestType === 'USD' ? (amount * 58.0) : amount))
                    });
                    
                    // Registrar en historial de transacciones
                    await addDoc(collection(db, 'artifacts', 'banco-juvenil-12903', 'transactions'), {
                        type: 'withdrawal_approved',
                        userId: userId, // O recipientId si se registra desde el admin
                        amount: amount,
                        currency: currency,
                        timestamp: serverTimestamp(),
                        status: 'completed'
                    });
                    showMessage('Retiro aprobado y saldo actualizado.', 'success');
                }
                // Recargar la lista de solicitudes pendientes
                loadPendingRequests(); 
            } catch (error) {
                console.error("Error al aprobar solicitud:", error);
                showMessage('Error al aprobar la solicitud. Revisa la consola.', 'error');
            }
        }

        // Rechazo de Solicitud
        if (target.classList.contains('reject-request-btn')) {
            const requestId = target.dataset.id;
            const userId = target.dataset.userid;

            try {
                await deleteDoc(doc(db, 'artifacts', 'banco-juvenil-12903', 'public', 'data', 'pending_requests', requestId));
                
                // Si era un depósito, liberar la bandera hasPendingDeposit
                const requestDoc = await getDoc(doc(db, 'artifacts', 'banco-juvenil-12903', 'public', 'data', 'pending_requests', requestId)); // Re-obtener para saber el tipo
                if (requestDoc.data().type === 'deposit') {
                    await updateDoc(doc(db, 'artifacts', 'banco-juvenil-12903', 'users', userId), {
                        hasPendingDeposit: false
                    });
                }
                // Aquí podrías añadir un email o notificación al usuario informando del rechazo
                showMessage('Solicitud rechazada.', 'info');
                loadPendingRequests();
            } catch (error) {
                console.error("Error al rechazar solicitud:", error);
                showMessage('Error al rechazar la solicitud. Revisa la consola.', 'error');
            }
        }
    });

    // Inicializar la UI
    onAuthStateChanged(auth, (user) => {
        updateUIForUser(user, currentUserData); // Pasar userData si ya la tenemos
    });
});
