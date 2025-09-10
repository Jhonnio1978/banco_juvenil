// ui-handlers.js

import { auth } from './firebase-config.js'; // ¡CORREGIDO!
import { performRegistration, handleLogin, handleLogout } from './auth.js';
import { handleDeposit, handleTransfer } from './transactions.js';
import { showMessage, hideMessage, showSection, showTransactionStatus, hideTransactionStatus } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {

    // Elementos de la interfaz de usuario
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    const dashboardSection = document.getElementById('dashboardSection');

    const loginForm = document.getElementById('loginForm');
    const loginIdentifierInput = document.getElementById('loginIdentifier');
    const loginPassword = document.getElementById('loginPassword');
    const registerForm = document.getElementById('registerForm');
    const registerNameInput = document.getElementById('registerName');
    const registerSurnameInput = document.getElementById('registerSurname');
    const registerAgeInput = document.getElementById('registerAge');
    const registerPhoneNumberInput = document.getElementById('registerPhoneNumber');
    const registerPasswordInput = document.getElementById('registerPassword');
    const logoutBtn = document.getElementById('logoutBtn');
    const accountBalance = document.getElementById('accountBalance');
    const depositMoneyBtn = document.getElementById('depositMoneyBtn');
    const depositModal = document.getElementById('depositModal');
    const cancelDeposit = document.getElementById('cancelDeposit');
    const depositForm = document.getElementById('depositForm');
    const depositSerialNumberInput = document.getElementById('depositSerialNumber');
    const depositAmount = document.getElementById('depositAmount');
    const depositCurrency = document.getElementById('depositCurrency');
    const transferMoneyBtn = document.getElementById('transferMoneyBtn');
    const transferModal = document.getElementById('transferModal');
    const cancelTransferModalBtn = document.getElementById('cancelTransferModalBtn');
    const transferForm = document.getElementById('transferForm');
    const transferRecipientIdInput = document.getElementById('transferRecipientId');
    const transferAmount = document.getElementById('transferAmount');
    const transferCurrency = document.getElementById('transferCurrency');

    // Event Listeners
    if (loginTab) {
        loginTab.addEventListener('click', () => {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            showSection(loginSection, registerSection, dashboardSection);
        });
    }

    if (registerTab) {
        registerTab.addEventListener('click', () => {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            showSection(registerSection, loginSection, dashboardSection);
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideMessage();
            const identifier = loginIdentifierInput.value.trim();
            const password = loginPassword.value;
            await handleLogin(identifier, password);
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideMessage();
            const name = registerNameInput.value.trim();
            const surname = registerSurnameInput.value.trim();
            const age = parseInt(registerAgeInput.value);
            const phoneNumber = registerPhoneNumberInput.value.trim();
            const password = registerPasswordInput.value;

            if (!name || !surname || !password || isNaN(age) || age <= 0 || !phoneNumber) {
                showMessage('Por favor, completa todos los campos correctamente.', 'error');
                return;
            }

            const result = await performRegistration(name, surname, age, phoneNumber, password);
            if (result.success) {
                loginIdentifierInput.value = result.email;
                loginPassword.value = password;
                // Ahora puedes iniciar sesión automáticamente si lo deseas
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    if (depositMoneyBtn) {
        depositMoneyBtn.addEventListener('click', () => {
            depositModal.classList.remove('hidden');
        });
    }

    if (cancelDeposit) {
        cancelDeposit.addEventListener('click', () => {
            depositModal.classList.add('hidden');
            depositForm.reset();
        });
    }

    if (depositForm) {
        depositForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = parseFloat(depositAmount.value);
            const currency = depositCurrency.value;
            const serialNumber = depositSerialNumberInput.value.trim();

            if (isNaN(amount) || amount <= 0 || !serialNumber) {
                showMessage('Por favor, ingresa una cantidad válida y el número de serie.', 'error');
                return;
            }

            const user = auth.currentUser;
            if (user) {
                await handleDeposit(user.uid, amount, currency, serialNumber, false);
                depositModal.classList.add('hidden');
                depositForm.reset();
            }
        });
    }

    if (transferMoneyBtn) {
        transferMoneyBtn.addEventListener('click', () => {
            transferModal.classList.remove('hidden');
        });
    }

    if (cancelTransferModalBtn) {
        cancelTransferModalBtn.addEventListener('click', () => {
            transferModal.classList.add('hidden');
            transferForm.reset();
        });
    }

    if (transferForm) {
        transferForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const recipientId = transferRecipientIdInput.value.trim();
            const amount = parseFloat(transferAmount.value);
            const currency = transferCurrency.value;

            if (!recipientId || isNaN(amount) || amount <= 0) {
                showMessage('Por favor, completa todos los campos de la transferencia.', 'error');
                return;
            }

            const user = auth.currentUser;
            if (user) {
                showTransactionStatus('Transferencia en curso...');
                const result = await handleTransfer(user.uid, recipientId, amount, currency);
                hideTransactionStatus();
                if (result.success) {
                    showMessage('Transferencia exitosa.', 'success');
                } else {
                    showMessage('Transferencia fallida.', 'error');
                }
                transferModal.classList.add('hidden');
                transferForm.reset();
            }
        });
    }
});
