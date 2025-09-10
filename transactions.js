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
    increment, // Importar increment para actualizaciones de saldo
    Timestamp, // Puede ser útil para fechas
    orderBy, // Para ordenar historial
    query, where, getDocs, deleteDoc, onSnapshot // Importaciones necesarias para el admin
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { db, appId } from './firebase-config.js';
import { showMessage, getUserDisplayName, showReceipt } from './utils.js';
import { auth } from './firebase-config.js'; // Importar auth para obtener currentUser

const USD_TO_DOP_RATE = 58.0; // Tasa de cambio de ejemplo

async function handleDeposit(userId, amount, currency, serialNumber, hasPendingDeposit) {
    if (hasPendingDeposit) {
        showMessage('Ya tienes una solicitud de depósito pendiente. Por favor, espera la aprobación del administrador.', 'error');
        return;
    }

    try {
        // Añadir la solicitud a pending_requests para que el admin la revise
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: userId,
            type: 'deposit',
            amount: amount,
            currency: currency,
            serialNumber: serialNumber, // Información para el admin
            timestamp: serverTimestamp(),
            status: 'pending' // Estado inicial
        });

        showMessage('Solicitud de depósito enviada. Esperando aprobación del administrador.', 'success');
        
        // Actualizar el estado del usuario para bloquear nuevos depósitos hasta que se apruebe o rechace
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId), {
            hasPendingDeposit: true
        });
        return { success: true };
    } catch (error) {
        console.error("Error al procesar el depósito:", error);
        showMessage('Error al procesar el depósito. Por favor, inténtalo de nuevo.', 'error');
        return { success: false, error };
    }
}

async function handleWithdrawal(userId, currentBalanceUSD, amount, currency) {
    // Convertir a USD para la comprobación de saldo
    const amountToWithdrawUSD = (currency === 'DOP') ? amount / USD_TO_DOP_RATE : amount;
    
    // Asumiendo que hay una comisión, que también se calcularía en USD
    // Aquí la comisión se aplica si el retiro es en USD o se convierte a USD para calcular
    // Si la comisión fuera fija en DOP, se ajustaría.
    const WITHDRAWAL_FEE_RATE = 0.01; // Ejemplo: 1% de comisión
    const feeAmountUSD = amountToWithdrawUSD * WITHDRAWAL_FEE_RATE;
    const totalAmountUSD = amountToWithdrawUSD + feeAmountUSD;

    if (currentBalanceUSD < totalAmountUSD) {
        showMessage('Saldo insuficiente para realizar el retiro.', 'error');
        return { success: false };
    }

    try {
        // Registrar la solicitud de retiro para que el admin la revise
        // La aprobación y el débito real se harán en el panel de admin
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: userId,
            type: 'withdrawal', // Tipo de solicitud
            amount: amount, // Monto original en la moneda solicitada
            currency: currency,
            amountUSD: totalAmountUSD, // Monto total en USD (incluyendo comisión) para referencia
            feeAmountUSD: feeAmountUSD,
            timestamp: serverTimestamp(),
            status: 'pending'
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
        // Ejecutar una transacción atómica para asegurar consistencia
        await runTransaction(db, async (transaction) => {
            const senderDocRef = doc(db, 'artifacts', appId, 'users', senderId);
            const recipientDocRef = doc(db, 'artifacts', appId, 'users', recipientId);

            const senderDoc = await transaction.get(senderDocRef);
            if (!senderDoc.exists()) {
                throw new Error("El usuario remitente no existe.");
            }
            const senderData = senderDoc.data();
            
            // Comprobar saldo suficiente en USD (si el monto a transferir en USD excede su saldo USD)
            if (senderData.balanceUSD < amountUSD) {
                throw new Error("Saldo insuficiente para la transferencia.");
            }

            const recipientDoc = await transaction.get(recipientDocRef);
            if (!recipientDoc.exists()) {
                throw new Error("El usuario destinatario no existe.");
            }
            // No necesitamos leer recipientData para esta operación, solo para crear la transacción.

            // Actualizar saldos de remitente y destinatario
            transaction.update(senderDocRef, {
                balanceUSD: senderData.balanceUSD - amountUSD,
                balanceDOP: senderData.balanceDOP - amountDOP // Ajustar saldo DOP también
            });
            transaction.update(recipientDocRef, {
                balanceUSD: increment(amountUSD), // Usar increment para sumar
                balanceDOP: increment(amountDOP)  // Usar increment para sumar
            });
            
            // Agregar el documento de la transacción al historial general
            const transactionsCollectionRef = collection(db, 'artifacts', appId, 'transactions');
            transaction.set(doc(transactionsCollectionRef), { // Usar set con doc(ref) para crear un nuevo doc
                type: 'transfer',
                senderId: senderId,
                recipientId: recipientId,
                amount: amount, // Monto original en la moneda solicitada
                currency: currency,
                amountUSD: amountUSD, // Monto en USD transferido
                timestamp: serverTimestamp(),
                status: 'completed' // Asumimos que se completa si la transacción es exitosa
            });
        });
        
        // showMessage('Transferencia exitosa.', 'success'); // Mejor mostrar esto en ui-handlers.js
        return { success: true };
    } catch (error) {
        console.error("Error al procesar la transferencia:", error);
        if (error.message.includes('Saldo insuficiente')) {
            showMessage('Saldo insuficiente para la transferencia.', 'error');
        } else if (error.message.includes('destinatario no existe')) {
            showMessage('El usuario destinatario no existe.', 'error');
        } else if (error.message.includes('remitente no existe')) {
            showMessage('El usuario remitente no existe (error interno).', 'error');
        }
        else {
            showMessage('Error al procesar la transferencia. Por favor, inténtalo de nuevo.', 'error');
        }
        return { success: false, error };
    }
}

export { handleDeposit, handleWithdrawal, handleTransfer };
