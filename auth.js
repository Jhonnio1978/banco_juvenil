// auth.js

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { auth, db, appId } from './firebase-config.js';
import { generateUserDisplayId, showMessage } from './utils.js';

let userProfileUnsubscribe = null;

async function performRegistration(name, surname, age, phoneNumber, password) {
    const generatedEmail = `${name.toLowerCase().replace(/\s/g, '')}.${surname.toLowerCase().replace(/\s/g, '')}@${appId}.com`;
    const userDisplayId = generateUserDisplayId(name, surname);

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, generatedEmail, password);
        const user = userCredential.user;
        const userId = user.uid;

        const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
        await setDoc(userDocRef, {
            userId,
            userDisplayId,
            name,
            surname,
            age,
            phoneNumber,
            email: generatedEmail,
            balanceUSD: 0,
            balanceDOP: 0,
            currencyPreference: 'USD',
            hasPendingDeposit: false,
            createdAt: new Date()
        });
        showMessage(`¡Registro exitoso, ${name}! Tu ID de usuario es: ${generatedEmail}.`, 'success');
        return { success: true, email: generatedEmail };
    } catch (error) {
        let errorMessage = 'Error al registrar. Por favor, inténtalo de nuevo.';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = `Ya existe una cuenta con este nombre y apellido.`;
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
        }
        showMessage(errorMessage, 'error');
        return { success: false, error };
    }
}

async function handleLogin(identifier, password) {
    let emailToLogin = identifier;
    try {
        if (!identifier.includes('@')) {
            const usersCollectionRef = collection(db, 'artifacts', appId, 'users');
            const q = query(usersCollectionRef, where('userDisplayId', '==', identifier));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                showMessage('ID de usuario o contraseña incorrectos.', 'error');
                return;
            }
            emailToLogin = querySnapshot.docs[0].data().email;
        }
        await signInWithEmailAndPassword(auth, emailToLogin, password);
    } catch (error) {
        showMessage('ID de usuario o contraseña incorrectos.', 'error');
    }
}

async function handleLogout() {
    try {
        if (userProfileUnsubscribe) {
            userProfileUnsubscribe();
            userProfileUnsubscribe = null;
        }
        await signOut(auth);
    } catch (error) {
        showMessage('Error al cerrar sesión.', 'error');
    }
}

export { performRegistration, handleLogin, handleLogout, onAuthStateChanged, userProfileUnsubscribe };
