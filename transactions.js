// transactions.js

import {
    doc,
    setDoc,
    updateDoc,
    addDoc,
    collection,
    serverTimestamp,
    getDoc,
    runTransaction // ¡CORREGIDO!
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { db, appId } from './firebase-config.js';
import { showMessage, getUserDisplayName, showReceipt } from './utils.js';

async function handleDeposit(userId, amount, currency, serialNumber, hasPendingDeposit) {
    if (hasPendingDeposit) {
        showMessage('Ya tienes una solicitud de depósito pendiente. Por favor, espera la aprobación del administrador.', 'error');
        return;
    }

    try {
        const pendingRequestRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: userId,
            type: 'deposit',
            amount: amount,
            currency: currency,
            serialNumber: serialNumber,
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage('Solicitud de depósito enviada. Esperando aprobación del administrador.', 'success');
        // Actualizar el estado del usuario para bloquear nuevos depósitos
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

async function handleWithdrawal(userId, currentBalanceUSD, amount, currency, WITHDRAWAL_FEE_RATE) {
    const amountUSD = (currency === 'DOP') ? amount / USD_TO_DOP_RATE : amount;
    const feeAmount = amountUSD * WITHDRAWAL_FEE_RATE;
    const totalAmount = amountUSD + feeAmount;

    if (currentBalanceUSD < totalAmount) {
        showMessage('Saldo insuficiente para realizar el retiro.', 'error');
        return { success: false };
    }

    try {
        const pendingRequestRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: userId,
            type: 'withdrawal',
            amount: amount,
            currency: currency,
            feeAmount: feeAmount,
            totalAmount: totalAmount,
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

    const USD_TO_DOP_RATE = 58.0; // Tasa de cambio de ejemplo
    const amountUSD = (currency === 'DOP') ? amount / USD_TO_DOP_RATE : amount;
    const amountDOP = (currency === 'USD') ? amount * USD_TO_DOP_RATE : amount;

    try {
        await runTransaction(db, async (transaction) => {
            const senderDocRef = doc(db, 'artifacts', appId, 'users', senderId);
            const recipientDocRef = doc(db, 'artifacts', appId, 'users', recipientId);

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
            const transactionRef = collection(db, 'artifacts', appId, 'transactions');
            transaction.set(doc(transactionRef), {
                type: 'transfer',
                senderId: senderId,
                recipientId: recipientId,
                amount: amount,
                currency: currency,
                timestamp: serverTimestamp()
            });
        });
        
        showMessage('Transferencia exitosa.', 'success');
        return { success: true };
    } catch (error) {
        console.error("Error al procesar la transferencia:", error);
        if (error.message.includes('Saldo insuficiente')) {
            showMessage('Saldo insuficiente para la transferencia.', 'error');
        } else if (error.message.includes('destinatario no existe')) {
            showMessage('El usuario destinatario no existe.', 'error');
        } else {
            showMessage('Error al procesar la transferencia. Por favor, inténtalo de nuevo.', 'error');
        }
        return { success: false, error };
    }
}

export { handleDeposit, handleWithdrawal, handleTransfer };
