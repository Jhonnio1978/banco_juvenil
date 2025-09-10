// transactions.js

import {
    doc,
    setDoc,
    updateDoc,
    addDoc,
    collection,
    serverTimestamp,
    getDoc,
    runTransaction,
    query,
    where,
    getDocs,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { db, appId } from './firebase-config.js';
import { showMessage, getUserDisplayName, showReceipt, loadTransactionHistory, showAdminPanel, showUserPanel } from './utils.js';
import { auth } from './firebase-config.js'; // Importar auth para obtener currentUser

const USD_TO_DOP_RATE = 58.0; // Tasa de cambio de ejemplo, idealmente esto vendría de una configuración

async function handleDeposit(userId, amount, currency, serialNumber) {
    // Se asume que la lógica de verificar 'hasPendingDeposit' está en el listener del usuario
    // y que se actualiza el documento del usuario.
    try {
        const depositsRef = collection(db, 'artifacts', appId, 'public', 'data', 'pending_deposits');
        await addDoc(depositsRef, {
            userId: userId,
            type: 'deposit',
            amount: amount,
            currency: currency,
            serialNumber: serialNumber,
            timestamp: serverTimestamp(),
            status: 'pending' // Estado inicial
        });

        // Actualizar el documento del usuario para indicar que hay un depósito pendiente
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId), {
            hasPendingDeposit: true
        });

        showMessage('Solicitud de depósito enviada. Esperando aprobación del administrador.', 'success');
        return { success: true };
    } catch (error) {
        console.error("Error al procesar el depósito:", error);
        showMessage('Error al procesar el depósito. Por favor, inténtalo de nuevo.', 'error');
        return { success: false, error };
    }
}

async function handleWithdrawal(userId, currentBalanceUSD, amount, currency) {
    const amountUSD = (currency === 'DOP') ? amount / USD_TO_DOP_RATE : amount;
    // Si hubiera una comisión fija o variable, se calcularía aquí.
    // Por ahora, asumo que no hay comisión directa en el retiro inicial,
    // pero el admin podría aplicarla.
    const feeAmount = 0; // O calcularla si aplica

    if (currentBalanceUSD < amountUSD) {
        showMessage('Saldo insuficiente para realizar el retiro.', 'error');
        return { success: false };
    }

    try {
        const withdrawalsRef = collection(db, 'artifacts', appId, 'public', 'data', 'pending_withdrawals');
        await addDoc(withdrawalsRef, {
            userId: userId,
            type: 'withdrawal',
            amount: amount,
            currency: currency,
            feeAmount: feeAmount, // Si aplica
            timestamp: serverTimestamp(),
            status: 'pending' // Estado inicial
        });

        showMessage('Solicitud de retiro enviada. Esperando aprobación del administrador.', 'success');
        return { success: true };
    } catch (error) {
        console.error("Error al procesar el retiro:", error);
        showMessage('Error al procesar el retiro. Por favor, inténtalo de nuevo.', 'error');
        return { success: false, error };
    }
}

async function handleTransfer(senderId, recipientId, amount, currency) {
    if (senderId === recipientId) {
        showMessage('No puedes transferir dinero a tu propia cuenta.', 'error');
        return { success: false };
    }

    const amountUSD = (currency === 'DOP') ? amount / USD_TO_DOP_RATE : amount;
    const amountDOP = (currency === 'USD') ? amount * USD_TO_DOP_RATE : amount;

    try {
        await runTransaction(db, async (transaction) => {
            const senderDocRef = doc(db, 'artifacts', appId, 'users', senderId);
            const recipientDocRef = doc(db, 'artifacts', appId, 'users', recipientId);
            const transactionsCollectionRef = collection(db, 'artifacts', appId, 'transactions');

            const senderDoc = await transaction.get(senderDocRef);
            if (!senderDoc.exists()) {
                throw new Error("El usuario remitente no existe.");
            }
            const senderData = senderDoc.data();
            
            if (senderData.balanceUSD < amountUSD) {
                throw new Error("Saldo insuficiente para la transferencia.");
            }

            const recipientDoc = await transaction.get(recipientDocRef);
            if (!recipientDoc.exists()) {
                throw new Error("El usuario destinatario no existe.");
            }
            const recipientData = recipientDoc.data();

            // Actualizar saldos dentro de la transacción
            transaction.update(senderDocRef, {
                balanceUSD: senderData.balanceUSD - amountUSD,
                balanceDOP: senderData.balanceDOP - amountDOP
            });
            transaction.update(recipientDocRef, {
                balanceUSD: recipientData.balanceUSD + amountUSD,
                balanceDOP: recipientData.balanceDOP + amountDOP
            });
            
            // Agregar el documento de la transacción
            // Usar addDoc para que Firebase genere el ID
            transaction.set(doc(transactionsCollectionRef), { // doc(collectionRef) para crear un nuevo doc
                type: 'transfer',
                senderId: senderId,
                recipientId: recipientId,
                amount: amount,
                currency: currency,
                timestamp: serverTimestamp()
            });
        });
        
        //showMessage('Transferencia exitosa.', 'success'); // Mostrar mensaje en ui-handlers
        return { success: true };
    } catch (error) {
        console.error("Error al procesar la transferencia:", error);
        // Los mensajes de error específicos se mostrarán en ui-handlers.js
        throw error; // Lanza el error para que ui-handlers.js pueda capturarlo
    }
}

// Podrías necesitar estas funciones si son llamadas desde ui-handlers.js o script.js
async function fetchUserTransactions(userId) {
    if (!userId) return [];
    try {
        const transactionsRef = collection(db, 'artifacts', appId, 'transactions');
        // Consulta para obtener transacciones donde el usuario es remitente o destinatario
        const q1 = query(transactionsRef, where('senderId', '==', userId), orderBy('timestamp', 'desc'));
        const q2 = query(transactionsRef, where('recipientId', '==', userId), orderBy('timestamp', 'desc'));

        const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        
        const transactions = [
            ...snapshot1.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            ...snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        ];
        
        // Ordenar por fecha descendente si hay duplicados o para asegurar el orden
        transactions.sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime());
        
        return transactions;
    } catch (error) {
        console.error("Error fetching user transactions:", error);
        return [];
    }
}

export { 
    handleDeposit, 
    handleWithdrawal, 
    handleTransfer,
    fetchUserTransactions // Exportar para que script.js pueda usarla
};
