import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// TU CONFIGURACIÓN DE FIREBASE - PROPORCIONADA POR TI
const firebaseConfig = {
    apiKey: "AIzaSyDfUxqjfr1UYo9KN1HwibNIXyAKSZCqYbw",
    authDomain: "banco-juvenil-12903.firebaseapp.com",
    projectId: "banco-juvenil-12903",
    storageBucket: "banco-juvenil-12903.firebaseapp.com",
    messagingSenderId: "421654654501",
    appId: "1:421654654501:web:c315e4d67c9289f6d619cc"
};

// Usando projectId como appId para la consistencia de la ruta de Firestore
const appId = "banco-juvenil-12903"; 

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

// Email de administrador para propósitos de prototipo - CRÍTICO: ASEGÚRATE DE QUE ESTO COINCIDA CON TUS REGLAS DE SEGURIDAD
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

// Variable global para almacenar la función de desuscripción del oyente de perfil de usuario
let userProfileUnsubscribe = null;

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

    console.log("Intentando registrar nuevo usuario con email:", generatedEmail);
    console.log("Datos de registro:", { name, surname, age, phoneNumber, userDisplayId });

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, generatedEmail, password);
        const user = userCredential.user;
        const userId = user.uid; // UID de Firebase
        console.log("Usuario de Firebase Auth creado:", user);

        const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
        await setDoc(userDocRef, {
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
        console.log("Documento de usuario creado en Firestore para UID:", userId);

        showMessage(`¡Registro exitoso, ${name}! Tu ID de usuario para iniciar sesión es: ${generatedEmail}. Tu ID público es: ${userDisplayId}. Por favor, anótalo.`, 'success');
        loginIdentifierInput.value = generatedEmail; // Prellena el campo de inicio de sesión con el email generado
        loginPassword.value = password; // Prellena la contraseña
        // onAuthStateChanged se encargará de la visualización del panel de control
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

    console.log("Intentando iniciar sesión con identificador:", identifier);

    try {
        // Si el identificador no parece un email, intenta encontrar el email por userDisplayId o UID de Firebase
        if (!identifier.includes('@')) {
            const usersCollectionRef = collection(db, 'artifacts', appId, 'users');
            let querySnapshot;

            // 1. Intenta buscar por userDisplayId (preferido para la facilidad de uso)
            console.log("Buscando usuario por userDisplayId:", identifier);
            let q = query(usersCollectionRef, where('userDisplayId', '==', identifier));
            querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                // 2. Si no se encuentra por userDisplayId, intenta buscar por UID de Firebase
                console.log("userDisplayId no encontrado. Buscando por userId:", identifier);
                q = query(usersCollectionRef, where('userId', '==', identifier));
                querySnapshot = await getDocs(q);
            }

            if (querySnapshot.empty) {
                console.warn("Usuario no encontrado por userDisplayId ni userId:", identifier);
                showMessage('ID de usuario o contraseña incorrectos.', 'error');
                return;
            }
            // Usuario encontrado, obtén su email asociado para Firebase Auth
            emailToLogin = querySnapshot.docs[0].data().email;
            if (!emailToLogin) {
                console.error("No se pudo encontrar el email asociado a este ID de usuario en Firestore:", identifier);
                showMessage('No se pudo encontrar el email asociado a este ID de usuario.', 'error');
                return;
            }
            console.log("Email de inicio de sesión encontrado en Firestore:", emailToLogin);
        }

        // Intenta iniciar sesión con el email y la contraseña determinados
        console.log("Intentando signInWithEmailAndPassword para:", emailToLogin);
        await signInWithEmailAndPassword(auth, emailToLogin, password);
        console.log("signInWithEmailAndPassword exitoso.");
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
        console.log("Intentando cerrar sesión...");
        await signOut(auth);
        console.log("Cierre de sesión exitoso.");
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
    console.log("onAuthStateChanged: Estado de autenticación cambiado. Usuario:", user ? user.uid : "null");

    if (user) {
        // El usuario ha iniciado sesión
        currentUser = user;
        currentUserId = user.uid;
        console.log(`onAuthStateChanged: Usuario autenticado. UID: ${currentUserId}, Email: ${user.email}`);

        // Escucha las actualizaciones en tiempo real del perfil del usuario en Firestore
        // Ruta: artifacts/{appId}/users/{userId}
        const userProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        console.log("onAuthStateChanged: Intentando escuchar el documento de perfil de usuario:", userProfileRef.path);

        // Desuscribirse de cualquier oyente anterior para evitar duplicados si onAuthStateChanged se dispara varias veces
        if (userProfileUnsubscribe) { // Comprueba si ya hay una función de desuscripción asignada
            userProfileUnsubscribe();
            userProfileUnsubscribe = null; // Restablece la variable
            console.log("onAuthStateChanged: Desuscrito del oyente de perfil de usuario anterior.");
        }

        userProfileUnsubscribe = onSnapshot(userProfileRef, (docSnap) => {
            console.log("onSnapshot para perfil de usuario activado.");
            if (docSnap.exists()) {
                const userData = docSnap.data();
                console.log("Datos del perfil de usuario cargados:", userData);

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
                    console.log("onAuthStateChanged: Usuario es administrador.");
                } else {
                    adminButtonsContainer.classList.add('hidden'); // Oculta para no administradores
                    console.log("onAuthStateChanged: Usuario NO es administrador.");
                }

            } else {
                console.warn("onSnapshot: Perfil de usuario NO encontrado en Firestore para el UID:", currentUserId);
                // Si el perfil de usuario no existe, cierra la sesión
                // Esto es crucial: si un usuario se autentica pero no tiene un perfil en Firestore, lo desconecta.
                showMessage("Tu perfil de usuario no se encontró. Por favor, regístrate o contacta a soporte.", 'error');
                handleLogout(); // Desconecta al usuario si no hay perfil de Firestore
            }
        }, (error) => {
            console.error("onSnapshot ERROR: Error al escuchar el perfil del usuario:", error);
            showMessage("Error al cargar los datos de tu perfil. Intenta recargar la página.", 'error');
            handleLogout(); // También desconecta en caso de error de lectura
        });

        // Carga los anuncios cuando el usuario inicia sesión
        loadAnnouncements();

        // Muestra el panel de control y oculta los formularios de inicio de sesión/registro y todos los modales
        showSection(dashboardSection, loginSection, registerSection, rulesConsentModal, userHistoryModal, adminFullHistoryModal, adminPendingRequestsModal, faqModal, onlineShoppingModal, streamingPaymentModal, gameRechargeModal, userPendingRequestsModal, receiptModal, editProfileModal, changePasswordModal, securityTipsModal, aboutUsModal, contactSupportModal, openSavingsAccountModal, viewSavingsAccountsModal, editAnnouncementsModal, depositToSavingsModal, withdrawFromSavingsModal, confirmDeleteSavingsAccountModal, savingsDebtsModal, adminSavingsDebtsModal);

    } else {
        // El usuario ha cerrado sesión
        console.log("onAuthStateChanged: Usuario desconectado.");
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

// --- NUEVO: Elementos del modal de recibir dinero de banco exterior
const receiveExternalBankModal = document.getElementById('receiveExternalBankModal');
const cancelReceiveExternalBankBtn = document.getElementById('cancelReceiveExternalBankBtn');
const receiveExternalBankForm = document.getElementById('receiveExternalBankForm');
const externalBankSenderNameInput = document.getElementById('externalBankSenderName');
const externalBankAmountInput = document.getElementById('externalBankAmount');
const externalBankCurrencyInput = document.getElementById('externalBankCurrency');
const externalBankNameInput = document.getElementById('externalBankName');
const externalBankSerialInput = document.getElementById('externalBankSerial');

// --- NUEVO: Funcionalidad de recibir dinero de banco exterior ---
receiveExternalBankBtn.addEventListener('click', () => {
    receiveExternalBankModal.classList.remove('hidden');
    receiveExternalBankForm.reset();
});

cancelReceiveExternalBankBtn.addEventListener('click', () => {
    closeModal(receiveExternalBankModal);
    receiveExternalBankForm.reset();
});

receiveExternalBankForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const senderName = externalBankSenderNameInput.value.trim();
    const amount = parseFloat(externalBankAmountInput.value);
    const currency = externalBankCurrencyInput.value;
    const bankName = externalBankNameInput.value.trim();
    const serialNumber = externalBankSerialInput.value.trim();

    if (!senderName || isNaN(amount) || amount <= 0 || !currency || !bankName || !serialNumber) {
        showMessage('Por favor, completa todos los campos correctamente para recibir dinero de banco exterior.', 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'external_bank_receive',
            senderName: senderName,
            amount: amount,
            currency: currency,
            bankName: bankName,
            serialNumber: serialNumber,
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage('Solicitud para recibir dinero de banco exterior enviada. Esperando aprobación del administrador.', 'success');
        closeModal(receiveExternalBankModal);
        receiveExternalBankForm.reset();
    } catch (error) {
        console.error("Error al solicitar dinero de banco exterior:", error);
        showMessage('Error al procesar la solicitud. Por favor, inténtalo de nuevo.', 'error');
    }
});

// --- Corrección: Carga y muestra el historial de transacciones del usuario actual sin duplicados ---
async function loadUserHistory() {
    const transactionsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const q = query(transactionsCollectionRef, where('userId', '==', currentUserId), where('status', '==', 'completed'));

    onSnapshot(q, async (snapshot) => {
        const uniqueTransactions = new Map();
        snapshot.forEach(docEntry => {
            const tx = docEntry.data();
            uniqueTransactions.set(docEntry.id, tx);
        });

        userHistoryTableBody.innerHTML = '';
        if (uniqueTransactions.size === 0) {
            userHistoryTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">No hay transacciones.</td></tr>';
            return;
        }

        for (const [id, tx] of uniqueTransactions.entries()) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${tx.timestamp ? new Date(tx.timestamp.seconds * 1000).toLocaleString() : 'N/A'}</td>
                <td>${tx.type || ''}</td>
                <td>${tx.amount ? `$${tx.amount.toFixed(2)}` : ''} ${tx.currency || ''}</td>
                <td>${tx.savingsGoal || ''}</td>
                <td>${tx.description || ''}</td>
                <td>${tx.status || ''}</td>
            `;
            userHistoryTableBody.appendChild(row);
        }
    }, (error) => {
        console.error("Error al cargar el historial de usuario:", error);
        userHistoryTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-4">Error al cargar historial.</td></tr>`;
    });
}

// --- Corrección: Carga y muestra el historial completo de transacciones para todos los usuarios sin duplicados ---
async function loadAdminFullHistory() {
    adminFullHistoryTableBodyModal.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">Cargando historial completo...</td></tr>';
    const transactionsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const q = query(transactionsCollectionRef, where('status', '==', 'completed'));

    onSnapshot(q, async (snapshot) => {
        const uniqueTransactions = new Map();
        snapshot.forEach(docEntry => {
            const tx = docEntry.data();
            uniqueTransactions.set(docEntry.id, tx);
        });

    adminPendingRequestsTableBody.innerHTML = '';
    if (snapshot.empty) {
        adminPendingRequestsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">No hay solicitudes pendientes.</td></tr>';
        return;
    }

    for (const docEntry of snapshot.docs) {
        const req = docEntry.data();
        const reqId = docEntry.id;
        const userNameDisplay = await getUserDisplayName(req.userId);
        let detalles = '';
        if (req.type === 'external_bank_receive') {
            detalles = `
                <div><b>Remitente:</b> ${req.senderName || ''}</div>
                <div><b>Banco:</b> ${req.bankName || ''}</div>
                <div><b>Serie:</b> ${req.serialNumber || ''}</div>
            `;
        } else {
            detalles = `${req.savingsGoal ? `<div><b>Meta:</b> ${req.savingsGoal}</div>` : ''}`;
        }
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${req.timestamp ? new Date(req.timestamp.seconds * 1000).toLocaleString() : 'N/A'}</td>
            <td>${req.type || ''}</td>
            <td>${userNameDisplay}</td>
            <td>${req.amount ? `$${req.amount.toFixed(2)}` : ''} ${req.currency || ''}</td>
            <td>${req.currency || ''}</td>
            <td>${detalles}</td>
            <td>
                <button class="btn-success btn-sm confirm-request-btn" data-request-id="${reqId}">Aprobar</button>
                <button class="btn-danger btn-sm reject-request-btn" data-request-id="${reqId}">Rechazar</button>
            </td>
        `;
        adminPendingRequestsTableBody.appendChild(row);
    }

    // Oyentes para aprobar/rechazar
    adminPendingRequestsTableBody.querySelectorAll('.confirm-request-btn').forEach(button => {
        button.onclick = async (event) => {
            const requestId = event.target.dataset.requestId;
            const reqDoc = snapshot.docs.find(doc => doc.id === requestId);
            if (!reqDoc) return;
            const req = reqDoc.data();
            if (req.type === 'external_bank_receive') {
                await confirmExternalBankReceiveRequest(requestId, req);
            } else {
                await confirmRequest(requestId, req.type, req.userId, req.amount, req.currency, req.serialNumber,
                    req.productAmount, req.productCurrency, req.productLinks,
                    req.service, req.accountIdentifier, req.subscriptionAmount, req.subscriptionCurrency,
                    req.gameName, req.playerId, req.rechargeAmount, req.rechargeCurrency, req.feeAmount, req.totalAmountToDeduct, req.category,
                    req.savingsGoal, req.initialDepositAmount, req.initialDepositCurrency, req.preferredSavingsFrequency, req.periodicContributionAmount, req.startDate, req.endDate);
            }
        };
    });
    adminPendingRequestsTableBody.querySelectorAll('.reject-request-btn').forEach(button => {
        button.onclick = async (event) => {
            const requestId = event.target.dataset.requestId;
            const reqDoc = snapshot.docs.find(doc => doc.id === requestId);
            if (!reqDoc) return;
            const req = reqDoc.data();
            await rejectRequest(requestId, req.type, req.userId);
        };
    });
/**
 * Aprueba una solicitud de recepción de dinero de banco exterior.
 * @param {string} requestId
 * @param {object} req
 */
async function confirmExternalBankReceiveRequest(requestId, req) {
    try {
        // Actualiza el saldo del usuario
        const userProfileRef = doc(db, 'artifacts', appId, 'users', req.userId);
        const userDocSnap = await getDoc(userProfileRef);
        if (!userDocSnap.exists()) {
            showMessage('Usuario no encontrado para aprobar la solicitud.', 'error');
            return;
        }
        const userData = userDocSnap.data();
        let newBalanceUSD = userData.balanceUSD || 0;
        let newBalanceDOP = userData.balanceDOP || 0;
        let amountInUSD = req.amount;
        if (req.currency === 'DOP') {
            amountInUSD = req.amount / USD_TO_DOP_RATE;
        }
        newBalanceUSD += amountInUSD;
        newBalanceDOP = newBalanceUSD * USD_TO_DOP_RATE;
        await updateDoc(userProfileRef, {
            balanceUSD: newBalanceUSD,
            balanceDOP: newBalanceDOP
        });

        // Registra la transacción
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: req.userId,
            type: 'external_bank_receive',
            amount: req.amount,
            currency: req.currency,
            senderName: req.senderName,
            bankName: req.bankName,
            serialNumber: req.serialNumber,
            timestamp: serverTimestamp(),
            status: 'completed',
            description: `Recepción de dinero de banco exterior de ${req.senderName} (${req.bankName})`
        });

        // Marca la solicitud como completada
        const reqRef = doc(db, 'artifacts', appId, 'public', 'data', 'pending_requests', requestId);
        await updateDoc(reqRef, { status: 'completed', processedAt: serverTimestamp() });

        showMessage('Solicitud de banco exterior aprobada y dinero acreditado.', 'success');
    } catch (error) {
        console.error('Error al aprobar solicitud de banco exterior:', error);
        showMessage('Error al aprobar la solicitud. Intenta de nuevo.', 'error');
    }
}
    });
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
        showMessage('Error al cargar los datos de tu perfil. Intenta recargar la página.', 'error');
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

// --- NUEVO: Funcionalidad de deudas de ahorro del cliente ---
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
        savingsDebtsUnsubscribe = null;
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

        if (!userDocSnap.exists() || !savingsDocSnap.exists()) {
            showMessage('Error: No se encontró tu perfil o la cuenta de ahorro.', 'error');
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

        // Deduce de la cuenta principal
        let newUserBalanceUSD = userCurrentBalanceUSD - amountDueInUSD;
        let newUserBalanceDOP = newUserBalanceUSD * USD_TO_DOP_RATE;

        // Agrega a la cuenta de ahorro
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

        // Registra una transacción para la resolución manual (no hay movimiento de dinero aquí, solo actualización de estado)
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: userId,
            type: 'savings_debt_payment', // Usa este tipo pero aclara que es manual
            amount: amountDue,
            currency: 'USD',
            savingsGoal: savingsGoal,
            debtId: debtId,
            timestamp: serverTimestamp(),
            status: 'completed',
            description: `Deuda de ahorro para "${savingsGoal}" marcada manualmente como pagada.`
        });

        showMessage(`Deuda #${debtId.substring(0,8)}... para "${savingsGoal}" marcada como pagada manualmente.`, 'info');

    } catch (error) {
        console.error("Error al resolver la deuda de ahorro manualmente:", error);
        showMessage('Error al marcar la deuda como pagada. Intenta de nuevo.', 'error');
    }
}

// --- Corrección: Lógica de recolección automática de ahorros ---
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

// --- NUEVO: Funcionalidad de recibir dinero de banco exterior ---
receiveExternalBankBtn.addEventListener('click', () => {
    receiveExternalBankModal.classList.remove('hidden');
    receiveExternalBankForm.reset();
});

cancelReceiveExternalBankBtn.addEventListener('click', () => {
    closeModal(receiveExternalBankModal);
    receiveExternalBankForm.reset();
});

receiveExternalBankForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const senderName = externalBankSenderNameInput.value.trim();
    const amount = parseFloat(externalBankAmountInput.value);
    const currency = externalBankCurrencyInput.value;
    const bankName = externalBankNameInput.value.trim();
    const serialNumber = externalBankSerialInput.value.trim();

    if (!senderName || isNaN(amount) || amount <= 0 || !currency || !bankName || !serialNumber) {
        showMessage('Por favor, completa todos los campos correctamente para recibir dinero de banco exterior.', 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'external_bank_receive',
            senderName: senderName,
            amount: amount,
            currency: currency,
            bankName: bankName,
            serialNumber: serialNumber,
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage('Solicitud para recibir dinero de banco exterior enviada. Esperando aprobación del administrador.', 'success');
        closeModal(receiveExternalBankModal);
        receiveExternalBankForm.reset();
    } catch (error) {
        console.error("Error al solicitar dinero de banco exterior:", error);
        showMessage('Error al procesar la solicitud. Por favor, inténtalo de nuevo.', 'error');
    }
});
