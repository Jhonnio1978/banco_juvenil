import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, runTransaction } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

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
const receiveExternalDepositBtn = document.getElementById('receiveExternalDepositBtn'); // NUEVO: Botón para recibir depósito exterior

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

// NUEVO: Modal de solicitud de dinero del exterior
const receiveExternalDepositModal = document.getElementById('receiveExternalDepositModal'); // Nuevo modal para recibir dinero del exterior
const cancelReceiveExternalDepositBtn = document.getElementById('cancelReceiveExternalDepositBtn');
const receiveExternalDepositForm = document.getElementById('receiveExternalDepositForm');
const receiveExternalSenderNameInput = document.getElementById('receiveExternalSenderName');
const receiveExternalSourceBankInput = document.getElementById('receiveExternalSourceBank');
const receiveExternalSerialNumberInput = document.getElementById('receiveExternalSerialNumber');
const receiveExternalAmountInput = document.getElementById('receiveExternalAmount');


// Variables para almacenar datos para operaciones de cuenta de ahorro
let currentSavingsAccountId = null;
let currentSavingsAccountBalanceUSD = 0;
let currentSavingsAccountGoal = '';

// Variable para guardar la función de desuscripción para el oyente de solicitudes pendientes del administrador
let adminPendingRequestsUnsubscribe = null;
let adminSavingsDebtsUnsubscribe = null; // Nueva desuscripción para deudas de ahorro del administrador
let savingsDebtsUnsubscribe = null; // Nueva desuscripción para deudas de ahorro del cliente
let userPendingRequestsUnsubscribe = null; // NUEVO: Para solicitudes pendientes del usuario

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
    } else if (transaction.type === 'streaming_payment') {
        typeDisplay = 'Pago Streaming';
        amountDisplay = (transaction.totalAmountDeducted ?? 0).toFixed(2);
        currencyDisplay = 'USD';
        feeDisplay = `Tarifa (3%): $${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
        otherDetails += `<p><strong>Servicio:</strong> ${transaction.service || 'N/A'}</p>`;
        otherDetails += `<p><strong>Identificador de Cuenta:</strong> ${transaction.accountIdentifier || 'N/A'}</p>`;
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
    } else if (transaction.type === 'withdrawal_fee') {
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
        otherDetails += `<p><strong>ID Deuda Original:</strong> ${transaction.originalDebtId || 'N/A'}</p>`;
    } else if (transaction.type === 'external_deposit') { // NUEVO: Recibo de depósito exterior
        typeDisplay = 'Depósito Exterior Recibido';
        amountDisplay = (transaction.amount ?? 0).toFixed(2);
        currencyDisplay = transaction.currency;
        otherDetails += `<p><strong>Nombre Remitente:</strong> ${transaction.senderName || 'N/A'}</p>`;
        otherDetails += `<p><strong>Banco Origen:</strong> ${transaction.sourceBank || 'N/A'}</p>`;
        otherDetails += `<p><strong>Número de Serie:</strong> ${transaction.serialNumber || 'N/A'}</p>`;
    }

    receiptContent.innerHTML = `
        <div class="space-y-4">
            <h3 class="text-2xl font-bold text-center text-gray-800">Recibo de ${typeDisplay}</h3>
            <div class="border-t border-gray-200 pt-4">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-gray-600 font-medium">Estado:</span>
                    <span class="text-green-600 font-semibold">${transaction.status === 'completed' ? 'Completado' : 'Pendiente'}</span>
                </div>
                <div class="flex justify-between items-center mb-2">
                    <span class="text-gray-600 font-medium">Fecha:</span>
                    <span>${new Date(transaction.timestamp.seconds * 1000).toLocaleString()}</span>
                </div>
                <div class="flex justify-between items-center mb-2">
                    <span class="text-gray-600 font-medium">ID de Transacción:</span>
                    <span class="break-all text-sm">${transaction.id}</span>
                </div>
                ${otherDetails}
            </div>
            <div class="border-t border-gray-200 pt-4 mt-4">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-gray-600 font-bold">Monto:</span>
                    <span class="text-lg font-bold">${amountDisplay} ${currencyDisplay}</span>
                </div>
                ${feeDisplay ? `<div class="flex justify-between items-center mb-2"><span class="text-gray-600">Tarifa:</span><span>${feeDisplay}</span></div>` : ''}
                <div class="flex justify-between items-center mt-4 pt-2 border-t">
                    <span class="text-xl font-bold text-gray-800">Total:</span>
                    <span class="text-xl font-bold text-blue-600">${amountDisplay} ${currencyDisplay}</span>
                </div>
            </div>
            <div class="text-sm text-gray-500 text-center mt-4">
                Gracias por usar Banco Juvenil.
            </div>
        </div>
    `;

    receiptModal.classList.remove('hidden');
}


// --- Lógica de la interfaz de usuario y eventos ---

/**
 * Cierra un modal específico.
 * @param {HTMLElement} modal El elemento del modal a cerrar.
 */
function closeModal(modal) {
    modal.classList.add('hidden');
}

// Cierre de modales
closeMessage.addEventListener('click', hideMessage);
closeUserHistoryModalBtn.addEventListener('click', () => closeModal(userHistoryModal));
closeAdminFullHistoryModalBtn.addEventListener('click', () => closeModal(adminFullHistoryModal));
closeAdminPendingRequestsModalBtn.addEventListener('click', () => closeModal(adminPendingRequestsModal));
closeUserPendingRequestsModalBtn.addEventListener('click', () => {
    closeModal(userPendingRequestsModal);
    if (userPendingRequestsUnsubscribe) {
        userPendingRequestsUnsubscribe();
        userPendingRequestsUnsubscribe = null;
        console.log("User: Desuscrito del oyente de solicitudes pendientes.");
    }
});
cancelTransferModalBtn.addEventListener('click', () => {
    closeModal(transferModal);
    transferForm.reset();
});
cancelDeposit.addEventListener('click', () => {
    closeModal(depositModal);
    depositForm.reset();
});
cancelWithdraw.addEventListener('click', () => {
    closeModal(withdrawModal);
    withdrawForm.reset();
});
closeReceiptModalBtn.addEventListener('click', () => closeModal(receiptModal));
closeFAQModalBtn.addEventListener('click', () => closeModal(faqModal));
cancelOnlineShopping.addEventListener('click', () => {
    closeModal(onlineShoppingModal);
    onlineShoppingForm.reset();
});
cancelStreamingPayment.addEventListener('click', () => {
    closeModal(streamingPaymentModal);
    streamingPaymentForm.reset();
});
cancelGameRecharge.addEventListener('click', () => {
    closeModal(gameRechargeModal);
    gameRechargeForm.reset();
});
cancelEditProfileBtn.addEventListener('click', () => closeModal(editProfileModal));
cancelChangePasswordBtn.addEventListener('click', () => {
    closeModal(changePasswordModal);
    changePasswordForm.reset();
});
closeSecurityTipsBtn.addEventListener('click', () => closeModal(securityTipsModal));
closeAboutUsBtn.addEventListener('click', () => closeModal(aboutUsModal));
closeContactSupportBtn.addEventListener('click', () => closeModal(contactSupportModal));
cancelOpenSavingsAccountBtn.addEventListener('click', () => {
    closeModal(openSavingsAccountModal);
    savingsAccountForm.reset();
});
closeViewSavingsAccountsBtn.addEventListener('click', () => {
    closeModal(viewSavingsAccountsModal);
});
cancelEditAnnouncementsBtn.addEventListener('click', () => {
    closeModal(editAnnouncementsModal);
});
cancelDepositToSavingsBtn.addEventListener('click', () => closeModal(depositToSavingsModal));
cancelWithdrawFromSavingsBtn.addEventListener('click', () => closeModal(withdrawFromSavingsModal));
cancelDeleteSavingsAccountBtn.addEventListener('click', () => closeModal(confirmDeleteSavingsAccountModal));
cancelDeleteSavingsAccountBtn2.addEventListener('click', () => closeModal(confirmDeleteSavingsAccountModal));
closeSavingsDebtsModalBtn.addEventListener('click', () => closeModal(savingsDebtsModal));
closeAdminSavingsDebtsModalBtn.addEventListener('click', () => closeModal(adminSavingsDebtsModal));
// NUEVO: Cerrar modal de depósito exterior
if (cancelReceiveExternalDepositBtn) {
    cancelReceiveExternalDepositBtn.addEventListener('click', () => {
        closeModal(receiveExternalDepositModal);
        receiveExternalDepositForm.reset();
    });
}

// Lógica de pestañas de autenticación
loginTab.addEventListener('click', () => {
    loginSection.classList.remove('hidden');
    registerSection.classList.add('hidden');
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
});

registerTab.addEventListener('click', () => {
    registerSection.classList.remove('hidden');
    loginSection.classList.add('hidden');
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
});

// Botón de cerrar sesión
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        console.log('Usuario ha cerrado sesión');
        // Limpia los datos de usuario
        currentUser = null;
        currentUserId = null;
        userDisplayNamesCache[currentUserId] = null;
        userPhoneNumbersCache[currentUserId] = null;
        if (userProfileUnsubscribe) userProfileUnsubscribe();
        if (adminPendingRequestsUnsubscribe) adminPendingRequestsUnsubscribe();
        if (adminSavingsDebtsUnsubscribe) adminSavingsDebtsUnsubscribe();
        if (savingsDebtsUnsubscribe) savingsDebtsUnsubscribe();
        if (userPendingRequestsUnsubscribe) userPendingRequestsUnsubscribe(); // NUEVO: Desuscribir oyente del usuario
        // Oculta el dashboard y muestra la sección de login
        dashboardSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
        loginTab.click(); // Vuelve a la pestaña de login
        showMessage('Has cerrado sesión exitosamente.', 'info');
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showMessage('Error al cerrar sesión. Por favor, inténtalo de nuevo.', 'error');
    }
});

// Listener de estado de autenticación de Firebase
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        currentUserId = user.uid;
        console.log(`Usuario autenticado: ${user.email}, UID: ${user.uid}`);
        
        // Listener en tiempo real para el perfil del usuario
        const userProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        userProfileUnsubscribe = onSnapshot(userProfileRef, async (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                console.log("Datos de usuario actualizados en tiempo real:", userData);
                
                // Actualiza el caché global y la interfaz
                userDisplayNamesCache[currentUserId] = `${userData.name} ${userData.surname}`;
                userPhoneNumbersCache[currentUserId] = userData.phoneNumber;
                dashboardUserName.textContent = `Hola, ${userData.name}!`;
                dashboardDisplayId.textContent = `ID de Usuario: ${userData.displayId}`;
                profileAvatar.textContent = userData.name.charAt(0).toUpperCase();

                // Actualiza los saldos
                currentBalanceUSD = userData.balanceUSD ?? 0;
                currentBalanceDOP = userData.balanceDOP ?? 0;
                updateBalanceDisplay();

                // Mostrar/ocultar botones de administrador
                if (user.email === ADMIN_EMAIL) {
                    adminButtonsContainer.classList.remove('hidden');
                    console.log("Mostrando botones de administrador.");
                    // Lógica para cargar solicitudes del administrador si el modal ya estuviera abierto
                    if (!adminPendingRequestsModal.classList.contains('hidden')) {
                        loadAdminPendingRequests();
                    }
                } else {
                    adminButtonsContainer.classList.add('hidden');
                    console.log("Ocultando botones de administrador.");
                }

                // Oculta las secciones de autenticación y muestra el dashboard
                loginSection.classList.add('hidden');
                registerSection.classList.add('hidden');
                dashboardSection.classList.remove('hidden');

                // Si el usuario tiene una solicitud de depósito pendiente, desactiva el botón de depósito
                if (userData.hasPendingDeposit) {
                    depositMoneyBtn.disabled = true;
                    depositMoneyBtn.textContent = 'Depósito Pendiente';
                    depositMoneyBtn.classList.remove('btn-primary');
                    depositMoneyBtn.classList.add('btn-secondary');
                } else {
                    depositMoneyBtn.disabled = false;
                    depositMoneyBtn.textContent = 'Depositar Dinero';
                    depositMoneyBtn.classList.add('btn-primary');
                    depositMoneyBtn.classList.remove('btn-secondary');
                }

            } else {
                console.error("No se encontraron datos para el usuario autenticado.");
                showMessage("No se pudieron cargar los datos de tu perfil. Por favor, contacta a soporte.", 'error');
                await signOut(auth); // Forzar cierre de sesión si no hay perfil
            }
        });
    } else {
        console.log('Usuario no autenticado.');
        // Muestra la sección de login por defecto
        dashboardSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
        loginTab.click();
    }
});


/**
 * Actualiza la visualización del saldo en el dashboard.
 */
function updateBalanceDisplay() {
    if (showCurrencyUSD) {
        accountBalance.textContent = `$${currentBalanceUSD.toFixed(2)} USD`;
        toggleCurrencyBtn.textContent = 'Ver en DOP';
    } else {
        accountBalance.textContent = `$${currentBalanceDOP.toFixed(2)} DOP`;
        toggleCurrencyBtn.textContent = 'Ver en USD';
    }
}

// Botón para alternar la moneda del saldo
toggleCurrencyBtn.addEventListener('click', () => {
    showCurrencyUSD = !showCurrencyUSD;
    updateBalanceDisplay();
});


/**
 * Obtiene el nombre de visualización de un usuario por su UID, usando un caché.
 * @param {string} uid El UID del usuario.
 * @returns {Promise<string>} El nombre del usuario o 'Usuario Desconocido'.
 */
async function getUserDisplayName(uid) {
    if (userDisplayNamesCache[uid]) {
        return userDisplayNamesCache[uid];
    }
    try {
        const userDocRef = doc(db, 'artifacts', appId, 'users', uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const displayName = `${userData.name} ${userData.surname}`;
            userDisplayNamesCache[uid] = displayName;
            return displayName;
        } else {
            return 'Usuario Desconocido';
        }
    } catch (error) {
        console.error("Error al obtener el nombre de usuario:", error);
        return 'Usuario Desconocido (Error)';
    }
}

// --- Lógica del formulario de registro ---
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = registerNameInput.value.trim();
    const surname = registerSurnameInput.value.trim();
    const age = parseInt(registerAgeInput.value);
    const phoneNumber = registerPhoneNumberInput.value.trim();
    const password = registerPasswordInput.value.trim();

    // Validación básica de datos
    if (!name || !surname || !phoneNumber || isNaN(age) || age < 13 || password.length < 6) {
        showMessage('Por favor, completa todos los campos correctamente. El número de teléfono debe ser válido y la contraseña debe tener al menos 6 caracteres.', 'error');
        return;
    }

    // Guarda los datos temporalmente y muestra el modal de reglas
    tempRegisterData = { name, surname, age, phoneNumber, password };
    briefRulesTextContainer.innerHTML = briefRulesText;
    rulesConsentModal.classList.remove('hidden');
});

// Botón de aceptar reglas en el modal
acceptRulesBtn.addEventListener('click', async () => {
    const { name, surname, age, phoneNumber, password } = tempRegisterData;

    // Genera un displayId simple, por ejemplo, las primeras 4 letras del nombre y 4 números aleatorios
    const displayId = `${name.substring(0, 4).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`;
    const userEmail = `${displayId}@${appId}.com`; // Crea un email ficticio único
    
    try {
        // 1. Crear el usuario en Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, userEmail, password);
        const user = userCredential.user;

        // 2. Crear el documento del usuario en Firestore
        const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid);
        await setDoc(userDocRef, {
            name: name,
            surname: surname,
            age: age,
            phoneNumber: phoneNumber,
            balanceUSD: 0,
            balanceDOP: 0,
            email: userEmail, // Almacena el email para referencia
            displayId: displayId,
            isAdmin: false,
            createdAt: serverTimestamp(),
            hasPendingDeposit: false // Bandera para controlar depósitos pendientes
        });

        // 3. Cierre de sesión y mostrar mensaje de éxito
        await signOut(auth);
        closeModal(rulesConsentModal);
        showMessage('¡Registro exitoso! Ahora puedes iniciar sesión con tu ID de usuario y la contraseña que creaste.', 'success');
        loginForm.reset();
        registerForm.reset();

    } catch (error) {
        closeModal(rulesConsentModal);
        console.error("Error al registrar:", error);
        // Manejo de errores específicos de Firebase Auth
        if (error.code === 'auth/email-already-in-use') {
            showMessage('Error: El email (ID de usuario) ya está en uso. Por favor, contacta a soporte.', 'error');
        } else if (error.code === 'auth/weak-password') {
            showMessage('Error: La contraseña debe tener al menos 6 caracteres.', 'error');
        } else {
            showMessage('Error al registrar. Por favor, inténtalo de nuevo más tarde.', 'error');
        }
    }
});

// Botón de rechazar reglas en el modal
rejectRulesBtn.addEventListener('click', () => {
    closeModal(rulesConsentModal);
    registerForm.reset();
    showMessage('El registro ha sido cancelado.', 'info');
});

// --- Lógica del formulario de inicio de sesión ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = loginIdentifierInput.value.trim();
    const password = loginPassword.value.trim();

    try {
        // Si el identificador es un email, inicia sesión con él directamente
        if (identifier.includes('@')) {
            await signInWithEmailAndPassword(auth, identifier, password);
        } else {
            // Si es un displayId, primero busca el email asociado
            const usersRef = collection(db, 'artifacts', appId, 'users');
            const q = query(usersRef, where('displayId', '==', identifier.toUpperCase()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                showMessage('ID de usuario no encontrado.', 'error');
                return;
            }

            const userDoc = querySnapshot.docs[0];
            const userEmail = userDoc.data().email;

            await signInWithEmailAndPassword(auth, userEmail, password);
        }
        showMessage('Inicio de sesión exitoso.', 'success');
        loginForm.reset();
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        showMessage('Error al iniciar sesión. Verifica tu ID de usuario/contraseña e inténtalo de nuevo.', 'error');
    }
});

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
    const serialNumber = depositSerialNumberInput.value;
    const amount = parseFloat(depositAmount.value);
    const currency = depositCurrency.value;

    if (isNaN(amount) || amount <= 0) {
        showMessage('Por favor, introduce un monto válido.', 'error');
        return;
    }

    try {
        const userProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        const userProfileSnap = await getDoc(userProfileRef);
        const userData = userProfileSnap.data();

        if (userData.hasPendingDeposit) {
            showMessage('Ya tienes una solicitud de depósito pendiente. Por favor, espera a que sea aprobada o rechazada.', 'error');
            return;
        }

        const pendingRequestsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests');
        const requestData = {
            userId: currentUserId,
            type: 'deposit',
            amount: amount,
            currency: currency,
            serialNumber: serialNumber,
            status: 'pending',
            timestamp: serverTimestamp()
        };
        await addDoc(pendingRequestsCollectionRef, requestData);

        // Actualiza el perfil del usuario para indicar que tiene un depósito pendiente
        await updateDoc(userProfileRef, {
            hasPendingDeposit: true
        });

        closeModal(depositModal);
        showMessage('Tu solicitud de depósito ha sido enviada para aprobación.', 'success');
        depositForm.reset();

    } catch (error) {
        console.error("Error al enviar la solicitud de depósito:", error);
        showMessage('Error al procesar la solicitud de depósito. Por favor, inténtalo de nuevo.', 'error');
    }
});

// --- Funcionalidad de solicitud de retiro ---
withdrawMoneyBtn.addEventListener('click', () => {
    withdrawModal.classList.remove('hidden');
});

withdrawForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount.value);
    const currency = withdrawCurrency.value;
    const feeAmount = amount * WITHDRAWAL_FEE_RATE;

    if (isNaN(amount) || amount <= 0) {
        showMessage('Por favor, introduce un monto válido.', 'error');
        return;
    }

    const balanceToCheck = currency === 'USD' ? currentBalanceUSD : currentBalanceDOP;
    // La tarifa siempre se cobra en USD, por lo que el saldo en USD debe ser suficiente
    const totalDeductionUSD = currency === 'USD' ? amount + feeAmount : feeAmount;
    const totalDeductionDOP = currency === 'DOP' ? amount : 0;

    if (currency === 'USD' && currentBalanceUSD < totalDeductionUSD) {
        showMessage('Saldo insuficiente en USD para cubrir el retiro y la tarifa.', 'error');
        return;
    }
    if (currency === 'DOP' && (currentBalanceDOP < totalDeductionDOP || currentBalanceUSD < feeAmount)) {
        showMessage('Saldo insuficiente para cubrir el retiro en DOP o la tarifa en USD.', 'error');
        return;
    }

    try {
        const pendingRequestsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests');
        const requestData = {
            userId: currentUserId,
            type: 'withdrawal',
            amount: amount,
            currency: currency,
            estimatedFee: feeAmount,
            status: 'pending',
            timestamp: serverTimestamp()
        };
        await addDoc(pendingRequestsCollectionRef, requestData);

        closeModal(withdrawModal);
        showMessage('Tu solicitud de retiro ha sido enviada para aprobación.', 'success');
        withdrawForm.reset();

    } catch (error) {
        console.error("Error al enviar la solicitud de retiro:", error);
        showMessage('Error al procesar la solicitud de retiro. Por favor, inténtalo de nuevo.', 'error');
    }
});

// --- Funcionalidad de transferencia de dinero ---
transferMoneyBtn.addEventListener('click', () => {
    transferModal.classList.remove('hidden');
});

// Listener para la entrada del ID del destinatario
transferRecipientIdInput.addEventListener('input', async (e) => {
    const identifier = e.target.value.trim();
    if (identifier.length > 3) { // Buscar después de 3 caracteres
        try {
            const usersRef = collection(db, 'artifacts', appId, 'users');
            const q = query(usersRef, where('displayId', '==', identifier.toUpperCase()));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                const userData = userDoc.data();
                currentTransferRecipientUid = userDoc.id;
                currentTransferRecipientDisplayName = `${userData.name} ${userData.surname}`;
                recipientNameDisplay.textContent = `Destinatario: ${currentTransferRecipientDisplayName}`;
                recipientNameDisplay.classList.remove('hidden', 'text-red-500');
                recipientNameDisplay.classList.add('text-green-600');
            } else {
                currentTransferRecipientUid = null;
                currentTransferRecipientDisplayName = '';
                recipientNameDisplay.textContent = 'ID de usuario no encontrado.';
                recipientNameDisplay.classList.remove('hidden', 'text-green-600');
                recipientNameDisplay.classList.add('text-red-500');
            }
        } catch (error) {
            console.error("Error al buscar ID de usuario:", error);
            recipientNameDisplay.textContent = 'Error al buscar ID.';
            recipientNameDisplay.classList.remove('hidden', 'text-green-600');
            recipientNameDisplay.classList.add('text-red-500');
        }
    } else {
        currentTransferRecipientUid = null;
        recipientNameDisplay.classList.add('hidden');
    }
});

transferForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentTransferRecipientUid) {
        showMessage('Por favor, introduce un ID de destinatario válido.', 'error');
        return;
    }

    currentTransferAmount = parseFloat(transferAmount.value);
    currentTransferCurrency = transferCurrency.value;
    currentTransferRecipientIdentifier = transferRecipientIdInput.value.trim();

    if (isNaN(currentTransferAmount) || currentTransferAmount <= 0) {
        showMessage('Por favor, introduce un monto válido.', 'error');
        return;
    }

    const balanceToCheck = currentTransferCurrency === 'USD' ? currentBalanceUSD : currentBalanceDOP;
    if (balanceToCheck < currentTransferAmount) {
        showMessage('Saldo insuficiente para la transferencia.', 'error');
        return;
    }

    closeModal(transferModal);
    showTransactionStatus(`Transfiriendo ${currentTransferAmount.toFixed(2)} ${currentTransferCurrency} a ${currentTransferRecipientDisplayName}...`);

    // Iniciar un temporizador de 10 segundos
    let timeLeft = 10;
    const updateTimer = () => {
        transactionStatusText.textContent = `Transfiriendo ${currentTransferAmount.toFixed(2)} ${currentTransferCurrency} a ${currentTransferRecipientDisplayName}... (${timeLeft}s)`;
        if (timeLeft <= 0) {
            clearInterval(transferInterval);
            processTransfer();
        } else {
            timeLeft--;
        }
    };

    updateTimer();
    transferInterval = setInterval(updateTimer, 1000);
});

async function processTransfer() {
    // Si la transferencia ya ha sido cancelada, simplemente sal de la función
    if (!currentTransferRecipientUid) {
        hideTransactionStatus();
        return;
    }

    try {
        await runTransaction(db, async (transaction) => {
            // Referencias a los documentos de los usuarios
            const senderDocRef = doc(db, 'artifacts', appId, 'users', currentUserId);
            const recipientDocRef = doc(db, 'artifacts', appId, 'users', currentTransferRecipientUid);

            const senderDoc = await transaction.get(senderDocRef);
            const recipientDoc = await transaction.get(recipientDocRef);

            if (!senderDoc.exists() || !recipientDoc.exists()) {
                throw "Sender or recipient document does not exist!";
            }

            const senderData = senderDoc.data();
            const recipientData = recipientDoc.data();
            let newSenderBalanceUSD = senderData.balanceUSD;
            let newSenderBalanceDOP = senderData.balanceDOP;
            let newRecipientBalanceUSD = recipientData.balanceUSD;
            let newRecipientBalanceDOP = recipientData.balanceDOP;

            const transferAmountInUSD = currentTransferCurrency === 'USD' ? currentTransferAmount : currentTransferAmount / USD_TO_DOP_RATE;

            // Deducir del remitente
            if (currentTransferCurrency === 'USD') {
                newSenderBalanceUSD -= currentTransferAmount;
            } else {
                newSenderBalanceDOP -= currentTransferAmount;
            }

            // Acreditar al destinatario
            if (currentTransferCurrency === 'USD') {
                newRecipientBalanceUSD += currentTransferAmount;
            } else {
                // Asume que las transferencias en DOP se convierten a USD para los efectos de la cuenta de destino si es necesario,
                // pero por simplicidad, lo mantendremos en la misma moneda.
                newRecipientBalanceDOP += currentTransferAmount;
            }

            // Comprobar si el remitente tiene saldo suficiente
            if (newSenderBalanceUSD < 0 || newSenderBalanceDOP < 0) {
                throw "Insufficient funds!";
            }

            // Actualizar saldos en la transacción
            transaction.update(senderDocRef, {
                balanceUSD: newSenderBalanceUSD,
                balanceDOP: newSenderBalanceDOP
            });
            transaction.update(recipientDocRef, {
                balanceUSD: newRecipientBalanceUSD,
                balanceDOP: newRecipientBalanceDOP
            });

            // Registrar la transacción
            const transactionsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
            transaction.set(doc(transactionsCollectionRef), {
                type: 'transfer',
                senderId: currentUserId,
                recipientId: currentTransferRecipientUid,
                amount: currentTransferAmount,
                currency: currentTransferCurrency,
                description: `Transferencia a ${currentTransferRecipientDisplayName}`,
                status: 'completed',
                timestamp: serverTimestamp()
            });
        });

        showMessage('Transferencia completada exitosamente.', 'success');
    } catch (error) {
        console.error("Fallo de la transacción de transferencia:", error);
        showMessage('Error en la transferencia. Por favor, inténtalo de nuevo.', 'error');
    } finally {
        // Asegúrate de que el mensaje de estado de la transacción esté oculto después de la finalización o el error
        hideTransactionStatus();
        currentTransferRecipientUid = null; // Reiniciar para permitir nuevas transferencias
        transferForm.reset();
    }
}

cancelOngoingTransferBtn.addEventListener('click', () => {
    if (transferInterval) {
        clearInterval(transferInterval);
    }
    currentTransferRecipientUid = null; // Señal para que `processTransfer` no se ejecute
    hideTransactionStatus();
    showMessage('Transferencia cancelada.', 'info');
    transferForm.reset();
});

// --- Funcionalidad de solicitud de dinero del exterior ---
if (receiveExternalDepositBtn) {
    receiveExternalDepositBtn.addEventListener('click', () => {
        if (receiveExternalDepositModal) {
            receiveExternalDepositModal.classList.remove('hidden');
        } else {
            showMessage("El modal para recibir depósitos no está disponible.", "error");
        }
    });
}

if (receiveExternalDepositForm) {
    receiveExternalDepositForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const senderName = receiveExternalSenderNameInput.value.trim();
        const sourceBank = receiveExternalSourceBankInput.value.trim();
        const serialNumber = receiveExternalSerialNumberInput.value.trim();
        const amount = parseFloat(receiveExternalAmountInput.value);

        if (!senderName || !sourceBank || !serialNumber || isNaN(amount) || amount <= 0) {
            showMessage('Por favor, completa todos los campos correctamente.', 'error');
            return;
        }

        try {
            const pendingRequestsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests');
            const requestData = {
                userId: currentUserId,
                type: 'external_deposit',
                amount: amount,
                currency: 'USD', // Asumimos que los depósitos del exterior son en USD
                senderName: senderName,
                sourceBank: sourceBank,
                serialNumber: serialNumber,
                status: 'pending',
                timestamp: serverTimestamp()
            };
            await addDoc(pendingRequestsCollectionRef, requestData);

            closeModal(receiveExternalDepositModal);
            showMessage('Tu solicitud de depósito exterior ha sido enviada para aprobación.', 'success');
            receiveExternalDepositForm.reset();

        } catch (error) {
            console.error("Error al enviar la solicitud de depósito exterior:", error);
            showMessage('Error al procesar la solicitud de depósito exterior. Por favor, inténtalo de nuevo.', 'error');
        }
    });
}


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
            const requestDate = (request.timestamp && typeof request.timestamp.seconds !== 'undefined') ? new Date(request.timestamp.seconds * 1000).toLocaleString() : 'Fecha no disponible';

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
                    amountDisplay = (request.totalAmountToDeduct ?? 0).toFixed(2);
                    currencyDisplay = 'USD';
                    detailsDisplay = `Monto Prod: ${request.productAmount ?? 0}, Cat: ${request.category}`;
                    break;
                case 'streaming_payment':
                    typeDisplay = 'Pago Streaming';
                    amountDisplay = (request.totalAmountToDeduct ?? 0).toFixed(2);
                    currencyDisplay = 'USD';
                    detailsDisplay = `Servicio: ${request.service}, Cuenta: ${request.accountIdentifier}`;
                    break;
                case 'game_recharge': // NUEVO: Solicitud de recarga de juegos
                    typeDisplay = 'Recarga de Juego';
                    amountDisplay = (request.totalAmountToDeduct ?? 0).toFixed(2);
                    currencyDisplay = 'USD';
                    detailsDisplay = `Juego: ${request.gameName}, ID Jugador: ${request.playerId}`;
                    break;
                case 'savings_account_open': // NUEVO: Solicitud de apertura de ahorro
                    typeDisplay = 'Abrir Cta. Ahorro';
                    amountDisplay = (request.initialDepositAmount ?? 0).toFixed(2);
                    currencyDisplay = request.initialDepositCurrency;
                    detailsDisplay = `Objetivo: ${request.savingsGoal}, Cuota: ${request.periodicContributionAmount}, Frec: ${request.preferredSavingsFrequency}`;
                    break;
                case 'external_deposit': // NUEVO: Manejar solicitudes de depósito exterior
                    typeDisplay = 'Depósito Exterior';
                    amountDisplay = (request.amount ?? 0).toFixed(2);
                    currencyDisplay = request.currency;
                    detailsDisplay = `Remitente: ${request.senderName}, Banco: ${request.sourceBank}, Serie: ${request.serialNumber}`;
                    break;
                default:
                    typeDisplay = 'Desconocido';
                    amountDisplay = 'N/A';
                    currencyDisplay = 'N/A';
                    detailsDisplay = JSON.stringify(request); // Para depuración
                    break;
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${userNameDisplay}</td>
                <td>${typeDisplay}</td>
                <td>${requestDate}</td>
                <td>${detailsDisplay}</td>
                <td>${amountDisplay} ${currencyDisplay}</td>
                <td class="flex space-x-2">
                    <button class="btn-success btn-sm approve-request-btn" data-request-id="${requestId}" data-request-type="${request.type}" data-user-id="${request.userId}">Aprobar</button>
                    <button class="btn-danger btn-sm reject-request-btn" data-request-id="${requestId}" data-request-type="${request.type}" data-user-id="${request.userId}">Rechazar</button>
                </td>
            `;
            adminPendingRequestsTableBody.appendChild(row);
        }

        // Adjunta oyentes de eventos a los nuevos botones
        document.querySelectorAll('.approve-request-btn').forEach(button => {
            button.onclick = (event) => {
                const requestId = event.target.dataset.requestId;
                const type = event.target.dataset.requestType;
                const userId = event.target.dataset.userId;
                approveRequest(requestId, type, userId);
            };
        });
        document.querySelectorAll('.reject-request-btn').forEach(button => {
            button.onclick = (event) => {
                const requestId = event.target.dataset.requestId;
                const type = event.target.dataset.requestType;
                const userId = event.target.dataset.userId;
                rejectRequest(requestId, type, userId);
            };
        });
    }, (error) => {
        console.error("Admin: Error al cargar solicitudes pendientes:", error);
        adminPendingRequestsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-red-500 py-4">Error al cargar solicitudes.</td></tr>';
    });
}

/**
 * Aprueba una solicitud pendiente.
 */
async function approveRequest(requestId, type, userId) {
    const requestDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'pending_requests', requestId);
    const userProfileRef = doc(db, 'artifacts', appId, 'users', userId);

    try {
        await runTransaction(db, async (transaction) => {
            const requestDoc = await transaction.get(requestDocRef);
            if (!requestDoc.exists()) {
                throw "La solicitud no existe.";
            }

            const requestData = requestDoc.data();
            const userDoc = await transaction.get(userProfileRef);
            if (!userDoc.exists()) {
                throw "El usuario no existe.";
            }

            let userData = userDoc.data();
            let newBalanceUSD = userData.balanceUSD;
            let newBalanceDOP = userData.balanceDOP;
            let newHasPendingDeposit = userData.hasPendingDeposit;

            // Lógica para cada tipo de solicitud
            switch (type) {
                case 'deposit':
                    if (requestData.currency === 'USD') {
                        newBalanceUSD += requestData.amount;
                    } else {
                        newBalanceDOP += requestData.amount;
                    }
                    newHasPendingDeposit = false; // Desactiva la bandera de depósito pendiente
                    break;
                case 'withdrawal':
                    // El monto ya fue validado en la solicitud
                    if (requestData.currency === 'USD') {
                        newBalanceUSD -= (requestData.amount + requestData.estimatedFee);
                    } else {
                        newBalanceDOP -= requestData.amount;
                        newBalanceUSD -= requestData.estimatedFee; // La tarifa se deduce del saldo en USD
                    }
                    // Registrar la tarifa de retiro como una transacción separada para el administrador
                    const withdrawalFeeTransactionRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'));
                    transaction.set(withdrawalFeeTransactionRef, {
                        type: 'withdrawal_fee',
                        payerId: userId,
                        receiverId: currentUserId, // El administrador
                        amount: requestData.estimatedFee,
                        currency: 'USD',
                        originalRequestId: requestId,
                        status: 'completed',
                        timestamp: serverTimestamp()
                    });
                    break;
                case 'online_purchase':
                case 'streaming_payment':
                case 'game_recharge':
                    // El monto total a deducir ya incluye la tarifa
                    if (userData.balanceUSD < requestData.totalAmountToDeduct) {
                        throw "Saldo insuficiente en USD para esta solicitud.";
                    }
                    newBalanceUSD -= requestData.totalAmountToDeduct;
                    break;
                case 'savings_account_open':
                    if (requestData.initialDepositCurrency === 'USD') {
                        if (userData.balanceUSD < requestData.initialDepositAmount) {
                            throw "Saldo insuficiente para el depósito inicial de la cuenta de ahorro.";
                        }
                        newBalanceUSD -= requestData.initialDepositAmount;
                    } else {
                        if (userData.balanceDOP < requestData.initialDepositAmount) {
                            throw "Saldo insuficiente para el depósito inicial de la cuenta de ahorro.";
                        }
                        newBalanceDOP -= requestData.initialDepositAmount;
                    }

                    const newSavingsAccountRef = doc(collection(db, 'artifacts', appId, 'users', userId, 'savings_accounts'));
                    transaction.set(newSavingsAccountRef, {
                        userId: userId,
                        goal: requestData.savingsGoal,
                        balanceUSD: requestData.initialDepositCurrency === 'USD' ? requestData.initialDepositAmount : requestData.initialDepositAmount / USD_TO_DOP_RATE,
                        balanceDOP: requestData.initialDepositCurrency === 'DOP' ? requestData.initialDepositAmount : 0,
                        initialDepositAmount: requestData.initialDepositAmount,
                        initialDepositCurrency: requestData.initialDepositCurrency,
                        preferredFrequency: requestData.preferredSavingsFrequency,
                        periodicContributionAmount: requestData.periodicContributionAmount,
                        startDate: requestData.timestamp,
                        endDate: requestData.savingsEndDate,
                        lastContributionDate: requestData.timestamp,
                        status: 'active',
                        createdAt: serverTimestamp()
                    });
                    requestData.savingsAccountId = newSavingsAccountRef.id;
                    break;
                case 'external_deposit': // NUEVO: Lógica de aprobación para depósito exterior
                    if (requestData.currency === 'USD') {
                        newBalanceUSD += requestData.amount;
                    } else {
                        newBalanceDOP += requestData.amount;
                    }
                    break;
                default:
                    throw `Tipo de solicitud desconocido: ${type}`;
            }

            // Actualizar el saldo del usuario
            transaction.update(userProfileRef, {
                balanceUSD: newBalanceUSD,
                balanceDOP: newBalanceDOP,
                hasPendingDeposit: newHasPendingDeposit
            });

            // Mover la solicitud a la colección de transacciones completadas
            const transactionsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
            transaction.set(doc(transactionsCollectionRef), {
                ...requestData,
                id: requestId, // Mantener el ID original de la solicitud
                status: 'completed',
                completedAt: serverTimestamp()
            });

            // Eliminar la solicitud de la colección de pendientes
            transaction.delete(requestDocRef);
        });

        showMessage(`Solicitud #${requestId} (${type}) aprobada exitosamente.`, 'success');
    } catch (error) {
        console.error(`Error aprobando solicitud ${type} #${requestId}:`, error);
        showMessage(`Error al aprobar la solicitud ${type}. Por favor, inténtalo de nuevo. Detalle: ${error.message}`, 'error');
    }
}

/**
 * Rechaza una solicitud pendiente.
 */
async function rejectRequest(requestId, type, userId) {
    try {
        const requestDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'pending_requests', requestId);
        await updateDoc(requestDocRef, { status: 'rejected', rejectedAt: serverTimestamp() });

        // Para los depósitos, restablece la bandera hasPendingDeposit para que el usuario pueda solicitar de nuevo
        if (type === 'deposit') {
            const userProfileRef = doc(db, 'artifacts', appId, 'users', userId);
            await updateDoc(userProfileRef, { hasPendingDeposit: false });
        }

        showMessage(`Solicitud #${requestId} (${type}) rechazada exitosamente.`, 'info');
    } catch (error) {
        console.error(`Error rechazando solicitud ${type} #${requestId}:`, error);
        showMessage(`Error al rechazar la solicitud ${type}. Por favor, inténtalo de nuevo. Detalle: ${error.message}`, 'error');
    }
}

// --- Funcionalidad de solicitudes pendientes del usuario (NUEVO) ---
if (viewUserPendingRequestsBtn) {
    viewUserPendingRequestsBtn.addEventListener('click', () => {
        userPendingRequestsModal.classList.remove('hidden');
        loadUserPendingRequests();
    });
}

/**
 * Carga y muestra las solicitudes pendientes del usuario actual.
 */
function loadUserPendingRequests() {
    if (!currentUserId) {
        userPendingRequestsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500 py-4">No se pudo cargar el usuario. Por favor, reinicia la sesión.</td></tr>';
        return;
    }

    if (userPendingRequestsUnsubscribe) {
        userPendingRequestsUnsubscribe();
        userPendingRequestsUnsubscribe = null;
        console.log("User: Desuscrito del oyente de solicitudes pendientes anterior.");
    }

    userPendingRequestsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">Cargando tus solicitudes...</td></tr>';
    const pendingRequestsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests');
    const q = query(pendingRequestsCollectionRef, where('userId', '==', currentUserId), where('status', '==', 'pending'));

    userPendingRequestsUnsubscribe = onSnapshot(q, async (snapshot) => {
        userPendingRequestsTableBody.innerHTML = '';
        if (snapshot.empty) {
            userPendingRequestsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">No tienes solicitudes pendientes.</td></tr>';
            return;
        }

        for (const docEntry of snapshot.docs) {
            const request = docEntry.data();
            const requestId = docEntry.id;
            const requestDate = (request.timestamp && typeof request.timestamp.seconds !== 'undefined') ? new Date(request.timestamp.seconds * 1000).toLocaleString() : 'Fecha no disponible';
            
            let typeDisplay = '';
            let amountDisplay = '';
            let currencyDisplay = '';
            let detailsDisplay = '';

            switch (request.type) {
                case 'deposit':
                    typeDisplay = 'Depósito';
                    amountDisplay = (request.amount ?? 0).toFixed(2);
                    currencyDisplay = request.currency;
                    detailsDisplay = `Serie: ${request.serialNumber || 'N/A'}`;
                    break;
                case 'withdrawal':
                    typeDisplay = 'Retiro';
                    amountDisplay = (request.amount ?? 0).toFixed(2);
                    currencyDisplay = request.currency;
                    detailsDisplay = `Tarifa est. (4%): $${(request.estimatedFee ?? 0).toFixed(2)} USD`;
                    break;
                case 'online_purchase':
                    typeDisplay = 'Compra Online';
                    amountDisplay = (request.totalAmountToDeduct ?? 0).toFixed(2);
                    currencyDisplay = 'USD';
                    detailsDisplay = `Monto Prod: ${request.productAmount ?? 0}, Cat: ${request.category}`;
                    break;
                case 'streaming_payment':
                    typeDisplay = 'Pago Streaming';
                    amountDisplay = (request.totalAmountToDeduct ?? 0).toFixed(2);
                    currencyDisplay = 'USD';
                    detailsDisplay = `Servicio: ${request.service}, Cuenta: ${request.accountIdentifier}`;
                    break;
                case 'game_recharge':
                    typeDisplay = 'Recarga de Juego';
                    amountDisplay = (request.totalAmountToDeduct ?? 0).toFixed(2);
                    currencyDisplay = 'USD';
                    detailsDisplay = `Juego: ${request.gameName}, ID Jugador: ${request.playerId}`;
                    break;
                case 'savings_account_open':
                    typeDisplay = 'Abrir Cta. Ahorro';
                    amountDisplay = (request.initialDepositAmount ?? 0).toFixed(2);
                    currencyDisplay = request.initialDepositCurrency;
                    detailsDisplay = `Objetivo: ${request.savingsGoal}, Cuota: ${request.periodicContributionAmount}`;
                    break;
                case 'external_deposit': // NUEVO: Mostrar solicitudes de depósito exterior
                    typeDisplay = 'Depósito Exterior';
                    amountDisplay = (request.amount ?? 0).toFixed(2);
                    currencyDisplay = request.currency;
                    detailsDisplay = `Remitente: ${request.senderName}, Banco: ${request.sourceBank}, Serie: ${request.serialNumber}`;
                    break;
                default:
                    typeDisplay = 'Desconocido';
                    amountDisplay = 'N/A';
                    currencyDisplay = 'N/A';
                    detailsDisplay = JSON.stringify(request);
                    break;
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${requestDate}</td>
                <td>${typeDisplay}</td>
                <td>${detailsDisplay}</td>
                <td>${amountDisplay} ${currencyDisplay}</td>
                <td>Pendiente</td>
            `;
            userPendingRequestsTableBody.appendChild(row);
        }
    }, (error) => {
        console.error("User: Error al cargar solicitudes pendientes:", error);
        userPendingRequestsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-4">Error al cargar tus solicitudes.</td></tr>`;
    });
}


// --- Lógica del historial de transacciones del usuario ---
viewHistoryBtn.addEventListener('click', () => {
    userHistoryModal.classList.remove('hidden');
    loadUserHistory();
});

/**
 * Carga y muestra el historial de transacciones del usuario actual.
 */
async function loadUserHistory() {
    if (!currentUserId) {
        userHistoryTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-red-500 py-4">No se pudo cargar el usuario. Por favor, reinicia la sesión.</td></tr>';
        return;
    }
    
    // El oyente `onSnapshot` ya está manejando la carga en tiempo real.
    // Solo necesitamos asegurarnos de que la consulta sea correcta.

    userHistoryTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">Cargando historial...</td></tr>';
    
    const transactionsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');

    // Optimizamos la consulta para evitar duplicados y filtrar por el usuario actual
    const q = query(transactionsCollectionRef, 
        where('status', '==', 'completed')
    );

    // Utilizamos onSnapshot para la actualización en tiempo real del historial
    onSnapshot(q, async (snapshot) => {
        userHistoryTableBody.innerHTML = '';
        userTransactionsData = []; // Borra los datos anteriores

        // Filtra las transacciones en el cliente para el usuario actual.
        // Un query más optimizado sería ideal, pero requiere una estructura de datos diferente.
        // Esta aproximación corrige el problema de duplicación filtrando solo una vez por ID.
        snapshot.docs.forEach(docEntry => {
            const transaction = { id: docEntry.id, ...docEntry.data() };
            if (
                (transaction.userId === currentUserId) || 
                (transaction.type === 'transfer' && (transaction.senderId === currentUserId || transaction.recipientId === currentUserId)) ||
                (transaction.type === 'savings_debt_payment' && transaction.debtorId === currentUserId) ||
                (transaction.type === 'savings_indemnization_applied' && transaction.payerId === currentUserId) ||
                // No incluir transacciones de tarifas internas a menos que el usuario sea el pagador
                (transaction.type === 'withdrawal_fee' && transaction.payerId === currentUserId)
            ) {
                userTransactionsData.push(transaction);
            }
        });

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
            const date = (transaction.timestamp && typeof transaction.timestamp.seconds !== 'undefined') ? new Date(transaction.timestamp.seconds * 1000).toLocaleString() : 'Fecha no disponible';
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
                case 'external_deposit': // NUEVO: Visualización de historial de depósito exterior
                    typeDisplay = 'Depósito Exterior';
                    detailsDisplay = `Remitente: ${transaction.senderName}, Banco: ${transaction.sourceBank}, Serie: ${transaction.serialNumber}`;
                    amountDisplay = `+${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
                    break;
                default:
                    return; // Ignora cualquier otro tipo de transacción que no deba mostrarse al usuario
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
            const date = (transaction.timestamp && typeof transaction.timestamp.seconds !== 'undefined') ? new Date(transaction.timestamp.seconds * 1000).toLocaleString() : 'Fecha no disponible';
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
                    details = `Objetivo: ${transaction.savingsGoal}, Tarifa: $${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
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
                    usersInvolved = await getUserDisplayName(transaction.debtorId);
                    amountValue = (transaction.amount ?? 0);
                    currencyValue = transaction.currency;
                    details = `Objetivo: ${transaction.savingsGoal}, ID Deuda: ${transaction.debtId.substring(0, 8)}...`;
                    break;
                case 'savings_indemnization_applied':
                    typeDisplay = 'Indemnización Ahorro Aplicada';
                    usersInvolved = await getUserDisplayName(transaction.payerId);
                    amountValue = (transaction.amount ?? 0);
                    currencyValue = transaction.currency;
                    details = `ID Deuda Original: ${transaction.originalDebtId || 'N/A'}`;
                    break;
                case 'external_deposit': // NUEVO: Visualización de historial de administrador para depósito exterior
                    typeDisplay = 'Depósito Exterior';
                    usersInvolved = await getUserDisplayName(transaction.userId);
                    amountValue = (transaction.amount ?? 0);
                    currencyValue = transaction.currency;
                    details = `Remitente: ${transaction.senderName}, Banco: ${transaction.sourceBank}, Serie: ${transaction.serialNumber}`;
                    break;
                default:
                    usersInvolved = 'N/A';
                    details = JSON.stringify(transaction);
                    break;
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date}</td>
                <td>${usersInvolved}</td>
                <td>${typeDisplay}</td>
                <td>${details}</td>
                <td>${amountValue.toFixed(2)} ${currencyValue}</td>
                <td><button class="btn-secondary view-receipt-btn" data-transaction-id="${transaction.id}">Ver Recibo</button></td>
            `;
            adminFullHistoryTableBodyModal.appendChild(row);
        }

        // Adjunta oyentes de eventos a los nuevos botones "Ver Recibo"
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
        console.error("Admin: Error al cargar el historial completo del administrador:", error);
        adminFullHistoryTableBodyModal.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 py-4">Error al cargar el historial completo.</td></tr>`;
    });
}
