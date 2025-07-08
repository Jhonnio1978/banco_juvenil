import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Your web app's Firebase configuration - provided by the user
const firebaseConfig = {
    apiKey: "AIzaSyDfUxqjfr1UYo9KN1HwibNIXyAKSZCqYbw",
    authDomain: "banco-juvenil-12903.firebaseapp.com",
    projectId: "banco-juvenil-12903",
    storageBucket: "banco-juvenil-12903.firebaseapp.com",
    messagingSenderId: "421654654501",
    appId: "1:421654654501:web:c315e4d67c9289f6d619cc"
};
const appId = "banco-juvenil-12903"; // Using projectId as appId for Firestore path consistency

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null; // Stores the current authenticated user object
let currentUserId = null; // Stores the UID of the current user (Firebase UID)
let currentBalanceUSD = 0;
let currentBalanceDOP = 0;
let showCurrencyUSD = true; // Flag to toggle currency display

// Exchange rate (example, in a real app this would come from an API)
const USD_TO_DOP_RATE = 58.0; // Example rate
const COMMISSION_RATE = 0.03; // 3% commission for online shopping and streaming
const WITHDRAWAL_FEE_RATE = 0.04; // 4% fee for withdrawals
const SAVINGS_DELETE_FEE_RATE = 0.02; // 2% fee for deleting savings account
const INDEMNIZATION_RATE = 0.05; // 5% indemnization for overdue savings debts

// Admin email for prototype purposes
const ADMIN_EMAIL = `admin.jhonnio@${appId}.com`;
const ADMIN_PHONE_NUMBER_FULL = '18293329545'; // Admin's WhatsApp number with country code

// Transfer specific variables
let transferInterval = null; // To hold the interval ID for cancellation
let currentTransferRecipientUid = null; // To store recipient UID for transfer confirmation
let currentTransferAmount = 0;
let currentTransferCurrency = '';
let currentTransferRecipientIdentifier = ''; // The ID or email the user typed
let currentTransferRecipientDisplayName = ''; // The name displayed to the user

// Global map to store user display names and phone numbers to avoid repeated Firestore lookups
const userDisplayNamesCache = {};
const userPhoneNumbersCache = {}; // New cache for phone numbers

// Global variable to store user's transaction data for summarization (no longer used for AI summary but kept for history loading)
let userTransactionsData = [];

// UI Elements
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const loginSection = document.getElementById('loginSection');
const registerSection = document.getElementById('registerSection');
const dashboardSection = document.getElementById('dashboardSection');
const adminButtonsContainer = document.getElementById('adminButtonsContainer'); // Container for admin buttons

const loginForm = document.getElementById('loginForm');
const loginIdentifierInput = document.getElementById('loginIdentifier');
const registerForm = document.getElementById('registerForm');
const registerNameInput = document.getElementById('registerName');
const registerSurnameInput = document.getElementById('registerSurname');
const registerAgeInput = document.getElementById('registerAge');
const registerPhoneNumberInput = document.getElementById('registerPhoneNumber'); // NEW: Phone Number Input
const registerPasswordInput = document.getElementById('registerPassword');

const logoutBtn = document.getElementById('logoutBtn');
const dashboardUserName = document.getElementById('dashboardUserName');
const dashboardDisplayId = document.getElementById('dashboardDisplayId'); // Simplified user ID for display
const accountBalance = document.getElementById('accountBalance');
const toggleCurrencyBtn = document.getElementById('toggleCurrency');
const profileAvatar = document.getElementById('profileAvatar'); // New: Profile Avatar

// Buttons
const adminFullHistoryBtn = document.getElementById('adminFullHistoryBtn');
const viewFAQBtn = document.getElementById('viewFAQBtn'); // FAQ Button
const onlineShoppingBtn = document.getElementById('onlineShoppingBtn'); // Online Shopping Button
const streamingPaymentBtn = document.getElementById('streamingPaymentBtn'); // Streaming Payment Button
const gameRechargeBtn = document.getElementById('gameRechargeBtn'); // NEW: Game Recharge Button
const viewUserPendingRequestsBtn = document.getElementById('viewUserPendingRequestsBtn'); // User Pending Requests Button
const viewAdminPendingRequestsBtn = document.getElementById('viewAdminPendingRequestsBtn'); // Admin Pending Requests Button
const editProfileBtn = document.getElementById('editProfileBtn'); // Edit Profile Button
const changePasswordBtn = document.getElementById('changePasswordBtn'); // Change Password Button
const securityTipsBtn = document.getElementById('securityTipsBtn'); // Security Tips Button
const aboutUsBtn = document.getElementById('aboutUsBtn'); // About Us Button
const contactSupportBtn = document.getElementById('contactSupportBtn'); // NEW: Contact & Support Button
const openSavingsAccountBtn = document.getElementById('openSavingsAccountBtn'); // NEW: Open Savings Account Button
const viewSavingsAccountsBtn = document.getElementById('viewSavingsAccountsBtn'); // NEW: View Savings Accounts Button
const editAnnouncementsBtn = document.getElementById('editAnnouncementsBtn'); // NEW: Edit Announcements Button
const viewSavingsDebtsBtn = document.getElementById('viewSavingsDebtsBtn'); // NEW: View Savings Debts Button (Client)
const viewAdminSavingsDebtsBtn = document.getElementById('viewAdminSavingsDebtsBtn'); // NEW: View Admin Savings Debts Button

const adminFullHistoryTableBodyModal = document.getElementById('adminFullHistoryTableBodyModal'); // Admin History (in modal)

const messageBox = document.getElementById('messageBox');
const messageText = document.getElementById('messageText');
const closeMessage = document.getElementById('closeMessage');
const transactionStatusMsg = document.getElementById('transactionStatusMsg');
const transactionStatusText = document.getElementById('transactionStatusText');
const cancelOngoingTransferBtn = document.getElementById('cancelOngoingTransferBtn');

// Rules Consent Modal elements
const rulesConsentModal = document.getElementById('rulesConsentModal');
const briefRulesTextContainer = document.getElementById('briefRulesTextContainer');
const acceptRulesBtn = document.getElementById('acceptRulesBtn');
const rejectRulesBtn = document.getElementById('rejectRulesBtn');

// Store registration form data temporarily for rules consent
let tempRegisterData = {};

// Define brief rules text (updated to reflect new pending approval flows)
const briefRulesText = `
    <p class="mb-2"><strong>1. Seguridad de Cuenta:</strong> Tu contraseña es confidencial. Nunca la compartas. Eres responsable de la seguridad de tu ID de usuario y contraseña.</p>
    <p class="mb-2"><strong>2. Edad Mínima:</strong> Debes tener al menos 13 años para registrarte.</p>
    <p class="mb-2"><strong>3. Monedas:</strong> Manejamos USD y DOP. Las tasas de cambio aplican para conversiones.</p>
    <p class="mb-2"><strong>4. Depósitos:</strong> Todos los depósitos requieren aprobación del banco. No podrás hacer otro depósito si tienes uno pendiente.</p>
    <p class="mb-2"><strong>5. Retiros:</strong> Las solicitudes de retiro también requieren aprobación del banco. Se aplicará una tarifa del 4% a cada retiro.</p>
    <p class="mb-2"><strong>6. Compras y Streaming:</strong> Las solicitudes de compra por internet y pago de servicios de streaming requieren la aprobación del administrador antes de que se deduzca el dinero.</p>
    <p class="mb-2"><strong>7. Recargas de Juegos:</strong> Las solicitudes de recarga de juegos requieren la aprobación del administrador antes de que se deduzca el dinero. Se aplicará una tarifa del 3%.</p>
    <p class="mb-2"><strong>8. Transferencias:</strong> Las transferencias tienen un tiempo de procesamiento de 10 segundos. Verifica bien al destinatario, no son reversibles.</p>
    <p class="mb-2"><strong>9. Cuentas de Ahorro:</strong> Las solicitudes para abrir cuentas de ahorro requieren la aprobación del administrador. Al eliminar una cuenta de ahorro, se aplicará una tarifa del 2% sobre el saldo restante.</p>
    <p class="mb-2"><strong>10. Cobro Automático de Ahorros:</strong> Las cuotas de ahorro se intentarán cobrar automáticamente de tu cuenta principal en la frecuencia establecida. Si no hay fondos suficientes, se registrará una deuda y se podrá aplicar una indemnización.</p>
    <p class="mb-2"><strong>11. Deudas de Ahorro:</strong> Las deudas por cuotas de ahorro no pagadas pueden generar una indemnización del ${INDEMNIZATION_RATE * 100}% del monto adeudado si no se pagan a tiempo. Esta indemnización se transferirá al administrador.</p>
`;

// Modals
const transferMoneyBtn = document.getElementById('transferMoneyBtn');
const transferModal = document.getElementById('transferModal');
const cancelTransferModalBtn = document.getElementById('cancelTransferModalBtn');
const transferForm = document.getElementById('transferForm');
const transferRecipientIdInput = document.getElementById('transferRecipientId');
const recipientNameDisplay = document.getElementById('recipientNameDisplay');
const confirmTransferBtn = document.getElementById('confirmTransferBtn');

const depositMoneyBtn = document.getElementById('depositMoneyBtn');
const depositModal = document.getElementById('depositModal');
const cancelDeposit = document.getElementById('cancelDeposit');
const depositForm = document.getElementById('depositForm');
const depositSerialNumberInput = document.getElementById('depositSerialNumber');

const withdrawMoneyBtn = document.getElementById('withdrawMoneyBtn');
const withdrawModal = document.getElementById('withdrawModal');
const cancelWithdraw = document.getElementById('cancelWithdraw');
const withdrawForm = document.getElementById('withdrawForm');

const userHistoryModal = document.getElementById('userHistoryModal');
const userHistoryTableBody = document.getElementById('userHistoryTableBody');
const closeUserHistoryModalBtn = document.getElementById('closeUserHistoryModalBtn');

const adminFullHistoryModal = document.getElementById('adminFullHistoryModal');
const closeAdminFullHistoryModalBtn = document.getElementById('closeAdminFullHistoryModalBtn');

// Admin Pending Requests Modal elements
const adminPendingRequestsModal = document.getElementById('adminPendingRequestsModal');
const closeAdminPendingRequestsModalBtn = document.getElementById('closeAdminPendingRequestsModalBtn');
const adminPendingRequestsTableBody = document.getElementById('adminPendingRequestsTableBody');

const faqModal = document.getElementById('faqModal');
const closeFAQModalBtn = document.getElementById('closeFAQModalBtn');

const onlineShoppingModal = document.getElementById('onlineShoppingModal');
const cancelOnlineShopping = document.getElementById('cancelOnlineShopping');
const onlineShoppingForm = document.getElementById('onlineShoppingForm');
const shoppingAmountInput = document.getElementById('shoppingAmount');
const shoppingCurrencyInput = document.getElementById('shoppingCurrency');
const productLinksInput = document.getElementById('productLinks');
const shoppingCategoryInput = document.getElementById('shoppingCategory'); // Category Input
const shoppingFeeDisplay = document.getElementById('shoppingFeeDisplay');
const shoppingTotalDisplay = document.getElementById('shoppingTotalDisplay');

const streamingPaymentModal = document.getElementById('streamingPaymentModal');
const cancelStreamingPayment = document.getElementById('cancelStreamingPayment');
const streamingPaymentForm = document.getElementById('streamingPaymentForm');
const streamingServiceInput = document.getElementById('streamingService');
const streamingAccountIdentifierInput = document.getElementById('streamingAccountIdentifier');
const streamingAmountInput = document.getElementById('streamingAmount');
const streamingCurrencyInput = document.getElementById('streamingCurrency');
const streamingCategoryInput = document.getElementById('streamingCategory'); // Category Input
const streamingFeeDisplay = document.getElementById('streamingFeeDisplay');
const streamingTotalDisplay = document.getElementById('streamingTotalDisplay');

// NEW: Game Recharge Modal elements
const gameRechargeModal = document.getElementById('gameRechargeModal');
const cancelGameRecharge = document.getElementById('cancelGameRecharge');
const gameRechargeForm = document.getElementById('gameRechargeForm');
const gameNameInput = document.getElementById('gameName');
const playerIdInput = document.getElementById('playerId');
const rechargeAmountInput = document.getElementById('rechargeAmount');
const rechargeCurrencyInput = document.getElementById('rechargeCurrency');
const gameRechargeCategoryInput = document.getElementById('gameRechargeCategory');
const gameRechargeFeeDisplay = document.getElementById('gameRechargeFeeDisplay');
const gameRechargeTotalDisplay = document.getElementById('gameRechargeTotalDisplay');

const userPendingRequestsModal = document.getElementById('userPendingRequestsModal');
const closeUserPendingRequestsModalBtn = document.getElementById('closeUserPendingRequestsModalBtn');
const userPendingRequestsTableBody = document.getElementById('userPendingRequestsTableBody');

const receiptModal = document.getElementById('receiptModal');
const receiptContent = document.getElementById('receiptContent');
const closeReceiptModalBtn = document.getElementById('closeReceiptModalBtn');

// Edit Profile Modal elements
const editProfileModal = document.getElementById('editProfileModal');
const cancelEditProfileBtn = document.getElementById('cancelEditProfileBtn');
const editProfileForm = document.getElementById('editProfileForm');
const editNameInput = document.getElementById('editName');
const editSurnameInput = document.getElementById('editSurname');
const editAgeInput = document.getElementById('editAge');
const editPhoneNumberInput = document.getElementById('editPhoneNumber'); // NEW: Phone Number Input

// Change Password Modal elements
const changePasswordModal = document.getElementById('changePasswordModal');
const cancelChangePasswordBtn = document.getElementById('cancelChangePasswordBtn');
const changePasswordForm = document.getElementById('changePasswordForm');
const currentPasswordInput = document.getElementById('currentPassword');
const newPasswordInput = document.getElementById('newPassword');
const confirmNewPasswordInput = document.getElementById('confirmNewPassword');

// Security Tips Modal elements
const securityTipsModal = document.getElementById('securityTipsModal');
const closeSecurityTipsBtn = document.getElementById('closeSecurityTipsBtn');

// About Us Modal elements
const aboutUsModal = document.getElementById('aboutUsModal');
const closeAboutUsBtn = document.getElementById('closeAboutUsBtn');

// Contact & Support Modal elements
const contactSupportModal = document.getElementById('contactSupportModal');
const closeContactSupportBtn = document.getElementById('closeContactSupportBtn');

// NEW: Open Savings Account Modal elements
const openSavingsAccountModal = document.getElementById('openSavingsAccountModal');
const cancelOpenSavingsAccountBtn = document.getElementById('cancelOpenSavingsAccountBtn');
const savingsAccountForm = document.getElementById('savingsAccountForm');
const savingsGoalInput = document.getElementById('savingsGoal');
const initialDepositAmountInput = document.getElementById('initialDepositAmount');
const initialDepositCurrencyInput = document.getElementById('initialDepositCurrency');
const preferredSavingsFrequencyInput = document.getElementById('preferredSavingsFrequency');
const periodicContributionAmountInput = document.getElementById('periodicContributionAmount'); // NEW: Periodic Contribution Amount
const savingsEndDateInput = document.getElementById('savingsEndDate'); // NEW: End Date Input

// NEW: View Savings Accounts Modal elements
const viewSavingsAccountsModal = document.getElementById('viewSavingsAccountsModal');
const closeViewSavingsAccountsBtn = document.getElementById('closeViewSavingsAccountsBtn');
const savingsAccountsTableBody = document.getElementById('savingsAccountsTableBody');

// NEW: Edit Announcements Modal elements
const editAnnouncementsModal = document.getElementById('editAnnouncementsModal');
const cancelEditAnnouncementsBtn = document.getElementById('cancelEditAnnouncementsBtn');
const editAnnouncementsForm = document.getElementById('editAnnouncementsForm');
const announcementsTextarea = document.getElementById('announcementsTextarea');
const announcementsList = document.getElementById('announcementsList'); // Reference to the UL in dashboard

// NEW: Deposit/Withdraw from Savings Modals
const depositToSavingsModal = document.getElementById('depositToSavingsModal');
const cancelDepositToSavingsBtn = document.getElementById('cancelDepositToSavingsBtn');
const depositToSavingsForm = document.getElementById('depositToSavingsForm');
const depositToSavingsAccountIdDisplay = document.getElementById('depositToSavingsAccountIdDisplay');
const depositToSavingsAmountInput = document.getElementById('depositToSavingsAmount');
const depositToSavingsCurrencyInput = document.getElementById('depositToSavingsCurrency');

const withdrawFromSavingsModal = document.getElementById('withdrawFromSavingsModal');
const cancelWithdrawFromSavingsBtn = document.getElementById('cancelWithdrawFromSavingsBtn');
const withdrawFromSavingsForm = document.getElementById('withdrawFromSavingsForm');
const withdrawFromSavingsAccountIdDisplay = document.getElementById('withdrawFromSavingsAccountIdDisplay');
const withdrawFromSavingsAmountInput = document.getElementById('withdrawFromSavingsAmount');
const withdrawFromSavingsCurrencyInput = document.getElementById('withdrawFromSavingsCurrency');

// NEW: Confirm Delete Savings Account Modal
const confirmDeleteSavingsAccountModal = document.getElementById('confirmDeleteSavingsAccountModal');
const cancelDeleteSavingsAccountBtn = document.getElementById('cancelDeleteSavingsAccountBtn');
const cancelDeleteSavingsAccountBtn2 = document.getElementById('cancelDeleteSavingsAccountBtn2'); // Second cancel button
const confirmDeleteSavingsAccountBtn = document.getElementById('confirmDeleteSavingsAccountBtn');
const deleteSavingsAccountGoalDisplay = document.getElementById('deleteSavingsAccountGoalDisplay');
const deleteSavingsAccountFeeDisplay = document.getElementById('deleteSavingsAccountFeeDisplay');
const deleteSavingsAccountRemainingDisplay = document.getElementById('deleteSavingsAccountRemainingDisplay');

// Variables to store data for savings account operations
let currentSavingsAccountId = null;
let currentSavingsAccountBalanceUSD = 0;
let currentSavingsAccountGoal = '';

// Variable to hold the unsubscribe function for admin pending requests listener
let adminPendingRequestsUnsubscribe = null;
let adminSavingsDebtsUnsubscribe = null; // New unsubscribe for admin savings debts
let savingsDebtsUnsubscribe = null; // New unsubscribe for client savings debts

// NEW: Savings Debts Modal (Client)
const savingsDebtsModal = document.getElementById('savingsDebtsModal');
const closeSavingsDebtsModalBtn = document.getElementById('closeSavingsDebtsModalBtn');
const savingsDebtsTableBody = document.getElementById('savingsDebtsTableBody');

// NEW: Admin Savings Debts Modal
const adminSavingsDebtsModal = document.getElementById('adminSavingsDebtsModal');
const closeAdminSavingsDebtsModalBtn = document.getElementById('closeAdminSavingsDebtsModalBtn');
const adminSavingsDebtsTableBody = document.getElementById('adminSavingsDebtsTableBody');


// --- Utility Functions ---

/**
 * Adds days to a given date.
 * @param {Date} date The starting date.
 * @param {number} days The number of days to add.
 * @returns {Date} The new date.
 */
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(date.getDate() + days);
    return result;
}

/**
 * Adds weeks to a given date.
 * @param {Date} date The starting date.
 * @param {number} weeks The number of weeks to add.
 * @returns {Date} The new date.
 */
function addWeeks(date, weeks) {
    return addDays(date, weeks * 7);
}

/**
 * Adds months to a given date.
 * @param {Date} date The starting date.
 * @param {number} months The number of months to add.
 * @returns {Date} The new date.
 */
function addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}

/**
 * Formats a Date object to 'YYYY-MM-DD'.
 * @param {Date} date The date object.
 * @returns {string} Formatted date string.
 */
function formatDateToYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Displays a message in the UI message box.
 * @param {string} msg The message to display.
 * @param {string} type The type of message (success, error, info).
 */
function showMessage(msg, type = 'info') {
    messageText.textContent = msg;
    messageBox.classList.remove('hidden', 'bg-red-100', 'text-red-800', 'bg-green-100', 'text-green-800', 'bg-blue-100', 'text-blue-800');
    messageBox.classList.add('block');

    if (type === 'error') {
        messageBox.classList.add('bg-red-100', 'text-red-800');
    } else if (type === 'success') {
        messageBox.classList.add('bg-green-100', 'text-green-800');
    } else {
        messageBox.classList.add('bg-blue-100', 'text-blue-800');
    }
}

/**
 * Hides the UI message box.
 */
function hideMessage() {
    messageBox.classList.add('hidden');
}

/**
 * Displays a transaction status message.
 * @param {string} msg The message to display.
 */
function showTransactionStatus(msg) {
    transactionStatusText.textContent = msg;
    transactionStatusMsg.classList.remove('hidden');
    // Show cancel button only if it's an actual transfer in progress
    cancelOngoingTransferBtn.classList.remove('hidden');
}

/**
 * Hides the transaction status message.
 */
function hideTransactionStatus() {
    transactionStatusMsg.classList.add('hidden');
    cancelOngoingTransferBtn.classList.add('hidden');
}

/**
 * Shows a receipt modal with transaction details.
 * @param {Object} transaction The transaction object from Firestore.
 */
async function showReceipt(transaction) {
    let content = `<p class="font-bold text-lg mb-2">Recibo de Transacción</p>`;
    content += `<p><strong>Fecha:</strong> ${new Date(transaction.timestamp.seconds * 1000).toLocaleString()}</p>`;
    content += `<p><strong>ID de Transacción:</strong> ${transaction.id}</p>`; // Use transaction ID

    let typeDisplay = '';
    let amountDisplay = '';
    let currencyDisplay = '';
    let feeDisplay = '';
    let otherDetails = '';

    // Fetch sender/recipient names for transfers
    if (transaction.type === 'transfer') {
        const senderName = await getUserDisplayName(transaction.senderId);
        const recipientName = await getUserDisplayName(transaction.recipientId);
        typeDisplay = 'Transferencia';
        amountDisplay = (transaction.amount ?? 0).toFixed(2);
        currencyDisplay = transaction.currency;
        otherDetails += `<p><strong>Remitente:</strong> ${senderName}</p>`;
        otherDetails += `<p><strong>Destinatario:</strong> ${recipientName}</p>`;
    } else if (transaction.type === 'deposit') {
        typeDisplay = 'Depósito';
        amountDisplay = (transaction.amount ?? 0).toFixed(2);
        currencyDisplay = transaction.currency;
        otherDetails += `<p><strong>Número de Serie:</strong> ${transaction.serialNumber || 'N/A'}</p>`;
    } else if (transaction.type === 'withdrawal') {
        typeDisplay = 'Retiro';
        amountDisplay = (transaction.amount ?? 0).toFixed(2);
        currencyDisplay = transaction.currency;
        feeDisplay = `Tarifa (4%): $${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
    } else if (transaction.type === 'online_purchase') {
        typeDisplay = 'Compra Online';
        amountDisplay = (transaction.totalAmountDeducted ?? 0).toFixed(2);
        currencyDisplay = 'USD';
        feeDisplay = `Tarifa (3%): $${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
        otherDetails += `<p><strong>Monto Productos:</strong> ${(transaction.productAmount ?? 0).toFixed(2)} ${transaction.productCurrency}</p>`;
        if (transaction.productLinks) {
            otherDetails += `<p><strong>Enlaces de Productos:</strong></p>`;
            transaction.productLinks.split('\n').forEach(link => {
                if (link.trim()) {
                    otherDetails += `<p class="ml-4 text-xs break-all"><a href="${link.trim()}" target="_blank" class="text-blue-500 hover:underline">${link.trim()}</a></p>`;
                }
            });
        }
        if (transaction.category) {
            otherDetails += `<p><strong>Categoría:</strong> ${transaction.category}</p>`;
        }
    } else if (transaction.type === 'streaming_payment') {
        typeDisplay = 'Pago de Streaming';
        amountDisplay = (transaction.totalAmountDeducted ?? 0).toFixed(2);
        currencyDisplay = 'USD';
        feeDisplay = `Tarifa (3%): $${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
        otherDetails += `<p><strong>Servicio:</strong> ${transaction.service || 'N/A'}</p>`;
        otherDetails += `<p><strong>Cuenta:</strong> ${transaction.accountIdentifier || 'N/A'}</p>`;
        otherDetails += `<p><strong>Monto Suscripción:</strong> ${(transaction.subscriptionAmount ?? 0).toFixed(2)} ${transaction.subscriptionCurrency}</p>`;
        if (transaction.category) {
            otherDetails += `<p><strong>Categoría:</strong> ${transaction.category}</p>`;
        }
    } else if (transaction.type === 'game_recharge') { // NEW: Game Recharge Receipt
        typeDisplay = 'Recarga de Juego';
        amountDisplay = (transaction.totalAmountDeducted ?? 0).toFixed(2);
        currencyDisplay = 'USD';
        feeDisplay = `Tarifa (3%): $${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
        otherDetails += `<p><strong>Juego:</strong> ${transaction.gameName || 'N/A'}</p>`;
        otherDetails += `<p><strong>ID de Jugador:</strong> ${transaction.playerId || 'N/A'}</p>`;
        otherDetails += `<p><strong>Monto Recarga:</strong> ${(transaction.rechargeAmount ?? 0).toFixed(2)} ${transaction.rechargeCurrency}</p>`;
        if (transaction.category) {
            otherDetails += `<p><strong>Tipo de Recarga:</strong> ${transaction.category}</p>`;
        }
    }
    else if (transaction.type === 'withdrawal_fee') {
        typeDisplay = 'Tarifa de Retiro Cobrada';
        amountDisplay = (transaction.amount ?? 0).toFixed(2);
        currencyDisplay = transaction.currency;
        const payerName = await getUserDisplayName(transaction.payerId);
        const receiverName = await getUserDisplayName(transaction.receiverId);
        otherDetails += `<p><strong>Pagado por:</strong> ${payerName}</p>`;
        otherDetails += `<p><strong>Recibido por:</strong> ${receiverName}</p>`;
        otherDetails += `<p><strong>Relacionado con Solicitud ID:</strong> ${transaction.originalRequestId || 'N/A'}</p>`;
    } else if (transaction.type === 'savings_account_open') {
        typeDisplay = 'Apertura de Cuenta de Ahorro';
        amountDisplay = (transaction.initialDepositAmount ?? 0).toFixed(2);
        currencyDisplay = transaction.initialDepositCurrency;
        otherDetails += `<p><strong>Objetivo de Ahorro:</strong> ${transaction.savingsGoal || 'N/A'}</p>`;
        otherDetails += `<p><strong>Frecuencia Preferida:</strong> ${transaction.preferredSavingsFrequency || 'N/A'}</p>`;
        otherDetails += `<p><strong>Cuota Periódica:</strong> $${(transaction.periodicContributionAmount ?? 0).toFixed(2)} USD</p>`;
        otherDetails += `<p><strong>Fecha Inicio:</strong> ${transaction.startDate ? new Date(transaction.startDate.seconds * 1000).toLocaleDateString() : 'N/A'}</p>`;
        otherDetails += `<p><strong>Fecha Fin:</strong> ${transaction.endDate || 'N/A'}</p>`;
        otherDetails += `<p><strong>ID de Cuenta de Ahorro:</strong> ${transaction.savingsAccountId || 'N/A'}</p>`;
    } else if (transaction.type === 'deposit_to_savings') {
        typeDisplay = 'Depósito a Ahorro';
        amountDisplay = (transaction.amount ?? 0).toFixed(2);
        currencyDisplay = transaction.currency;
        otherDetails += `<p><strong>ID Cuenta Ahorro:</strong> ${transaction.savingsAccountId || 'N/A'}</p>`;
        otherDetails += `<p><strong>Objetivo:</strong> ${transaction.savingsGoal || 'N/A'}</p>`;
    } else if (transaction.type === 'withdraw_from_savings') {
        typeDisplay = 'Retiro de Ahorro';
        amountDisplay = (transaction.amount ?? 0).toFixed(2);
        currencyDisplay = transaction.currency;
        otherDetails += `<p><strong>ID Cuenta Ahorro:</strong> ${transaction.savingsAccountId || 'N/A'}</p>`;
        otherDetails += `<p><strong>Objetivo:</strong> ${transaction.savingsGoal || 'N/A'}</p>`;
    } else if (transaction.type === 'delete_savings_account') {
        typeDisplay = 'Eliminación Cuenta Ahorro';
        amountDisplay = (transaction.remainingBalanceTransferred ?? 0).toFixed(2);
        currencyDisplay = 'USD'; // Remaining balance is always in USD
        feeDisplay = `Tarifa (2%): $${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
        otherDetails += `<p><strong>Objetivo de Cuenta Eliminada:</strong> ${transaction.savingsGoal || 'N/A'}</p>`;
        otherDetails += `<p><strong>ID Cuenta Eliminada:</strong> ${transaction.savingsAccountId || 'N/A'}</p>`;
    } else if (transaction.type === 'automatic_savings_collection') {
        typeDisplay = 'Cobro Automático de Ahorro';
        amountDisplay = (transaction.amount ?? 0).toFixed(2);
        currencyDisplay = transaction.currency;
        otherDetails += `<p><strong>ID Cuenta Ahorro:</strong> ${transaction.savingsAccountId || 'N/A'}</p>`;
        otherDetails += `<p><strong>Objetivo:</strong> ${transaction.savingsGoal || 'N/A'}</p>`;
    } else if (transaction.type === 'savings_debt_payment') {
        typeDisplay = 'Pago de Deuda de Ahorro';
        amountDisplay = (transaction.amount ?? 0).toFixed(2);
        currencyDisplay = transaction.currency;
        otherDetails += `<p><strong>ID Cuenta Ahorro:</strong> ${transaction.savingsAccountId || 'N/A'}</p>`;
        otherDetails += `<p><strong>Objetivo:</strong> ${transaction.savingsGoal || 'N/A'}</p>`;
        otherDetails += `<p><strong>ID Deuda:</strong> ${transaction.debtId || 'N/A'}</p>`;
    } else if (transaction.type === 'savings_indemnization_applied') {
        typeDisplay = 'Indemnización de Ahorro Aplicada';
        amountDisplay = (transaction.amount ?? 0).toFixed(2);
        currencyDisplay = transaction.currency;
        const payerName = await getUserDisplayName(transaction.payerId);
        const receiverName = await getUserDisplayName(transaction.receiverId);
        otherDetails += `<p><strong>Pagado por:</strong> ${payerName}</p>`;
        otherDetails += `<p><strong>Recibido por:</strong> ${receiverName}</p>`;
        otherDetails += `<p><strong>ID Deuda:</strong> ${transaction.debtId || 'N/A'}</p>`;
    }


    content += `<p><strong>Tipo:</strong> ${typeDisplay}</p>`;
    content += `<p><strong>Monto:</strong> ${amountDisplay} ${currencyDisplay}</p>`;
    if (feeDisplay) {
        content += `<p><strong>${feeDisplay}</strong></p>`;
    }
    if (otherDetails) {
        content += otherDetails;
    }
    content += `<p class="mt-4 font-bold">¡Gracias por usar Banco Juvenil!</p>`;

    receiptContent.innerHTML = content;
    receiptModal.classList.remove('hidden');
}

/**
 * Toggles visibility between sections.
 * @param {HTMLElement} showElement Element to show.
 * @param {HTMLElement} ...hideElements List of elements to hide.
 */
function showSection(showElement, ...hideElements) {
    showElement.classList.remove('hidden');
    hideElements.forEach(el => el.classList.add('hidden'));
}

/**
 * Toggles the active state of login/register tabs.
 * @param {string} activeTabId 'login' or 'register'.
 */
function toggleTabs(activeTabId) {
    if (activeTabId === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        // Hide all main sections and modals
        showSection(loginSection, registerSection, dashboardSection, rulesConsentModal, userHistoryModal, adminFullHistoryModal, adminPendingRequestsModal, faqModal, onlineShoppingModal, streamingPaymentModal, gameRechargeModal, userPendingRequestsModal, receiptModal, editProfileModal, changePasswordModal, securityTipsModal, aboutUsModal, contactSupportModal, openSavingsAccountModal, viewSavingsAccountsModal, editAnnouncementsModal, depositToSavingsModal, withdrawFromSavingsModal, confirmDeleteSavingsAccountModal, savingsDebtsModal, adminSavingsDebtsModal);
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        // Hide all main sections and modals
        showSection(registerSection, loginSection, dashboardSection, rulesConsentModal, userHistoryModal, adminFullHistoryModal, adminPendingRequestsModal, faqModal, onlineShoppingModal, streamingPaymentModal, gameRechargeModal, userPendingRequestsModal, receiptModal, editProfileModal, changePasswordModal, securityTipsModal, aboutUsModal, contactSupportModal, openSavingsAccountModal, viewSavingsAccountsModal, editAnnouncementsModal, depositToSavingsModal, withdrawFromSavingsModal, confirmDeleteSavingsAccountModal, savingsDebtsModal, adminSavingsDebtsModal);
    }
    hideMessage(); // Hide any previous messages when changing tabs
}

/**
 * Closes any open modal.
 */
function closeModal(modalElement) {
    modalElement.classList.add('hidden');
}

/**
 * Generates a simple, readable ID for display purposes.
 * @param {string} name User's first name.
 * @param {string} surname User's last name.
 * @returns {string} A user-friendly display ID.
 */
function generateUserDisplayId(name, surname) {
    const initials = `${name.substring(0, 1).toUpperCase()}${surname.substring(0, 1).toUpperCase()}`;
    const randomNumber = Math.floor(1000 + Math.random() * 9000); // 4-digit number
    return `${initials}#${randomNumber}`;
}

/**
 * Fetches a user's display name from cache or Firestore.
 * @param {string} userId The Firebase UID of the user.
 * @returns {Promise<string>} The user's display name (Name Surname (ID#ABCD)) or a truncated ID.
 */
async function getUserDisplayName(userId) {
    // Check if userId matches the Firebase UID of the admin email
    const adminQuery = query(collection(db, 'artifacts', appId, 'users'), where('email', '==', ADMIN_EMAIL));
    const adminSnapshot = await getDocs(adminQuery);
    if (!adminSnapshot.empty && adminSnapshot.docs[0].id === userId) {
        return "Administrador";
    }

    if (userDisplayNamesCache[userId]) {
        return userDisplayNamesCache[userId];
    }
    try {
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const displayName = `${userData.name} ${userData.surname} (${userData.userDisplayId || userData.userId.substring(0, 5) + '...'})`;
            userDisplayNamesCache[userId] = displayName;
            return displayName;
        }
    } catch (error) {
        console.error("Error fetching user display name:", error);
    }
    return `ID: ${userId.substring(0, 5)}...`; // Fallback to truncated Firebase UID
}

/**
 * Fetches a user's phone number from cache or Firestore.
 * @param {string} userId The Firebase UID of the user.
 * @returns {Promise<string|null>} The user's phone number or null if not found.
 */
async function getUserPhoneNumber(userId) {
    if (userPhoneNumbersCache[userId]) {
        return userPhoneNumbersCache[userId];
    }
    try {
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const phoneNumber = userData.phoneNumber || null;
            userPhoneNumbersCache[userId] = phoneNumber;
            return phoneNumber;
        }
    } catch (error) {
        console.error("Error fetching user phone number:", error);
    }
    return null;
}


// --- Firebase Authentication & Firestore Operations ---

/**
 * Handles new user registration form submission (initiates rules consent).
 * @param {Event} e Form submission event.
 */
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const name = registerNameInput.value.trim();
    const surname = registerSurnameInput.value.trim();
    const age = parseInt(registerAgeInput.value);
    const phoneNumber = registerPhoneNumberInput.value.trim(); // Get phone number
    const password = registerPasswordInput.value;

    if (!name || !surname || !password || isNaN(age) || age <= 0 || !phoneNumber) {
        showMessage('Por favor, completa todos los campos correctamente.', 'error');
        return;
    }

    // Store data temporarily for use after rules consent
    tempRegisterData = { name, surname, age, phoneNumber, password };

    // Show rules consent modal
    briefRulesTextContainer.innerHTML = briefRulesText;
    rulesConsentModal.classList.remove('hidden');
});

/**
 * Performs the actual user registration after rules consent.
 * @param {string} name User's name.
 * @param {string} surname User's surname.
 * @param {number} age User's age.
 * @param {string} phoneNumber User's phone number.
 * @param {string} password User's password.
 */
async function performRegistration(name, surname, age, phoneNumber, password) {
    // Generate email for Firebase Auth (internal use primarily)
    const generatedEmail = `${name.toLowerCase().replace(/\s/g, '')}.${surname.toLowerCase().replace(/\s/g, '')}@${appId}.com`;
    // Generate a simple, user-friendly ID for display
    const userDisplayId = generateUserDisplayId(name, surname);

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, generatedEmail, password);
        const user = userCredential.user;
        const userId = user.uid; // Firebase UID

        await setDoc(doc(db, 'artifacts', appId, 'users', userId), {
            userId: userId, // Internal Firebase UID
            userDisplayId: userDisplayId, // User-friendly display ID
            name: name,
            surname: surname,
            age: age,
            phoneNumber: phoneNumber, // Store phone number
            email: generatedEmail, // Primary login email
            balanceUSD: 0,
            balanceDOP: 0,
            currencyPreference: 'USD',
            hasPendingDeposit: false, // Keep this for specific deposit blocking
            createdAt: serverTimestamp()
        });

        showMessage(`¡Registro exitoso, ${name}! Tu ID de usuario para iniciar sesión es: ${generatedEmail}. Tu ID público es: ${userDisplayId}. Por favor, anótalo.`, 'success');
        loginIdentifierInput.value = generatedEmail; // Pre-fill login field with generated email
        loginPassword.value = password; // Pre-fill password
        // No explicit toggleTabs('login') here, as onAuthStateChanged handles showing dashboard
        // if login is successful after registration automatically.

    } catch (error) {
        console.error("Error during registration:", error);
        let errorMessage = 'Error al registrar. Por favor, inténtalo de nuevo.';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = `Ya existe una cuenta con este nombre y apellido (o email ${generatedEmail}). Prueba a iniciar sesión o usa otro nombre/apellido.`;
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Error en el formato del email generado. Contacta soporte.';
        } else if (error.code === 'auth/configuration-not-found') {
            errorMessage = 'Error de configuración de autenticación. Asegúrate de que "Email/Password" esté habilitado en Firebase Auth.';
        }
        showMessage(errorMessage, 'error');
    } finally {
        tempRegisterData = {}; // Clear temporary data regardless of outcome
    }
}


/**
 * Handles user login, accepting email or Firebase UID.
 * @param {Event} e Form submission event.
 */
async function handleLogin(e) {
    e.preventDefault();
    hideMessage();
    const identifier = loginIdentifierInput.value.trim(); // Can be email, userDisplayId, or Firebase UID
    const password = loginPassword.value;
    let emailToLogin = identifier;

    if (!identifier || !password) {
        showMessage('Por favor, ingresa tu ID de usuario y contraseña.', 'error');
        return;
    }

    try {
        // If the identifier does not look like an email, try to find the email by userDisplayId or Firebase UID
        if (!identifier.includes('@')) {
            const usersCollectionRef = collection(db, 'artifacts', appId, 'users');
            let querySnapshot;

            // 1. Try to find by userDisplayId (preferred for user-friendliness)
            let q = query(usersCollectionRef, where('userDisplayId', '==', identifier));
            querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                // 2. If not found by userDisplayId, try to find by Firebase UID
                q = query(usersCollectionRef, where('userId', '==', identifier));
                querySnapshot = await getDocs(q);
            }

            if (querySnapshot.empty) {
                showMessage('ID de usuario o contraseña incorrectos.', 'error');
                return;
            }
            // Found user, get their associated email for Firebase Auth
            emailToLogin = querySnapshot.docs[0].data().email;
            if (!emailToLogin) {
                showMessage('No se pudo encontrar el email asociado a este ID de usuario.', 'error');
                return;
            }
        }

        // Attempt to sign in with the determined email and password
        await signInWithEmailAndPassword(auth, emailToLogin, password);
        // The onAuthStateChanged listener will handle UI update if login is successful

    } catch (error) {
        console.error("Error during login:", error);
        let errorMessage = 'Error al iniciar sesión. Verifica tu ID de usuario y contraseña.';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = 'ID de usuario o contraseña incorrectos.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'El formato del ID de usuario (email) es inválido.';
        } else if (error.code === 'auth/configuration-not-found') {
            errorMessage = 'Error de configuración de autenticación. Asegúrate de que "Email/Password" esté habilitado en Firebase Auth.';
        }
        showMessage(errorMessage, 'error');
    }
}

/**
 * Handles user logout.
 */
async function handleLogout() {
    try {
        await signOut(auth);
        // The onAuthStateChanged listener will handle UI update
    } catch (error) {
        console.error("Error during logout:", error);
        showMessage('Error al cerrar sesión. Por favor, inténtalo de nuevo.', 'error');
    }
}

/**
 * Updates the balance display in the UI.
 */
function updateBalanceDisplay() {
    if (showCurrencyUSD) {
        accountBalance.textContent = `$${currentBalanceUSD.toFixed(2)} USD`;
        toggleCurrencyBtn.textContent = 'Cambiar a DOP';
    } else {
        accountBalance.textContent = `RD$${currentBalanceDOP.toFixed(2)} DOP`;
        toggleCurrencyBtn.textContent = 'Cambiar a USD';
    }
}

/**
 * Handles toggling currency display in the dashboard.
 */
function toggleCurrencyDisplay() {
    showCurrencyUSD = !showCurrencyUSD;
    updateBalanceDisplay();
}

/**
 * Listens for authentication state changes to update the UI.
 */
onAuthStateChanged(auth, async (user) => {
    hideMessage(); // Clear any messages
    hideTransactionStatus(); // Clear any transaction status messages

    if (user) {
        // User is signed in
        currentUser = user;
        currentUserId = user.uid;

        // Listen for real-time updates to the user's profile in Firestore
        // Path: artifacts/{appId}/users/{userId}
        const userProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        onSnapshot(userProfileRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                dashboardUserName.textContent = userData.name || 'Usuario';
                // Display the user-friendly ID, fallback to Firebase UID if not set
                dashboardDisplayId.textContent = userData.userDisplayId || userData.userId;
                profileAvatar.textContent = (userData.name ? userData.name.substring(0,1) : 'U').toUpperCase(); // Set avatar initial

                currentBalanceUSD = userData.balanceUSD || 0;
                currentBalanceDOP = userData.balanceDOP || 0;
                updateBalanceDisplay();

                // Check for pending deposits and disable deposit button if necessary
                if (userData.hasPendingDeposit) {
                    depositMoneyBtn.disabled = true;
                    depositMoneyBtn.textContent = 'Depósito Pendiente...';
                    showMessage('Tienes un depósito pendiente de aprobación. No puedes hacer otro depósito hasta que se confirme el actual.', 'info');
                } else {
                    depositMoneyBtn.disabled = false;
                    depositMoneyBtn.textContent = 'Depositar Dinero';
                }

                // Show admin specific buttons if current user is admin
                if (currentUser.email === ADMIN_EMAIL) {
                    adminButtonsContainer.classList.remove('hidden'); // Show container for admin buttons
                } else {
                    adminButtonsContainer.classList.add('hidden'); // Hide for non-admin
                }

            } else {
                console.warn("User profile not found in Firestore for UID:", currentUserId);
                // If user profile doesn't exist, sign out
                handleLogout();
            }
        }, (error) => {
            console.error("Error listening to user profile:", error);
            showMessage("Error al cargar los datos de tu perfil. Intenta recargar la página.", 'error');
        });

        // Load announcements when user logs in
        loadAnnouncements();

        // Display dashboard and hide login/register forms and all modals
        showSection(dashboardSection, loginSection, registerSection, rulesConsentModal, userHistoryModal, adminFullHistoryModal, adminPendingRequestsModal, faqModal, onlineShoppingModal, streamingPaymentModal, gameRechargeModal, userPendingRequestsModal, receiptModal, editProfileModal, changePasswordModal, securityTipsModal, aboutUsModal, contactSupportModal, openSavingsAccountModal, viewSavingsAccountsModal, editAnnouncementsModal, depositToSavingsModal, withdrawFromSavingsModal, confirmDeleteSavingsAccountModal, savingsDebtsModal, adminSavingsDebtsModal);

    } else {
        // User is signed out
        currentUser = null;
        currentUserId = null;
        dashboardUserName.textContent = '';
        dashboardDisplayId.textContent = ''; // Clear display ID
        profileAvatar.textContent = 'U'; // Reset avatar
        accountBalance.textContent = '$0.00 USD';
        toggleCurrencyBtn.textContent = 'Cambiar a DOP';
        showCurrencyUSD = true; // Reset currency display preference
        toggleTabs('login'); // Go back to login tab
    }
});


// --- Transfer Money Functionality ---

/**
 * Shows the transfer money modal and resets its state.
 */
transferMoneyBtn.addEventListener('click', () => {
    transferModal.classList.remove('hidden');
    transferForm.reset();
    recipientNameDisplay.textContent = ''; // Clear previous recipient name
    confirmTransferBtn.disabled = true; // Disable confirm button initially
});

/**
 * Closes the transfer money modal.
 */
cancelTransferModalBtn.addEventListener('click', () => {
    closeModal(transferModal);
    transferForm.reset();
    recipientNameDisplay.textContent = '';
    confirmTransferBtn.disabled = true;
});

// Event listener for recipient ID input to fetch name
transferRecipientIdInput.addEventListener('input', async () => {
    const identifier = transferRecipientIdInput.value.trim();
    recipientNameDisplay.textContent = 'Buscando usuario...';
    confirmTransferBtn.disabled = true;
    currentTransferRecipientUid = null; // Reset UID on new input

    if (!identifier) {
        recipientNameDisplay.textContent = '';
        return;
    }

    let recipientData = null;
    let querySnapshot;

    // 1. Try to find by email
    if (identifier.includes('@')) {
        const q = query(collection(db, 'artifacts', appId, 'users'), where('email', '==', identifier));
        querySnapshot = await getDocs(q);
    } else {
        // 2. If not email, try to find by userDisplayId
        const q = query(collection(db, 'artifacts', appId, 'users'), where('userDisplayId', '==', identifier));
        querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            // 3. Finally, try to find by Firebase UID
            const q2 = query(collection(db, 'artifacts', appId, 'users'), where('userId', '==', identifier));
            querySnapshot = await getDocs(q2);
        }
    }

    if (!querySnapshot.empty) {
        recipientData = querySnapshot.docs[0].data();
        // Store the actual Firebase UID for transaction
        currentTransferRecipientUid = recipientData.userId;
        // Store the identifier the user typed for messaging
        currentTransferRecipientIdentifier = identifier;
        currentTransferRecipientDisplayName = `${recipientData.name} ${recipientData.surname}`;
        recipientNameDisplay.textContent = `Usuario: ${currentTransferRecipientDisplayName}`;
        confirmTransferBtn.disabled = false;

        // Prevent self-transfer
        if (currentTransferRecipientUid === currentUserId) {
            recipientNameDisplay.textContent = '¡No puedes transferir dinero a tu propia cuenta!';
            confirmTransferBtn.disabled = true;
            currentTransferRecipientUid = null; // Invalidate recipient
        }
    } else {
        recipientNameDisplay.textContent = 'Usuario no encontrado.';
        confirmTransferBtn.disabled = true;
        currentTransferRecipientUid = null;
        currentTransferRecipientDisplayName = '';
    }
});


/**
 * Handles transfer form submission.
 * In a real environment, this SHOULD BE A FIREBASE CLOUD FUNCTION for security.
 */
transferForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    hideTransactionStatus();

    if (!currentTransferRecipientUid) {
        showMessage('Por favor, selecciona un destinatario válido.', 'error');
        return;
    }

    currentTransferAmount = parseFloat(transferAmount.value);
    currentTransferCurrency = transferCurrency.value;

    if (currentTransferAmount <= 0 || isNaN(currentTransferAmount)) {
        showMessage('El monto a transferir debe ser un número positivo.', 'error');
        return;
    }

    // Check sender's balance (currentBalanceUSD and currentBalanceDOP are already updated by onSnapshot)
    let senderBalance = currentTransferCurrency === 'USD' ? currentBalanceUSD : currentBalanceDOP;
    if (currentTransferAmount > senderBalance) {
        showMessage('Saldo insuficiente para realizar esta transferencia.', 'error');
        closeModal(transferModal); // Close modal on error
        return;
    }

    showMessage(`Iniciando transferencia de ${currentTransferAmount.toFixed(2)} ${currentTransferCurrency} a ${currentTransferRecipientDisplayName}... Por favor, espera 10 segundos.`, 'info');
    closeModal(transferModal); // Close the modal immediately
    showTransactionStatus(`Transferencia a ${currentTransferRecipientDisplayName} en proceso... (10 segundos restantes)`);
    transferForm.reset(); // Reset form fields
    recipientNameDisplay.textContent = ''; // Clear recipient name display
    confirmTransferBtn.disabled = true; // Disable button after submission

    // --- SIMULACIÓN DE 10 SEGUNDOS DE ESPERA ---
    let countdown = 10; // 10 seconds
    cancelOngoingTransferBtn.classList.remove('hidden'); // Show cancel button for ongoing transfer

    transferInterval = setInterval(() => {
        countdown--;
        if (countdown >= 0) {
            transactionStatusText.textContent = `Transferencia a ${currentTransferRecipientDisplayName} en proceso... (${countdown} segundos restantes)`;
        }

        if (countdown <= 0) {
            clearInterval(transferInterval);
            transferInterval = null; // Clear interval ID
            hideTransactionStatus(); // Hide status message
            performTransfer(currentUserId, currentTransferRecipientUid, currentTransferAmount, currentTransferCurrency, currentTransferRecipientDisplayName);
        }
    }, 1000); // Update every second
});

// Cancel Ongoing Transfer button handler
cancelOngoingTransferBtn.addEventListener('click', () => {
    if (transferInterval) {
        clearInterval(transferInterval);
        transferInterval = null; // Clear interval ID
        hideTransactionStatus();
        showMessage('Transferencia cancelada.', 'info');
        // Reset any state related to the transfer
        currentTransferRecipientUid = null;
        currentTransferAmount = 0;
        currentTransferCurrency = '';
        currentTransferRecipientIdentifier = '';
        currentTransferRecipientDisplayName = '';
    }
});


/**
 * Executes the actual transfer logic after the delay.
 * In a real environment, this SHOULD BE A FIREBASE CLOUD FUNCTION for security.
 * @param {string} senderUid Firebase UID of the sender.
 * @param {string} actualRecipientUid Firebase UID of the recipient.
 * @param {number} amount Amount to transfer.
 * @param {string} currency Currency of the transfer (USD/DOP).
 * @param {string} recipientDisplayName The name displayed to the user for the recipient.
 */
async function performTransfer(senderUid, actualRecipientUid, amount, currency, recipientDisplayName) {
    try {
        const senderProfileRef = doc(db, 'artifacts', appId, 'users', senderUid);
        const recipientProfileRef = doc(db, 'artifacts', appId, 'users', actualRecipientUid);

        // Get current balances for transaction (ideally this entire block would be atomic in Cloud Function)
        const senderSnap = await getDoc(senderProfileRef);
        const recipientSnap = await getDoc(recipientProfileRef);

        if (!senderSnap.exists() || !recipientSnap.exists()) {
            showMessage('Error: No se encontraron los perfiles de remitente o destinatario para completar la transferencia.', 'error');
            return; // Do not proceed with transfer if profiles not found
        }

        const senderData = senderSnap.data();
        const recipientData = recipientSnap.data();

        let senderCurrentBalanceUSD = senderData.balanceUSD || 0;
        let senderCurrentBalanceDOP = senderData.balanceDOP || 0;
        let recipientCurrentBalanceUSD = recipientData.balanceUSD || 0;
        let recipientCurrentBalanceDOP = recipientData.balanceDOP || 0;

        // Convert amount to USD for internal calculation if currency is DOP
        let amountInUSD = amount;
        if (currency === 'DOP') {
            amountInUSD = amount / USD_TO_DOP_RATE;
        }

        // Double check sender's balance
        if (senderCurrentBalanceUSD < amountInUSD) {
            showMessage('Error: Saldo insuficiente para completar la transferencia (posiblemente ya gastado o error de concurrencia).', 'error');
            return;
        }

        // Update sender's balance
        senderCurrentBalanceUSD -= amountInUSD;
        senderCurrentBalanceDOP = senderCurrentBalanceUSD * USD_TO_DOP_RATE;

        // Update recipient's balance
        recipientCurrentBalanceUSD += amountInUSD;
        recipientCurrentBalanceDOP = recipientCurrentBalanceUSD * USD_TO_DOP_RATE;

        // Perform updates in Firestore
        await updateDoc(senderProfileRef, {
            balanceUSD: senderCurrentBalanceUSD,
            balanceDOP: senderCurrentBalanceDOP
        });

        await updateDoc(recipientProfileRef, {
            balanceUSD: recipientCurrentBalanceUSD,
            balanceDOP: recipientCurrentBalanceDOP
        });

        // Record the transaction in a public collection
        // Path: artifacts/{appId}/public/data/transactions
        const newTransactionRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            senderId: senderUid,
            recipientId: actualRecipientUid,
            amount: amount,
            currency: currency,
            timestamp: serverTimestamp(),
            type: 'transfer',
            status: 'completed',
            description: `Transferencia a ${recipientDisplayName}`
        });

        showMessage(`Transferencia de ${amount.toFixed(2)} ${currency} a ${recipientDisplayName} completada exitosamente.`, 'success');
        // Balances will be updated automatically by the onSnapshot listener

        // Show receipt for the sender
        const transactionDoc = await getDoc(newTransactionRef);
        if (transactionDoc.exists()) {
            showReceipt({ id: transactionDoc.id, ...transactionDoc.data() });
        }

    } catch (error) {
        console.error("Error al completar la transferencia:", error);
        showMessage('Error al procesar la transferencia. Por favor, inténtalo de nuevo.', 'error');
    } finally {
        // Ensure transaction status is hidden after completion or error
        hideTransactionStatus();
    }
}


// --- Deposit Money Functionality ---

/**
 * Shows the deposit money modal with an auto-generated serial number.
 */
depositMoneyBtn.addEventListener('click', () => {
    depositSerialNumberInput.value = crypto.randomUUID().substring(0, 8).toUpperCase(); // Generate a shorter unique ID
    depositModal.classList.remove('hidden');
});

/**
 * Closes the deposit money modal.
 */
cancelDeposit.addEventListener('click', () => {
    closeModal(depositModal);
    depositForm.reset();
});

/**
 * Handles deposit form submission.
 * Requests are sent to pending_requests for admin approval.
 */
depositForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    hideTransactionStatus();

    const serialNumber = depositSerialNumberInput.value.trim();
    const amount = parseFloat(depositAmount.value);
    const currency = depositCurrency.value;

    if (amount <= 0 || isNaN(amount)) {
        showMessage('El monto debe ser un número positivo.', 'error');
        return;
    }
    if (!serialNumber) {
        showMessage('Por favor, ingresa un número de serie único para tu depósito.', 'error');
        return;
    }

    try {
        // Check if user already has a pending deposit (this specific flag is for deposits only)
        const userDocRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists() && userDocSnap.data().hasPendingDeposit) {
             showMessage('Ya tienes un depósito pendiente de aprobación. No puedes solicitar otro.', 'error');
             closeModal(depositModal);
             depositForm.reset();
             return;
        }

        // Add deposit request to a unified 'pending_requests' collection
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'deposit', // Indicate request type
            serialNumber: serialNumber,
            amount: amount,
            currency: currency,
            timestamp: serverTimestamp(),
            status: 'pending' // Status for admin approval
        });

        // Update user's profile to mark that they have a pending deposit
        await updateDoc(userDocRef, {
            hasPendingDeposit: true
        });

        showMessage(`Solicitud de depósito de ${amount.toFixed(2)} ${currency} con número de serie ${serialNumber} enviada. Esperando aprobación del banco.`, 'success');
        closeModal(depositModal);
        depositForm.reset();

        // Send WhatsApp message to admin
        const userData = userDocSnap.data();
        const whatsappMessage = `
        Nueva solicitud de depósito pendiente:
        Usuario: ${userData.name} ${userData.surname} (ID: ${userData.userDisplayId || userData.userId})
        Monto: ${amount.toFixed(2)} ${currency}
        Número de Serie: ${serialNumber}
        Por favor, revisa y confirma.
        `;
        const encodedMessage = encodeURIComponent(whatsappMessage);
        window.open(`https://wa.me/${ADMIN_PHONE_NUMBER_FULL}?text=${encodedMessage}`, '_blank');

    } catch (error) {
        console.error("Error al solicitar depósito:", error);
        showMessage('Error al procesar la solicitud de depósito. Inténtalo de nuevo.', 'error');
    }
});

// --- Withdraw Money Functionality ---

/**
 * Shows the withdraw money modal.
 */
withdrawMoneyBtn.addEventListener('click', () => {
    withdrawModal.classList.remove('hidden');
});

/**
 * Closes the withdraw money modal.
 */
cancelWithdraw.addEventListener('click', () => {
    closeModal(withdrawModal);
    withdrawForm.reset();
});

/**
 * Handles withdrawal form submission.
 * Requests are sent to pending_requests for admin approval.
 */
withdrawForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    hideTransactionStatus();

    const amount = parseFloat(withdrawAmount.value);
    const currency = withdrawCurrency.value;

    if (amount <= 0 || isNaN(amount)) {
        showMessage('El monto a retirar debe ser un número positivo.', 'error');
        return;
    }

    // Calculate estimated total including fee for display
    let amountInUSD = amount;
    if (currency === 'DOP') {
        amountInUSD = amount / USD_TO_DOP_RATE;
    }
    const estimatedFeeInUSD = amountInUSD * WITHDRAWAL_FEE_RATE;
    const totalRequiredForWithdrawalInUSD = amountInUSD + estimatedFeeInUSD;

    // Check if current balance is sufficient for estimation (final check at confirmation)
    if (currentBalanceUSD < totalRequiredForWithdrawalInUSD) {
        showMessage(`Saldo insuficiente para cubrir el retiro de ${amount.toFixed(2)} ${currency} y la tarifa del 4%. Necesitas $${totalRequiredForWithdrawalInUSD.toFixed(2)} USD.`, 'error');
        return;
    }

    try {
        // Add withdrawal request to a unified 'pending_requests' collection
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'withdrawal', // Indicate request type
            amount: amount,
            currency: currency,
            timestamp: serverTimestamp(),
            status: 'pending', // Status for admin approval
            estimatedFee: estimatedFeeInUSD // Store estimated fee for admin review
        });

        showMessage(`Solicitud de retiro de ${amount.toFixed(2)} ${currency} enviada. Esperando aprobación del banco. Se aplicará una tarifa del 4% al confirmar.`, 'success');
        closeModal(withdrawModal);
        withdrawForm.reset();

        // Send WhatsApp message to admin
        const userDocSnap = await getDoc(doc(db, 'artifacts', appId, 'users', currentUserId));
        const userData = userDocSnap.data();
        const whatsappMessage = `
        Nueva solicitud de retiro pendiente:
        Usuario: ${userData.name} ${userData.surname} (ID: ${userData.userDisplayId || userData.userId})
        Monto: ${amount.toFixed(2)} ${currency}
        Tarifa estimada (4%): $${estimatedFeeInUSD.toFixed(2)} USD
        Por favor, revisa y confirma.
        `;
        const encodedMessage = encodeURIComponent(whatsappMessage);
        window.open(`https://wa.me/${ADMIN_PHONE_NUMBER_FULL}?text=${encodedMessage}`, '_blank');

    } catch (error) {
        console.error("Error al solicitar retiro:", error);
        showMessage('Error al procesar la solicitud de retiro. Inténtalo de nuevo.', 'error');
    }
});

// --- Online Shopping Logic ---
onlineShoppingBtn.addEventListener('click', () => {
    onlineShoppingModal.classList.remove('hidden');
    onlineShoppingForm.reset();
    shoppingFeeDisplay.textContent = '$0.00 USD';
    shoppingTotalDisplay.textContent = '$0.00 USD';
});

cancelOnlineShopping.addEventListener('click', () => {
    closeModal(onlineShoppingModal);
    onlineShoppingForm.reset();
});

shoppingAmountInput.addEventListener('input', updateOnlineShoppingCalculation);
shoppingCurrencyInput.addEventListener('change', updateOnlineShoppingCalculation);

function updateOnlineShoppingCalculation() {
    const amount = parseFloat(shoppingAmountInput.value);
    const currency = shoppingCurrencyInput.value;

    if (isNaN(amount) || amount <= 0) {
        shoppingFeeDisplay.textContent = `$0.00 USD`;
        shoppingTotalDisplay.textContent = `$0.00 USD`;
        return;
    }

    let amountInUSD = amount;
    if (currency === 'DOP') {
        amountInUSD = amount / USD_TO_DOP_RATE;
    }

    const feeAmount = amountInUSD * COMMISSION_RATE;
    const totalAmount = amountInUSD + feeAmount; // This is what the user *will pay* after admin confirmation

    shoppingFeeDisplay.textContent = `$${feeAmount.toFixed(2)} USD`;
    shoppingTotalDisplay.textContent = `$${totalAmount.toFixed(2)} USD`;
}

onlineShoppingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const productAmount = parseFloat(shoppingAmountInput.value);
    const productCurrency = shoppingCurrencyInput.value;
    const productLinks = productLinksInput.value.trim();
    const shoppingCategory = shoppingCategoryInput.value; // Get category

    if (isNaN(productAmount) || productAmount <= 0) {
        showMessage('Por favor, ingresa un monto estimado válido para los productos.', 'error');
        return;
    }
    if (!productLinks) {
        showMessage('Por favor, ingresa al menos un enlace de producto.', 'error');
        return;
    }
    if (!shoppingCategory) {
        showMessage('Por favor, selecciona una categoría para la compra.', 'error');
        return;
    }


    let amountInUSD = productAmount;
    if (productCurrency === 'DOP') {
        amountInUSD = productAmount / USD_TO_DOP_RATE;
    }

    const feeAmount = amountInUSD * COMMISSION_RATE;
    const totalToDeductInUSD = amountInUSD + feeAmount; // This is the total amount the user will pay

    try {
        // Add online purchase request to 'pending_requests'
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'online_purchase',
            productAmount: productAmount,
            productCurrency: productCurrency,
            productLinks: productLinks,
            feeAmount: feeAmount, // Store calculated fee
            totalAmountToDeduct: totalToDeductInUSD, // Store total to deduct
            category: shoppingCategory, // Store category
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage('Solicitud de compra por internet enviada. Esperando aprobación del administrador. El dinero se deducirá al confirmar.', 'info');
        closeModal(onlineShoppingModal);
        onlineShoppingForm.reset();

        // Send WhatsApp message to admin
        const userDocSnap = await getDoc(doc(db, 'artifacts', appId, 'users', currentUserId));
        const userData = userDocSnap.data();
        const whatsappMessage = `
        Nueva solicitud de compra online pendiente:
        Usuario: ${userData.name} ${userData.surname} (ID: ${userData.userDisplayId || userData.userId})
        Monto de productos: ${productAmount.toFixed(2)} ${productCurrency}
        Tarifa (3%): $${feeAmount.toFixed(2)} USD
        TOTAL A DEDUCIR: $${totalToDeductInUSD.toFixed(2)} USD (al confirmar)
        Categoría: ${shoppingCategory}
        Enlaces de productos:
        ${productLinks}
        Por favor, revisa y confirma.
        `;
        const encodedMessage = encodeURIComponent(whatsappMessage);
        window.open(`https://wa.me/${ADMIN_PHONE_NUMBER_FULL}?text=${encodedMessage}`, '_blank');

    } catch (error) {
        console.error("Error al solicitar compra online:", error);
        showMessage('Error al procesar la solicitud de compra online. Por favor, inténtalo de nuevo.', 'error');
    }
});

// --- Streaming Payment Logic ---
streamingPaymentBtn.addEventListener('click', () => {
    streamingPaymentModal.classList.remove('hidden');
    streamingPaymentForm.reset();
    streamingFeeDisplay.textContent = '$0.00 USD';
    streamingTotalDisplay.textContent = '$0.00 USD';
});

cancelStreamingPayment.addEventListener('click', () => {
    closeModal(streamingPaymentModal);
    streamingPaymentForm.reset();
});

streamingAmountInput.addEventListener('input', updateStreamingPaymentCalculation);
streamingCurrencyInput.addEventListener('change', updateStreamingPaymentCalculation);

function updateStreamingPaymentCalculation() {
    const amount = parseFloat(streamingAmountInput.value);
    const currency = streamingCurrencyInput.value;

    if (isNaN(amount) || amount <= 0) {
        streamingFeeDisplay.textContent = `$0.00 USD`;
        streamingTotalDisplay.textContent = `$0.00 USD`;
        return;
    }

    let amountInUSD = amount;
    if (currency === 'DOP') {
        amountInUSD = amount / USD_TO_DOP_RATE;
    }

    const feeAmount = amountInUSD * COMMISSION_RATE;
    const totalAmount = amountInUSD + feeAmount; // This is what the user *will pay* after admin confirmation

    streamingFeeDisplay.textContent = `$${feeAmount.toFixed(2)} USD`;
    streamingTotalDisplay.textContent = `$${totalAmount.toFixed(2)} USD`;
}

streamingPaymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const service = streamingServiceInput.value;
    const accountIdentifier = streamingAccountIdentifierInput.value.trim();
    const subscriptionAmount = parseFloat(streamingAmountInput.value);
    const subscriptionCurrency = streamingCurrencyInput.value;
    const streamingCategory = streamingCategoryInput.value; // Get category

    if (!service || !accountIdentifier || isNaN(subscriptionAmount) || subscriptionAmount <= 0) {
        showMessage('Por favor, completa todos los campos para el pago del servicio de streaming.', 'error');
        return;
    }
    if (!streamingCategory) {
        showMessage('Por favor, selecciona una categoría para el servicio de streaming.', 'error');
        return;
    }

    let amountInUSD = subscriptionAmount;
    if (subscriptionCurrency === 'DOP') {
        amountInUSD = subscriptionAmount / USD_TO_DOP_RATE;
    }

    const feeAmount = amountInUSD * COMMISSION_RATE;
    const totalToDeductInUSD = amountInUSD + feeAmount; // This is the total amount the user will pay

    try {
        // Add streaming payment request to 'pending_requests'
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'streaming_payment',
            service: service,
            accountIdentifier: accountIdentifier,
            subscriptionAmount: subscriptionAmount,
            subscriptionCurrency: subscriptionCurrency,
            feeAmount: feeAmount,
            totalAmountToDeduct: totalToDeductInUSD,
            category: streamingCategory, // Store category
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage('Solicitud de pago de servicio de streaming enviada. Esperando aprobación del administrador. El dinero se deducirá al confirmar.', 'info');
        closeModal(streamingPaymentModal);
        streamingPaymentForm.reset();

        // Send WhatsApp message to admin
        const userDocSnap = await getDoc(doc(db, 'artifacts', appId, 'users', currentUserId));
        const userData = userDocSnap.data();
        const whatsappMessage = `
        Nueva solicitud de pago de streaming pendiente:
        Usuario: ${userData.name} ${userData.surname} (ID: ${userData.userDisplayId || userData.userId})
        Servicio: ${service}
        Cuenta: ${accountIdentifier}
        Monto Suscripción: ${subscriptionAmount.toFixed(2)} ${subscriptionCurrency}
        Tarifa (3%): $${feeAmount.toFixed(2)} USD
        TOTAL A DEDUCIR: $${totalToDeductInUSD.toFixed(2)} USD (al confirmar)
        Categoría: ${streamingCategory}
        Por favor, revisa y confirma.
        `;
        const encodedMessage = encodeURIComponent(whatsappMessage);
        window.open(`https://wa.me/${ADMIN_PHONE_NUMBER_FULL}?text=${encodedMessage}`, '_blank');

    } catch (error) {
        console.error("Error al solicitar pago de streaming:", error);
        showMessage('Error al procesar el pago de streaming. Por favor, inténtalo de nuevo.', 'error');
    }
});

// --- NEW: Game Recharge Logic ---
gameRechargeBtn.addEventListener('click', () => {
    gameRechargeModal.classList.remove('hidden');
    gameRechargeForm.reset();
    gameRechargeFeeDisplay.textContent = '$0.00 USD';
    gameRechargeTotalDisplay.textContent = '$0.00 USD';
});

cancelGameRecharge.addEventListener('click', () => {
    closeModal(gameRechargeModal);
    gameRechargeForm.reset();
});

rechargeAmountInput.addEventListener('input', updateGameRechargeCalculation);
rechargeCurrencyInput.addEventListener('change', updateGameRechargeCalculation);

function updateGameRechargeCalculation() {
    const amount = parseFloat(rechargeAmountInput.value);
    const currency = rechargeCurrencyInput.value;

    if (isNaN(amount) || amount <= 0) {
        gameRechargeFeeDisplay.textContent = `$0.00 USD`;
        gameRechargeTotalDisplay.textContent = `$0.00 USD`;
        return;
    }

    let amountInUSD = amount;
    if (currency === 'DOP') {
        amountInUSD = amount / USD_TO_DOP_RATE;
    }

    const feeAmount = amountInUSD * COMMISSION_RATE;
    const totalAmount = amountInUSD + feeAmount; // This is what the user *will pay* after admin confirmation

    gameRechargeFeeDisplay.textContent = `$${feeAmount.toFixed(2)} USD`;
    gameRechargeTotalDisplay.textContent = `$${totalAmount.toFixed(2)} USD`;
}

gameRechargeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const gameName = gameNameInput.value;
    const playerId = playerIdInput.value.trim();
    const rechargeAmount = parseFloat(rechargeAmountInput.value);
    const rechargeCurrency = rechargeCurrencyInput.value;
    const gameRechargeCategory = gameRechargeCategoryInput.value;

    if (!gameName || !playerId || isNaN(rechargeAmount) || rechargeAmount <= 0 || !gameRechargeCategory) {
        showMessage('Por favor, completa todos los campos para la recarga del juego.', 'error');
        return;
    }

    let amountInUSD = rechargeAmount;
    if (rechargeCurrency === 'DOP') {
        amountInUSD = rechargeAmount / USD_TO_DOP_RATE;
    }

    const feeAmount = amountInUSD * COMMISSION_RATE;
    const totalToDeductInUSD = amountInUSD + feeAmount; // This is the total amount the user will pay

    try {
        // Add game recharge request to 'pending_requests'
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'game_recharge',
            gameName: gameName,
            playerId: playerId,
            rechargeAmount: rechargeAmount,
            rechargeCurrency: rechargeCurrency,
            feeAmount: feeAmount,
            totalAmountToDeduct: totalToDeductInUSD,
            category: gameRechargeCategory,
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage('Solicitud de recarga de juego enviada. Esperando aprobación del administrador. El dinero se deducirá al confirmar.', 'info');
        closeModal(gameRechargeModal);
        gameRechargeForm.reset();

        // Send WhatsApp message to admin
        const userDocSnap = await getDoc(doc(db, 'artifacts', appId, 'users', currentUserId));
        const userData = userDocSnap.data();
        const whatsappMessage = `
        Nueva solicitud de recarga de juego pendiente:
        Usuario: ${userData.name} ${userData.surname} (ID: ${userData.userDisplayId || userData.userId})
        Juego: ${gameName}
        ID de Jugador: ${playerId}
        Monto Recarga: ${rechargeAmount.toFixed(2)} ${rechargeCurrency}
        Tarifa (3%): $${feeAmount.toFixed(2)} USD
        TOTAL A DEDUCIR: $${totalToDeductInUSD.toFixed(2)} USD (al confirmar)
        Tipo de Recarga: ${gameRechargeCategory}
        Por favor, revisa y confirma.
        `;
        const encodedMessage = encodeURIComponent(whatsappMessage);
        window.open(`https://wa.me/${ADMIN_PHONE_NUMBER_FULL}?text=${encodedMessage}`, '_blank');

    } catch (error) {
        console.error("Error al solicitar recarga de juego:", error);
        showMessage('Error al procesar la solicitud de recarga de juego. Por favor, inténtalo de nuevo.', 'error');
    }
});


// --- Admin Pending Requests Functionality (Unified) ---

viewAdminPendingRequestsBtn.addEventListener('click', () => {
    adminPendingRequestsModal.classList.remove('hidden');
    loadAdminPendingRequests();
});

closeAdminPendingRequestsModalBtn.addEventListener('click', () => {
    closeModal(adminPendingRequestsModal);
    // Unsubscribe from the listener when the modal is closed
    if (adminPendingRequestsUnsubscribe) {
        adminPendingRequestsUnsubscribe();
        adminPendingRequestsUnsubscribe = null;
        console.log("Admin: Unsubscribed from pending requests listener on modal close.");
    }
});

/**
 * Loads and displays all pending requests for the admin.
 */
function loadAdminPendingRequests() {
    // Unsubscribe from previous listener if it exists
    if (adminPendingRequestsUnsubscribe) {
        adminPendingRequestsUnsubscribe();
        adminPendingRequestsUnsubscribe = null; // Reset
        console.log("Admin: Unsubscribed from previous pending requests listener.");
    }

    adminPendingRequestsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">Cargando solicitudes pendientes...</td></tr>';
    const pendingRequestsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests');
    const q = query(pendingRequestsCollectionRef, where('status', '==', 'pending'));

    // Assign the unsubscribe function to adminPendingRequestsUnsubscribe
    adminPendingRequestsUnsubscribe = onSnapshot(q, async (snapshot) => {
        adminPendingRequestsTableBody.innerHTML = ''; // Clear table for new data
        if (snapshot.empty) {
            adminPendingRequestsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">No hay solicitudes pendientes.</td></tr>';
            return;
        }

        for (const docEntry of snapshot.docs) {
            const request = docEntry.data();
            const requestId = docEntry.id;

            const userNameDisplay = await getUserDisplayName(request.userId);
            const requestDate = (request.timestamp && typeof request.timestamp.seconds !== 'undefined')
                ? new Date(request.timestamp.seconds * 1000).toLocaleString()
                : 'Fecha no disponible';

            let typeDisplay = '';
            let amountDisplay = '';
            let currencyDisplay = '';
            let detailsDisplay = '';

            switch (request.type) {
                case 'deposit':
                    typeDisplay = 'Depósito';
                    amountDisplay = (request.amount ?? 0).toFixed(2);
                    currencyDisplay = request.currency;
                    detailsDisplay = `Serie: ${request.serialNumber}`;
                    break;
                case 'withdrawal':
                    typeDisplay = 'Retiro';
                    amountDisplay = (request.amount ?? 0).toFixed(2);
                    currencyDisplay = request.currency;
                    detailsDisplay = `Tarifa est. (4%): $${(request.estimatedFee ?? 0).toFixed(2)} USD`;
                    break;
                case 'online_purchase':
                    typeDisplay = 'Compra Online';
                    amountDisplay = (request.totalAmountToDeduct ?? 0).toFixed(2); // Show total amount to be deducted
                    currencyDisplay = 'USD'; // Assuming totalToDeduct is in USD
                    detailsDisplay = `Prod. Cant: ${(request.productAmount ?? 0).toFixed(2)} ${request.productCurrency}, Tarifa (3%): $${(request.feeAmount ?? 0).toFixed(2)} USD. Cat: ${request.category || 'N/A'}. Links: ${request.productLinks.substring(0, 50)}...`;
                    break;
                case 'streaming_payment':
                    typeDisplay = 'Pago Streaming';
                    amountDisplay = (request.totalAmountToDeduct ?? 0).toFixed(2); // Show total amount to be deducted
                    currencyDisplay = 'USD'; // Assuming totalToDeduct is in USD
                    detailsDisplay = `Servicio: ${request.service}, Cuenta: ${request.accountIdentifier}, Tarifa (3%): $${(request.feeAmount ?? 0).toFixed(2)} USD. Cat: ${request.category || 'N/A'}.`;
                    break;
                case 'game_recharge': // NEW: Admin Pending Request Display for Game Recharge
                    typeDisplay = 'Recarga de Juego';
                    amountDisplay = (request.totalAmountToDeduct ?? 0).toFixed(2);
                    currencyDisplay = 'USD';
                    detailsDisplay = `Juego: ${request.gameName}, ID Jugador: ${request.playerId}, Monto: ${(request.rechargeAmount ?? 0).toFixed(2)} ${request.rechargeCurrency}, Tarifa (3%): $${(request.feeAmount ?? 0).toFixed(2)} USD. Tipo: ${request.category || 'N/A'}.`;
                    break;
                case 'savings_account_open':
                    typeDisplay = 'Apertura Cta. Ahorro';
                    amountDisplay = (request.initialDepositAmount ?? 0).toFixed(2);
                    currencyDisplay = request.initialDepositCurrency;
                    detailsDisplay = `Objetivo: ${request.savingsGoal}, Frecuencia: ${request.preferredSavingsFrequency}. Cuota Periódica: $${(request.periodicContributionAmount ?? 0).toFixed(2)} USD. Inicio: ${request.startDate ? new Date(request.startDate.seconds * 1000).toLocaleDateString() : 'N/A'}, Fin: ${request.endDate || 'N/A'}. Depósito Inicial: ${amountDisplay} ${currencyDisplay}`;
                    break;
                default:
                    typeDisplay = 'Desconocido';
                    amountDisplay = (request.amount ?? 0).toFixed(2);
                    currencyDisplay = request.currency || 'N/A';
                    detailsDisplay = 'N/A';
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${requestDate}</td>
                <td>${typeDisplay}</td>
                <td>${userNameDisplay}</td>
                <td>${amountDisplay}</td>
                <td>${currencyDisplay}</td>
                <td>${detailsDisplay}</td>
                <td>
                    <button class="btn-success confirm-request-btn"
                        data-request-id="${requestId}"
                        data-user-id="${request.userId}"
                        data-type="${request.type}"
                        data-amount="${request.amount || 0}"
                        data-currency="${request.currency || ''}"
                        data-serial-number="${request.serialNumber || ''}"
                        data-product-amount="${request.productAmount || 0}"
                        data-product-currency="${request.productCurrency || ''}"
                        data-product-links="${request.productLinks || ''}"
                        data-service="${request.service || ''}"
                        data-account-identifier="${request.accountIdentifier || ''}"
                        data-subscription-amount="${request.subscriptionAmount || 0}"
                        data-subscription-currency="${request.subscriptionCurrency || ''}"
                        data-game-name="${request.gameName || ''}"
                        data-player-id="${request.playerId || ''}"
                        data-recharge-amount="${request.rechargeAmount || 0}"
                        data-recharge-currency="${request.rechargeCurrency || ''}"
                        data-fee-amount="${request.feeAmount || 0}"
                        data-total-amount-to-deduct="${request.totalAmountToDeduct || 0}"
                        data-category="${request.category || ''}"
                        data-savings-goal="${request.savingsGoal || ''}"
                        data-initial-deposit-amount="${request.initialDepositAmount || 0}"
                        data-initial-deposit-currency="${request.initialDepositCurrency || ''}"
                        data-preferred-savings-frequency="${request.preferredSavingsFrequency || ''}"
                        data-periodic-contribution-amount="${request.periodicContributionAmount || 0}"
                        data-start-date="${request.startDate ? request.startDate.seconds * 1000 : ''}"
                        data-end-date="${request.endDate || ''}"
                        >Confirmar</button>
                    <button class="btn-danger reject-request-btn"
                        data-request-id="${requestId}"
                        data-user-id="${request.userId}"
                        data-type="${request.type}"
                        >Rechazar</button>
                </td>
            `;
            adminPendingRequestsTableBody.appendChild(row);
        }
    }, (error) => {
        console.error("Error loading admin pending requests:", error);
        adminPendingRequestsTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 py-4">Error al cargar solicitudes pendientes.</td></tr>`;
    });
}

// Event delegation for confirm/reject buttons in admin pending requests table
adminPendingRequestsTableBody.addEventListener('click', async (event) => {
    const target = event.target;
    if (target.classList.contains('confirm-request-btn')) {
        const dataset = target.dataset;
        await confirmRequest(
            dataset.requestId,
            dataset.type,
            dataset.userId,
            parseFloat(dataset.amount),
            dataset.currency,
            dataset.serialNumber,
            parseFloat(dataset.productAmount),
            dataset.productCurrency,
            dataset.productLinks,
            dataset.service,
            dataset.accountIdentifier,
            parseFloat(dataset.subscriptionAmount),
            dataset.subscriptionCurrency,
            dataset.gameName, // NEW
            dataset.playerId, // NEW
            parseFloat(dataset.rechargeAmount), // NEW
            dataset.rechargeCurrency, // NEW
            parseFloat(dataset.feeAmount),
            parseFloat(dataset.totalAmountToDeduct),
            dataset.category,
            dataset.savingsGoal,
            parseFloat(dataset.initialDepositAmount),
            dataset.initialDepositCurrency,
            dataset.preferredSavingsFrequency,
            parseFloat(dataset.periodicContributionAmount), // Pass periodicContributionAmount
            dataset.startDate, // Pass startDate
            dataset.endDate // Pass endDate
        );
    } else if (target.classList.contains('reject-request-btn')) {
        const dataset = target.dataset;
        await rejectRequest(dataset.requestId, dataset.type, dataset.userId);
    }
});


/**
 * Confirms a pending request, handles money transfer, and records transaction.
 */
async function confirmRequest(
            requestId, type, userId, amount, currency, serialNumber,
            productAmount, productCurrency, productLinks,
            service, accountIdentifier, subscriptionAmount, subscriptionCurrency,
            gameName, playerId, rechargeAmount, rechargeCurrency, // NEW Game Recharge parameters
            feeAmount, totalAmountToDeduct, category,
            savingsGoal, initialDepositAmount, initialDepositCurrency, preferredSavingsFrequency, periodicContributionAmount, startDate, endDate // New parameters
        ) {
            console.log("Confirming request:", { requestId, type, userId, amount, currency, serialNumber, productAmount, productCurrency, productLinks, service, accountIdentifier, subscriptionAmount, subscriptionCurrency, gameName, playerId, rechargeAmount, rechargeCurrency, feeAmount, totalAmountToDeduct, category, savingsGoal, initialDepositAmount, initialDepositCurrency, preferredSavingsFrequency, periodicContributionAmount, startDate, endDate });
            try {
                const userProfileRef = doc(db, 'artifacts', appId, 'users', userId);
                const requestDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'pending_requests', requestId);

                const userDocSnap = await getDoc(userProfileRef);

                if (!userDocSnap.exists()) {
                    console.error("Error: User profile not found for request:", userId);
                    showMessage('Error: Usuario no encontrado para la solicitud.', 'error');
                    return;
                }
                const userData = userDocSnap.data();
                let userCurrentBalanceUSD = userData.balanceUSD || 0;
                let userCurrentBalanceDOP = userData.balanceDOP || 0;

                let adminId = null;
                const adminUsersCollectionRef = collection(db, 'artifacts', appId, 'users');
                const adminQuery = query(adminUsersCollectionRef, where('email', '==', ADMIN_EMAIL));
                const adminSnapshot = await getDocs(adminQuery);
                if (!adminSnapshot.empty) {
                    adminId = adminSnapshot.docs[0].id;
                } else {
                    console.warn("Admin account not found. Fees might not be transferred to admin.");
                }

                let transactionType = type;
                let transactionDescription = '';
                let amountToRecordInTransaction = amount;
                let currencyToRecordInTransaction = currency;
                let typeDisplay = '';
                let savingsAccountId = null;
                let calculatedFeeInUSD = 0;

                switch (type) {
                    case 'deposit':
                        let depositAmountInUSD = amount;
                        if (currency === 'DOP') {
                            depositAmountInUSD = amount / USD_TO_DOP_RATE;
                        }
                        userCurrentBalanceUSD += depositAmountInUSD;
                        userCurrentBalanceDOP = userCurrentBalanceUSD * USD_TO_DOP_RATE;
                        transactionDescription = `Depósito con serie ${serialNumber}`;
                        typeDisplay = 'Depósito';
                        break;
                    case 'withdrawal':
                        let withdrawalAmountInUSD = amount;
                        if (currency === 'DOP') {
                            withdrawalAmountInUSD = amount / USD_TO_DOP_RATE;
                        }
                        calculatedFeeInUSD = withdrawalAmountInUSD * WITHDRAWAL_FEE_RATE;
                        const totalDeductionFromUserForWithdrawal = withdrawalAmountInUSD + calculatedFeeInUSD;

                        if (userCurrentBalanceUSD < totalDeductionFromUserForWithdrawal) {
                            showMessage(`Error: Saldo insuficiente para cubrir el retiro y la tarifa del 4%.`, 'error');
                            return;
                        }
                        userCurrentBalanceUSD -= totalDeductionFromUserForWithdrawal;
                        userCurrentBalanceDOP = userCurrentBalanceUSD * USD_TO_DOP_RATE;
                        transactionDescription = `Retiro (Tarifa: ${calculatedFeeInUSD.toFixed(2)} USD)`;
                        typeDisplay = 'Retiro';

                        if (adminId) {
                            const adminProfileRef = doc(db, 'artifacts', appId, 'users', adminId);
                            const adminData = (await getDoc(adminProfileRef)).data();
                            let adminNewBalanceUSD = (adminData.balanceUSD || 0) + calculatedFeeInUSD;
                            await updateDoc(adminProfileRef, { balanceUSD: adminNewBalanceUSD, balanceDOP: adminNewBalanceUSD * USD_TO_DOP_RATE });
                            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
                                payerId: userId,
                                receiverId: adminId,
                                amount: calculatedFeeInUSD,
                                currency: 'USD',
                                timestamp: serverTimestamp(),
                                type: 'withdrawal_fee',
                                status: 'completed',
                                originalRequestId: requestId
                            });
                        }
                        break;
                    case 'online_purchase':
                        if (userCurrentBalanceUSD < totalAmountToDeduct) {
                            showMessage(`Error: Saldo insuficiente para la compra online.`, 'error');
                            return;
                        }
                        userCurrentBalanceUSD -= totalAmountToDeduct;
                        userCurrentBalanceDOP = userCurrentBalanceUSD * USD_TO_DOP_RATE;
                        transactionDescription = `Compra online`;
                        amountToRecordInTransaction = totalAmountToDeduct;
                        currencyToRecordInTransaction = 'USD';
                        typeDisplay = 'Compra Online';

                        // --- CAMBIO AQUÍ: Solo transferimos la tarifa (feeAmount) al admin ---
                        if (adminId && feeAmount > 0) {
                            console.log("Transferring online purchase FEE to admin:", feeAmount, "USD");
                            const adminProfileRef = doc(db, 'artifacts', appId, 'users', adminId);
                            const adminData = (await getDoc(adminProfileRef)).data();
                            let adminNewBalanceUSD = (adminData.balanceUSD || 0) + feeAmount;
                            await updateDoc(adminProfileRef, { balanceUSD: adminNewBalanceUSD, balanceDOP: adminNewBalanceUSD * USD_TO_DOP_RATE });
                        }
                        break;
                    case 'streaming_payment':
                        if (userCurrentBalanceUSD < totalAmountToDeduct) {
                            showMessage(`Error: Saldo insuficiente para el pago de streaming.`, 'error');
                            return;
                        }
                        userCurrentBalanceUSD -= totalAmountToDeduct;
                        userCurrentBalanceDOP = userCurrentBalanceUSD * USD_TO_DOP_RATE;
                        transactionDescription = `Pago de ${service}`;
                        amountToRecordInTransaction = totalAmountToDeduct;
                        currencyToRecordInTransaction = 'USD';
                        typeDisplay = 'Pago Streaming';

                        // --- CAMBIO AQUÍ: Solo transferimos la tarifa (feeAmount) al admin ---
                        if (adminId && feeAmount > 0) {
                            console.log("Transferring streaming payment FEE to admin:", feeAmount, "USD");
                            const adminProfileRef = doc(db, 'artifacts', appId, 'users', adminId);
                            const adminData = (await getDoc(adminProfileRef)).data();
                            let adminNewBalanceUSD = (adminData.balanceUSD || 0) + feeAmount;
                            await updateDoc(adminProfileRef, { balanceUSD: adminNewBalanceUSD, balanceDOP: adminNewBalanceUSD * USD_TO_DOP_RATE });
                        }
                        break;
                    case 'game_recharge':
                        if (userCurrentBalanceUSD < totalAmountToDeduct) {
                            showMessage(`Error: Saldo insuficiente para la recarga de juego.`, 'error');
                            return;
                        }
                        userCurrentBalanceUSD -= totalAmountToDeduct;
                        userCurrentBalanceDOP = userCurrentBalanceUSD * USD_TO_DOP_RATE;
                        transactionDescription = `Recarga de ${gameName} (ID: ${playerId})`;
                        amountToRecordInTransaction = totalAmountToDeduct;
                        currencyToRecordInTransaction = 'USD';
                        typeDisplay = 'Recarga de Juego';

                        // --- CAMBIO AQUÍ: Solo transferimos la tarifa (feeAmount) al admin ---
                        if (adminId && feeAmount > 0) {
                            console.log("Transferring game recharge FEE to admin:", feeAmount, "USD");
                            const adminProfileRef = doc(db, 'artifacts', appId, 'users', adminId);
                            const adminData = (await getDoc(adminProfileRef)).data();
                            let adminNewBalanceUSD = (adminData.balanceUSD || 0) + feeAmount;
                            await updateDoc(adminProfileRef, { balanceUSD: adminNewBalanceUSD, balanceDOP: adminNewBalanceUSD * USD_TO_DOP_RATE });
                        }
                        break;
                    case 'savings_account_open':
                        let initialDepositAmountInUSD = initialDepositAmount;
                        if (initialDepositCurrency === 'DOP') {
                            initialDepositAmountInUSD = initialDepositAmount / USD_TO_DOP_RATE;
                        }

                        if (userCurrentBalanceUSD < initialDepositAmountInUSD) {
                            showMessage(`Error: Saldo insuficiente para el depósito inicial de la cuenta de ahorro.`, 'error');
                            return;
                        }
                        userCurrentBalanceUSD -= initialDepositAmountInUSD;
                        userCurrentBalanceDOP = userCurrentBalanceUSD * USD_TO_DOP_RATE;
                        
                        let nextDueDate = new Date();
                        if (preferredSavingsFrequency === 'Diaria') {
                            nextDueDate = addDays(nextDueDate, 1);
                        } else if (preferredSavingsFrequency === 'Semanal') {
                            nextDueDate = addWeeks(nextDueDate, 1);
                        } else if (preferredSavingsFrequency === 'Quincenal') {
                            nextDueDate = addDays(nextDueDate, 15);
                        } else if (preferredSavingsFrequency === 'Mensual') {
                            nextDueDate = addMonths(nextDueDate, 1);
                        }

                        const newSavingsAccountId = crypto.randomUUID();
                        const savingsAccountRef = doc(db, 'artifacts', appId, 'users', userId, 'savings_accounts', newSavingsAccountId);
                        await setDoc(savingsAccountRef, {
                            accountId: newSavingsAccountId,
                            userId: userId,
                            savingsGoal: savingsGoal,
                            balanceUSD: initialDepositAmountInUSD,
                            balanceDOP: initialDepositAmountInUSD * USD_TO_DOP_RATE,
                            initialDepositAmount: initialDepositAmount,
                            initialDepositCurrency: initialDepositCurrency,
                            preferredSavingsFrequency: preferredSavingsFrequency,
                            periodicContributionAmount: periodicContributionAmount,
                            nextContributionDueDate: preferredSavingsFrequency !== 'Ocasional' ? nextDueDate : null,
                            lastContributionAttemptDate: null,
                            endDate: endDate,
                            createdAt: serverTimestamp(),
                            status: 'active'
                        });
                        savingsAccountId = newSavingsAccountId;

                        transactionDescription = `Apertura de cuenta de ahorro para ${savingsGoal}`;
                        amountToRecordInTransaction = initialDepositAmount;
                        currencyToRecordInTransaction = initialDepositCurrency;
                        typeDisplay = 'Apertura Cta. Ahorro';
                        break;
                    default:
                        console.error("Error: Unknown request type:", type);
                        showMessage('Tipo de solicitud desconocido.', 'error');
                        typeDisplay = 'Desconocido';
                        return;
                }

                await updateDoc(userProfileRef, {
                    balanceUSD: userCurrentBalanceUSD,
                    balanceDOP: userCurrentBalanceDOP,
                    ...(type === 'deposit' && { hasPendingDeposit: false })
                });
                
                await updateDoc(requestDocRef, {
                    status: 'completed',
                    confirmedAt: serverTimestamp()
                });

                const newTransactionRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
                    userId: userId,
                    type: transactionType,
                    amount: amountToRecordInTransaction,
                    currency: currencyToRecordInTransaction,
                    timestamp: serverTimestamp(),
                    status: 'completed',
                    description: transactionDescription,
                    ...(type === 'withdrawal' && { feeAmount: calculatedFeeInUSD, feeCurrency: 'USD', adminReceiverId: adminId }),
                    ...(type === 'online_purchase' && { productAmount, productCurrency, productLinks, feeAmount, feeCurrency: 'USD', totalAmountDeducted: totalAmountToDeduct, adminReceiverId: adminId, category: category }),
                    ...(type === 'streaming_payment' && { service, accountIdentifier, subscriptionAmount, subscriptionCurrency, feeAmount, feeCurrency: 'USD', totalAmountDeducted: totalAmountToDeduct, adminReceiverId: adminId, category: category }),
                    ...(type === 'game_recharge' && { gameName, playerId, rechargeAmount, rechargeCurrency, feeAmount, feeCurrency: 'USD', totalAmountDeducted: totalAmountToDeduct, adminReceiverId: adminId, category: category }),
                    ...(type === 'savings_account_open' && { savingsGoal, initialDepositAmount, initialDepositCurrency, preferredSavingsFrequency, periodicContributionAmount, savingsAccountId, startDate: serverTimestamp(), endDate: endDate })
                });

                showMessage(`Solicitud #${requestId} (${typeDisplay}) confirmada exitosamente.`, 'success');

                const transactionDoc = await getDoc(newTransactionRef);
                if (transactionDoc.exists()) {
                    showReceipt({ id: transactionDoc.id, ...transactionDoc.data() });
                }

            } catch (error) {
                console.error(`GLOBAL CATCH: Error confirmando solicitud ${type} #${requestId}:`, error);
                showMessage(`Error al confirmar la solicitud ${type}. Por favor, inténtalo de nuevo. Detalle: ${error.message}`, 'error');
            }
        }

/**
 * Rejects a pending request.
 */
async function rejectRequest(requestId, type, userId) {
    try {
        const requestDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'pending_requests', requestId);

        await updateDoc(requestDocRef, {
            status: 'rejected',
            rejectedAt: serverTimestamp()
        });

        // For deposits, reset the hasPendingDeposit flag so user can request again
        if (type === 'deposit') {
            const userProfileRef = doc(db, 'artifacts', appId, 'users', userId);
            await updateDoc(userProfileRef, {
                hasPendingDeposit: false
            });
        }

        showMessage(`Solicitud #${requestId} (${type}) rechazada exitosamente.`, 'info');

    } catch (error) {
        console.error(`Error rechazando solicitud ${type} #${requestId}:`, error);
        showMessage(`Error al rechazar la solicitud ${type}. Por favor, inténtalo de nuevo. Detalle: ${error.message}`, 'error');
    }
}


/**
 * Loads and displays the current user's transaction history.
 */
async function loadUserHistory() {
    userHistoryTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">Cargando historial...</td></tr>';

    const transactionsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');

    const q = query(transactionsCollectionRef,
        where('status', '==', 'completed')
    );

    onSnapshot(q, async (snapshot) => {
        userHistoryTableBody.innerHTML = '';
        userTransactionsData = []; // Clear previous data

        for (const docEntry of snapshot.docs) {
            const transaction = { id: docEntry.id, ...docEntry.data() };

            // Filter for current user's completed transactions
            if ((transaction.type === 'deposit' || transaction.type === 'withdrawal' || transaction.type === 'online_purchase' || transaction.type === 'streaming_payment' || transaction.type === 'game_recharge' || transaction.type === 'savings_account_open' || transaction.type === 'deposit_to_savings' || transaction.type === 'withdraw_from_savings' || transaction.type === 'delete_savings_account' || transaction.type === 'automatic_savings_collection' || transaction.type === 'savings_debt_payment' || transaction.type === 'savings_indemnization_applied') && transaction.userId === currentUserId) {
                userTransactionsData.push(transaction);
            } else if (transaction.type === 'transfer' && (transaction.senderId === currentUserId || transaction.recipientId === currentUserId)) {
                userTransactionsData.push(transaction);
            }
            // Do NOT include 'withdrawal_fee' in user's history as it's an internal admin transaction
        }

        if (userTransactionsData.length === 0) {
            userHistoryTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">No hay movimientos en tu historial.</td></tr>';
            return;
        }

        // Sort transactions by timestamp descending (newest first)
        userTransactionsData.sort((a, b) => {
            const timestampA = a.timestamp && typeof a.timestamp.seconds !== 'undefined' ? a.timestamp.seconds : 0;
            const timestampB = b.timestamp && typeof b.timestamp.seconds !== 'undefined' ? b.timestamp.seconds : 0;
            return timestampB - timestampA;
        });

        for (const transaction of userTransactionsData) {
            const date = (transaction.timestamp && typeof transaction.timestamp.seconds !== 'undefined')
                ? new Date(transaction.timestamp.seconds * 1000).toLocaleString()
                : 'Fecha no disponible';

            let typeDisplay = '';
            let detailsDisplay = '';
            let amountDisplay = '';

            switch (transaction.type) {
                case 'deposit':
                    typeDisplay = 'Depósito';
                    detailsDisplay = `Serie: ${transaction.serialNumber || 'N/A'}`;
                    amountDisplay = `+${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
                    break;
                case 'withdrawal':
                    typeDisplay = 'Retiro';
                    detailsDisplay = `Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
                    amountDisplay = `-${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
                    break;
                case 'transfer':
                    if (transaction.senderId === currentUserId) {
                        typeDisplay = 'Transferencia Enviada';
                        const recipientDisplayName = await getUserDisplayName(transaction.recipientId);
                        detailsDisplay = `A: ${recipientDisplayName}`;
                        amountDisplay = `-${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
                    } else if (transaction.recipientId === currentUserId) {
                        typeDisplay = 'Transferencia Recibida';
                        const senderDisplayName = await getUserDisplayName(transaction.senderId);
                        detailsDisplay = `De: ${senderDisplayName}`;
                        amountDisplay = `+${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
                    }
                    break;
                case 'online_purchase':
                    typeDisplay = 'Compra Online';
                    detailsDisplay = `Cat: ${transaction.category || 'N/A'}, Total prod: ${(transaction.productAmount ?? 0).toFixed(2)} ${transaction.productCurrency}, Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} ${transaction.feeCurrency}`;
                    amountDisplay = `-${(transaction.totalAmountDeducted ?? 0).toFixed(2)} ${transaction.currency}`; // This is the total deducted
                    break;
                case 'streaming_payment':
                    typeDisplay = 'Pago Streaming';
                    detailsDisplay = `Servicio: ${transaction.service}, Cat: ${transaction.category || 'N/A'}, Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} ${transaction.feeCurrency}`;
                    amountDisplay = `-${(transaction.totalAmountDeducted ?? 0).toFixed(2)} ${transaction.currency}`; // This is the total deducted
                    break;
                case 'game_recharge': // NEW: User History Display for Game Recharge
                    typeDisplay = 'Recarga de Juego';
                    detailsDisplay = `Juego: ${transaction.gameName}, ID Jugador: ${transaction.playerId}, Tipo: ${transaction.category || 'N/A'}, Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} ${transaction.feeCurrency}`;
                    amountDisplay = `-${(transaction.totalAmountDeducted ?? 0).toFixed(2)} ${transaction.currency}`;
                    break;
                case 'savings_account_open':
                    typeDisplay = 'Apertura Cta. Ahorro';
                    detailsDisplay = `Objetivo: ${transaction.savingsGoal}, ID Cuenta: ${transaction.savingsAccountId.substring(0, 8)}...`;
                    amountDisplay = `-${(transaction.initialDepositAmount ?? 0).toFixed(2)} ${transaction.initialDepositCurrency} (de cuenta principal)`;
                    break;
                case 'deposit_to_savings':
                    typeDisplay = 'Depósito a Ahorro';
                    detailsDisplay = `Objetivo: ${transaction.savingsGoal}, ID Cuenta: ${transaction.savingsAccountId.substring(0, 8)}...`;
                    amountDisplay = `-${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency} (de principal)`;
                    break;
                case 'withdraw_from_savings':
                    typeDisplay = 'Retiro de Ahorro';
                    detailsDisplay = `Objetivo: ${transaction.savingsGoal}, ID Cuenta: ${transaction.savingsAccountId.substring(0, 8)}...`;
                    amountDisplay = `+${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency} (a principal)`;
                    break;
                case 'delete_savings_account':
                    typeDisplay = 'Eliminación Cta. Ahorro';
                    detailsDisplay = `Objetivo: ${transaction.savingsGoal}, Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
                    amountDisplay = `+${(transaction.remainingBalanceTransferred ?? 0).toFixed(2)} USD (a principal)`;
                    break;
                case 'automatic_savings_collection':
                    typeDisplay = 'Cobro Automático Ahorro';
                    detailsDisplay = `Objetivo: ${transaction.savingsGoal}, ID Cuenta: ${transaction.savingsAccountId.substring(0, 8)}...`;
                    amountDisplay = `-${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency} (a ahorro)`;
                    break;
                case 'savings_debt_payment':
                    typeDisplay = 'Pago Deuda Ahorro';
                    detailsDisplay = `Objetivo: ${transaction.savingsGoal}, ID Deuda: ${transaction.debtId.substring(0, 8)}...`;
                    amountDisplay = `-${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
                    break;
                case 'savings_indemnization_applied':
                    typeDisplay = 'Indemnización Ahorro';
                    detailsDisplay = `ID Deuda: ${transaction.debtId.substring(0, 8)}...`;
                    amountDisplay = `-${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency} (a admin)`;
                    break;
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date}</td>
                <td>${typeDisplay}</td>
                <td>${detailsDisplay}</td>
                <td>${amountDisplay}</td>
                <td>${transaction.currency}</td>
                <td><button class="btn-secondary view-receipt-btn" data-transaction-id="${transaction.id}">Ver Recibo</button></td>
            `;
            userHistoryTableBody.appendChild(row);
        }

        // Attach event listeners for "Ver Recibo" buttons
        document.querySelectorAll('.view-receipt-btn').forEach(button => {
            button.onclick = async (event) => {
                const transactionId = event.target.dataset.transactionId;
                const transactionDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'transactions', transactionId);
                const transactionDocSnap = await getDoc(transactionDocRef);
                if (transactionDocSnap.exists()) {
                    showReceipt({ id: transactionDocSnap.id, ...transactionDocSnap.data() });
                } else {
                    showMessage('No se pudo encontrar el recibo para esta transacción.', 'error');
                }
            };
        });

    }, (error) => {
        console.error("Error loading user history:", error);
        userHistoryTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-4">Error al cargar tu historial.</td></tr>`;
    });
}


/**
 * Loads and displays the full transaction history for all users in the admin modal.
 */
async function loadAdminFullHistory() {
    console.log("Admin: loadAdminFullHistory() called.");
    adminFullHistoryTableBodyModal.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">Cargando historial completo...</td></tr>';
    const transactionsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const q = query(transactionsCollectionRef, where('status', '==', 'completed'));

    onSnapshot(q, async (snapshot) => {
        console.log("Admin: onSnapshot for admin full history triggered.");
        console.log("Admin: Snapshot size for full history:", snapshot.size);

        adminFullHistoryTableBodyModal.innerHTML = '';
        if (snapshot.empty) {
            adminFullHistoryTableBodyModal.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">No hay transacciones en el historial.</td></tr>';
            console.log("Admin: No transactions found for admin history.");
            return;
        }

        const allTransactions = [];
        for (const docEntry of snapshot.docs) {
            allTransactions.push({ id: docEntry.id, ...docEntry.data() });
        }

        // Sort transactions by timestamp descending (newest first)
        allTransactions.sort((a, b) => {
            const timestampA = a.timestamp && typeof a.timestamp.seconds !== 'undefined' ? a.timestamp.seconds : 0;
            const timestampB = b.timestamp && typeof b.timestamp.seconds !== 'undefined' ? b.timestamp.seconds : 0;
            return timestampB - timestampA;
        });

        for (const transaction of allTransactions) {
            const date = (transaction.timestamp && typeof transaction.timestamp.seconds !== 'undefined')
                ? new Date(transaction.timestamp.seconds * 1000).toLocaleString()
                : 'Fecha no disponible';

            let typeDisplay = transaction.type;
            let usersInvolved = '';
            let details = '';
            let amountValue = transaction.amount;
            let currencyValue = transaction.currency;

            switch (transaction.type) {
                case 'deposit':
                    typeDisplay = 'Depósito';
                    usersInvolved = await getUserDisplayName(transaction.userId);
                    amountValue = (transaction.amount ?? 0);
                    details = `Serie: ${transaction.serialNumber || 'N/A'}`;
                    break;
                case 'withdrawal':
                    typeDisplay = 'Retiro';
                    usersInvolved = await getUserDisplayName(transaction.userId);
                    amountValue = (transaction.amount ?? 0);
                    details = `Tarifa: $${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
                    break;
                case 'transfer':
                    typeDisplay = 'Transferencia';
                    const senderName = await getUserDisplayName(transaction.senderId);
                    const recipientName = await getUserDisplayName(transaction.recipientId);
                    usersInvolved = `${senderName} (envía) -> ${recipientName} (recibe)`;
                    amountValue = (transaction.amount ?? 0);
                    details = `Descripción: ${transaction.description || 'N/A'}`;
                    break;
                case 'withdrawal_fee':
                    typeDisplay = 'Tarifa de Retiro Cobrada';
                    const feePayer = await getUserDisplayName(transaction.payerId);
                    const feeReceiver = await getUserDisplayName(transaction.receiverId);
                    usersInvolved = `${feePayer} (paga) -> ${feeReceiver} (recibe)`;
                    amountValue = (transaction.amount ?? 0); // This is the fee amount
                    currencyValue = 'USD';
                    details = `ID Solicitud Original: ${transaction.originalRequestId || 'N/A'}`;
                    break;
                case 'online_purchase':
                    typeDisplay = 'Compra Online';
                    usersInvolved = await getUserDisplayName(transaction.userId);
                    amountValue = (transaction.totalAmountDeducted ?? 0); // Show total deducted from user
                    currencyValue = 'USD';
                    details = `Cat: ${transaction.category || 'N/A'}. Links: ${transaction.productLinks ? transaction.productLinks.substring(0, 50) + '...' : 'N/A'}. Total prod: ${(transaction.productAmount ?? 0).toFixed(2)} ${transaction.productCurrency}, Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} ${transaction.feeCurrency}`;
                    break;
                case 'streaming_payment':
                    typeDisplay = 'Pago Streaming';
                    usersInvolved = await getUserDisplayName(transaction.userId);
                    amountValue = (transaction.totalAmountDeducted ?? 0); // Show total deducted from user
                    currencyValue = 'USD';
                    details = `Servicio: ${transaction.service}, Cat: ${transaction.category || 'N/A'}, Cuenta: ${transaction.accountIdentifier}, Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} ${transaction.feeCurrency}`;
                    break;
                case 'game_recharge': // NEW: Admin History Display for Game Recharge
                    typeDisplay = 'Recarga de Juego';
                    usersInvolved = await getUserDisplayName(transaction.userId);
                    amountValue = (transaction.totalAmountDeducted ?? 0);
                    currencyValue = 'USD';
                    details = `Juego: ${transaction.gameName}, ID Jugador: ${transaction.playerId}, Tipo: ${transaction.category || 'N/A'}, Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} ${transaction.feeCurrency}`;
                    break;
                case 'savings_account_open':
                    typeDisplay = 'Apertura Cta. Ahorro';
                    usersInvolved = await getUserDisplayName(transaction.userId);
                    amountValue = (transaction.initialDepositAmount ?? 0);
                    currencyValue = transaction.initialDepositCurrency;
                    details = `Objetivo: ${transaction.savingsGoal}, Cuota Periódica: $${(transaction.periodicContributionAmount ?? 0).toFixed(2)} USD, ID Cuenta: ${transaction.savingsAccountId.substring(0, 8)}...`;
                    break;
                case 'deposit_to_savings':
                    typeDisplay = 'Depósito a Ahorro';
                    usersInvolved = await getUserDisplayName(transaction.userId);
                    amountValue = (transaction.amount ?? 0);
                    currencyValue = transaction.currency;
                    details = `Objetivo: ${transaction.savingsGoal}, ID Cuenta: ${transaction.savingsAccountId.substring(0, 8)}...`;
                    break;
                case 'withdraw_from_savings':
                    typeDisplay = 'Retiro de Ahorro';
                    usersInvolved = await getUserDisplayName(transaction.userId);
                    amountValue = (transaction.amount ?? 0);
                    currencyValue = transaction.currency;
                    details = `Objetivo: ${transaction.savingsGoal}, ID Cuenta: ${transaction.savingsAccountId.substring(0, 8)}...`;
                    break;
                case 'delete_savings_account':
                    typeDisplay = 'Eliminación Cta. Ahorro';
                    usersInvolved = await getUserDisplayName(transaction.userId);
                    amountValue = (transaction.remainingBalanceTransferred ?? 0);
                    currencyValue = 'USD';
                    details = `Objetivo: ${transaction.savingsGoal}, Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
                    break;
                case 'automatic_savings_collection':
                    typeDisplay = 'Cobro Automático Ahorro';
                    usersInvolved = await getUserDisplayName(transaction.userId);
                    amountValue = (transaction.amount ?? 0);
                    currencyValue = transaction.currency;
                    details = `Objetivo: ${transaction.savingsGoal}, ID Cuenta: ${transaction.savingsAccountId.substring(0, 8)}...`;
                    break;
                case 'savings_debt_payment':
                    typeDisplay = 'Pago Deuda Ahorro';
                    usersInvolved = await getUserDisplayName(transaction.userId);
                    amountValue = (transaction.amount ?? 0);
                    currencyValue = transaction.currency;
                    details = `Objetivo: ${transaction.savingsGoal}, ID Deuda: ${transaction.debtId.substring(0, 8)}...`;
                    break;
                case 'savings_indemnization_applied':
                    typeDisplay = 'Indemnización Ahorro';
                    const payerName = await getUserDisplayName(transaction.payerId);
                    const receiverName = await getUserDisplayName(transaction.receiverId);
                    usersInvolved = `${payerName} (paga) -> ${receiverName} (recibe)`;
                    amountValue = (transaction.amount ?? 0);
                    currencyValue = transaction.currency;
                    details = `ID Deuda: ${transaction.debtId.substring(0, 8)}...`;
                    break;
                default:
                    usersInvolved = transaction.userId || 'N/A'; // Fallback
                    details = 'N/A';
                    amountValue = (transaction.amount ?? 0);
                    currencyValue = transaction.currency || 'N/A';
            }


            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date}</td>
                <td>${typeDisplay}</td>
                <td>${usersInvolved}</td>
                <td>${amountValue.toFixed(2)}</td>
                <td>${currencyValue}</td>
                <td>${transaction.status}</td>
                <td>${details}</td>
            `;
            adminFullHistoryTableBodyModal.appendChild(row); // Append to modal's tbody
        }
        console.log(`Admin: Loaded ${snapshot.docs.length} total transactions for admin history.`);
    }, (error) => {
        console.error("Admin: Error loading admin full history:", error);
        adminFullHistoryTableBodyModal.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 py-4">Error al cargar el historial completo.</td></tr>`;
    });
}

/**
 * Loads and displays the current user's pending deposits and withdrawals, and other pending requests.
 */
async function loadUserPendingRequests() {
    userPendingRequestsTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">Cargando solicitudes...</td></tr>';

    const pendingRequestsRef = collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests');
    const userPendingQuery = query(pendingRequestsRef, where('userId', '==', currentUserId), where('status', '==', 'pending'));

    onSnapshot(userPendingQuery, async (snapshot) => {
        userPendingRequestsTableBody.innerHTML = ''; // Clear table for new data
        const allPendingRequests = [];

        snapshot.forEach(docEntry => {
            const data = docEntry.data();
            let typeDisplay = '';
            let detailDisplay = '';
            let amountToDisplay = data.amount;
            let currencyToDisplay = data.currency;

            switch (data.type) {
                case 'deposit':
                    typeDisplay = 'Depósito';
                    detailDisplay = `Serie: ${data.serialNumber}`;
                    amountToDisplay = (data.amount ?? 0);
                    break;
                case 'withdrawal':
                    typeDisplay = 'Retiro';
                    detailDisplay = `Tarifa est. (4%): $${(data.estimatedFee ?? 0).toFixed(2)} USD`;
                    amountToDisplay = (data.amount ?? 0);
                    break;
                case 'online_purchase':
                    typeDisplay = 'Compra Online';
                    amountToDisplay = (data.totalAmountToDeduct ?? 0); // Show total that will be deducted
                    currencyToDisplay = 'USD';
                    detailDisplay = `Cat: ${data.category || 'N/A'}, Total prod: ${(data.productAmount ?? 0).toFixed(2)} ${data.productCurrency}, Tarifa: ${(data.feeAmount ?? 0).toFixed(2)} USD`;
                    break;
                case 'streaming_payment':
                    typeDisplay = 'Pago Streaming';
                    amountToDisplay = (data.totalAmountToDeduct ?? 0); // Show total that will be deducted
                    currencyToDisplay = 'USD';
                    detailDisplay = `Servicio: ${data.service}, Cat: ${data.category || 'N/A'}, Tarifa: ${(data.feeAmount ?? 0).toFixed(2)} USD`;
                    break;
                case 'game_recharge': // NEW: User Pending Request Display for Game Recharge
                    typeDisplay = 'Recarga de Juego';
                    amountToDisplay = (data.totalAmountToDeduct ?? 0);
                    currencyToDisplay = 'USD';
                    detailDisplay = `Juego: ${data.gameName}, ID Jugador: ${data.playerId}, Tipo: ${data.category || 'N/A'}, Tarifa: ${(data.feeAmount ?? 0).toFixed(2)} USD`;
                    break;
                case 'savings_account_open':
                    typeDisplay = 'Apertura Cta. Ahorro';
                    amountToDisplay = (data.initialDepositAmount ?? 0);
                    currencyToDisplay = data.initialDepositCurrency;
                    detailDisplay = `Objetivo: ${data.savingsGoal}, Frecuencia: ${data.preferredSavingsFrequency}, Cuota: $${(data.periodicContributionAmount ?? 0).toFixed(2)} USD, Fin: ${data.endDate || 'N/A'}`;
                    break;
                default:
                    typeDisplay = 'Desconocido';
                    detailDisplay = 'N/A';
                    amountToDisplay = (data.amount ?? 0);
            }

            allPendingRequests.push({
                id: docEntry.id,
                type: typeDisplay,
                amount: amountToDisplay,
                currency: currencyToDisplay,
                status: data.status,
                timestamp: data.timestamp,
                detail: detailDisplay
            });
        });

        if (allPendingRequests.length === 0) {
            userPendingRequestsTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">No tienes solicitudes pendientes.</td></tr>';
            return;
        }

        // Sort by timestamp descending
        allPendingRequests.sort((a, b) => {
            const timestampA = a.timestamp && typeof a.timestamp.seconds !== 'undefined' ? a.timestamp.seconds : 0;
            const timestampB = b.timestamp && typeof b.timestamp.seconds !== 'undefined' ? b.timestamp.seconds : 0;
            return timestampB - timestampA;
        });

        for (const request of allPendingRequests) {
            const date = (request.timestamp && typeof request.timestamp.seconds !== 'undefined')
                ? new Date(request.timestamp.seconds * 1000).toLocaleString()
                : 'Fecha no disponible';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date}</td>
                <td>${request.type}</td>
                <td>${request.amount.toFixed(2)}</td>
                <td>${request.currency}</td>
                <td>${request.status === 'pending' ? 'Pendiente' : request.status}</td>
                <td>${request.detail}</td>
            `;
            userPendingRequestsTableBody.appendChild(row);
        }
    }, (error) => {
        console.error("Error loading user pending requests:", error);
        userPendingRequestsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-4">Error al cargar solicitudes pendientes.</td></tr>`;
    });
}

// --- NEW: Open Savings Account Functionality ---
openSavingsAccountBtn.addEventListener('click', () => {
    openSavingsAccountModal.classList.remove('hidden');
    savingsAccountForm.reset();
    // Set min date for savingsEndDate to today
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    savingsEndDateInput.min = `${year}-${month}-${day}`;
});

cancelOpenSavingsAccountBtn.addEventListener('click', () => {
    closeModal(openSavingsAccountModal);
    savingsAccountForm.reset();
});

savingsAccountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const savingsGoal = savingsGoalInput.value.trim();
    const initialDepositAmount = parseFloat(initialDepositAmountInput.value);
    const initialDepositCurrency = initialDepositCurrencyInput.value;
    const preferredSavingsFrequency = preferredSavingsFrequencyInput.value;
    const periodicContributionAmount = parseFloat(periodicContributionAmountInput.value); // Get periodic contribution
    const savingsEndDate = savingsEndDateInput.value; // Get end date

    if (!savingsGoal || isNaN(initialDepositAmount) || initialDepositAmount <= 0 || !preferredSavingsFrequency || isNaN(periodicContributionAmount) || periodicContributionAmount < 0 || !savingsEndDate) {
        showMessage('Por favor, completa todos los campos correctamente para tu cuenta de ahorro.', 'error');
        return;
    }

    let initialDepositAmountInUSD = initialDepositAmount;
    if (initialDepositCurrency === 'DOP') {
        initialDepositAmountInUSD = initialDepositAmount / USD_TO_DOP_RATE;
    }

    if (currentBalanceUSD < initialDepositAmountInUSD) {
        showMessage(`Saldo insuficiente en tu cuenta principal para depositar ${initialDepositAmount.toFixed(2)} ${initialDepositCurrency} en tu cuenta de ahorro. Necesitas al menos $${initialDepositAmountInUSD.toFixed(2)} USD.`, 'error');
        return;
    }

    try {
        // Add savings account opening request to 'pending_requests'
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'savings_account_open',
            savingsGoal: savingsGoal,
            initialDepositAmount: initialDepositAmount,
            initialDepositCurrency: initialDepositCurrency,
            preferredSavingsFrequency: preferredSavingsFrequency,
            periodicContributionAmount: periodicContributionAmount, // Store periodic contribution
            startDate: serverTimestamp(), // Automatically set start date
            endDate: savingsEndDate, // Store provided end date
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage(`Solicitud para abrir cuenta de ahorro para "${savingsGoal}" enviada. Esperando aprobación del administrador.`, 'success');
        closeModal(openSavingsAccountModal);
        savingsAccountForm.reset();

        // Send WhatsApp message to admin
        const userDocSnap = await getDoc(doc(db, 'artifacts', appId, 'users', currentUserId));
        const userData = userDocSnap.data();
        const whatsappMessage = `
        Nueva solicitud de apertura de cuenta de ahorro pendiente:
        Usuario: ${userData.name} ${userData.surname} (ID: ${userData.userDisplayId || userData.userId})
        Objetivo: ${savingsGoal}
        Depósito Inicial: ${initialDepositAmount.toFixed(2)} ${initialDepositCurrency}
        Frecuencia Preferida: ${preferredSavingsFrequency}
        Cuota Periódica: $${periodicContributionAmount.toFixed(2)} USD
        Fecha Finalización: ${savingsEndDate}
        Por favor, revisa y confirma.
        `;
        const encodedMessage = encodeURIComponent(whatsappMessage);
        window.open(`https://wa.me/${ADMIN_PHONE_NUMBER_FULL}?text=${encodedMessage}`, '_blank');

    } catch (error) {
        console.error("Error al solicitar cuenta de ahorro:", error);
        showMessage('Error al procesar la solicitud de cuenta de ahorro. Por favor, inténtalo de nuevo.', 'error');
    }
});

// --- NEW: View Savings Accounts Functionality ---
viewSavingsAccountsBtn.addEventListener('click', () => {
    viewSavingsAccountsModal.classList.remove('hidden');
    loadSavingsAccounts();
});

closeViewSavingsAccountsBtn.addEventListener('click', () => {
    closeModal(viewSavingsAccountsModal);
});

/**
 * Loads and displays the user's savings accounts and handles automatic collection.
 */
async function loadSavingsAccounts() {
    savingsAccountsTableBody.innerHTML = '<tr><td colspan="10" class="text-center text-gray-500 py-4">Cargando cuentas de ahorro...</td></tr>';

    if (!currentUserId) {
        savingsAccountsTableBody.innerHTML = '<tr><td colspan="10" class="text-center text-red-500 py-4">Inicia sesión para ver tus cuentas de ahorro.</td></tr>';
        return;
    }

    const savingsAccountsRef = collection(db, 'artifacts', appId, 'users', currentUserId, 'savings_accounts');

    onSnapshot(savingsAccountsRef, async (snapshot) => {
        savingsAccountsTableBody.innerHTML = '';
        if (snapshot.empty) {
            savingsAccountsTableBody.innerHTML = '<tr><td colspan="10" class="text-center text-gray-500 py-4">No tienes cuentas de ahorro activas.</td></tr>';
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day for comparison

        for (const docEntry of snapshot.docs) {
            const account = docEntry.data();
            const savingsAccountId = docEntry.id;

            const startDateDisplay = account.startDate ? new Date(account.startDate.seconds * 1000).toLocaleDateString() : 'N/A';
            const endDateDisplay = account.endDate || 'N/A';
            const nextContributionDueDateDisplay = account.nextContributionDueDate ? new Date(account.nextContributionDueDate.seconds * 1000).toLocaleDateString() : 'N/A';

            // --- Automatic Collection Logic ---
            if (account.status === 'active' && account.preferredSavingsFrequency !== 'Ocasional' && account.periodicContributionAmount > 0) {
                const nextDueDate = account.nextContributionDueDate ? new Date(account.nextContributionDueDate.seconds * 1000) : null;
                const lastAttemptDate = account.lastContributionAttemptDate ? new Date(account.lastContributionAttemptDate.seconds * 1000) : null;

                // Normalize nextDueDate and lastAttemptDate to start of day for accurate comparison
                if (nextDueDate) nextDueDate.setHours(0, 0, 0, 0);
                if (lastAttemptDate) lastAttemptDate.setHours(0, 0, 0, 0);

                // Check if a payment is due AND it hasn't been attempted today
                if (nextDueDate && today >= nextDueDate && (!lastAttemptDate || today > lastAttemptDate)) {
                    console.log(`Attempting automatic collection for savings account ${savingsAccountId} (Goal: ${account.savingsGoal})`);
                    await attemptAutomaticSavingsCollection(currentUserId, savingsAccountId, account.periodicContributionAmount, account.savingsGoal);
                }
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${account.accountId.substring(0, 8)}...</td>
                <td>${account.savingsGoal}</td>
                <td>$${(account.balanceUSD ?? 0).toFixed(2)} USD</td>
                <td>RD$${(account.balanceDOP ?? 0).toFixed(2)} DOP</td>
                <td>${account.preferredSavingsFrequency}</td>
                <td>$${(account.periodicContributionAmount ?? 0).toFixed(2)} USD</td>
                <td>${nextContributionDueDateDisplay}</td>
                <td>${endDateDisplay}</td>
                <td>${account.status === 'active' ? 'Activa' : account.status}</td>
                <td>
                    <button class="btn-primary btn-sm deposit-to-savings-btn"
                        data-account-id="${account.accountId}"
                        data-savings-goal="${account.savingsGoal}"
                        >Depositar</button>
                    <button class="btn-secondary btn-sm withdraw-from-savings-btn"
                        data-account-id="${account.accountId}"
                        data-savings-goal="${account.savingsGoal}"
                        data-balance-usd="${account.balanceUSD}"
                        >Retirar</button>
                    <button class="btn-danger btn-sm delete-savings-account-btn mt-2"
                        data-account-id="${account.accountId}"
                        data-savings-goal="${account.savingsGoal}"
                        data-balance-usd="${account.balanceUSD}"
                        >Eliminar</button>
                </td>
            `;
            savingsAccountsTableBody.appendChild(row);
        }

        // Attach event listeners for new buttons using delegation
        savingsAccountsTableBody.querySelectorAll('.deposit-to-savings-btn').forEach(button => {
            button.onclick = (event) => {
                const { accountId, savingsGoal } = event.target.dataset;
                showDepositToSavingsModal(accountId, savingsGoal);
            };
        });
        savingsAccountsTableBody.querySelectorAll('.withdraw-from-savings-btn').forEach(button => {
            button.onclick = (event) => {
                const { accountId, savingsGoal, balanceUsd } = event.target.dataset;
                showWithdrawFromSavingsModal(accountId, savingsGoal, parseFloat(balanceUsd));
            };
        });
        savingsAccountsTableBody.querySelectorAll('.delete-savings-account-btn').forEach(button => {
            button.onclick = (event) => {
                const { accountId, savingsGoal, balanceUsd } = event.target.dataset;
                showConfirmDeleteSavingsAccountModal(accountId, savingsGoal, parseFloat(balanceUsd));
            };
        });

    }, (error) => {
        console.error("Error loading savings accounts:", error);
        savingsAccountsTableBody.innerHTML = `<tr><td colspan="10" class="text-center text-red-500 py-4">Error al cargar cuentas de ahorro.</td></tr>`;
    });
}

/**
 * Attempts to automatically collect savings contribution.
 * @param {string} userId The user's Firebase UID.
 * @param {string} savingsAccountId The ID of the savings account.
 * @param {number} amount The amount to collect.
 * @param {string} savingsGoal The goal of the savings account.
 */
async function attemptAutomaticSavingsCollection(userId, savingsAccountId, amount, savingsGoal) {
    console.log(`Attempting automatic collection for user ${userId}, account ${savingsAccountId}, amount ${amount}`);
    try {
        const userProfileRef = doc(db, 'artifacts', appId, 'users', userId);
        const savingsAccountRef = doc(db, 'artifacts', appId, 'users', userId, 'savings_accounts', savingsAccountId);

        const userDocSnap = await getDoc(userProfileRef);
        const savingsDocSnap = await getDoc(savingsAccountRef);

        if (!userDocSnap.exists() || !savingsDocSnap.exists()) {
            console.error("User or savings account not found during automatic collection attempt.");
            return;
        }

        const userData = userDocSnap.data();
        const savingsData = savingsDocSnap.data();

        let userCurrentBalanceUSD = userData.balanceUSD || 0;
        let savingsCurrentBalanceUSD = savingsData.balanceUSD || 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Update lastContributionAttemptDate regardless of success/failure
        await updateDoc(savingsAccountRef, {
            lastContributionAttemptDate: serverTimestamp()
        });

        if (userCurrentBalanceUSD >= amount) {
            // Sufficient funds: perform transfer
            let newUserBalanceUSD = userCurrentBalanceUSD - amount;
            let newUserBalanceDOP = newUserBalanceUSD * USD_TO_DOP_RATE;

            let newSavingsBalanceUSD = savingsCurrentBalanceUSD + amount;
            let newSavingsBalanceDOP = newSavingsBalanceUSD * USD_TO_DOP_RATE;

            await updateDoc(userProfileRef, {
                balanceUSD: newUserBalanceUSD,
                balanceDOP: newUserBalanceDOP
            });
            await updateDoc(savingsAccountRef, {
                balanceUSD: newSavingsBalanceUSD,
                balanceDOP: newSavingsBalanceDOP,
                nextContributionDueDate: getNextDueDate(savingsData.preferredSavingsFrequency, today) // Update next due date
            });

            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
                userId: userId,
                type: 'automatic_savings_collection',
                amount: amount,
                currency: 'USD',
                savingsAccountId: savingsAccountId,
                savingsGoal: savingsGoal,
                timestamp: serverTimestamp(),
                status: 'completed',
                description: `Cobro automático de ahorro para "${savingsGoal}"`
            });
            showMessage(`¡Cobro automático de $${amount.toFixed(2)} USD para "${savingsGoal}" realizado con éxito!`, 'success');
            console.log(`Automatic collection for ${savingsGoal} successful.`);

        } else {
            // Insufficient funds: record a debt
            console.log(`Insufficient funds for automatic collection for ${savingsGoal}. Recording debt.`);

            // Check if a debt for this period already exists and is pending/overdue
            const existingDebtsQuery = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'savings_debts'),
                where('userId', '==', userId),
                where('savingsAccountId', '==', savingsAccountId),
                where('status', 'in', ['pending', 'overdue'])
            );
            const existingDebtsSnap = await getDocs(existingDebtsQuery);

            if (existingDebtsSnap.empty) {
                // Create new debt entry
                const dueDateForDebt = addDays(today, 7); // 7 days to pay the debt
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'savings_debts'), {
                    userId: userId,
                    savingsAccountId: savingsAccountId,
                    savingsGoal: savingsGoal,
                    amountDue: amount,
                    currency: 'USD',
                    dueDate: dueDateForDebt,
                    status: 'pending', // 'pending' for payment, 'overdue' if past dueDate, 'paid', 'penalized'
                    penaltyApplied: false,
                    createdAt: serverTimestamp(),
                    lastUpdated: serverTimestamp()
                });
                showMessage(`No hay suficiente saldo para el cobro automático de "${savingsGoal}". Se ha registrado una deuda de $${amount.toFixed(2)} USD. Tienes hasta el ${dueDateForDebt.toLocaleDateString()} para pagar.`, 'error');
            } else {
                console.log(`Debt for ${savingsGoal} already exists for this period. No new debt created.`);
                showMessage(`Ya tienes una deuda pendiente para tu cuenta de ahorro "${savingsGoal}".`, 'info');
            }

            // Update next contribution due date even if debt is created, to prevent re-attempting same period
            await updateDoc(savingsAccountRef, {
                nextContributionDueDate: getNextDueDate(savingsData.preferredSavingsFrequency, today)
            });
        }
    } catch (error) {
        console.error("Error during automatic savings collection:", error);
        showMessage(`Error en el cobro automático para "${savingsGoal}". Intenta de nuevo más tarde.`, 'error');
    }
}

/**
 * Calculates the next contribution due date based on frequency.
 * @param {string} frequency The preferred savings frequency.
 * @param {Date} lastDate The last date a contribution was due or attempted.
 * @returns {Date} The next due date.
 */
function getNextDueDate(frequency, lastDate) {
    let nextDate = new Date(lastDate); // Start from the last attempted/due date
    if (frequency === 'Diaria') {
        nextDate = addDays(nextDate, 1);
    } else if (frequency === 'Semanal') {
        nextDate = addWeeks(nextDate, 1);
    } else if (frequency === 'Quincenal') {
        nextDate = addDays(nextDate, 15);
    } else if (frequency === 'Mensual') {
        nextDate = addMonths(nextDate, 1);
    }
    return nextDate;
}

// --- NEW: Deposit to Savings Modal Functions ---
function showDepositToSavingsModal(accountId, savingsGoal) {
    currentSavingsAccountId = accountId;
    depositToSavingsAccountIdDisplay.textContent = `${savingsGoal} (${accountId.substring(0, 8)}...)`;
    depositToSavingsModal.classList.remove('hidden');
    depositToSavingsForm.reset();
}

cancelDepositToSavingsBtn.addEventListener('click', () => {
    closeModal(depositToSavingsModal);
});

depositToSavingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const amount = parseFloat(depositToSavingsAmountInput.value);
    const currency = depositToSavingsCurrencyInput.value;

    if (isNaN(amount) || amount <= 0) {
        showMessage('El monto a depositar debe ser un número positivo.', 'error');
        return;
    }

    let amountInUSD = amount;
    if (currency === 'DOP') {
        amountInUSD = amount / USD_TO_DOP_RATE;
    }

    if (currentBalanceUSD < amountInUSD) {
        showMessage(`Saldo insuficiente en tu cuenta principal para depositar ${amount.toFixed(2)} ${currency} en tu cuenta de ahorro. Necesitas al menos $${amountInUSD.toFixed(2)} USD.`, 'error');
        return;
    }

    try {
        const userProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        const savingsAccountRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'savings_accounts', currentSavingsAccountId);

        const userDocSnap = await getDoc(userProfileRef);
        const savingsDocSnap = await getDoc(savingsAccountRef);

        if (!userDocSnap.exists() || !savingsDocSnap.exists()) {
            showMessage('Error: No se encontró tu perfil o la cuenta de ahorro.', 'error');
            return;
        }

        const userData = userDocSnap.data();
        const savingsData = savingsDocSnap.data();

        // Deduct from main account
        let newUserBalanceUSD = userData.balanceUSD - amountInUSD;
        let newUserBalanceDOP = newUserBalanceUSD * USD_TO_DOP_RATE;

        // Add to savings account
        let newSavingsBalanceUSD = savingsData.balanceUSD + amountInUSD;
        let newSavingsBalanceDOP = newSavingsBalanceUSD * USD_TO_DOP_RATE;

        await updateDoc(userProfileRef, {
            balanceUSD: newUserBalanceUSD,
            balanceDOP: newUserBalanceDOP
        });

        await updateDoc(savingsAccountRef, {
            balanceUSD: newSavingsBalanceUSD,
            balanceDOP: newSavingsBalanceDOP
        });

        // Record transaction
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: currentUserId,
            type: 'deposit_to_savings',
            amount: amount,
            currency: currency,
            savingsAccountId: currentSavingsAccountId,
            savingsGoal: savingsData.savingsGoal,
            timestamp: serverTimestamp(),
            status: 'completed',
            description: `Depósito a cuenta de ahorro "${savingsData.savingsGoal}"`
        });

        showMessage(`¡Depósito de ${amount.toFixed(2)} ${currency} a tu cuenta de ahorro realizado con éxito!`, 'success');
        closeModal(depositToSavingsModal);
    } catch (error) {
        console.error("Error depositing to savings account:", error);
        showMessage('Error al depositar en la cuenta de ahorro. Intenta de nuevo.', 'error');
    }
});

// --- NEW: Withdraw from Savings Modal Functions ---
function showWithdrawFromSavingsModal(accountId, savingsGoal, balanceUsd) {
    currentSavingsAccountId = accountId;
    currentSavingsAccountGoal = savingsGoal;
    currentSavingsAccountBalanceUSD = balanceUsd; // Store for validation
    withdrawFromSavingsAccountIdDisplay.textContent = `${savingsGoal} (${accountId.substring(0, 8)}...)`;
    withdrawFromSavingsModal.classList.remove('hidden');
    withdrawFromSavingsForm.reset();
}

cancelWithdrawFromSavingsBtn.addEventListener('click', () => {
    closeModal(withdrawFromSavingsModal);
});

withdrawFromSavingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const amount = parseFloat(withdrawFromSavingsAmountInput.value);
    const currency = withdrawFromSavingsCurrencyInput.value;

    if (isNaN(amount) || amount <= 0) {
        showMessage('El monto a retirar debe ser un número positivo.', 'error');
        return;
    }

    let amountInUSD = amount;
    if (currency === 'DOP') {
        amountInUSD = amount / USD_TO_DOP_RATE;
    }

    if (currentSavingsAccountBalanceUSD < amountInUSD) {
        showMessage(`Saldo insuficiente en tu cuenta de ahorro para retirar ${amount.toFixed(2)} ${currency}. Saldo actual: $${currentSavingsAccountBalanceUSD.toFixed(2)} USD.`, 'error');
        return;
    }

    try {
        const userProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        const savingsAccountRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'savings_accounts', currentSavingsAccountId);

        const userDocSnap = await getDoc(userProfileRef);
        const savingsDocSnap = await getDoc(savingsAccountRef);

        if (!userDocSnap.exists() || !savingsDocSnap.exists()) {
            showMessage('Error: No se encontró tu perfil o la cuenta de ahorro.', 'error');
            return;
        }

        const userData = userDocSnap.data();
        const savingsData = savingsDocSnap.data();

        // Deduct from savings account
        let newSavingsBalanceUSD = savingsData.balanceUSD - amountInUSD;
        let newSavingsBalanceDOP = newSavingsBalanceUSD * USD_TO_DOP_RATE;

        // Add to main account
        let newUserBalanceUSD = userData.balanceUSD + amountInUSD;
        let newUserBalanceDOP = newUserBalanceUSD * USD_TO_DOP_RATE;

        await updateDoc(userProfileRef, {
            balanceUSD: newUserBalanceUSD,
            balanceDOP: newUserBalanceDOP
        });

        await updateDoc(savingsAccountRef, {
            balanceUSD: newSavingsBalanceUSD,
            balanceDOP: newSavingsBalanceDOP
        });

        // Record transaction
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: currentUserId,
            type: 'withdraw_from_savings',
            amount: amount,
            currency: currency,
            savingsAccountId: currentSavingsAccountId,
            savingsGoal: savingsData.savingsGoal,
            timestamp: serverTimestamp(),
            status: 'completed',
            description: `Retiro de cuenta de ahorro "${savingsData.savingsGoal}"`
        });

        showMessage(`¡Retiro de ${amount.toFixed(2)} ${currency} de tu cuenta de ahorro realizado con éxito!`, 'success');
        closeModal(withdrawFromSavingsModal);
    } catch (error) {
        console.error("Error withdrawing from savings account:", error);
        showMessage('Error al retirar de la cuenta de ahorro. Intenta de nuevo.', 'error');
    }
});

// --- NEW: Delete Savings Account Functions ---
function showConfirmDeleteSavingsAccountModal(accountId, savingsGoal, balanceUsd) {
    currentSavingsAccountId = accountId;
    currentSavingsAccountGoal = savingsGoal;
    currentSavingsAccountBalanceUSD = balanceUsd; // Store for calculation

    const feeAmount = balanceUsd * SAVINGS_DELETE_FEE_RATE;
    const remainingBalance = balanceUsd - feeAmount;

    deleteSavingsAccountGoalDisplay.textContent = savingsGoal;
    deleteSavingsAccountFeeDisplay.textContent = `$${feeAmount.toFixed(2)} USD`;
    deleteSavingsAccountRemainingDisplay.textContent = `$${remainingBalance.toFixed(2)} USD`;

    confirmDeleteSavingsAccountModal.classList.remove('hidden');
}

cancelDeleteSavingsAccountBtn.addEventListener('click', () => {
    closeModal(confirmDeleteSavingsAccountModal);
});
cancelDeleteSavingsAccountBtn2.addEventListener('click', () => { // Second cancel button
    closeModal(confirmDeleteSavingsAccountModal);
});

confirmDeleteSavingsAccountBtn.addEventListener('click', async () => {
    hideMessage();

    if (!currentSavingsAccountId) {
        showMessage('Error: No se seleccionó ninguna cuenta de ahorro para eliminar.', 'error');
        return;
    }

    try {
        const userProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        const savingsAccountRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'savings_accounts', currentSavingsAccountId);

        const userDocSnap = await getDoc(userProfileRef);
        const savingsDocSnap = await getDoc(savingsAccountRef);

        if (!userDocSnap.exists() || !savingsDocSnap.exists()) {
            showMessage('Error: No se encontró tu perfil o la cuenta de ahorro a eliminar.', 'error');
            return;
        }

        const userData = userDocSnap.data();
        const savingsData = savingsDocSnap.data();
        const savingsBalanceUSD = savingsData.balanceUSD || 0;

        const feeAmount = savingsBalanceUSD * SAVINGS_DELETE_FEE_RATE;
        const remainingBalanceToTransfer = savingsBalanceUSD - feeAmount;

        // Update main account balance
        let newUserBalanceUSD = userData.balanceUSD + remainingBalanceToTransfer;
        let newUserBalanceDOP = newUserBalanceUSD * USD_TO_DOP_RATE;

        await updateDoc(userProfileRef, {
            balanceUSD: newUserBalanceUSD,
            balanceDOP: newUserBalanceDOP
        });

        // Transfer fee to admin
        let adminId = null;
        const adminUsersCollectionRef = collection(db, 'artifacts', appId, 'users');
        const adminQuery = query(adminUsersCollectionRef, where('email', '==', ADMIN_EMAIL));
        const adminSnapshot = await getDocs(adminQuery);
        if (!adminSnapshot.empty) {
            adminId = adminSnapshot.docs[0].id;
            const adminProfileRef = doc(db, 'artifacts', appId, 'users', adminId);
            const adminData = (await getDoc(adminProfileRef)).data();
            let adminNewBalanceUSD = (adminData.balanceUSD || 0) + feeAmount;
            await updateDoc(adminProfileRef, { balanceUSD: adminNewBalanceUSD, balanceDOP: adminNewBalanceUSD * USD_TO_DOP_RATE });
            console.log("Savings account deletion fee transferred to admin and recorded.");
        } else {
            console.warn("Admin account not found. Savings account deletion fee might not be transferred.");
        }


        // Delete the savings account document
        await deleteDoc(savingsAccountRef);

        // Record transaction for deletion
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: currentUserId,
            type: 'delete_savings_account',
            savingsAccountId: currentSavingsAccountId,
            savingsGoal: savingsData.savingsGoal,
            feeAmount: feeAmount,
            remainingBalanceTransferred: remainingBalanceToTransfer,
            timestamp: serverTimestamp(),
            status: 'completed',
            description: `Eliminación de cuenta de ahorro "${savingsData.savingsGoal}"`
        });

        showMessage(`¡Cuenta de ahorro "${currentSavingsAccountGoal}" eliminada con éxito! Se transfirieron $${remainingBalanceToTransfer.toFixed(2)} USD a tu cuenta principal (después de la tarifa de $${feeAmount.toFixed(2)} USD).`, 'success');
        closeModal(confirmDeleteSavingsAccountModal);
        // The loadSavingsAccounts() onSnapshot listener will automatically refresh the table
    } catch (error) {
        console.error("Error deleting savings account:", error);
        showMessage('Error al eliminar la cuenta de ahorro. Intenta de nuevo.', 'error');
    }
});


// --- NEW: Admin Edit Announcements Functionality ---
editAnnouncementsBtn.addEventListener('click', async () => {
    editAnnouncementsModal.classList.remove('hidden');
    await loadAnnouncementsForEdit(); // Load current announcements into the textarea
});

cancelEditAnnouncementsBtn.addEventListener('click', () => {
    closeModal(editAnnouncementsModal);
    editAnnouncementsForm.reset();
});

editAnnouncementsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const newAnnouncementsText = announcementsTextarea.value.trim();
    const newAnnouncementsArray = newAnnouncementsText.split('\n').map(line => line.trim()).filter(line => line !== '');

    try {
        const announcementsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcements');
        await setDoc(announcementsDocRef, {
            items: newAnnouncementsArray,
            lastUpdated: serverTimestamp()
        }, { merge: true }); // Use merge to avoid overwriting other fields if they exist

        showMessage('¡Anuncios actualizados exitosamente!', 'success');
        closeModal(editAnnouncementsModal);
    } catch (error) {
        console.error("Error updating announcements:", error);
        showMessage('Error al actualizar los anuncios. Intenta de nuevo.', 'error');
    }
});

/**
 * Loads announcements into the dashboard list and the edit textarea.
 * Uses onSnapshot for real-time updates on the dashboard.
 */
function loadAnnouncements() {
    const announcementsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcements');

    onSnapshot(announcementsDocRef, (docSnap) => {
        announcementsList.innerHTML = ''; // Clear existing list
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.items && Array.isArray(data.items) && data.items.length > 0) {
                data.items.forEach(item => {
                    const li = document.createElement('li');
                    li.textContent = item;
                    announcementsList.appendChild(li);
                });
            } else {
                announcementsList.innerHTML = '<li>No hay anuncios importantes en este momento.</li>';
            }
        } else {
            announcementsList.innerHTML = '<li>No hay anuncios importantes en este momento.</li>';
        }
    }, (error) => {
        console.error("Error loading announcements:", error);
        announcementsList.innerHTML = '<li>Error al cargar anuncios.</li>';
    });
}

/**
 * Loads announcements specifically for the edit modal textarea.
 */
async function loadAnnouncementsForEdit() {
    try {
        const announcementsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcements');
        const docSnap = await getDoc(announcementsDocRef);
        if (docSnap.exists() && docSnap.data().items && Array.isArray(docSnap.data().items)) {
            announcementsTextarea.value = docSnap.data().items.join('\n');
        } else {
            announcementsTextarea.value = ''; // Clear if no announcements or wrong format
        }
    } catch (error) {
        console.error("Error loading announcements for edit:", error);
        announcementsTextarea.value = 'Error al cargar anuncios para editar.';
    }
}


// --- Edit Profile Functions ---
editProfileBtn.addEventListener('click', async () => {
    if (!currentUser) {
        showMessage('Debes iniciar sesión para editar tu perfil.', 'error');
        return;
    }
    try {
        const userDocRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            editNameInput.value = userData.name || '';
            editSurnameInput.value = userData.surname || '';
            editAgeInput.value = userData.age || '';
            editPhoneNumberInput.value = userData.phoneNumber || ''; // Populate phone number
            editProfileModal.classList.remove('hidden');
        } else {
            showMessage('No se pudieron cargar los datos de tu perfil.', 'error');
        }
    } catch (error) {
        console.error("Error loading profile for editing:", error);
        showMessage('Error al cargar los datos de tu perfil. Intenta de nuevo.', 'error');
    }
});

cancelEditProfileBtn.addEventListener('click', () => {
    closeModal(editProfileModal);
    editProfileForm.reset();
});

editProfileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const name = editNameInput.value.trim();
    const surname = editSurnameInput.value.trim();
    const age = parseInt(editAgeInput.value);
    const phoneNumber = editPhoneNumberInput.value.trim(); // Get phone number

    if (!name || !surname || isNaN(age) || age <= 0 || !phoneNumber) {
        showMessage('Por favor, completa todos los campos correctamente.', 'error');
        return;
    }

    try {
        const userDocRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        await updateDoc(userDocRef, {
            name: name,
            surname: surname,
            age: age,
            phoneNumber: phoneNumber // Update phone number
        });
        showMessage('¡Perfil actualizado exitosamente!', 'success');
        closeModal(editProfileModal);
    } catch (error) {
        console.error("Error updating profile:", error);
        showMessage('Error al actualizar el perfil. Intenta de nuevo.', 'error');
    }
});

// --- Change Password Functions ---
changePasswordBtn.addEventListener('click', () => {
    if (!currentUser) {
        showMessage('Debes iniciar sesión para cambiar tu contraseña.', 'error');
        return;
    }
    changePasswordModal.classList.remove('hidden');
    changePasswordForm.reset();
});

cancelChangePasswordBtn.addEventListener('click', () => {
    closeModal(changePasswordModal);
    changePasswordForm.reset();
});

changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmNewPassword = confirmNewPasswordInput.value;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        showMessage('Por favor, completa todos los campos.', 'error');
        return;
    }
    if (newPassword !== confirmNewPassword) {
        showMessage('La nueva contraseña y su confirmación no coinciden.', 'error');
        return;
    }
    if (newPassword.length < 6) {
        showMessage('La nueva contraseña debe tener al menos 6 caracteres.', 'error');
        return;
    }
    if (currentPassword === newPassword) {
        showMessage('La nueva contraseña no puede ser igual a la actual.', 'error');
        return;
    }

    try {
        // Re-authenticate user with current password
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);

        // Update password
        await updatePassword(currentUser, newPassword);

        showMessage('¡Contraseña actualizada exitosamente!', 'success');
        closeModal(changePasswordModal);
        changePasswordForm.reset();
    } catch (error) {
        console.error("Error changing password:", error);
        let errorMessage = 'Error al cambiar la contraseña. Por favor, inténtalo de nuevo.';
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = 'La contraseña actual es incorrecta.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'La nueva contraseña es demasiado débil. Debe tener al menos 6 caracteres.';
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = 'Por favor, inicia sesión de nuevo para cambiar tu contraseña. Por motivos de seguridad.';
        }
        showMessage(errorMessage, 'error');
    }
});

// --- Security Tips Functions ---
securityTipsBtn.addEventListener('click', () => {
    securityTipsModal.classList.remove('hidden');
});

closeSecurityTipsBtn.addEventListener('click', () => {
    closeModal(securityTipsModal);
});

// --- About Us Functions ---
aboutUsBtn.addEventListener('click', () => {
    aboutUsModal.classList.remove('hidden');
});

closeAboutUsBtn.addEventListener('click', () => {
    closeModal(aboutUsModal);
});

// --- Contact & Support Functions ---
contactSupportBtn.addEventListener('click', () => {
    contactSupportModal.classList.remove('hidden');
});

closeContactSupportBtn.addEventListener('click', () => {
    closeModal(contactSupportModal);
});

// --- NEW: Client Savings Debts Functions ---
viewSavingsDebtsBtn.addEventListener('click', () => {
    savingsDebtsModal.classList.remove('hidden');
    loadSavingsDebts();
});

closeSavingsDebtsModalBtn.addEventListener('click', () => {
    closeModal(savingsDebtsModal);
    // Unsubscribe from the listener when the modal is closed
    if (savingsDebtsUnsubscribe) {
        savingsDebtsUnsubscribe();
        savingsDebtsUnsubscribe = null;
        console.log("Client: Unsubscribed from savings debts listener on modal close.");
    }
});

/**
 * Loads and displays the current user's savings debts.
 */
async function loadSavingsDebts() {
    // Unsubscribe from previous listener if it exists
    if (savingsDebtsUnsubscribe) {
        savingsDebtsUnsubscribe();
        savingsDebtsUnsubscribe = null; // Reset
        console.log("Client: Unsubscribed from previous savings debts listener.");
    }

    savingsDebtsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">Cargando deudas...</td></tr>';

    if (!currentUserId) {
        savingsDebtsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500 py-4">Inicia sesión para ver tus deudas.</td></tr>';
        return;
    }

    const debtsRef = collection(db, 'artifacts', appId, 'public', 'data', 'savings_debts');
    const q = query(debtsRef, where('userId', '==', currentUserId), where('status', 'in', ['pending', 'overdue']));

    // Assign the unsubscribe function to savingsDebtsUnsubscribe
    savingsDebtsUnsubscribe = onSnapshot(q, async (snapshot) => {
        savingsDebtsTableBody.innerHTML = '';
        if (snapshot.empty) {
            savingsDebtsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">No tienes deudas de ahorro pendientes.</td></tr>';
            return;
        }

        for (const docEntry of snapshot.docs) {
            const debt = docEntry.data();
            const debtId = docEntry.id;
            const dueDate = debt.dueDate ? new Date(debt.dueDate.seconds * 1000).toLocaleDateString() : 'N/A';
            const statusDisplay = debt.status === 'pending' ? 'Pendiente' : (debt.status === 'overdue' ? 'Vencida' : debt.status);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${debt.savingsGoal} (${debt.savingsAccountId.substring(0, 8)}...)</td>
                <td>$${(debt.amountDue ?? 0).toFixed(2)} ${debt.currency}</td>
                <td>${dueDate}</td>
                <td>${statusDisplay}</td>
                <td>
                    <button class="btn-success btn-sm pay-debt-btn"
                        data-debt-id="${debtId}"
                        data-amount-due="${debt.amountDue}"
                        data-currency="${debt.currency}"
                        data-savings-goal="${debt.savingsGoal}"
                        data-savings-account-id="${debt.savingsAccountId}"
                        >Pagar</button>
                </td>
            `;
            savingsDebtsTableBody.appendChild(row);
        }

        // Attach event listeners for "Pagar" buttons
        savingsDebtsTableBody.querySelectorAll('.pay-debt-btn').forEach(button => {
            button.onclick = async (event) => {
                const { debtId, amountDue, currency, savingsGoal, savingsAccountId } = event.target.dataset;
                await paySavingsDebt(debtId, parseFloat(amountDue), currency, savingsGoal, savingsAccountId);
            };
        });

    }, (error) => {
        console.error("Error loading savings debts:", error);
        savingsDebtsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-4">Error al cargar deudas de ahorro.</td></tr>`;
    });
}

/**
 * Handles paying a savings debt.
 * @param {string} debtId The ID of the debt document.
 * @param {number} amountDue The amount to pay.
 * @param {string} currency The currency of the debt.
 * @param {string} savingsGoal The goal of the associated savings account.
 * @param {string} savingsAccountId The ID of the savings account associated with the debt.
 */
async function paySavingsDebt(debtId, amountDue, currency, savingsGoal, savingsAccountId) {
    hideMessage();
    try {
        const userProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        const debtDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'savings_debts', debtId);
        const savingsAccountRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'savings_accounts', savingsAccountId); // Reference to the savings account

        const userDocSnap = await getDoc(userProfileRef);
        const savingsDocSnap = await getDoc(savingsAccountRef);

        if (!userDocSnap.exists()) {
            showMessage('Error: No se encontró tu perfil.', 'error');
            return;
        }
        if (!savingsDocSnap.exists()) {
            showMessage('Error: La cuenta de ahorro asociada a esta deuda ya no existe.', 'error');
            return;
        }

        const userData = userDocSnap.data();
        const savingsData = savingsDocSnap.data();

        let userCurrentBalanceUSD = userData.balanceUSD || 0;
        let savingsCurrentBalanceUSD = savingsData.balanceUSD || 0;

        // Convert amountDue to USD if necessary for main account deduction
        let amountDueInUSD = amountDue;
        if (currency === 'DOP') {
            amountDueInUSD = amountDue / USD_TO_DOP_RATE;
        }

        if (userCurrentBalanceUSD < amountDueInUSD) {
            showMessage(`Saldo insuficiente en tu cuenta principal para pagar esta deuda de $${amountDue.toFixed(2)} ${currency}. Necesitas al menos $${amountDueInUSD.toFixed(2)} USD.`, 'error');
            return;
        }

        // Deduct from user's main balance
        let newUserBalanceUSD = userCurrentBalanceUSD - amountDueInUSD;
        let newUserBalanceDOP = newUserBalanceUSD * USD_TO_DOP_RATE;

        // Add to savings account balance
        let newSavingsBalanceUSD = savingsCurrentBalanceUSD + amountDueInUSD;
        let newSavingsBalanceDOP = newSavingsBalanceUSD * USD_TO_DOP_RATE;

        await updateDoc(userProfileRef, {
            balanceUSD: newUserBalanceUSD,
            balanceDOP: newUserBalanceDOP
        });

        await updateDoc(savingsAccountRef, {
            balanceUSD: newSavingsBalanceUSD,
            balanceDOP: newSavingsBalanceDOP
        });

        // Update debt status to paid
        await updateDoc(debtDocRef, {
            status: 'paid',
            paidAt: serverTimestamp()
        });

        // Record transaction
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: currentUserId,
            type: 'savings_debt_payment',
            amount: amountDue,
            currency: currency,
            savingsGoal: savingsGoal,
            savingsAccountId: savingsAccountId, // Include savings account ID
            debtId: debtId,
            timestamp: serverTimestamp(),
            status: 'completed',
            description: `Pago de deuda de ahorro para "${savingsGoal}"`
        });

        showMessage(`¡Deuda de $${amountDue.toFixed(2)} ${currency} para "${savingsGoal}" pagada con éxito!`, 'success');
        closeModal(savingsDebtsModal); // Close the modal after payment
    } catch (error) {
        console.error("Error paying savings debt:", error);
        showMessage('Error al pagar la deuda de ahorro. Intenta de nuevo.', 'error');
    }
}

// --- NEW: Admin Savings Debts Functions ---
viewAdminSavingsDebtsBtn.addEventListener('click', () => {
    adminSavingsDebtsModal.classList.remove('hidden');
    loadAdminSavingsDebts();
});

closeAdminSavingsDebtsModalBtn.addEventListener('click', () => {
    closeModal(adminSavingsDebtsModal);
    if (adminSavingsDebtsUnsubscribe) {
        adminSavingsDebtsUnsubscribe();
        adminSavingsDebtsUnsubscribe = null;
        console.log("Admin: Unsubscribed from admin savings debts listener on modal close.");
    }
});

/**
 * Loads and displays all pending/overdue savings debts for the admin.
 */
function loadAdminSavingsDebts() {
    if (adminSavingsDebtsUnsubscribe) {
        adminSavingsDebtsUnsubscribe();
        adminSavingsDebtsUnsubscribe = null;
        console.log("Admin: Unsubscribed from previous admin savings debts listener.");
    }

    adminSavingsDebtsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">Cargando deudas...</td></tr>';
    const debtsRef = collection(db, 'artifacts', appId, 'public', 'data', 'savings_debts');
    const q = query(debtsRef, where('status', 'in', ['pending', 'overdue']));

    adminSavingsDebtsUnsubscribe = onSnapshot(q, async (snapshot) => {
        adminSavingsDebtsTableBody.innerHTML = '';
        if (snapshot.empty) {
            adminSavingsDebtsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">No hay deudas de ahorro pendientes.</td></tr>';
            return;
        }

        const allDebts = [];
        for (const docEntry of snapshot.docs) {
            allDebts.push({ id: docEntry.id, ...docEntry.data() });
        }

        // Sort by dueDate descending
        allDebts.sort((a, b) => {
            const dueDateA = a.dueDate && typeof a.dueDate.seconds !== 'undefined' ? a.dueDate.seconds : 0;
            const dueDateB = b.dueDate && typeof b.dueDate.seconds !== 'undefined' ? b.dueDate.seconds : 0;
            return dueDateB - dueDateA;
        });

        for (const debt of allDebts) {
            const userNameDisplay = await getUserDisplayName(debt.userId);
            const userPhoneNumber = await getUserPhoneNumber(debt.userId);
            const dueDate = debt.dueDate ? new Date(debt.dueDate.seconds * 1000) : null;
            const dueDateDisplay = dueDate ? dueDate.toLocaleDateString() : 'N/A';
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let statusDisplay = debt.status === 'pending' ? 'Pendiente' : (debt.status === 'overdue' ? 'Vencida' : debt.status);
            if (dueDate && today > dueDate && debt.status === 'pending') {
                // Mark as overdue if past due date and still pending
                statusDisplay = 'Vencida';
                // Optionally update status in Firestore here, but for simplicity, just display it
                // await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'savings_debts', debt.id), { status: 'overdue' });
            }

            const whatsappMessage = `¡Hola, ${userNameDisplay}! Te recordamos que tienes una deuda pendiente de $${(debt.amountDue ?? 0).toFixed(2)} USD para tu cuenta de ahorro "${debt.savingsGoal}". Tienes hasta el ${dueDateDisplay} para pagar. Si no pagas a tiempo, se aplicará una indemnización.`;
            const encodedMessage = encodeURIComponent(whatsappMessage);
            const whatsappLink = userPhoneNumber ? `https://wa.me/${userPhoneNumber}?text=${encodedMessage}` : '#';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${userNameDisplay}</td>
                <td>${debt.savingsGoal} (${debt.savingsAccountId.substring(0, 8)}...)</td>
                <td>$${(debt.amountDue ?? 0).toFixed(2)} ${debt.currency}</td>
                <td>${dueDateDisplay}</td>
                <td>${statusDisplay}</td>
                <td>
                    ${userPhoneNumber ? `<a href="${whatsappLink}" target="_blank" class="text-green-600 hover:underline font-bold">WhatsApp</a>` : 'N/A'}
                </td>
                <td>
                    ${(dueDate && today > dueDate && !debt.penaltyApplied) ?
                        `<button class="btn-danger btn-sm apply-indemnization-btn"
                            data-debt-id="${debt.id}"
                            data-user-id="${debt.userId}"
                            data-amount-due="${debt.amountDue}"
                            data-savings-goal="${debt.savingsGoal}"
                            >Aplicar Indemnización</button>` :
                        (debt.penaltyApplied ? '<span class="text-red-500">Indemnización Aplicada</span>' : '')
                    }
                    <button class="btn-secondary btn-sm resolve-debt-btn mt-2"
                        data-debt-id="${debt.id}"
                        data-user-id="${debt.userId}"
                        data-amount-due="${debt.amountDue}"
                        data-savings-goal="${debt.savingsGoal}"
                        >Marcar como Pagada</button>
                </td>
            `;
            adminSavingsDebtsTableBody.appendChild(row);
        }

        // Attach event listeners for admin debt actions
        adminSavingsDebtsTableBody.querySelectorAll('.apply-indemnization-btn').forEach(button => {
            button.onclick = async (event) => {
                const { debtId, userId, amountDue, savingsGoal } = event.target.dataset;
                await applyIndemnization(debtId, userId, parseFloat(amountDue), savingsGoal);
            };
        });
        adminSavingsDebtsTableBody.querySelectorAll('.resolve-debt-btn').forEach(button => {
            button.onclick = async (event) => {
                const { debtId, userId, amountDue, savingsGoal } = event.target.dataset;
                await resolveSavingsDebtManually(debtId, userId, parseFloat(amountDue), savingsGoal);
            };
        });

    }, (error) => {
        console.error("Error loading admin savings debts:", error);
        adminSavingsDebtsTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 py-4">Error al cargar deudas de ahorro.</td></tr>`;
    });
}

/**
 * Applies indemnization for an overdue debt.
 * @param {string} debtId The ID of the debt document.
 * @param {string} userId The user's Firebase UID.
 * @param {number} amountDue The original amount due for the debt.
 * @param {string} savingsGoal The goal of the associated savings account.
 */
async function applyIndemnization(debtId, userId, amountDue, savingsGoal) {
    hideMessage();
    try {
        const userProfileRef = doc(db, 'artifacts', appId, 'users', userId);
        const debtDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'savings_debts', debtId);

        const userDocSnap = await getDoc(userProfileRef);
        if (!userDocSnap.exists()) {
            showMessage('Error: Usuario no encontrado para aplicar indemnización.', 'error');
            return;
        }
        const userData = userDocSnap.data();
        let userCurrentBalanceUSD = userData.balanceUSD || 0;

        const penaltyAmount = amountDue * INDEMNIZATION_RATE;

        if (userCurrentBalanceUSD < penaltyAmount) {
            showMessage(`Saldo insuficiente en la cuenta del cliente para aplicar la indemnización de $${penaltyAmount.toFixed(2)} USD.`, 'error');
            return;
        }

        // Deduct penalty from user's main account
        let newUserBalanceUSD = userCurrentBalanceUSD - penaltyAmount;
        let newUserBalanceDOP = newUserBalanceUSD * USD_TO_DOP_RATE;

        await updateDoc(userProfileRef, {
            balanceUSD: newUserBalanceUSD,
            balanceDOP: newUserBalanceDOP
        });

        // Add penalty to admin's account
        let adminId = null;
        const adminUsersCollectionRef = collection(db, 'artifacts', appId, 'users');
        const adminQuery = query(adminUsersCollectionRef, where('email', '==', ADMIN_EMAIL));
        const adminSnapshot = await getDocs(adminQuery);
        if (!adminSnapshot.empty) {
            adminId = adminSnapshot.docs[0].id;
            const adminProfileRef = doc(db, 'artifacts', appId, 'users', adminId);
            const adminData = (await getDoc(adminProfileRef)).data();
            let adminNewBalanceUSD = (adminData.balanceUSD || 0) + penaltyAmount;
            await updateDoc(adminProfileRef, { balanceUSD: adminNewBalanceUSD, balanceDOP: adminNewBalanceUSD * USD_TO_DOP_RATE });
        } else {
            console.warn("Admin account not found. Indemnization might not be transferred.");
        }

        // Update debt status
        await updateDoc(debtDocRef, {
            status: 'penalized', // New status for penalized debts
            penaltyApplied: true,
            penaltyAmount: penaltyAmount,
            penalizedAt: serverTimestamp()
        });

        // Record transaction for indemnization
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: userId, // User who paid the penalty
            payerId: userId,
            receiverId: adminId,
            type: 'savings_indemnization_applied',
            amount: penaltyAmount,
            currency: 'USD',
            savingsGoal: savingsGoal,
            debtId: debtId,
            timestamp: serverTimestamp(),
            status: 'completed',
            description: `Indemnización aplicada por deuda de ahorro para "${savingsGoal}"`
        });

        showMessage(`¡Indemnización de $${penaltyAmount.toFixed(2)} USD aplicada a ${await getUserDisplayName(userId)} por la deuda de "${savingsGoal}"!`, 'success');

    } catch (error) {
        console.error("Error applying indemnization:", error);
        showMessage('Error al aplicar la indemnización. Intenta de nuevo.', 'error');
    }
}

/**
 * Allows admin to manually mark a debt as paid (e.g., if paid offline).
 * @param {string} debtId The ID of the debt document.
 * @param {string} userId The user's Firebase UID.
 * @param {number} amountDue The original amount due for the debt.
 * @param {string} savingsGoal The goal of the associated savings account.
 */
async function resolveSavingsDebtManually(debtId, userId, amountDue, savingsGoal) {
    hideMessage();
    try {
        const debtDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'savings_debts', debtId);
        await updateDoc(debtDocRef, {
            status: 'paid',
            paidAt: serverTimestamp(),
            resolvedManually: true // Indicate manual resolution
        });

        // Record a transaction for manual resolution (no money movement here, just status update)
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: userId,
            type: 'savings_debt_payment', // Use this type but clarify it's manual
            amount: amountDue,
            currency: 'USD',
            savingsGoal: savingsGoal,
            debtId: debtId,
            timestamp: serverTimestamp(),
            status: 'completed (manual)',
            description: `Deuda de ahorro "${savingsGoal}" marcada manualmente como pagada.`
        });

        showMessage(`Deuda #${debtId.substring(0,8)}... para "${savingsGoal}" marcada como pagada manualmente.`, 'info');

    } catch (error) {
        console.error("Error resolving savings debt manually:", error);
        showMessage('Error al marcar la deuda como pagada. Intenta de nuevo.', 'error');
    }
}


// --- Event Listeners ---
window.onload = () => {
     // onAuthStateChanged will handle the user's login state automatically
};


loginTab.addEventListener('click', () => toggleTabs('login'));
registerTab.addEventListener('click', () => toggleTabs('register'));
closeMessage.addEventListener('click', hideMessage);

loginForm.addEventListener('submit', handleLogin);
logoutBtn.addEventListener('click', handleLogout);
toggleCurrencyBtn.addEventListener('click', toggleCurrencyDisplay);

// Rules Consent buttons
acceptRulesBtn.addEventListener('click', () => {
    rulesConsentModal.classList.add('hidden');
    // Proceed with registration using stored data
    performRegistration(tempRegisterData.name, tempRegisterData.surname, tempRegisterData.age, tempRegisterData.phoneNumber, tempRegisterData.password);
});

rejectRulesBtn.addEventListener('click', () => {
    rulesConsentModal.classList.add('hidden');
    showMessage('Debes aceptar las reglas para registrarte en el Banco Juvenil.', 'error');
    registerForm.reset(); // Clear the form if rules are rejected
    tempRegisterData = {}; // Clear temporary data
});

// User History Modal buttons
viewHistoryBtn.addEventListener('click', () => {
    userHistoryModal.classList.remove('hidden');
    loadUserHistory(); // Load user-specific history
});
closeUserHistoryModalBtn.addEventListener('click', () => {
    closeModal(userHistoryModal);
});

// Admin Full History Modal buttons
adminFullHistoryBtn.addEventListener('click', () => {
    adminFullHistoryModal.classList.remove('hidden');
    loadAdminFullHistory(); // Load full admin history
});
closeAdminFullHistoryModalBtn.addEventListener('click', () => {
    closeModal(adminFullHistoryModal);
});

// Admin Pending Requests Modal button (Unified)
viewAdminPendingRequestsBtn.addEventListener('click', () => {
    adminPendingRequestsModal.classList.remove('hidden');
    loadAdminPendingRequests();
});
// This listener is now handled at the top of the file to manage unsubscribe
// closeAdminPendingRequestsModalBtn.addEventListener('click', () => {
//     closeModal(adminPendingRequestsModal);
// });

// FAQ Modal buttons
viewFAQBtn.addEventListener('click', () => {
    faqModal.classList.remove('hidden');
});
closeFAQModalBtn.addEventListener('click', () => {
    closeModal(faqModal);
});

// Online Shopping Buttons
onlineShoppingBtn.addEventListener('click', () => {
    onlineShoppingModal.classList.remove('hidden');
    onlineShoppingForm.reset(); // Reset form when opened
    updateOnlineShoppingCalculation(); // Initial calculation display
});
cancelOnlineShopping.addEventListener('click', () => {
    closeModal(onlineShoppingModal);
});

// Streaming Payment Buttons
streamingPaymentBtn.addEventListener('click', () => {
    streamingPaymentModal.classList.remove('hidden');
    streamingPaymentForm.reset(); // Reset form when opened
    updateStreamingPaymentCalculation(); // Initial calculation display
});
cancelStreamingPayment.addEventListener('click', () => {
    closeModal(streamingPaymentModal);
});

// User Pending Requests Button
viewUserPendingRequestsBtn.addEventListener('click', () => {
    userPendingRequestsModal.classList.remove('hidden');
    loadUserPendingRequests();
});
closeUserPendingRequestsModalBtn.addEventListener('click', () => {
    closeModal(userPendingRequestsModal);
});

// Receipt Modal Button
closeReceiptModalBtn.addEventListener('click', () => {
    closeModal(receiptModal);
});

// NEW: Open Savings Account Event Listeners
openSavingsAccountBtn.addEventListener('click', () => {
    openSavingsAccountModal.classList.remove('hidden');
    savingsAccountForm.reset();
});
cancelOpenSavingsAccountBtn.addEventListener('click', () => {
    closeModal(openSavingsAccountModal);
});
// The submit event listener for savingsAccountForm is already defined globally.

// NEW: View Savings Accounts Event Listeners
viewSavingsAccountsBtn.addEventListener('click', () => {
    viewSavingsAccountsModal.classList.remove('hidden');
    loadSavingsAccounts();
});
closeViewSavingsAccountsBtn.addEventListener('click', () => {
    closeModal(viewSavingsAccountsModal);
});

// NEW: Edit Announcements Event Listeners
editAnnouncementsBtn.addEventListener('click', async () => {
    editAnnouncementsModal.classList.remove('hidden');
    await loadAnnouncementsForEdit();
});
cancelEditAnnouncementsBtn.addEventListener('click', () => {
    closeModal(editAnnouncementsModal);
});
// The submit event listener for editAnnouncementsForm is already defined globally.

// NEW: Deposit to Savings Modal Event Listeners
cancelDepositToSavingsBtn.addEventListener('click', () => {
    closeModal(depositToSavingsModal);
});

// NEW: Withdraw from Savings Modal Event Listeners
cancelWithdrawFromSavingsBtn.addEventListener('click', () => {
    closeModal(withdrawFromSavingsModal);
});

// NEW: Confirm Delete Savings Account Modal Event Listeners
cancelDeleteSavingsAccountBtn.addEventListener('click', () => {
    closeModal(confirmDeleteSavingsAccountModal);
});
cancelDeleteSavingsAccountBtn2.addEventListener('click', () => {
    closeModal(confirmDeleteSavingsAccountModal);
});
