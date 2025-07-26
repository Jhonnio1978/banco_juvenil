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

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null; // Almacena el objeto de usuario autenticado actual
let currentUserId = null; // Almacena el UID del usuario actual (Firebase UID)
let currentBalanceUSD = 0;
let currentBalanceDOP = 0;
let showCurrencyUSD = true; // Bandera para alternar la visualización de la moneda

// Tasa de cambio (ejemplo, en una aplicación real esto vendría de una API)
const USD_TO_DOP_RATE = 58.0; // Tasa de ejemplo
const COMMISSION_RATE = 0.03; // Comisión del 3% para compras en línea y streaming
const WITHDRAWAL_FEE_RATE = 0.04; // Tarifa del 4% para retiros
const SAVINGS_DELETE_FEE_RATE = 0.02; // Tarifa del 2% por eliminar cuenta de ahorro
const INDEMNIZATION_RATE = 0.05; // Indemnización del 5% por deudas de ahorro vencidas

// Email de administrador para propósitos de prototipo
const ADMIN_EMAIL = `admin.jhonnio@${appId}.com`;
const ADMIN_PHONE_NUMBER_FULL = '18293329545'; // Número de WhatsApp del administrador con código de país

// Variables específicas de transferencia
let transferInterval = null; // Para guardar el ID del intervalo para su cancelación
let currentTransferRecipientUid = null; // Para almacenar el UID del destinatario para la confirmación de la transferencia
let currentTransferAmount = 0;
let currentTransferCurrency = '';
let currentTransferRecipientIdentifier = ''; // El ID o email que el usuario escribió
let currentTransferRecipientDisplayName = ''; // El nombre que se muestra al usuario

// Mapa global para almacenar nombres de visualización de usuarios y números de teléfono para evitar búsquedas repetidas en Firestore
const userDisplayNamesCache = {};
const userPhoneNumbersCache = {}; // Nuevo caché para números de teléfono

// Variable global para almacenar los datos de transacción del usuario para el resumen (ya no se usa para el resumen de IA, pero se mantiene para la carga del historial)
let userTransactionsData = [];

// Elementos de la interfaz de usuario
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const loginSection = document.getElementById('loginSection');
const registerSection = document.getElementById('registerSection');
const dashboardSection = document.getElementById('dashboardSection');
const adminButtonsContainer = document.getElementById('adminButtonsContainer'); // Contenedor para botones de administrador

const loginForm = document.getElementById('loginForm');
const loginIdentifierInput = document.getElementById('loginIdentifier');
const loginPassword = document.getElementById('loginPassword'); // Asegúrate de que este ID exista en tu HTML
const registerForm = document.getElementById('registerForm');
const registerNameInput = document.getElementById('registerName');
const registerSurnameInput = document.getElementById('registerSurname');
const registerAgeInput = document.getElementById('registerAge');
const registerPhoneNumberInput = document.getElementById('registerPhoneNumber'); // NUEVO: Entrada de número de teléfono
const registerPasswordInput = document.getElementById('registerPassword');

const logoutBtn = document.getElementById('logoutBtn');
const dashboardUserName = document.getElementById('dashboardUserName');
const dashboardDisplayId = document.getElementById('dashboardDisplayId'); // ID de usuario simplificado para mostrar
const accountBalance = document.getElementById('accountBalance');
const toggleCurrencyBtn = document.getElementById('toggleCurrency');
const profileAvatar = document.getElementById('profileAvatar'); // Nuevo: Avatar de perfil

// Botones
const adminFullHistoryBtn = document.getElementById('adminFullHistoryBtn');
const viewFAQBtn = document.getElementById('viewFAQBtn'); // Botón de preguntas frecuentes
const onlineShoppingBtn = document.getElementById('onlineShoppingBtn'); // Botón de compras en línea
const streamingPaymentBtn = document.getElementById('streamingPaymentBtn'); // Botón de pago de streaming
const gameRechargeBtn = document.getElementById('gameRechargeBtn'); // NUEVO: Botón de recarga de juegos
const viewUserPendingRequestsBtn = document.getElementById('viewUserPendingRequestsBtn'); // Botón de solicitudes pendientes del usuario
const viewAdminPendingRequestsBtn = document.getElementById('viewAdminPendingRequestsBtn'); // Botón de solicitudes pendientes del administrador
const editProfileBtn = document.getElementById('editProfileBtn'); // Botón de editar perfil
const changePasswordBtn = document.getElementById('changePasswordBtn'); // Botón de cambiar contraseña
const securityTipsBtn = document.getElementById('securityTipsBtn'); // Botón de consejos de seguridad
const aboutUsBtn = document.getElementById('aboutUsBtn'); // Botón de acerca de nosotros
const contactSupportBtn = document.getElementById('contactSupportBtn'); // NUEVO: Botón de contacto y soporte
const openSavingsAccountBtn = document.getElementById('openSavingsAccountBtn'); // NUEVO: Botón de abrir cuenta de ahorro
const viewSavingsAccountsBtn = document.getElementById('viewSavingsAccountsBtn'); // NUEVO: Botón de ver cuentas de ahorro
const editAnnouncementsBtn = document.getElementById('editAnnouncementsBtn'); // NUEVO: Botón de editar anuncios
const viewSavingsDebtsBtn = document.getElementById('viewSavingsDebtsBtn'); // NUEVO: Botón de ver deudas de ahorro (cliente)
const viewAdminSavingsDebtsBtn = document.getElementById('viewAdminSavingsDebtsBtn'); // NUEVO: Botón de ver deudas de ahorro del administrador

const adminFullHistoryTableBodyModal = document.getElementById('adminFullHistoryTableBodyModal'); // Historial del administrador (en modal)

const messageBox = document.getElementById('messageBox');
const messageText = document.getElementById('messageText');
const closeMessage = document.getElementById('closeMessage');
const transactionStatusMsg = document.getElementById('transactionStatusMsg');
const transactionStatusText = document.getElementById('transactionStatusText');
const cancelOngoingTransferBtn = document.getElementById('cancelOngoingTransferBtn');

// Elementos del modal de consentimiento de reglas
const rulesConsentModal = document.getElementById('rulesConsentModal');
const briefRulesTextContainer = document.getElementById('briefRulesTextContainer');
const acceptRulesBtn = document.getElementById('acceptRulesBtn');
const rejectRulesBtn = document.getElementById('rejectRulesBtn');

// Almacena temporalmente los datos del formulario de registro para el consentimiento de las reglas
let tempRegisterData = {};

// Define el texto de las reglas breves (actualizado para reflejar los nuevos flujos de aprobación pendientes)
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

// Modales
const transferMoneyBtn = document.getElementById('transferMoneyBtn');
const transferModal = document.getElementById('transferModal');
const cancelTransferModalBtn = document.getElementById('cancelTransferModalBtn');
const transferForm = document.getElementById('transferForm');
const transferRecipientIdInput = document.getElementById('transferRecipientId');
const transferAmount = document.getElementById('transferAmount'); // Asegúrate de que este ID exista
const transferCurrency = document.getElementById('transferCurrency'); // Asegúrate de que este ID exista
const recipientNameDisplay = document.getElementById('recipientNameDisplay');
const confirmTransferBtn = document.getElementById('confirmTransferBtn');

const depositMoneyBtn = document.getElementById('depositMoneyBtn');
const depositModal = document.getElementById('depositModal');
const cancelDeposit = document.getElementById('cancelDeposit');
const depositForm = document.getElementById('depositForm');
const depositSerialNumberInput = document.getElementById('depositSerialNumber');
const depositAmount = document.getElementById('depositAmount'); // Asegúrate de que este ID exista
const depositCurrency = document.getElementById('depositCurrency'); // Asegúrate de que este ID exista

const withdrawMoneyBtn = document.getElementById('withdrawMoneyBtn');
const withdrawModal = document.getElementById('withdrawModal');
const cancelWithdraw = document.getElementById('cancelWithdraw');
const withdrawForm = document.getElementById('withdrawForm');
const withdrawAmount = document.getElementById('withdrawAmount'); // Asegúrate de que este ID exista
const withdrawCurrency = document.getElementById('withdrawCurrency'); // Asegúrate de que este ID exista

const userHistoryModal = document.getElementById('userHistoryModal');
const userHistoryTableBody = document.getElementById('userHistoryTableBody');
const closeUserHistoryModalBtn = document.getElementById('closeUserHistoryModalBtn');
const viewHistoryBtn = document.getElementById('viewHistoryBtn'); // Asegúrate de que este ID exista

const adminFullHistoryModal = document.getElementById('adminFullHistoryModal');
const closeAdminFullHistoryModalBtn = document.getElementById('closeAdminFullHistoryModalBtn');

// Elementos del modal de solicitudes pendientes del administrador
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
const shoppingCategoryInput = document.getElementById('shoppingCategory'); // Entrada de categoría
const shoppingFeeDisplay = document.getElementById('shoppingFeeDisplay');
const shoppingTotalDisplay = document.getElementById('shoppingTotalDisplay');

const streamingPaymentModal = document.getElementById('streamingPaymentModal');
const cancelStreamingPayment = document.getElementById('cancelStreamingPayment');
const streamingPaymentForm = document.getElementById('streamingPaymentForm');
const streamingServiceInput = document.getElementById('streamingService');
const streamingAccountIdentifierInput = document.getElementById('streamingAccountIdentifier');
const streamingAmountInput = document.getElementById('streamingAmount');
const streamingCurrencyInput = document.getElementById('streamingCurrency');
const streamingCategoryInput = document.getElementById('streamingCategory'); // Entrada de categoría
const streamingFeeDisplay = document.getElementById('streamingFeeDisplay');
const streamingTotalDisplay = document.getElementById('streamingTotalDisplay');

// NUEVO: Elementos del modal de recarga de juegos
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

// Elementos del modal de edición de perfil
const editProfileModal = document.getElementById('editProfileModal');
const cancelEditProfileBtn = document.getElementById('cancelEditProfileBtn');
const editProfileForm = document.getElementById('editProfileForm');
const editNameInput = document.getElementById('editName');
const editSurnameInput = document.getElementById('editSurname');
const editAgeInput = document.getElementById('editAge');
const editPhoneNumberInput = document.getElementById('editPhoneNumber'); // NUEVO: Entrada de número de teléfono

// Elementos del modal de cambio de contraseña
const changePasswordModal = document.getElementById('changePasswordModal');
const cancelChangePasswordBtn = document.getElementById('cancelChangePasswordBtn');
const changePasswordForm = document.getElementById('changePasswordForm');
const currentPasswordInput = document.getElementById('currentPassword');
const newPasswordInput = document.getElementById('newPassword');
const confirmNewPasswordInput = document.getElementById('confirmNewPassword');

// Elementos del modal de consejos de seguridad
const securityTipsModal = document.getElementById('securityTipsModal');
const closeSecurityTipsBtn = document.getElementById('closeSecurityTipsBtn');

// Elementos del modal de acerca de nosotros
const aboutUsModal = document.getElementById('aboutUsModal');
const closeAboutUsBtn = document.getElementById('closeAboutUsBtn');

// Elementos del modal de contacto y soporte
const contactSupportModal = document.getElementById('contactSupportModal');
const closeContactSupportBtn = document.getElementById('closeContactSupportBtn');

// NUEVO: Elementos del modal de abrir cuenta de ahorro
const openSavingsAccountModal = document.getElementById('openSavingsAccountModal');
const cancelOpenSavingsAccountBtn = document.getElementById('cancelOpenSavingsAccountBtn');
const savingsAccountForm = document.getElementById('savingsAccountForm');
const savingsGoalInput = document.getElementById('savingsGoal');
const initialDepositAmountInput = document.getElementById('initialDepositAmount');
const initialDepositCurrencyInput = document.getElementById('initialDepositCurrency');
const preferredSavingsFrequencyInput = document.getElementById('preferredSavingsFrequency');
const periodicContributionAmountInput = document.getElementById('periodicContributionAmount'); // NUEVO: Monto de contribución periódica
const savingsEndDateInput = document.getElementById('savingsEndDate'); // NUEVO: Entrada de fecha de finalización

// NUEVO: Elementos del modal de ver cuentas de ahorro
const viewSavingsAccountsModal = document.getElementById('viewSavingsAccountsModal');
const closeViewSavingsAccountsBtn = document.getElementById('closeViewSavingsAccountsBtn');
const savingsAccountsTableBody = document.getElementById('savingsAccountsTableBody');

// NUEVO: Elementos del modal de editar anuncios
const editAnnouncementsModal = document.getElementById('editAnnouncementsModal');
const cancelEditAnnouncementsBtn = document.getElementById('cancelEditAnnouncementsBtn');
const editAnnouncementsForm = document.getElementById('editAnnouncementsForm');
const announcementsTextarea = document.getElementById('announcementsTextarea');
const announcementsList = document.getElementById('announcementsList'); // Referencia a la UL en el panel de control

// NUEVO: Modales de depósito/retiro de ahorros
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

// NUEVO: Modal de confirmación de eliminación de cuenta de ahorro
const confirmDeleteSavingsAccountModal = document.getElementById('confirmDeleteSavingsAccountModal');
const cancelDeleteSavingsAccountBtn = document.getElementById('cancelDeleteSavingsAccountBtn');
const cancelDeleteSavingsAccountBtn2 = document.getElementById('cancelDeleteSavingsAccountBtn2'); // Segundo botón de cancelar
const confirmDeleteSavingsAccountBtn = document.getElementById('confirmDeleteSavingsAccountBtn');
const deleteSavingsAccountGoalDisplay = document.getElementById('deleteSavingsAccountGoalDisplay');
const deleteSavingsAccountFeeDisplay = document.getElementById('deleteSavingsAccountFeeDisplay');
const deleteSavingsAccountRemainingDisplay = document.getElementById('deleteSavingsAccountRemainingDisplay');

// Variables para almacenar datos para operaciones de cuenta de ahorro
let currentSavingsAccountId = null;
let currentSavingsAccountBalanceUSD = 0;
let currentSavingsAccountGoal = '';

// Variable para guardar la función de desuscripción para el oyente de solicitudes pendientes del administrador
let adminPendingRequestsUnsubscribe = null;
let adminSavingsDebtsUnsubscribe = null; // Nueva desuscripción para deudas de ahorro del administrador
let savingsDebtsUnsubscribe = null; // Nueva desuscripción para deudas de ahorro del cliente

// NUEVO: Modal de deudas de ahorro (cliente)
const savingsDebtsModal = document.getElementById('savingsDebtsModal');
const closeSavingsDebtsModalBtn = document.getElementById('closeSavingsDebtsModalBtn');
const savingsDebtsTableBody = document.getElementById('savingsDebtsTableBody');

// NUEVO: Modal de deudas de ahorro del administrador
const adminSavingsDebtsModal = document.getElementById('adminSavingsDebtsModal');
const closeAdminSavingsDebtsModalBtn = document.getElementById('closeAdminSavingsDebtsModalBtn');
const adminSavingsDebtsTableBody = document.getElementById('adminSavingsDebtsTableBody');


// --- Funciones de utilidad ---

/**
 * Agrega días a una fecha dada.
 * @param {Date} date La fecha inicial.
 * @param {number} days El número de días a agregar.
 * @returns {Date} La nueva fecha.
 */
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(date.getDate() + days);
    return result;
}

/**
 * Agrega semanas a una fecha dada.
 * @param {Date} date La fecha inicial.
 * @param {number} weeks El número de semanas a agregar.
 * @returns {Date} La nueva fecha.
 */
function addWeeks(date, weeks) {
    return addDays(date, weeks * 7);
}

/**
 * Agrega meses a una fecha dada.
 * @param {Date} date La fecha inicial.
 * @param {number} months El número de meses a agregar.
 * @returns {Date} La nueva fecha.
 */
function addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}

/**
 * Formatea un objeto Date a 'YYYY-MM-DD'.
 * @param {Date} date El objeto de fecha.
 * @returns {string} Cadena de fecha formateada.
 */
function formatDateToYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Muestra un mensaje en el cuadro de mensajes de la interfaz de usuario.
 * @param {string} msg El mensaje a mostrar.
 * @param {string} type El tipo de mensaje (success, error, info).
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
 * Oculta el cuadro de mensajes de la interfaz de usuario.
 */
function hideMessage() {
    messageBox.classList.add('hidden');
}

/**
 * Muestra un mensaje de estado de transacción.
 * @param {string} msg El mensaje a mostrar.
 */
function showTransactionStatus(msg) {
    transactionStatusText.textContent = msg;
    transactionStatusMsg.classList.remove('hidden');
    // Muestra el botón de cancelar solo si es una transferencia en curso
    cancelOngoingTransferBtn.classList.remove('hidden');
}

/**
 * Oculta el mensaje de estado de la transacción.
 */
function hideTransactionStatus() {
    transactionStatusMsg.classList.add('hidden');
    cancelOngoingTransferBtn.classList.add('hidden');
}

/**
 * Muestra un modal de recibo con los detalles de la transacción.
 * @param {Object} transaction El objeto de transacción de Firestore.
 */
async function showReceipt(transaction) {
    let content = `<p class="font-bold text-lg mb-2">Recibo de Transacción</p>`;
    content += `<p><strong>Fecha:</strong> ${new Date(transaction.timestamp.seconds * 1000).toLocaleString()}</p>`;
    content += `<p><strong>ID de Transacción:</strong> ${transaction.id}</p>`; // Usa el ID de la transacción

    let typeDisplay = '';
    let amountDisplay = '';
    let currencyDisplay = '';
    let feeDisplay = '';
    let otherDetails = '';

    // Obtener nombres de remitente/destinatario para transferencias
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
    } else if (transaction.type === 'game_recharge') { // NUEVO: Recibo de recarga de juegos
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
        currencyDisplay = 'USD'; // El saldo restante siempre está en USD
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
 * Alterna la visibilidad entre secciones.
 * @param {HTMLElement} showElement Elemento a mostrar.
 * @param {HTMLElement} ...hideElements Lista de elementos a ocultar.
 */
function showSection(showElement, ...hideElements) {
    showElement.classList.remove('hidden');
    hideElements.forEach(el => el.classList.add('hidden'));
}

/**
 * Alterna el estado activo de las pestañas de inicio de sesión/registro.
 * @param {string} activeTabId 'login' o 'register'.
 */
function toggleTabs(activeTabId) {
    if (activeTabId === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        // Oculta todas las secciones principales y modales
        showSection(loginSection, registerSection, dashboardSection, rulesConsentModal, userHistoryModal, adminFullHistoryModal, adminPendingRequestsModal, faqModal, onlineShoppingModal, streamingPaymentModal, gameRechargeModal, userPendingRequestsModal, receiptModal, editProfileModal, changePasswordModal, securityTipsModal, aboutUsModal, contactSupportModal, openSavingsAccountModal, viewSavingsAccountsModal, editAnnouncementsModal, depositToSavingsModal, withdrawFromSavingsModal, confirmDeleteSavingsAccountModal, savingsDebtsModal, adminSavingsDebtsModal);
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        // Oculta todas las secciones principales y modales
        showSection(registerSection, loginSection, dashboardSection, rulesConsentModal, userHistoryModal, adminFullHistoryModal, adminPendingRequestsModal, faqModal, onlineShoppingModal, streamingPaymentModal, gameRechargeModal, userPendingRequestsModal, receiptModal, editProfileModal, changePasswordModal, securityTipsModal, aboutUsModal, contactSupportModal, openSavingsAccountModal, viewSavingsAccountsModal, editAnnouncementsModal, depositToSavingsModal, withdrawFromSavingsModal, confirmDeleteSavingsAccountModal, savingsDebtsModal, adminSavingsDebtsModal);
    }
    hideMessage(); // Oculta cualquier mensaje anterior al cambiar de pestaña
}

/**
 * Cierra cualquier modal abierto.
 */
function closeModal(modalElement) {
    modalElement.classList.add('hidden');
}

/**
 * Genera un ID simple y legible para fines de visualización.
 * @param {string} name Primer nombre del usuario.
 * @param {string} surname Apellido del usuario.
 * @returns {string} Un ID de visualización amigable para el usuario.
 */
function generateUserDisplayId(name, surname) {
    const initials = `${name.substring(0, 1).toUpperCase()}${surname.substring(0, 1).toUpperCase()}`;
    const randomNumber = Math.floor(1000 + Math.random() * 9000); // Número de 4 dígitos
    return `${initials}#${randomNumber}`;
}

/**
 * Obtiene el nombre de visualización de un usuario del caché o de Firestore.
 * @param {string} userId El UID de Firebase del usuario.
 * @returns {Promise<string>} El nombre de visualización del usuario (Nombre Apellido (ID#ABCD)) o un ID truncado.
 */
async function getUserDisplayName(userId) {
    // Comprueba si el userId coincide con el UID de Firebase del email del administrador
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
        console.error("Error al obtener el nombre de visualización del usuario:", error);
    }
    return `ID: ${userId.substring(0, 5)}...`; // Vuelve al UID de Firebase truncado
}

/**
 * Obtiene el número de teléfono de un usuario del caché o de Firestore.
 * @param {string} userId El UID de Firebase del usuario.
 * @returns {Promise<string|null>} El número de teléfono del usuario o nulo si no se encuentra.
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
        console.error("Error al obtener el número de teléfono del usuario:", error);
    }
    return null;
}


// --- Autenticación de Firebase y operaciones de Firestore ---

/**
 * Maneja el envío del formulario de registro de nuevos usuarios (inicia el consentimiento de las reglas).
 * @param {Event} e Evento de envío del formulario.
 */
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const name = registerNameInput.value.trim();
    const surname = registerSurnameInput.value.trim();
    const age = parseInt(registerAgeInput.value);
    const phoneNumber = registerPhoneNumberInput.value.trim(); // Obtener número de teléfono
    const password = registerPasswordInput.value;

    if (!name || !surname || !password || isNaN(age) || age <= 0 || !phoneNumber) {
        showMessage('Por favor, completa todos los campos correctamente.', 'error');
        return;
    }

    // Almacena los datos temporalmente para usarlos después del consentimiento de las reglas
    tempRegisterData = { name, surname, age, phoneNumber, password };

    // Muestra el modal de consentimiento de las reglas
    briefRulesTextContainer.innerHTML = briefRulesText;
    rulesConsentModal.classList.remove('hidden');
});

/**
 * Realiza el registro real del usuario después del consentimiento de las reglas.
 * @param {string} name Nombre del usuario.
 * @param {string} surname Apellido del usuario.
 * @param {number} age Edad del usuario.
 * @param {string} phoneNumber Número de teléfono del usuario.
 * @param {string} password Contraseña del usuario.
 */
async function performRegistration(name, surname, age, phoneNumber, password) {
    // Genera un email para Firebase Auth (uso interno principalmente)
    const generatedEmail = `${name.toLowerCase().replace(/\s/g, '')}.${surname.toLowerCase().replace(/\s/g, '')}@${appId}.com`;
    // Genera un ID simple y amigable para el usuario para mostrar
    const userDisplayId = generateUserDisplayId(name, surname);

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, generatedEmail, password);
        const user = userCredential.user;
        const userId = user.uid; // UID de Firebase

        await setDoc(doc(db, 'artifacts', appId, 'users', userId), {
            userId: userId, // UID interno de Firebase
            userDisplayId: userDisplayId, // ID de visualización amigable para el usuario
            name: name,
            surname: surname,
            age: age,
            phoneNumber: phoneNumber, // Almacena el número de teléfono
            email: generatedEmail, // Email de inicio de sesión principal
            balanceUSD: 0,
            balanceDOP: 0,
            currencyPreference: 'USD',
            hasPendingDeposit: false, // Mantiene esto para el bloqueo de depósitos específicos
            createdAt: serverTimestamp()
        });

        showMessage(`¡Registro exitoso, ${name}! Tu ID de usuario para iniciar sesión es: ${generatedEmail}. Tu ID público es: ${userDisplayId}. Por favor, anótalo.`, 'success');
        loginIdentifierInput.value = generatedEmail; // Prellena el campo de inicio de sesión con el email generado
        loginPassword.value = password; // Prellena la contraseña
        // No hay un toggleTabs('login') explícito aquí, ya que onAuthStateChanged maneja la visualización del panel de control
        // si el inicio de sesión es exitoso después del registro automáticamente.

    } catch (error) {
        console.error("Error durante el registro:", error);
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
        tempRegisterData = {}; // Borra los datos temporales independientemente del resultado
    }
}


/**
 * Maneja el inicio de sesión del usuario, aceptando email o UID de Firebase.
 * @param {Event} e Evento de envío del formulario.
 */
async function handleLogin(e) {
    e.preventDefault();
    hideMessage();
    const identifier = loginIdentifierInput.value.trim(); // Puede ser email, userDisplayId o UID de Firebase
    const password = loginPassword.value;
    let emailToLogin = identifier;

    if (!identifier || !password) {
        showMessage('Por favor, ingresa tu ID de usuario y contraseña.', 'error');
        return;
    }

    try {
        // Si el identificador no parece un email, intenta encontrar el email por userDisplayId o UID de Firebase
        if (!identifier.includes('@')) {
            const usersCollectionRef = collection(db, 'artifacts', appId, 'users');
            let querySnapshot;

            // 1. Intenta buscar por userDisplayId (preferido para la facilidad de uso)
            let q = query(usersCollectionRef, where('userDisplayId', '==', identifier));
            querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                // 2. Si no se encuentra por userDisplayId, intenta buscar por UID de Firebase
                q = query(usersCollectionRef, where('userId', '==', identifier));
                querySnapshot = await getDocs(q);
            }

            if (querySnapshot.empty) {
                showMessage('ID de usuario o contraseña incorrectos.', 'error');
                return;
            }
            // Usuario encontrado, obtén su email asociado para Firebase Auth
            emailToLogin = querySnapshot.docs[0].data().email;
            if (!emailToLogin) {
                showMessage('No se pudo encontrar el email asociado a este ID de usuario.', 'error');
                return;
            }
        }

        // Intenta iniciar sesión con el email y la contraseña determinados
        await signInWithEmailAndPassword(auth, emailToLogin, password);
        // El oyente onAuthStateChanged se encargará de la actualización de la interfaz de usuario si el inicio de sesión es exitoso

    } catch (error) {
        console.error("Error durante el inicio de sesión:", error);
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
 * Maneja el cierre de sesión del usuario.
 */
async function handleLogout() {
    try {
        await signOut(auth);
        // El oyente onAuthStateChanged se encargará de la actualización de la interfaz de usuario
    } catch (error) {
        console.error("Error durante el cierre de sesión:", error);
        showMessage('Error al cerrar sesión. Por favor, inténtalo de nuevo.', 'error');
    }
}

/**
 * Actualiza la visualización del saldo en la interfaz de usuario.
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
 * Maneja el cambio de visualización de la moneda en el panel de control.
 */
function toggleCurrencyDisplay() {
    showCurrencyUSD = !showCurrencyUSD;
    updateBalanceDisplay();
}

/**
 * Escucha los cambios en el estado de autenticación para actualizar la interfaz de usuario.
 */
onAuthStateChanged(auth, async (user) => {
    hideMessage(); // Borra cualquier mensaje
    hideTransactionStatus(); // Borra cualquier mensaje de estado de transacción

    if (user) {
        // El usuario ha iniciado sesión
        currentUser = user;
        currentUserId = user.uid;

        // Escucha las actualizaciones en tiempo real del perfil del usuario en Firestore
        // Ruta: artifacts/{appId}/users/{userId}
        const userProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        onSnapshot(userProfileRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                dashboardUserName.textContent = userData.name || 'Usuario';
                // Muestra el ID amigable para el usuario, si no está configurado, usa el UID de Firebase
                dashboardDisplayId.textContent = userData.userDisplayId || userData.userId;
                profileAvatar.textContent = (userData.name ? userData.name.substring(0,1) : 'U').toUpperCase(); // Establece la inicial del avatar

                currentBalanceUSD = userData.balanceUSD || 0;
                currentBalanceDOP = userData.balanceDOP || 0;
                updateBalanceDisplay();

                // Comprueba si hay depósitos pendientes y deshabilita el botón de depósito si es necesario
                if (userData.hasPendingDeposit) {
                    depositMoneyBtn.disabled = true;
                    depositMoneyBtn.textContent = 'Depósito Pendiente...';
                    showMessage('Tienes un depósito pendiente de aprobación. No puedes hacer otro depósito hasta que se confirme el actual.', 'info');
                } else {
                    depositMoneyBtn.disabled = false;
                    depositMoneyBtn.textContent = 'Depositar Dinero';
                }

                // Muestra los botones específicos del administrador si el usuario actual es administrador
                if (currentUser.email === ADMIN_EMAIL) {
                    adminButtonsContainer.classList.remove('hidden'); // Muestra el contenedor para los botones del administrador
                } else {
                    adminButtonsContainer.classList.add('hidden'); // Oculta para no administradores
                }

            } else {
                console.warn("Perfil de usuario no encontrado en Firestore para el UID:", currentUserId);
                // Si el perfil de usuario no existe, cierra la sesión
                handleLogout();
            }
        }, (error) => {
            console.error("Error al escuchar el perfil del usuario:", error);
            showMessage("Error al cargar los datos de tu perfil. Intenta recargar la página.", 'error');
        });

        // Carga los anuncios cuando el usuario inicia sesión
        loadAnnouncements();

        // Muestra el panel de control y oculta los formularios de inicio de sesión/registro y todos los modales
        showSection(dashboardSection, loginSection, registerSection, rulesConsentModal, userHistoryModal, adminFullHistoryModal, adminPendingRequestsModal, faqModal, onlineShoppingModal, streamingPaymentModal, gameRechargeModal, userPendingRequestsModal, receiptModal, editProfileModal, changePasswordModal, securityTipsModal, aboutUsModal, contactSupportModal, openSavingsAccountModal, viewSavingsAccountsModal, editAnnouncementsModal, depositToSavingsModal, withdrawFromSavingsModal, confirmDeleteSavingsAccountModal, savingsDebtsModal, adminSavingsDebtsModal);

    } else {
        // El usuario ha cerrado sesión
        currentUser = null;
        currentUserId = null;
        dashboardUserName.textContent = '';
        dashboardDisplayId.textContent = ''; // Borra el ID de visualización
        profileAvatar.textContent = 'U'; // Restablece el avatar
        accountBalance.textContent = '$0.00 USD';
        toggleCurrencyBtn.textContent = 'Cambiar a DOP';
        showCurrencyUSD = true; // Restablece la preferencia de visualización de moneda
        toggleTabs('login'); // Vuelve a la pestaña de inicio de sesión
    }
});


// --- Funcionalidad de transferencia de dinero ---

/**
 * Muestra el modal de transferencia de dinero y restablece su estado.
 */
transferMoneyBtn.addEventListener('click', () => {
    transferModal.classList.remove('hidden');
    transferForm.reset();
    recipientNameDisplay.textContent = ''; // Borra el nombre del destinatario anterior
    confirmTransferBtn.disabled = true; // Deshabilita el botón de confirmar inicialmente
});

/**
 * Cierra el modal de transferencia de dinero.
 */
cancelTransferModalBtn.addEventListener('click', () => {
    closeModal(transferModal);
    transferForm.reset();
    recipientNameDisplay.textContent = '';
    confirmTransferBtn.disabled = true;
});

// Oyente de eventos para la entrada del ID del destinatario para obtener el nombre
transferRecipientIdInput.addEventListener('input', async () => {
    const identifier = transferRecipientIdInput.value.trim();
    recipientNameDisplay.textContent = 'Buscando usuario...';
    confirmTransferBtn.disabled = true;
    currentTransferRecipientUid = null; // Restablece el UID en la nueva entrada

    if (!identifier) {
        recipientNameDisplay.textContent = '';
        return;
    }

    let recipientData = null;
    let querySnapshot;

    // 1. Intenta buscar por email
    if (identifier.includes('@')) {
        const q = query(collection(db, 'artifacts', appId, 'users'), where('email', '==', identifier));
        querySnapshot = await getDocs(q);
    } else {
        // 2. Si no es un email, intenta buscar por userDisplayId
        const q = query(collection(db, 'artifacts', appId, 'users'), where('userDisplayId', '==', identifier));
        querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            // 3. Finalmente, intenta buscar por UID de Firebase
            const q2 = query(collection(db, 'artifacts', appId, 'users'), where('userId', '==', identifier));
            querySnapshot = await getDocs(q2);
        }
    }

    if (!querySnapshot.empty) {
        recipientData = querySnapshot.docs[0].data();
        // Almacena el UID real de Firebase para la transacción
        currentTransferRecipientUid = recipientData.userId;
        // Almacena el identificador que el usuario escribió para los mensajes
        currentTransferRecipientIdentifier = identifier;
        currentTransferRecipientDisplayName = `${recipientData.name} ${recipientData.surname}`;
        recipientNameDisplay.textContent = `Usuario: ${currentTransferRecipientDisplayName}`;
        confirmTransferBtn.disabled = false;

        // Evita la auto-transferencia
        if (currentTransferRecipientUid === currentUserId) {
            recipientNameDisplay.textContent = '¡No puedes transferir dinero a tu propia cuenta!';
            confirmTransferBtn.disabled = true;
            currentTransferRecipientUid = null; // Invalida el destinatario
        }
    } else {
        recipientNameDisplay.textContent = 'Usuario no encontrado.';
        confirmTransferBtn.disabled = true;
        currentTransferRecipientUid = null;
        currentTransferRecipientDisplayName = '';
    }
});


/**
 * Maneja el envío del formulario de transferencia.
 * En un entorno real, esto DEBERÍA SER UNA FUNCIÓN DE LA NUBE DE FIREBASE por seguridad.
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

    // Comprueba el saldo del remitente (currentBalanceUSD y currentBalanceDOP ya están actualizados por onSnapshot)
    let senderBalance = currentTransferCurrency === 'USD' ? currentBalanceUSD : currentBalanceDOP;
    if (currentTransferAmount > senderBalance) {
        showMessage('Saldo insuficiente para realizar esta transferencia.', 'error');
        closeModal(transferModal); // Cierra el modal en caso de error
        return;
    }

    showMessage(`Iniciando transferencia de ${currentTransferAmount.toFixed(2)} ${currentTransferCurrency} a ${currentTransferRecipientDisplayName}... Por favor, espera 10 segundos.`, 'info');
    closeModal(transferModal); // Cierra el modal inmediatamente
    showTransactionStatus(`Transferencia a ${currentTransferRecipientDisplayName} en proceso... (10 segundos restantes)`);
    transferForm.reset(); // Restablece los campos del formulario
    recipientNameDisplay.textContent = ''; // Borra la visualización del nombre del destinatario
    confirmTransferBtn.disabled = true; // Deshabilita el botón después del envío

    // --- SIMULACIÓN DE 10 SEGUNDOS DE ESPERA ---
    let countdown = 10; // 10 segundos
    cancelOngoingTransferBtn.classList.remove('hidden'); // Muestra el botón de cancelar para la transferencia en curso

    transferInterval = setInterval(() => {
        countdown--;
        if (countdown >= 0) {
            transactionStatusText.textContent = `Transferencia a ${currentTransferRecipientDisplayName} en proceso... (${countdown} segundos restantes)`;
        }

        if (countdown <= 0) {
            clearInterval(transferInterval);
            transferInterval = null; // Borra el ID del intervalo
            hideTransactionStatus(); // Oculta el mensaje de estado
            performTransfer(currentUserId, currentTransferRecipientUid, currentTransferAmount, currentTransferCurrency, currentTransferRecipientDisplayName);
        }
    }, 1000); // Actualiza cada segundo
});

// Manejador del botón de cancelar transferencia en curso
cancelOngoingTransferBtn.addEventListener('click', () => {
    if (transferInterval) {
        clearInterval(transferInterval);
        transferInterval = null; // Borra el ID del intervalo
        hideTransactionStatus();
        showMessage('Transferencia cancelada.', 'info');
        // Restablece cualquier estado relacionado con la transferencia
        currentTransferRecipientUid = null;
        currentTransferAmount = 0;
        currentTransferCurrency = '';
        currentTransferRecipientIdentifier = '';
        currentTransferRecipientDisplayName = '';
    }
});


/**
 * Ejecuta la lógica de transferencia real después del retraso.
 * En un entorno real, esto DEBERÍA SER UNA FUNCIÓN DE LA NUBE DE FIREBASE por seguridad.
 * @param {string} senderUid UID de Firebase del remitente.
 * @param {string} actualRecipientUid UID de Firebase del destinatario.
 * @param {number} amount Cantidad a transferir.
 * @param {string} currency Moneda de la transferencia (USD/DOP).
 * @param {string} recipientDisplayName El nombre que se muestra al usuario para el destinatario.
 */
async function performTransfer(senderUid, actualRecipientUid, amount, currency, recipientDisplayName) {
    try {
        const senderProfileRef = doc(db, 'artifacts', appId, 'users', senderUid);
        const recipientProfileRef = doc(db, 'artifacts', appId, 'users', actualRecipientUid);

        // Obtener saldos actuales para la transacción (idealmente todo este bloque sería atómico en una función de la nube)
        const senderSnap = await getDoc(senderProfileRef);
        const recipientSnap = await getDoc(recipientProfileRef);

        if (!senderSnap.exists() || !recipientSnap.exists()) {
            showMessage('Error: No se encontraron los perfiles de remitente o destinatario para completar la transferencia.', 'error');
            return; // No procede con la transferencia si no se encuentran los perfiles
        }

        const senderData = senderSnap.data();
        const recipientData = recipientSnap.data();

        let senderCurrentBalanceUSD = senderData.balanceUSD || 0;
        let senderCurrentBalanceDOP = senderData.balanceDOP || 0;
        let recipientCurrentBalanceUSD = recipientData.balanceUSD || 0;
        let recipientCurrentBalanceDOP = recipientData.balanceDOP || 0;

        // Convierte la cantidad a USD para el cálculo interno si la moneda es DOP
        let amountInUSD = amount;
        if (currency === 'DOP') {
            amountInUSD = amount / USD_TO_DOP_RATE;
        }

        // Vuelve a verificar el saldo del remitente
        if (senderCurrentBalanceUSD < amountInUSD) {
            showMessage('Error: Saldo insuficiente para completar la transferencia (posiblemente ya gastado o error de concurrencia).', 'error');
            return;
        }

        // Actualiza el saldo del remitente
        senderCurrentBalanceUSD -= amountInUSD;
        senderCurrentBalanceDOP = senderCurrentBalanceUSD * USD_TO_DOP_RATE;

        // Actualiza el saldo del destinatario
        recipientCurrentBalanceUSD += amountInUSD;
        recipientCurrentBalanceDOP = recipientCurrentBalanceUSD * USD_TO_DOP_RATE;

        // Realiza las actualizaciones en Firestore
        await updateDoc(senderProfileRef, {
            balanceUSD: senderCurrentBalanceUSD,
            balanceDOP: senderCurrentBalanceDOP
        });

        await updateDoc(recipientProfileRef, {
            balanceUSD: recipientCurrentBalanceUSD,
            balanceDOP: recipientCurrentBalanceDOP
        });

        // Registra la transacción en una colección pública
        // Ruta: artifacts/{appId}/public/data/transactions
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
        // Los saldos se actualizarán automáticamente por el oyente onSnapshot

        // Muestra el recibo para el remitente
        const transactionDoc = await getDoc(newTransactionRef);
        if (transactionDoc.exists()) {
            showReceipt({ id: transactionDoc.id, ...transactionDoc.data() });
        }

    } catch (error) {
        console.error("Error al completar la transferencia:", error);
        showMessage('Error al procesar la transferencia. Por favor, inténtalo de nuevo.', 'error');
    } finally {
        // Asegura que el estado de la transacción esté oculto después de la finalización o el error
        hideTransactionStatus();
    }
}


// --- Funcionalidad de depósito de dinero ---

/**
 * Muestra el modal de depósito de dinero con un número de serie autogenerado.
 */
depositMoneyBtn.addEventListener('click', () => {
    depositSerialNumberInput.value = crypto.randomUUID().substring(0, 8).toUpperCase(); // Genera un ID único más corto
    depositModal.classList.remove('hidden');
});

/**
 * Cierra el modal de depósito de dinero.
 */
cancelDeposit.addEventListener('click', () => {
    closeModal(depositModal);
    depositForm.reset();
});

/**
 * Maneja el envío del formulario de depósito.
 * Las solicitudes se envían a pending_requests para la aprobación del administrador.
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
        // Comprueba si el usuario ya tiene un depósito pendiente (esta bandera específica es solo para depósitos)
        const userDocRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists() && userDocSnap.data().hasPendingDeposit) {
             showMessage('Ya tienes un depósito pendiente de aprobación. No puedes solicitar otro.', 'error');
             closeModal(depositModal);
             depositForm.reset();
             return;
        }

        // Agrega la solicitud de depósito a una colección unificada 'pending_requests'
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'deposit', // Indica el tipo de solicitud
            serialNumber: serialNumber,
            amount: amount,
            currency: currency,
            timestamp: serverTimestamp(),
            status: 'pending' // Estado para la aprobación del administrador
        });

        // Actualiza el perfil del usuario para marcar que tiene un depósito pendiente
        await updateDoc(userDocRef, {
            hasPendingDeposit: true
        });

        showMessage(`Solicitud de depósito de ${amount.toFixed(2)} ${currency} con número de serie ${serialNumber} enviada. Esperando aprobación del banco.`, 'success');
        closeModal(depositModal);
        depositForm.reset();

        // Envía un mensaje de WhatsApp al administrador
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

// --- Funcionalidad de retiro de dinero ---

/**
 * Muestra el modal de retiro de dinero.
 */
withdrawMoneyBtn.addEventListener('click', () => {
    withdrawModal.classList.remove('hidden');
});

/**
 * Cierra el modal de retiro de dinero.
 */
cancelWithdraw.addEventListener('click', () => {
    closeModal(withdrawModal);
    withdrawForm.reset();
});

/**
 * Maneja el envío del formulario de retiro.
 * Las solicitudes se envían a pending_requests para la aprobación del administrador.
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

    // Calcula el total estimado incluyendo la tarifa para mostrar
    let amountInUSD = amount;
    if (currency === 'DOP') {
        amountInUSD = amount / USD_TO_DOP_RATE;
    }
    const estimatedFeeInUSD = amountInUSD * WITHDRAWAL_FEE_RATE;
    const totalRequiredForWithdrawalInUSD = amountInUSD + estimatedFeeInUSD;

    // Comprueba si el saldo actual es suficiente para la estimación (verificación final en la confirmación)
    if (currentBalanceUSD < totalRequiredForWithdrawalInUSD) {
        showMessage(`Saldo insuficiente para cubrir el retiro de ${amount.toFixed(2)} ${currency} y la tarifa del 4%. Necesitas $${totalRequiredForWithdrawalInUSD.toFixed(2)} USD.`, 'error');
        return;
    }

    try {
        // Agrega la solicitud de retiro a una colección unificada 'pending_requests'
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'withdrawal', // Indica el tipo de solicitud
            amount: amount,
            currency: currency,
            timestamp: serverTimestamp(),
            status: 'pending', // Estado para la aprobación del administrador
            estimatedFee: estimatedFeeInUSD // Almacena la tarifa estimada para la revisión del administrador
        });

        showMessage(`Solicitud de retiro de ${amount.toFixed(2)} ${currency} enviada. Esperando aprobación del banco. Se aplicará una tarifa del 4% al confirmar.`, 'success');
        closeModal(withdrawModal);
        withdrawForm.reset();

        // Envía un mensaje de WhatsApp al administrador
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

// --- Lógica de compras en línea ---
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
    const totalAmount = amountInUSD + feeAmount; // Esto es lo que el usuario *pagará* después de la confirmación del administrador

    shoppingFeeDisplay.textContent = `$${feeAmount.toFixed(2)} USD`;
    shoppingTotalDisplay.textContent = `$${totalAmount.toFixed(2)} USD`;
}

onlineShoppingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const productAmount = parseFloat(shoppingAmountInput.value);
    const productCurrency = shoppingCurrencyInput.value;
    const productLinks = productLinksInput.value.trim();
    const shoppingCategory = shoppingCategoryInput.value; // Obtener categoría

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
    const totalToDeductInUSD = amountInUSD + feeAmount; // Este es el monto total que el usuario pagará

    try {
        // Agrega la solicitud de compra en línea a 'pending_requests'
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'online_purchase',
            productAmount: productAmount,
            productCurrency: productCurrency,
            productLinks: productLinks,
            feeAmount: feeAmount, // Almacena la tarifa calculada
            totalAmountToDeduct: totalToDeductInUSD, // Almacena el total a deducir
            category: shoppingCategory, // Almacena la categoría
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage('Solicitud de compra por internet enviada. Esperando aprobación del administrador. El dinero se deducirá al confirmar.', 'info');
        closeModal(onlineShoppingModal);
        onlineShoppingForm.reset();

        // Envía un mensaje de WhatsApp al administrador
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

// --- Lógica de pago de streaming ---
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
    const totalAmount = amountInUSD + feeAmount; // Esto es lo que el usuario *pagará* después de la confirmación del administrador

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
    const streamingCategory = streamingCategoryInput.value; // Obtener categoría

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
    const totalToDeductInUSD = amountInUSD + feeAmount; // Este es el monto total que el usuario pagará

    try {
        // Agrega la solicitud de pago de streaming a 'pending_requests'
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'streaming_payment',
            service: service,
            accountIdentifier: accountIdentifier,
            subscriptionAmount: subscriptionAmount,
            subscriptionCurrency: subscriptionCurrency,
            feeAmount: feeAmount,
            totalAmountToDeduct: totalToDeductInUSD,
            category: streamingCategory, // Almacena la categoría
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage('Solicitud de pago de servicio de streaming enviada. Esperando aprobación del administrador. El dinero se deducirá al confirmar.', 'info');
        closeModal(streamingPaymentModal);
        streamingPaymentForm.reset();

        // Envía un mensaje de WhatsApp al administrador
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

// --- NUEVO: Lógica de recarga de juegos ---
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
    const totalAmount = amountInUSD + feeAmount; // Esto es lo que el usuario *pagará* después de la confirmación del administrador

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
        amountInUSD = amount / USD_TO_DOP_RATE;
    }

    const feeAmount = amountInUSD * COMMISSION_RATE;
    const totalToDeductInUSD = amountInUSD + feeAmount; // Este es el monto total que el usuario pagará

    try {
        // Agrega la solicitud de recarga de juegos a 'pending_requests'
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

        // Envía un mensaje de WhatsApp al administrador
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


// --- Funcionalidad de solicitudes pendientes del administrador (Unificado) ---

viewAdminPendingRequestsBtn.addEventListener('click', () => {
    adminPendingRequestsModal.classList.remove('hidden');
    loadAdminPendingRequests();
});

closeAdminPendingRequestsModalBtn.addEventListener('click', () => {
    closeModal(adminPendingRequestsModal);
    // Desuscribirse del oyente cuando se cierra el modal
    if (adminPendingRequestsUnsubscribe) {
        adminPendingRequestsUnsubscribe();
        adminPendingRequestsUnsubscribe = null;
        console.log("Admin: Desuscrito del oyente de solicitudes pendientes al cerrar el modal.");
    }
});

/**
 * Carga y muestra todas las solicitudes pendientes para el administrador.
 */
function loadAdminPendingRequests() {
    // Desuscribirse del oyente anterior si existe
    if (adminPendingRequestsUnsubscribe) {
        adminPendingRequestsUnsubscribe();
        adminPendingRequestsUnsubscribe = null; // Restablecer
        console.log("Admin: Desuscrito del oyente de solicitudes pendientes anterior.");
    }

    adminPendingRequestsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">Cargando solicitudes pendientes...</td></tr>';
    const pendingRequestsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests');
    const q = query(pendingRequestsCollectionRef, where('status', '==', 'pending'));

    // Asigna la función de desuscripción a adminPendingRequestsUnsubscribe
    adminPendingRequestsUnsubscribe = onSnapshot(q, async (snapshot) => {
        adminPendingRequestsTableBody.innerHTML = ''; // Borra la tabla para nuevos datos
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
                    amountDisplay = (request.totalAmountToDeduct ?? 0).toFixed(2); // Muestra el monto total a deducir
                    currencyDisplay = 'USD'; // Asumiendo que totalToDeduct está en USD
                    detailsDisplay = `Cant. Prod: ${(request.productAmount ?? 0).toFixed(2)} ${request.productCurrency}, Tarifa (3%): $${(request.feeAmount ?? 0).toFixed(2)} USD. Cat: ${request.category || 'N/A'}. Enlaces: ${request.productLinks.substring(0, 50)}...`;
                    break;
                case 'streaming_payment':
                    typeDisplay = 'Pago Streaming';
                    amountDisplay = (request.totalAmountToDeduct ?? 0).toFixed(2); // Muestra el monto total a deducir
                    currencyDisplay = 'USD'; // Asumiendo que totalToDeduct está en USD
                    detailsDisplay = `Servicio: ${request.service}, Cuenta: ${request.accountIdentifier}, Tarifa (3%): $${(request.feeAmount ?? 0).toFixed(2)} USD. Cat: ${request.category || 'N/A'}.`;
                    break;
                case 'game_recharge': // NUEVO: Visualización de solicitud pendiente de administrador para recarga de juegos
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
        console.error("Error al cargar las solicitudes pendientes del administrador:", error);
        adminPendingRequestsTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 py-4">Error al cargar solicitudes pendientes.</td></tr>`;
    });
}

// Delegación de eventos para los botones de confirmar/rechazar en la tabla de solicitudes pendientes del administrador
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
            dataset.gameName, // NUEVO
            dataset.playerId, // NUEVO
            parseFloat(dataset.rechargeAmount), // NUEVO
            dataset.rechargeCurrency, // NUEVO
            parseFloat(dataset.feeAmount),
            parseFloat(dataset.totalAmountToDeduct),
            dataset.category,
            dataset.savingsGoal,
            parseFloat(dataset.initialDepositAmount),
            dataset.initialDepositCurrency,
            dataset.preferredSavingsFrequency,
            parseFloat(dataset.periodicContributionAmount), // Pasa periodicContributionAmount
            dataset.startDate, // Pasa startDate
            dataset.endDate // Pasa endDate
        );
    } else if (target.classList.contains('reject-request-btn')) {
        const dataset = target.dataset;
        await rejectRequest(dataset.requestId, dataset.type, dataset.userId);
    }
});


/**
 * Confirma una solicitud pendiente, maneja la transferencia de dinero y registra la transacción.
 */
async function confirmRequest(
            requestId, type, userId, amount, currency, serialNumber,
            productAmount, productCurrency, productLinks,
            service, accountIdentifier, subscriptionAmount, subscriptionCurrency,
            gameName, playerId, rechargeAmount, rechargeCurrency, // Parámetros NUEVOS de recarga de juegos
            feeAmount, totalAmountToDeduct, category,
            savingsGoal, initialDepositAmount, initialDepositCurrency, preferredSavingsFrequency, periodicContributionAmount, startDate, endDate // Nuevos parámetros
        ) {
            console.log("Confirmando solicitud:", { requestId, type, userId, amount, currency, serialNumber, productAmount, productCurrency, productLinks, service, accountIdentifier, subscriptionAmount, subscriptionCurrency, gameName, playerId, rechargeAmount, rechargeCurrency, feeAmount, totalAmountToDeduct, category, savingsGoal, initialDepositAmount, initialDepositCurrency, preferredSavingsFrequency, periodicContributionAmount, startDate, endDate });
            try {
                const userProfileRef = doc(db, 'artifacts', appId, 'users', userId);
                const requestDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'pending_requests', requestId);

                const userDocSnap = await getDoc(userProfileRef);

                if (!userDocSnap.exists()) {
                    console.error("Error: Perfil de usuario no encontrado para la solicitud:", userId);
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
                    console.warn("Cuenta de administrador no encontrada. Las tarifas podrían no transferirse al administrador.");
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

                        // --- CAMBIO AQUÍ: Solo transferimos la tarifa (feeAmount) al administrador ---
                        if (adminId && feeAmount > 0) {
                            console.log("Transfiriendo TARIFA de compra en línea al administrador:", feeAmount, "USD");
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

                        // --- CAMBIO AQUÍ: Solo transferimos la tarifa (feeAmount) al administrador ---
                        if (adminId && feeAmount > 0) {
                            console.log("Transfiriendo TARIFA de pago de streaming al administrador:", feeAmount, "USD");
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

                        // --- CAMBIO AQUÍ: Solo transferimos la tarifa (feeAmount) al administrador ---
                        if (adminId && feeAmount > 0) {
                            console.log("Transfiriendo TARIFA de recarga de juego al administrador:", feeAmount, "USD");
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
                        console.error("Error: Tipo de solicitud desconocido:", type);
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
 * Rechaza una solicitud pendiente.
 */
async function rejectRequest(requestId, type, userId) {
    try {
        const requestDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'pending_requests', requestId);

        await updateDoc(requestDocRef, {
            status: 'rejected',
            rejectedAt: serverTimestamp()
        });

        // Para los depósitos, restablece la bandera hasPendingDeposit para que el usuario pueda solicitar de nuevo
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
 * Carga y muestra el historial de transacciones del usuario actual.
 */
async function loadUserHistory() {
    userHistoryTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">Cargando historial...</td></tr>';

    const transactionsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');

    const q = query(transactionsCollectionRef,
        where('status', '==', 'completed')
    );

    onSnapshot(q, async (snapshot) => {
        userHistoryTableBody.innerHTML = '';
        userTransactionsData = []; // Borra los datos anteriores

        for (const docEntry of snapshot.docs) {
            const transaction = { id: docEntry.id, ...docEntry.data() };

            // Filtra las transacciones completadas del usuario actual
            if ((transaction.type === 'deposit' || transaction.type === 'withdrawal' || transaction.type === 'online_purchase' || transaction.type === 'streaming_payment' || transaction.type === 'game_recharge' || transaction.type === 'savings_account_open' || transaction.type === 'deposit_to_savings' || transaction.type === 'withdraw_from_savings' || transaction.type === 'delete_savings_account' || transaction.type === 'automatic_savings_collection' || transaction.type === 'savings_debt_payment' || transaction.type === 'savings_indemnization_applied') && transaction.userId === currentUserId) {
                userTransactionsData.push(transaction);
            } else if (transaction.type === 'transfer' && (transaction.senderId === currentUserId || transaction.recipientId === currentUserId)) {
                userTransactionsData.push(transaction);
            }
            // NO incluyas 'withdrawal_fee' en el historial del usuario, ya que es una transacción interna del administrador
        }

        if (userTransactionsData.length === 0) {
            userHistoryTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">No hay movimientos en tu historial.</td></tr>';
            return;
        }

        // Ordena las transacciones por marca de tiempo descendente (las más recientes primero)
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
                    amountDisplay = `-${(transaction.totalAmountDeducted ?? 0).toFixed(2)} ${transaction.currency}`; // Este es el total deducido
                    break;
                case 'streaming_payment':
                    typeDisplay = 'Pago Streaming';
                    detailsDisplay = `Servicio: ${transaction.service}, Cat: ${transaction.category || 'N/A'}, Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} ${transaction.feeCurrency}`;
                    amountDisplay = `-${(transaction.totalAmountDeducted ?? 0).toFixed(2)} ${transaction.currency}`; // Este es el total deducido
                    break;
                case 'game_recharge': // NUEVO: Visualización de historial de usuario para recarga de juegos
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

        // Adjunta oyentes de eventos para los botones "Ver Recibo"
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
        console.error("Error al cargar el historial del usuario:", error);
        userHistoryTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-4">Error al cargar tu historial.</td></tr>`;
    });
}


/**
 * Carga y muestra el historial completo de transacciones para todos los usuarios en el modal del administrador.
 */
async function loadAdminFullHistory() {
    console.log("Admin: loadAdminFullHistory() llamado.");
    adminFullHistoryTableBodyModal.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">Cargando historial completo...</td></tr>';
    const transactionsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const q = query(transactionsCollectionRef, where('status', '==', 'completed'));

    onSnapshot(q, async (snapshot) => {
        console.log("Admin: onSnapshot para el historial completo del administrador activado.");
        console.log("Admin: Tamaño de la instantánea para el historial completo:", snapshot.size);

        adminFullHistoryTableBodyModal.innerHTML = '';
        if (snapshot.empty) {
            adminFullHistoryTableBodyModal.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">No hay transacciones en el historial.</td></tr>';
            console.log("Admin: No se encontraron transacciones para el historial del administrador.");
            return;
        }

        const allTransactions = [];
        for (const docEntry of snapshot.docs) {
            allTransactions.push({ id: docEntry.id, ...docEntry.data() });
        }

        // Ordena las transacciones por marca de tiempo descendente (las más recientes primero)
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
                    amountValue = (transaction.amount ?? 0); // Este es el monto de la tarifa
                    currencyValue = 'USD';
                    details = `ID Solicitud Original: ${transaction.originalRequestId || 'N/A'}`;
                    break;
                case 'online_purchase':
                    typeDisplay = 'Compra Online';
                    usersInvolved = await getUserDisplayName(transaction.userId);
                    amountValue = (transaction.totalAmountDeducted ?? 0); // Muestra el total deducido del usuario
                    currencyValue = 'USD';
                    details = `Cat: ${transaction.category || 'N/A'}. Enlaces: ${transaction.productLinks ? transaction.productLinks.substring(0, 50) + '...' : 'N/A'}. Total prod: ${(transaction.productAmount ?? 0).toFixed(2)} ${transaction.productCurrency}, Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} ${transaction.feeCurrency}`;
                    break;
                case 'streaming_payment':
                    typeDisplay = 'Pago Streaming';
                    usersInvolved = await getUserDisplayName(transaction.userId);
                    amountValue = (transaction.totalAmountDeducted ?? 0); // Muestra el total deducido del usuario
                    currencyValue = 'USD';
                    details = `Servicio: ${transaction.service}, Cat: ${transaction.category || 'N/A'}, Cuenta: ${transaction.accountIdentifier}, Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} ${transaction.feeCurrency}`;
                    break;
                case 'game_recharge': // NUEVO: Visualización de historial de administrador para recarga de juegos
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
            adminFullHistoryTableBodyModal.appendChild(row); // Agrega al tbody del modal
        }
        console.log(`Admin: Se cargaron ${snapshot.docs.length} transacciones totales para el historial del administrador.`);
    }, (error) => {
        console.error("Admin: Error al cargar el historial completo del administrador:", error);
        adminFullHistoryTableBodyModal.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 py-4">Error al cargar el historial completo.</td></tr>`;
    });
}

/**
 * Carga y muestra los depósitos y retiros pendientes del usuario actual, y otras solicitudes pendientes.
 */
async function loadUserPendingRequests() {
    userPendingRequestsTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">Cargando solicitudes...</td></tr>';

    const pendingRequestsRef = collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests');
    const userPendingQuery = query(pendingRequestsRef, where('userId', '==', currentUserId), where('status', '==', 'pending'));

    onSnapshot(userPendingQuery, async (snapshot) => {
        userPendingRequestsTableBody.innerHTML = ''; // Borra la tabla para nuevos datos
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
                    amountToDisplay = (data.totalAmountToDeduct ?? 0); // Muestra el total que se deducirá
                    currencyToDisplay = 'USD';
                    detailDisplay = `Cat: ${data.category || 'N/A'}, Total prod: ${(data.productAmount ?? 0).toFixed(2)} ${data.productCurrency}, Tarifa: ${(data.feeAmount ?? 0).toFixed(2)} USD`;
                    break;
                case 'streaming_payment':
                    typeDisplay = 'Pago Streaming';
                    amountToDisplay = (data.totalAmountToDeduct ?? 0); // Muestra el total que se deducirá
                    currencyToDisplay = 'USD';
                    detailDisplay = `Servicio: ${data.service}, Cat: ${data.category || 'N/A'}, Tarifa: ${(data.feeAmount ?? 0).toFixed(2)} USD`;
                    break;
                case 'game_recharge': // NUEVO: Visualización de solicitud pendiente del usuario para recarga de juegos
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

        // Ordena por marca de tiempo descendente
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
        console.error("Error al cargar las solicitudes pendientes del usuario:", error);
        userPendingRequestsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-4">Error al cargar solicitudes pendientes.</td></tr>`;
    });
}

// --- NUEVO: Funcionalidad de abrir cuenta de ahorro ---
openSavingsAccountBtn.addEventListener('click', () => {
    openSavingsAccountModal.classList.remove('hidden');
    savingsAccountForm.reset();
    // Establece la fecha mínima para savingsEndDate en hoy
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
    const periodicContributionAmount = parseFloat(periodicContributionAmountInput.value); // Obtener contribución periódica
    const savingsEndDate = savingsEndDateInput.value; // Obtener fecha de finalización

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
        // Agrega la solicitud de apertura de cuenta de ahorro a 'pending_requests'
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'savings_account_open',
            savingsGoal: savingsGoal,
            initialDepositAmount: initialDepositAmount,
            initialDepositCurrency: initialDepositCurrency,
            preferredSavingsFrequency: preferredSavingsFrequency,
            periodicContributionAmount: periodicContributionAmount, // Almacena la contribución periódica
            startDate: serverTimestamp(), // Establece automáticamente la fecha de inicio
            endDate: savingsEndDate, // Almacena la fecha de finalización proporcionada
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage(`Solicitud para abrir cuenta de ahorro para "${savingsGoal}" enviada. Esperando aprobación del administrador.`, 'success');
        closeModal(openSavingsAccountModal);
        savingsAccountForm.reset();

        // Envía un mensaje de WhatsApp al administrador
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

// --- NUEVO: Funcionalidad de ver cuentas de ahorro ---
viewSavingsAccountsBtn.addEventListener('click', () => {
    viewSavingsAccountsModal.classList.remove('hidden');
    loadSavingsAccounts();
});

closeViewSavingsAccountsBtn.addEventListener('click', () => {
    closeModal(viewSavingsAccountsModal);
});

/**
 * Carga y muestra las cuentas de ahorro del usuario y maneja la recolección automática.
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
        today.setHours(0, 0, 0, 0); // Normaliza al inicio del día para la comparación

        for (const docEntry of snapshot.docs) {
            const account = docEntry.data();
            const savingsAccountId = docEntry.id;

            const startDateDisplay = account.startDate ? new Date(account.startDate.seconds * 1000).toLocaleDateString() : 'N/A';
            const endDateDisplay = account.endDate || 'N/A';
            const nextContributionDueDateDisplay = account.nextContributionDueDate ? new Date(account.nextContributionDueDate.seconds * 1000).toLocaleDateString() : 'N/A';

            // --- Lógica de recolección automática ---
            if (account.status === 'active' && account.preferredSavingsFrequency !== 'Ocasional' && account.periodicContributionAmount > 0) {
                const nextDueDate = account.nextContributionDueDate ? new Date(account.nextContributionDueDate.seconds * 1000) : null;
                const lastAttemptDate = account.lastContributionAttemptDate ? new Date(account.lastContributionAttemptDate.seconds * 1000) : null;

                // Normaliza nextDueDate y lastAttemptDate al inicio del día para una comparación precisa
                if (nextDueDate) nextDueDate.setHours(0, 0, 0, 0);
                if (lastAttemptDate) lastAttemptDate.setHours(0, 0, 0, 0);

                // Comprueba si un pago está vencido Y no se ha intentado hoy
                if (nextDueDate && today >= nextDueDate && (!lastAttemptDate || today > lastAttemptDate)) {
                    console.log(`Intentando recolección automática para la cuenta de ahorro ${savingsAccountId} (Objetivo: ${account.savingsGoal})`);
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

        // Adjunta oyentes de eventos para los nuevos botones usando delegación
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
        console.error("Error al cargar las cuentas de ahorro:", error);
        savingsAccountsTableBody.innerHTML = `<tr><td colspan="10" class="text-center text-red-500 py-4">Error al cargar cuentas de ahorro.</td></tr>`;
    });
}

/**
 * Intenta recolectar automáticamente la contribución de ahorro.
 * @param {string} userId El UID de Firebase del usuario.
 * @param {string} savingsAccountId El ID de la cuenta de ahorro.
 * @param {number} amount La cantidad a recolectar.
 * @param {string} savingsGoal El objetivo de la cuenta de ahorro.
 */
async function attemptAutomaticSavingsCollection(userId, savingsAccountId, amount, savingsGoal) {
    console.log(`Intentando recolección automática para el usuario ${userId}, cuenta ${savingsAccountId}, monto ${amount}`);
    try {
        const userProfileRef = doc(db, 'artifacts', appId, 'users', userId);
        const savingsAccountRef = doc(db, 'artifacts', appId, 'users', userId, 'savings_accounts', savingsAccountId);

        const userDocSnap = await getDoc(userProfileRef);
        const savingsDocSnap = await getDoc(savingsAccountRef);

        if (!userDocSnap.exists() || !savingsDocSnap.exists()) {
            console.error("Usuario o cuenta de ahorro no encontrados durante el intento de recolección automática.");
            return;
        }

        const userData = userDocSnap.data();
        const savingsData = savingsDocSnap.data();

        let userCurrentBalanceUSD = userData.balanceUSD || 0;
        let savingsCurrentBalanceUSD = savingsData.balanceUSD || 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Actualiza lastContributionAttemptDate independientemente del éxito/fracaso
        await updateDoc(savingsAccountRef, {
            lastContributionAttemptDate: serverTimestamp()
        });

        if (userCurrentBalanceUSD >= amount) {
            // Fondos suficientes: realiza la transferencia
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
                nextContributionDueDate: getNextDueDate(savingsData.preferredSavingsFrequency, today) // Actualiza la próxima fecha de vencimiento
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
            console.log(`Recolección automática para ${savingsGoal} exitosa.`);

        } else {
            // Fondos insuficientes: registra una deuda
            console.log(`Fondos insuficientes para la recolección automática de ${savingsGoal}. Registrando deuda.`);

            // Comprueba si ya existe una deuda para este período y está pendiente/vencida
            const existingDebtsQuery = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'savings_debts'),
                where('userId', '==', userId),
                where('savingsAccountId', '==', savingsAccountId),
                where('status', 'in', ['pending', 'overdue'])
            );
            const existingDebtsSnap = await getDocs(existingDebtsQuery);

            if (existingDebtsSnap.empty) {
                // Crea una nueva entrada de deuda
                const dueDateForDebt = addDays(today, 7); // 7 días para pagar la deuda
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'savings_debts'), {
                    userId: userId,
                    savingsAccountId: savingsAccountId,
                    savingsGoal: savingsGoal,
                    amountDue: amount,
                    currency: 'USD',
                    dueDate: dueDateForDebt,
                    status: 'pending', // 'pending' para pago, 'overdue' si pasó la fecha de vencimiento, 'paid', 'penalized'
                    penaltyApplied: false,
                    createdAt: serverTimestamp(),
                    lastUpdated: serverTimestamp()
                });
                showMessage(`No hay suficiente saldo para el cobro automático de "${savingsGoal}". Se ha registrado una deuda de $${amount.toFixed(2)} USD. Tienes hasta el ${dueDateForDebt.toLocaleDateString()} para pagar.`, 'error');
            } else {
                console.log(`Ya existe una deuda para ${savingsGoal} para este período. No se creó ninguna deuda nueva.`);
                showMessage(`Ya tienes una deuda pendiente para tu cuenta de ahorro "${savingsGoal}".`, 'info');
            }

            // Actualiza la próxima fecha de vencimiento de la contribución incluso si se crea la deuda, para evitar volver a intentar el mismo período
            await updateDoc(savingsAccountRef, {
                nextContributionDueDate: getNextDueDate(savingsData.preferredSavingsFrequency, today)
            });
        }
    } catch (error) {
        console.error("Error durante la recolección automática de ahorros:", error);
        showMessage(`Error en el cobro automático para "${savingsGoal}". Intenta de nuevo más tarde.`, 'error');
    }
}

/**
 * Calcula la próxima fecha de vencimiento de la contribución en función de la frecuencia.
 * @param {string} frequency La frecuencia de ahorro preferida.
 * @param {Date} lastDate La última fecha en que se venció o se intentó una contribución.
 * @returns {Date} La próxima fecha de vencimiento.
 */
function getNextDueDate(frequency, lastDate) {
    let nextDate = new Date(lastDate); // Comienza desde la última fecha intentada/vencida
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

// --- NUEVO: Funciones del modal de depósito en ahorros ---
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

        // Deduce de la cuenta principal
        let newUserBalanceUSD = userData.balanceUSD - amountInUSD;
        let newUserBalanceDOP = newUserBalanceUSD * USD_TO_DOP_RATE;

        // Agrega a la cuenta de ahorro
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

        // Registra la transacción
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
        console.error("Error al depositar en la cuenta de ahorro:", error);
        showMessage('Error al depositar en la cuenta de ahorro. Intenta de nuevo.', 'error');
    }
});

// --- NUEVO: Funciones del modal de retiro de ahorros ---
function showWithdrawFromSavingsModal(accountId, savingsGoal, balanceUsd) {
    currentSavingsAccountId = accountId;
    currentSavingsAccountGoal = savingsGoal;
    currentSavingsAccountBalanceUSD = balanceUsd; // Almacena para validación
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

        // Deduce de la cuenta de ahorro
        let newSavingsBalanceUSD = savingsData.balanceUSD - amountInUSD;
        let newSavingsBalanceDOP = newSavingsBalanceUSD * USD_TO_DOP_RATE;

        // Agrega a la cuenta principal
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

        // Registra la transacción
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
        console.error("Error al retirar de la cuenta de ahorro:", error);
        showMessage('Error al retirar de la cuenta de ahorro. Intenta de nuevo.', 'error');
    }
});

// --- NUEVO: Funciones de eliminación de cuenta de ahorro ---
function showConfirmDeleteSavingsAccountModal(accountId, savingsGoal, balanceUsd) {
    currentSavingsAccountId = accountId;
    currentSavingsAccountGoal = savingsGoal;
    currentSavingsAccountBalanceUSD = balanceUsd; // Almacena para el cálculo

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
cancelDeleteSavingsAccountBtn2.addEventListener('click', () => { // Segundo botón de cancelar
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

        // Actualiza el saldo de la cuenta principal
        let newUserBalanceUSD = userData.balanceUSD + remainingBalanceToTransfer;
        let newUserBalanceDOP = newUserBalanceUSD * USD_TO_DOP_RATE;

        await updateDoc(userProfileRef, {
            balanceUSD: newUserBalanceUSD,
            balanceDOP: newUserBalanceDOP
        });

        // Transfiere la tarifa al administrador
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
            console.log("Tarifa de eliminación de cuenta de ahorro transferida al administrador y registrada.");
        } else {
            console.warn("Cuenta de administrador no encontrada. La tarifa de eliminación de cuenta de ahorro podría no transferirse.");
        }


        // Elimina el documento de la cuenta de ahorro
        await deleteDoc(savingsAccountRef);

        // Registra la transacción de eliminación
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
        // El oyente onSnapshot de loadSavingsAccounts() actualizará automáticamente la tabla
    } catch (error) {
        console.error("Error al eliminar la cuenta de ahorro:", error);
        showMessage('Error al eliminar la cuenta de ahorro. Intenta de nuevo.', 'error');
    }
});


// --- NUEVO: Funcionalidad de editar anuncios del administrador ---
editAnnouncementsBtn.addEventListener('click', async () => {
    editAnnouncementsModal.classList.remove('hidden');
    await loadAnnouncementsForEdit(); // Carga los anuncios actuales en el área de texto
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
        }, { merge: true }); // Usa merge para evitar sobrescribir otros campos si existen

        showMessage('¡Anuncios actualizados exitosamente!', 'success');
        closeModal(editAnnouncementsModal);
    } catch (error) {
        console.error("Error al actualizar los anuncios:", error);
        showMessage('Error al actualizar los anuncios. Intenta de nuevo.', 'error');
    }
});

/**
 * Carga los anuncios en la lista del panel de control y en el área de texto de edición.
 * Usa onSnapshot para actualizaciones en tiempo real en el panel de control.
 */
function loadAnnouncements() {
    const announcementsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcements');

    onSnapshot(announcementsDocRef, (docSnap) => {
        announcementsList.innerHTML = ''; // Borra la lista existente
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
        console.error("Error al cargar los anuncios:", error);
        announcementsList.innerHTML = '<li>Error al cargar anuncios.</li>';
    });
}

/**
 * Carga los anuncios específicamente para el área de texto del modal de edición.
 */
async function loadAnnouncementsForEdit() {
    try {
        const announcementsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcements');
        const docSnap = await getDoc(announcementsDocRef);
        if (docSnap.exists() && docSnap.data().items && Array.isArray(docSnap.data().items)) {
            announcementsTextarea.value = docSnap.data().items.join('\n');
        } else {
            announcementsTextarea.value = ''; // Borra si no hay anuncios o el formato es incorrecto
        }
    } catch (error) {
        console.error("Error al cargar los anuncios para editar:", error);
        announcementsTextarea.value = 'Error al cargar anuncios para editar.';
    }
}


// --- Funciones de edición de perfil ---
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
            editPhoneNumberInput.value = userData.phoneNumber || ''; // Rellena el número de teléfono
            editProfileModal.classList.remove('hidden');
        } else {
            showMessage('No se pudieron cargar los datos de tu perfil.', 'error');
        }
    } catch (error) {
        console.error("Error al cargar el perfil para editar:", error);
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
    const phoneNumber = editPhoneNumberInput.value.trim(); // Obtener número de teléfono

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
            phoneNumber: phoneNumber // Actualiza el número de teléfono
        });
        showMessage('¡Perfil actualizado exitosamente!', 'success');
        closeModal(editProfileModal);
    } catch (error) {
        console.error("Error al actualizar el perfil:", error);
        showMessage('Error al actualizar el perfil. Intenta de nuevo.', 'error');
    }
});

// --- Funciones de cambio de contraseña ---
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
        // Volver a autenticar al usuario con la contraseña actual
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);

        // Actualizar contraseña
        await updatePassword(currentUser, newPassword);

        showMessage('¡Contraseña actualizada exitosamente!', 'success');
        closeModal(changePasswordModal);
        changePasswordForm.reset();
    } catch (error) {
        console.error("Error al cambiar la contraseña:", error);
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

// --- Funciones de consejos de seguridad ---
securityTipsBtn.addEventListener('click', () => {
    securityTipsModal.classList.remove('hidden');
});

closeSecurityTipsBtn.addEventListener('click', () => {
    closeModal(securityTipsModal);
});

// --- Funciones de acerca de nosotros ---
aboutUsBtn.addEventListener('click', () => {
    aboutUsModal.classList.remove('hidden');
});

closeAboutUsBtn.addEventListener('click', () => {
    closeModal(aboutUsModal);
});

// --- Funciones de contacto y soporte ---
contactSupportBtn.addEventListener('click', () => {
    contactSupportModal.classList.remove('hidden');
});

closeContactSupportBtn.addEventListener('click', () => {
    closeModal(contactSupportModal);
});

// --- NUEVO: Funciones de deudas de ahorro del cliente ---
viewSavingsDebtsBtn.addEventListener('click', () => {
    savingsDebtsModal.classList.remove('hidden');
    loadSavingsDebts();
});

closeSavingsDebtsModalBtn.addEventListener('click', () => {
    closeModal(savingsDebtsModal);
    // Desuscribirse del oyente cuando se cierra el modal
    if (savingsDebtsUnsubscribe) {
        savingsDebtsUnsubscribe();
        savingsDebtsUnsubscribe = null;
        console.log("Cliente: Desuscrito del oyente de deudas de ahorro al cerrar el modal.");
    }
});

/**
 * Carga y muestra las deudas de ahorro del usuario actual.
 */
async function loadSavingsDebts() {
    // Desuscribirse del oyente anterior si existe
    if (savingsDebtsUnsubscribe) {
        savingsDebtsUnsubscribe();
        savingsDebtsUnsubscribe = null; // Restablecer
        console.log("Cliente: Desuscrito del oyente de deudas de ahorro anterior.");
    }

    savingsDebtsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">Cargando deudas...</td></tr>';

    if (!currentUserId) {
        savingsDebtsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500 py-4">Inicia sesión para ver tus deudas.</td></tr>';
        return;
    }

    const debtsRef = collection(db, 'artifacts', appId, 'public', 'data', 'savings_debts');
    const q = query(debtsRef, where('userId', '==', currentUserId), where('status', 'in', ['pending', 'overdue']));

    // Asigna la función de desuscripción a savingsDebtsUnsubscribe
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

        // Adjunta oyentes de eventos para los botones "Pagar"
        savingsDebtsTableBody.querySelectorAll('.pay-debt-btn').forEach(button => {
            button.onclick = async (event) => {
                const { debtId, amountDue, currency, savingsGoal, savingsAccountId } = event.target.dataset;
                await paySavingsDebt(debtId, parseFloat(amountDue), currency, savingsGoal, savingsAccountId);
            };
        });

    }, (error) => {
        console.error("Error al cargar las deudas de ahorro:", error);
        savingsDebtsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-4">Error al cargar deudas de ahorro.</td></tr>`;
    });
}

/**
 * Maneja el pago de una deuda de ahorro.
 * @param {string} debtId El ID del documento de deuda.
 * @param {number} amountDue La cantidad a pagar.
 * @param {string} currency La moneda de la deuda.
 * @param {string} savingsGoal El objetivo de la cuenta de ahorro asociada.
 * @param {string} savingsAccountId El ID de la cuenta de ahorro asociada a la deuda.
 */
async function paySavingsDebt(debtId, amountDue, currency, savingsGoal, savingsAccountId) {
    hideMessage();
    try {
        const userProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        const debtDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'savings_debts', debtId);
        const savingsAccountRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'savings_accounts', savingsAccountId); // Referencia a la cuenta de ahorro

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

        // Convierte amountDue a USD si es necesario para la deducción de la cuenta principal
        let amountDueInUSD = amountDue;
        if (currency === 'DOP') {
            amountDueInUSD = amountDue / USD_TO_DOP_RATE;
        }

        if (userCurrentBalanceUSD < amountDueInUSD) {
            showMessage(`Saldo insuficiente en tu cuenta principal para pagar esta deuda de $${amountDue.toFixed(2)} ${currency}. Necesitas al menos $${amountDueInUSD.toFixed(2)} USD.`, 'error');
            return;
        }

        // Deduce del saldo principal del usuario
        let newUserBalanceUSD = userCurrentBalanceUSD - amountDueInUSD;
        let newUserBalanceDOP = newUserBalanceUSD * USD_TO_DOP_RATE;

        // Agrega al saldo de la cuenta de ahorro
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

        // Actualiza el estado de la deuda a pagada
        await updateDoc(debtDocRef, {
            status: 'paid',
            paidAt: serverTimestamp()
        });

        // Registra la transacción
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: currentUserId,
            type: 'savings_debt_payment',
            amount: amountDue,
            currency: currency,
            savingsGoal: savingsGoal,
            savingsAccountId: savingsAccountId, // Incluye el ID de la cuenta de ahorro
            debtId: debtId,
            timestamp: serverTimestamp(),
            status: 'completed',
            description: `Pago de deuda de ahorro para "${savingsGoal}"`
        });

        showMessage(`¡Deuda de $${amountDue.toFixed(2)} ${currency} para "${savingsGoal}" pagada con éxito!`, 'success');
        closeModal(savingsDebtsModal); // Cierra el modal después del pago
    } catch (error) {
        console.error("Error al pagar la deuda de ahorro:", error);
        showMessage('Error al pagar la deuda de ahorro. Intenta de nuevo.', 'error');
    }
}

// --- NUEVO: Funciones de deudas de ahorro del administrador ---
viewAdminSavingsDebtsBtn.addEventListener('click', () => {
    adminSavingsDebtsModal.classList.remove('hidden');
    loadAdminSavingsDebts();
});

closeAdminSavingsDebtsModalBtn.addEventListener('click', () => {
    closeModal(adminSavingsDebtsModal);
    if (adminSavingsDebtsUnsubscribe) {
        adminSavingsDebtsUnsubscribe();
        adminSavingsDebtsUnsubscribe = null;
        console.log("Admin: Desuscrito del oyente de deudas de ahorro del administrador al cerrar el modal.");
    }
});

/**
 * Carga y muestra todas las deudas de ahorro pendientes/vencidas para el administrador.
 */
function loadAdminSavingsDebts() {
    if (adminSavingsDebtsUnsubscribe) {
        adminSavingsDebtsUnsubscribe();
        adminSavingsDebtsUnsubscribe = null;
        console.log("Admin: Desuscrito del oyente de deudas de ahorro del administrador anterior.");
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

        // Ordena por dueDate descendente
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
                // Marca como vencida si pasó la fecha de vencimiento y aún está pendiente
                statusDisplay = 'Vencida';
                // Opcionalmente, actualiza el estado en Firestore aquí, pero para simplificar, solo lo muestra
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

        // Adjunta oyentes de eventos para las acciones de deuda del administrador
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
        console.error("Error al cargar las deudas de ahorro del administrador:", error);
        adminSavingsDebtsTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 py-4">Error al cargar deudas de ahorro.</td></tr>`;
    });
}

/**
 * Aplica la indemnización por una deuda vencida.
 * @param {string} debtId El ID del documento de deuda.
 * @param {string} userId El UID de Firebase del usuario.
 * @param {number} amountDue La cantidad original adeudada por la deuda.
 * @param {string} savingsGoal El objetivo de la cuenta de ahorro asociada.
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

        // Deduce la penalización del saldo principal del usuario
        let newUserBalanceUSD = userCurrentBalanceUSD - penaltyAmount;
        let newUserBalanceDOP = newUserBalanceUSD * USD_TO_DOP_RATE;

        await updateDoc(userProfileRef, {
            balanceUSD: newUserBalanceUSD,
            balanceDOP: newUserBalanceDOP
        });

        // Agrega la penalización a la cuenta del administrador
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
            console.warn("Cuenta de administrador no encontrada. La indemnización podría no transferirse.");
        }

        // Actualiza el estado de la deuda
        await updateDoc(debtDocRef, {
            status: 'penalized', // Nuevo estado para deudas penalizadas
            penaltyApplied: true,
            penaltyAmount: penaltyAmount,
            penalizedAt: serverTimestamp()
        });

        // Registra la transacción de indemnización
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: userId, // Usuario que pagó la penalización
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
        console.error("Error al aplicar la indemnización:", error);
        showMessage('Error al aplicar la indemnización. Intenta de nuevo.', 'error');
    }
}

/**
 * Permite al administrador marcar manualmente una deuda como pagada (por ejemplo, si se pagó fuera de línea).
 * @param {string} debtId El ID del documento de deuda.
 * @param {string} userId El UID de Firebase del usuario.
 * @param {number} amountDue La cantidad original adeudada por la deuda.
 * @param {string} savingsGoal El objetivo de la cuenta de ahorro asociada.
 */
async function resolveSavingsDebtManually(debtId, userId, amountDue, savingsGoal) {
    hideMessage();
    try {
        const debtDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'savings_debts', debtId);
        await updateDoc(debtDocRef, {
            status: 'paid',
            paidAt: serverTimestamp(),
            resolvedManually: true // Indica resolución manual
        });

        // Registra una transacción para la resolución manual (no hay movimiento de dinero aquí, solo actualización de estado)
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: userId,
            type: 'savings_debt_payment', // Usa este tipo pero aclara que es manual
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
        console.error("Error al resolver la deuda de ahorro manualmente:", error);
        showMessage('Error al marcar la deuda como pagada. Intenta de nuevo.', 'error');
    }
}


// --- Oyentes de eventos ---
window.onload = async () => {
    // Autenticación inicial con el token personalizado proporcionado por Canvas
    // Si no hay token, intenta el inicio de sesión anónimo (para usuarios no autenticados)
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
            await signInWithCustomToken(auth, __initial_auth_token);
            console.log("Autenticación con token personalizado exitosa.");
        } catch (error) {
            console.error("Error al iniciar sesión con token personalizado:", error);
            // Si falla el token personalizado, intenta el inicio de sesión anónimo
            try {
                await signInAnonymously(auth);
                console.log("Inicio de sesión anónimo exitoso.");
            } catch (anonError) {
                console.error("Error al iniciar sesión anónimamente:", anonError);
                showMessage("Error de autenticación inicial. Por favor, recarga la página.", 'error');
            }
        }
    } else {
        // Si no hay token personalizado, intenta el inicio de sesión anónimo
        try {
            await signInAnonymously(auth);
            console.log("Inicio de sesión anónimo exitoso (no se proporcionó token personalizado).");
        } catch (anonError) {
            console.error("Error al iniciar sesión anónimamente:", anonError);
            showMessage("Error de autenticación inicial. Por favor, recarga la página.", 'error');
        }
    }
    // onAuthStateChanged manejará el estado de inicio de sesión del usuario automáticamente
};


loginTab.addEventListener('click', () => toggleTabs('login'));
registerTab.addEventListener('click', () => toggleTabs('register'));
closeMessage.addEventListener('click', hideMessage);

loginForm.addEventListener('submit', handleLogin);
logoutBtn.addEventListener('click', handleLogout);
toggleCurrencyBtn.addEventListener('click', toggleCurrencyDisplay);

// Botones de consentimiento de reglas
acceptRulesBtn.addEventListener('click', () => {
    rulesConsentModal.classList.add('hidden');
    // Procede con el registro usando los datos almacenados
    performRegistration(tempRegisterData.name, tempRegisterData.surname, tempRegisterData.age, tempRegisterData.phoneNumber, tempRegisterData.password);
});

rejectRulesBtn.addEventListener('click', () => {
    rulesConsentModal.classList.add('hidden');
    showMessage('Debes aceptar las reglas para registrarte en el Banco Juvenil.', 'error');
    registerForm.reset(); // Borra el formulario si se rechazan las reglas
    tempRegisterData = {}; // Borra los datos temporales
});

// Botones del modal de historial de usuario
viewHistoryBtn.addEventListener('click', () => {
    userHistoryModal.classList.remove('hidden');
    loadUserHistory(); // Carga el historial específico del usuario
});
closeUserHistoryModalBtn.addEventListener('click', () => {
    closeModal(userHistoryModal);
});

// Botones del modal de historial completo del administrador
adminFullHistoryBtn.addEventListener('click', () => {
    adminFullHistoryModal.classList.remove('hidden');
    loadAdminFullHistory(); // Carga el historial completo del administrador
});
closeAdminFullHistoryModalBtn.addEventListener('click', () => {
    closeModal(adminFullHistoryModal);
});

// Botón del modal de solicitudes pendientes del administrador (Unificado)
viewAdminPendingRequestsBtn.addEventListener('click', () => {
    adminPendingRequestsModal.classList.remove('hidden');
    loadAdminPendingRequests();
});
// Este oyente ahora se maneja al principio del archivo para gestionar la desuscripción
// closeAdminPendingRequestsModalBtn.addEventListener('click', () => {
//     closeModal(adminPendingRequestsModal);
// });

// Botones del modal de preguntas frecuentes
viewFAQBtn.addEventListener('click', () => {
    faqModal.classList.remove('hidden');
});
closeFAQModalBtn.addEventListener('click', () => {
    closeModal(faqModal);
});

// Botones de compras en línea
onlineShoppingBtn.addEventListener('click', () => {
    onlineShoppingModal.classList.remove('hidden');
    onlineShoppingForm.reset(); // Restablece el formulario cuando se abre
    updateOnlineShoppingCalculation(); // Visualización del cálculo inicial
});
cancelOnlineShopping.addEventListener('click', () => {
    closeModal(onlineShoppingModal);
});

// Botones de pago de streaming
streamingPaymentBtn.addEventListener('click', () => {
    streamingPaymentModal.classList.remove('hidden');
    streamingPaymentForm.reset(); // Restablece el formulario cuando se abre
    updateStreamingPaymentCalculation(); // Visualización del cálculo inicial
});
cancelStreamingPayment.addEventListener('click', () => {
    closeModal(streamingPaymentModal);
});

// Botón de solicitudes pendientes del usuario
viewUserPendingRequestsBtn.addEventListener('click', () => {
    userPendingRequestsModal.classList.remove('hidden');
    loadUserPendingRequests();
});
closeUserPendingRequestsModalBtn.addEventListener('click', () => {
    closeModal(userPendingRequestsModal);
});

// Botón del modal de recibo
closeReceiptModalBtn.addEventListener('click', () => {
    closeModal(receiptModal);
});

// NUEVO: Oyentes de eventos de abrir cuenta de ahorro
openSavingsAccountBtn.addEventListener('click', () => {
    openSavingsAccountModal.classList.remove('hidden');
    savingsAccountForm.reset();
});
cancelOpenSavingsAccountBtn.addEventListener('click', () => {
    closeModal(openSavingsAccountModal);
});
// El oyente de eventos de envío para savingsAccountForm ya está definido globalmente.

// NUEVO: Oyentes de eventos de ver cuentas de ahorro
viewSavingsAccountsBtn.addEventListener('click', () => {
    viewSavingsAccountsModal.classList.remove('hidden');
    loadSavingsAccounts();
});
closeViewSavingsAccountsBtn.addEventListener('click', () => {
    closeModal(viewSavingsAccountsModal);
});

// NUEVO: Oyentes de eventos de editar anuncios
editAnnouncementsBtn.addEventListener('click', async () => {
    editAnnouncementsModal.classList.remove('hidden');
    await loadAnnouncementsForEdit();
});
cancelEditAnnouncementsBtn.addEventListener('click', () => {
    closeModal(editAnnouncementsModal);
});
// El oyente de eventos de envío para editAnnouncementsForm ya está definido globalmente.

// NUEVO: Oyentes de eventos del modal de depósito en ahorros
cancelDepositToSavingsBtn.addEventListener('click', () => {
    closeModal(depositToSavingsModal);
});

// NUEVO: Oyentes de eventos del modal de retiro de ahorros
cancelWithdrawFromSavingsBtn.addEventListener('click', () => {
    closeModal(withdrawFromSavingsModal);
});

// NUEVO: Oyentes de eventos del modal de confirmación de eliminación de cuenta de ahorro
cancelDeleteSavingsAccountBtn.addEventListener('click', () => {
    closeModal(confirmDeleteSavingsAccountModal);
});
cancelDeleteSavingsAccountBtn2.addEventListener('click', () => {
    closeModal(confirmDeleteSavingsAccountModal);
});
