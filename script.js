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

// NUEVO: Elementos para recibir dinero del exterior
const receiveExternalMoneyBtn = document.getElementById('receiveExternalMoneyBtn'); // Asegúrate de que este botón exista en tu HTML
const receiveExternalMoneyModal = document.getElementById('receiveExternalMoneyModal'); // Asegúrate de que este modal exista en tu HTML
const cancelReceiveExternalMoneyBtn = document.getElementById('cancelReceiveExternalMoneyBtn'); // Asegúrate de que este botón exista en tu HTML
const receiveExternalMoneyForm = document.getElementById('receiveExternalMoneyForm'); // Asegúrate de que este formulario exista en tu HTML
const externalSenderNameInput = document.getElementById('externalSenderName');
const externalSenderBankInput = document.getElementById('externalSenderBank');
const externalSerialNumberInput = document.getElementById('externalSerialNumber');
const externalDepositAmountInput = document.getElementById('externalDepositAmount');
const externalDepositCurrencyInput = document.getElementById('externalDepositCurrency');


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
let userHistoryUnsubscribe = null; // NUEVO: Desuscripción para el oyente del historial del usuario

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
    } else if (transaction.type === 'external_deposit') { // NUEVO: Recibo de depósito externo
        typeDisplay = 'Depósito Exterior';
        amountDisplay = (transaction.amount ?? 0).toFixed(2);
        currencyDisplay = transaction.currency;
        otherDetails += `<p><strong>Banco Origen:</strong> ${transaction.senderBank || 'N/A'}</p>`;
        otherDetails += `<p><strong>Remitente:</strong> ${transaction.senderName || 'N/A'}</p>`;
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
        showSection(loginSection, registerSection, dashboardSection, rulesConsentModal, userHistoryModal, adminFullHistoryModal, adminPendingRequestsModal, faqModal, onlineShoppingModal, streamingPaymentModal, gameRechargeModal, userPendingRequestsModal, receiptModal, editProfileModal, changePasswordModal, securityTipsModal, aboutUsModal, contactSupportModal, openSavingsAccountModal, viewSavingsAccountsModal, editAnnouncementsModal, depositToSavingsModal, withdrawFromSavingsModal, confirmDeleteSavingsAccountModal, savingsDebtsModal, adminSavingsDebtsModal, receiveExternalMoneyModal);
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        // Oculta todas las secciones principales y modales
        showSection(registerSection, loginSection, dashboardSection, rulesConsentModal, userHistoryModal, adminFullHistoryModal, adminPendingRequestsModal, faqModal, onlineShoppingModal, streamingPaymentModal, gameRechargeModal, userPendingRequestsModal, receiptModal, editProfileModal, changePasswordModal, securityTipsModal, aboutUsModal, contactSupportModal, openSavingsAccountModal, viewSavingsAccountsModal, editAnnouncementsModal, depositToSavingsModal, withdrawFromSavingsModal, confirmDeleteSavingsAccountModal, savingsDebtsModal, adminSavingsDebtsModal, receiveExternalMoneyModal);
    }
    hideMessage(); // Oculta cualquier mensaje anterior al cambiar de pestaña
}

/**
 * Cierra cualquier modal abierto.
 */
function closeModal(modalElement) {
    modalElement.classList.add('hidden');
}

// --- Funcionalidad de inicio de sesión y registro ---

// Oyentes de eventos para las pestañas de inicio de sesión/registro
loginTab.addEventListener('click', () => toggleTabs('login'));
registerTab.addEventListener('click', () => toggleTabs('register'));

// Oyente de eventos para el formulario de inicio de sesión
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const identifier = loginIdentifierInput.value.trim();
    const password = loginPassword.value;

    if (!identifier || !password) {
        showMessage('Por favor, ingresa tu correo electrónico/ID de usuario y contraseña.', 'error');
        return;
    }

    try {
        let emailToSignIn = identifier;
        // Si el identificador no contiene '@', asume que es un userDisplayId o phoneNumber
        if (!identifier.includes('@')) {
            const usersRef = collection(db, 'artifacts', appId, 'users');
            let q;
            if (identifier.startsWith('+')) { // Asume que es un número de teléfono si empieza con '+'
                q = query(usersRef, where('phoneNumber', '==', identifier));
            } else { // Asume que es un userDisplayId
                q = query(usersRef, where('userDisplayId', '==', identifier));
            }
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                showMessage('Usuario no encontrado. Verifica tu ID de usuario o número de teléfono.', 'error');
                return;
            }
            emailToSignIn = querySnapshot.docs[0].data().email;
        }

        await signInWithEmailAndPassword(auth, emailToSignIn, password);
        showMessage('Inicio de sesión exitoso.', 'success');
        loginForm.reset();
    } catch (error) {
        console.error("Error de inicio de sesión:", error);
        if (error.code === 'auth/invalid-email' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            showMessage('Credenciales inválidas. Verifica tu correo/ID de usuario y contraseña.', 'error');
        } else if (error.code === 'auth/too-many-requests') {
            showMessage('Demasiados intentos de inicio de sesión fallidos. Inténtalo de nuevo más tarde.', 'error');
        } else {
            showMessage('Error al iniciar sesión. Por favor, inténtalo de nuevo.', 'error');
        }
    }
});

// Oyente de eventos para el formulario de registro
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const name = registerNameInput.value.trim();
    const surname = registerSurnameInput.value.trim();
    const age = parseInt(registerAgeInput.value);
    const phoneNumber = registerPhoneNumberInput.value.trim(); // Obtiene el número de teléfono
    const password = registerPasswordInput.value;
    const email = `${name.toLowerCase()}.${surname.toLowerCase()}@${appId}.com`; // Genera un email único

    if (!name || !surname || isNaN(age) || age < 13 || !phoneNumber || password.length < 6) {
        showMessage('Por favor, completa todos los campos. La edad debe ser al menos 13 y la contraseña de 6 caracteres mínimo.', 'error');
        return;
    }

    // Guarda los datos temporalmente y muestra el modal de consentimiento
    tempRegisterData = { name, surname, age, phoneNumber, password, email };
    briefRulesTextContainer.innerHTML = briefRulesText;
    rulesConsentModal.classList.remove('hidden');
});

// Oyentes de eventos para el modal de consentimiento de reglas
acceptRulesBtn.addEventListener('click', async () => {
    rulesConsentModal.classList.add('hidden');
    const { name, surname, age, phoneNumber, password, email } = tempRegisterData;

    try {
        // Verifica si el userDisplayId o el número de teléfono ya existen
        const usersRef = collection(db, 'artifacts', appId, 'users');
        const querySnapshotId = await getDocs(query(usersRef, where('userDisplayId', '==', `${name.toLowerCase()}.${surname.toLowerCase()}`)));
        const querySnapshotPhone = await getDocs(query(usersRef, where('phoneNumber', '==', phoneNumber)));

        if (!querySnapshotId.empty) {
            showMessage('El ID de usuario generado (nombre.apellido) ya existe. Por favor, usa un nombre o apellido diferente.', 'error');
            return;
        }
        if (!querySnapshotPhone.empty) {
            showMessage('El número de teléfono ya está registrado. Por favor, usa uno diferente o inicia sesión.', 'error');
            return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userDisplayId = `${name.toLowerCase()}.${surname.toLowerCase()}`; // ID de usuario simplificado

        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid), {
            name: name,
            surname: surname,
            age: age,
            phoneNumber: phoneNumber, // Guarda el número de teléfono
            email: email,
            userDisplayId: userDisplayId, // Guarda el ID de usuario simplificado
            balanceUSD: 0,
            balanceDOP: 0,
            isAdmin: false,
            createdAt: serverTimestamp()
        });
        showMessage('Registro exitoso. ¡Bienvenido a Banco Juvenil!', 'success');
        registerForm.reset();
        tempRegisterData = {}; // Limpia los datos temporales
    } catch (error) {
        console.error("Error de registro:", error);
        if (error.code === 'auth/email-already-in-use') {
            showMessage('El correo electrónico ya está en uso. Intenta iniciar sesión.', 'error');
        } else {
            showMessage('Error al registrar. Por favor, inténtalo de nuevo.', 'error');
        }
    }
});

rejectRulesBtn.addEventListener('click', () => {
    rulesConsentModal.classList.add('hidden');
    tempRegisterData = {}; // Limpia los datos temporales si se rechazan las reglas
    showMessage('Debes aceptar las reglas para registrarte.', 'error');
});

// --- NUEVA FUNCIONALIDAD: Recibir dinero de banco exterior ---
receiveExternalMoneyBtn.addEventListener('click', () => {
    receiveExternalMoneyModal.classList.remove('hidden');
    receiveExternalMoneyForm.reset();
});

cancelReceiveExternalMoneyBtn.addEventListener('click', () => {
    closeModal(receiveExternalMoneyModal);
    receiveExternalMoneyForm.reset();
});

receiveExternalMoneyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const senderName = externalSenderNameInput.value.trim();
    const senderBank = externalSenderBankInput.value.trim();
    const serialNumber = externalSerialNumberInput.value.trim();
    const amount = parseFloat(externalDepositAmountInput.value);
    const currency = externalDepositCurrencyInput.value;

    if (!senderName || !senderBank || !serialNumber || isNaN(amount) || amount <= 0) {
        showMessage('Por favor, completa todos los campos correctamente.', 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'pending_requests'), {
            userId: currentUserId,
            type: 'external_deposit',
            senderName: senderName,
            senderBank: senderBank,
            serialNumber: serialNumber,
            amount: amount,
            currency: currency,
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage('Solicitud de depósito exterior enviada. Esperando aprobación del administrador.', 'success');
        closeModal(receiveExternalMoneyModal);
        receiveExternalMoneyForm.reset();

        // Enviar notificación al administrador por WhatsApp
        const userDocSnap = await getDoc(doc(db, 'artifacts', appId, 'users', currentUserId));
        const userData = userDocSnap.data();
        const whatsappMessage = `
            Nueva solicitud de depósito exterior pendiente:
            Usuario: ${userData.name} ${userData.surname} (ID: ${userData.userDisplayId || userData.userId})
            Remitente: ${senderName}
            Banco: ${senderBank}
            Número de Serie: ${serialNumber}
            Monto: ${amount.toFixed(2)} ${currency}
            Por favor, revisa y confirma.
        `;
        const encodedMessage = encodeURIComponent(whatsappMessage);
        window.open(`https://wa.me/${ADMIN_PHONE_NUMBER_FULL}?text=${encodedMessage}`, '_blank');

    } catch (error) {
        console.error("Error al solicitar depósito exterior:", error);
        showMessage('Error al procesar la solicitud de depósito exterior. Por favor, inténtalo de nuevo.', 'error');
    }
});


// --- Funcionalidad del historial de usuario ---
viewHistoryBtn.addEventListener('click', () => {
    userHistoryModal.classList.remove('hidden');
    loadUserHistory();
});

closeUserHistoryModalBtn.addEventListener('click', () => {
    closeModal(userHistoryModal);
    // Desuscribirse del oyente cuando se cierra el modal
    if (userHistoryUnsubscribe) {
        userHistoryUnsubscribe();
        userHistoryUnsubscribe = null;
        console.log("Usuario: Desuscrito del oyente del historial al cerrar el modal.");
    }
});

/**
 * Carga el historial de transacciones del usuario y lo muestra.
 */
async function loadUserHistory() {
    // Desuscribirse del oyente anterior si existe para evitar duplicados
    if (userHistoryUnsubscribe) {
        userHistoryUnsubscribe();
        userHistoryUnsubscribe = null;
    }

    userHistoryTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">Cargando historial...</td></tr>';
    if (!currentUserId) {
        userHistoryTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-red-500 py-4">Inicia sesión para ver tu historial.</td></tr>';
        return;
    }

    const transactionsCollectionRef = collection(db, 'artifacts', appId, 'transactions');
    const q = query(transactionsCollectionRef,
        where('usersInvolved', 'array-contains', currentUserId));

    userHistoryUnsubscribe = onSnapshot(q, async (snapshot) => {
        userHistoryTableBody.innerHTML = ''; // Importante: Vacía la tabla para evitar duplicados
        if (snapshot.empty) {
            userHistoryTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">No hay historial de transacciones.</td></tr>';
            return;
        }

        const transactions = [];
        for (const docEntry of snapshot.docs) {
            const transaction = docEntry.data();
            transactions.push({ id: docEntry.id, ...transaction });
        }

        // Ordena las transacciones por marca de tiempo, la más reciente primero
        transactions.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);

        for (const transaction of transactions) {
            const date = (transaction.timestamp && typeof transaction.timestamp.seconds !== 'undefined') ? new Date(transaction.timestamp.seconds * 1000).toLocaleString() : 'Fecha no disponible';
            let typeDisplay = '';
            let amountDisplay = '';
            let currencyDisplay = '';
            let detailsDisplay = '';

            switch (transaction.type) {
                case 'transfer':
                    const otherUserId = transaction.senderId === currentUserId ? transaction.recipientId : transaction.senderId;
                    const otherUserName = await getUserDisplayName(otherUserId);
                    if (transaction.senderId === currentUserId) {
                        typeDisplay = 'Transferencia Enviada';
                        detailsDisplay = `Destinatario: ${otherUserName}`;
                        amountDisplay = `-${(transaction.amount ?? 0).toFixed(2)}`;
                    } else {
                        typeDisplay = 'Transferencia Recibida';
                        detailsDisplay = `Remitente: ${otherUserName}`;
                        amountDisplay = `+${(transaction.amount ?? 0).toFixed(2)}`;
                    }
                    currencyDisplay = transaction.currency;
                    break;
                case 'deposit':
                    typeDisplay = 'Depósito';
                    amountDisplay = `+${(transaction.amount ?? 0).toFixed(2)}`;
                    currencyDisplay = transaction.currency;
                    detailsDisplay = `Serie: ${transaction.serialNumber || 'N/A'}`;
                    break;
                case 'external_deposit': // NUEVO: Visualización para el usuario de un depósito exterior aprobado
                    typeDisplay = 'Depósito Exterior';
                    amountDisplay = `+${(transaction.amount ?? 0).toFixed(2)}`;
                    currencyDisplay = transaction.currency;
                    detailsDisplay = `Banco Origen: ${transaction.senderBank || 'N/A'}, Serie: ${transaction.serialNumber || 'N/A'}`;
                    break;
                case 'withdrawal':
                    typeDisplay = 'Retiro';
                    const totalWithdrawal = (transaction.amount ?? 0) + (transaction.feeAmount ?? 0);
                    amountDisplay = `-${totalWithdrawal.toFixed(2)}`;
                    currencyDisplay = transaction.currency;
                    detailsDisplay = `Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
                    break;
                case 'online_purchase':
                    typeDisplay = 'Compra Online';
                    amountDisplay = `-${(transaction.totalAmountDeducted ?? 0).toFixed(2)}`;
                    currencyDisplay = 'USD';
                    detailsDisplay = `Cat: ${transaction.category || 'N/A'}, Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
                    break;
                case 'streaming_payment':
                    typeDisplay = 'Pago Streaming';
                    amountDisplay = `-${(transaction.totalAmountDeducted ?? 0).toFixed(2)}`;
                    currencyDisplay = 'USD';
                    detailsDisplay = `Servicio: ${transaction.service}, Cat: ${transaction.category || 'N/A'}, Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
                    break;
                case 'game_recharge':
                    typeDisplay = 'Recarga de Juego';
                    amountDisplay = `-${(transaction.totalAmountDeducted ?? 0).toFixed(2)}`;
                    currencyDisplay = 'USD';
                    detailsDisplay = `Juego: ${transaction.gameName}, ID Jugador: ${transaction.playerId}, Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
                    break;
                case 'savings_account_open':
                    typeDisplay = 'Apertura Cta. Ahorro';
                    amountDisplay = `-${(transaction.initialDepositAmount ?? 0).toFixed(2)}`;
                    currencyDisplay = transaction.initialDepositCurrency;
                    detailsDisplay = `Objetivo: ${transaction.savingsGoal}, ID Cta: ${transaction.savingsAccountId.substring(0, 8)}...`;
                    break;
                case 'deposit_to_savings':
                    typeDisplay = 'Depósito a Ahorro';
                    amountDisplay = `-${(transaction.amount ?? 0).toFixed(2)}`;
                    currencyDisplay = transaction.currency;
                    detailsDisplay = `Objetivo: ${transaction.savingsGoal}, ID Cta: ${transaction.savingsAccountId.substring(0, 8)}...`;
                    break;
                case 'withdraw_from_savings':
                    typeDisplay = 'Retiro de Ahorro';
                    amountDisplay = `+${(transaction.amount ?? 0).toFixed(2)}`;
                    currencyDisplay = transaction.currency;
                    detailsDisplay = `Objetivo: ${transaction.savingsGoal}, ID Cta: ${transaction.savingsAccountId.substring(0, 8)}...`;
                    break;
                case 'delete_savings_account':
                    typeDisplay = 'Eliminación Cta. Ahorro';
                    amountDisplay = `+${(transaction.remainingBalanceTransferred ?? 0).toFixed(2)}`;
                    currencyDisplay = 'USD';
                    detailsDisplay = `Objetivo: ${transaction.savingsGoal}, Tarifa: ${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
                    break;
                case 'automatic_savings_collection':
                    typeDisplay = 'Cobro Automático Ahorro';
                    amountDisplay = `-${(transaction.amount ?? 0).toFixed(2)}`;
                    currencyDisplay = transaction.currency;
                    detailsDisplay = `Objetivo: ${transaction.savingsGoal}, ID Cta: ${transaction.savingsAccountId.substring(0, 8)}...`;
                    break;
                case 'savings_debt_payment':
                    typeDisplay = 'Pago Deuda Ahorro';
                    amountDisplay = `-${(transaction.amount ?? 0).toFixed(2)}`;
                    currencyDisplay = transaction.currency;
                    detailsDisplay = `Objetivo: ${transaction.savingsGoal}, ID Deuda: ${transaction.debtId.substring(0, 8)}...`;
                    break;
                default:
                    typeDisplay = transaction.type || 'Desconocido';
                    amountDisplay = (transaction.amount ?? 0).toFixed(2);
                    currencyDisplay = transaction.currency || 'N/A';
                    detailsDisplay = 'N/A';
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date}</td>
                <td>${typeDisplay}</td>
                <td class="text-right">${amountDisplay}</td>
                <td>${currencyDisplay}</td>
                <td>${detailsDisplay}</td>
                <td>
                    <button class="btn-info btn-sm view-receipt-btn" data-transaction-id="${transaction.id}">Ver Recibo</button>
                </td>
            `;
            userHistoryTableBody.appendChild(row);
        }
    }, (error) => {
        console.error("Error al cargar el historial del usuario:", error);
        userHistoryTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 py-4">Error al cargar el historial.</td></tr>`;
    });
}

// --- Event Listeners del Dashboard ---

// Alternar la visualización de la moneda
toggleCurrencyBtn.addEventListener('click', () => {
    showCurrencyUSD = !showCurrencyUSD;
    updateBalanceDisplay();
});

// Botones de modales
transferMoneyBtn.addEventListener('click', () => {
    showSection(transferModal);
    transferForm.reset();
});
cancelTransferModalBtn.addEventListener('click', () => {
    closeModal(transferModal);
    transferForm.reset();
});

depositMoneyBtn.addEventListener('click', () => {
    showSection(depositModal);
    depositForm.reset();
});
cancelDeposit.addEventListener('click', () => {
    closeModal(depositModal);
    depositForm.reset();
});

withdrawMoneyBtn.addEventListener('click', () => {
    showSection(withdrawModal);
    withdrawForm.reset();
});
cancelWithdraw.addEventListener('click', () => {
    closeModal(withdrawModal);
    withdrawForm.reset();
});

viewUserPendingRequestsBtn.addEventListener('click', () => {
    userPendingRequestsModal.classList.remove('hidden');
    loadUserPendingRequests(); // Cargar las solicitudes pendientes del usuario al abrir
});
closeUserPendingRequestsModalBtn.addEventListener('click', () => {
    closeModal(userPendingRequestsModal);
});

closeReceiptModalBtn.addEventListener('click', () => {
    closeModal(receiptModal);
});

// Delegación de eventos para el botón "Ver Recibo" en el historial de usuario
userHistoryTableBody.addEventListener('click', async (event) => {
    if (event.target.classList.contains('view-receipt-btn')) {
        const transactionId = event.target.dataset.transactionId;
        console.log("Buscando recibo para la transacción ID:", transactionId);
        const transactionDocRef = doc(db, 'artifacts', appId, 'transactions', transactionId);
        try {
            const transactionDocSnap = await getDoc(transactionDocRef);
            if (transactionDocSnap.exists()) {
                const transactionData = transactionDocSnap.data();
                transactionData.id = transactionId; // Agrega el ID al objeto de datos
                showReceipt(transactionData);
            } else {
                showMessage("Recibo no encontrado.", "error");
            }
        } catch (error) {
            console.error("Error al obtener el recibo:", error);
            showMessage("Error al obtener el recibo.", "error");
        }
    }
});


// Botones del administrador
if (adminFullHistoryBtn) {
    adminFullHistoryBtn.addEventListener('click', () => {
        showSection(adminFullHistoryModal);
        loadAdminFullHistory();
    });
}
if (closeAdminFullHistoryModalBtn) {
    closeAdminFullHistoryModalBtn.addEventListener('click', () => {
        closeModal(adminFullHistoryModal);
    });
}
if (viewAdminPendingRequestsBtn) {
    viewAdminPendingRequestsBtn.addEventListener('click', () => {
        showSection(adminPendingRequestsModal);
        loadAdminPendingRequests();
    });
}
if (closeAdminPendingRequestsModalBtn) {
    closeAdminPendingRequestsModalBtn.addEventListener('click', () => {
        closeModal(adminPendingRequestsModal);
        // Desuscribirse del oyente cuando se cierra el modal
        if (adminPendingRequestsUnsubscribe) {
            adminPendingRequestsUnsubscribe();
            adminPendingRequestsUnsubscribe = null;
            console.log("Admin: Desuscrito del oyente de solicitudes pendientes al cerrar el modal.");
        }
    });
}
// Botones de navegación
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth)
            .then(() => {
                console.log('Sesión cerrada');
                showSection(loginSection, registerSection, dashboardSection);
                toggleTabs('login');
                hideMessage();
            })
            .catch((error) => {
                console.error("Error al cerrar sesión:", error);
            });
    });
}

// Botones de funciones
if (onlineShoppingBtn) {
    onlineShoppingBtn.addEventListener('click', () => {
        showSection(onlineShoppingModal);
        onlineShoppingForm.reset();
    });
}
if (cancelOnlineShopping) {
    cancelOnlineShopping.addEventListener('click', () => {
        closeModal(onlineShoppingModal);
    });
}
if (streamingPaymentBtn) {
    streamingPaymentBtn.addEventListener('click', () => {
        showSection(streamingPaymentModal);
        streamingPaymentForm.reset();
    });
}
if (cancelStreamingPayment) {
    cancelStreamingPayment.addEventListener('click', () => {
        closeModal(streamingPaymentModal);
    });
}
if (gameRechargeBtn) {
    gameRechargeBtn.addEventListener('click', () => {
        showSection(gameRechargeModal);
        gameRechargeForm.reset();
    });
}
if (cancelGameRecharge) {
    cancelGameRecharge.addEventListener('click', () => {
        closeModal(gameRechargeModal);
    });
}
if (viewFAQBtn) {
    viewFAQBtn.addEventListener('click', () => {
        showSection(faqModal);
    });
}
if (closeFAQModalBtn) {
    closeFAQModalBtn.addEventListener('click', () => {
        closeModal(faqModal);
    });
}
if (editProfileBtn) {
    editProfileBtn.addEventListener('click', async () => {
        await loadEditProfileData();
        showSection(editProfileModal);
    });
}
if (cancelEditProfileBtn) {
    cancelEditProfileBtn.addEventListener('click', () => {
        closeModal(editProfileModal);
    });
}
if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', () => {
        showSection(changePasswordModal);
        changePasswordForm.reset();
    });
}
if (cancelChangePasswordBtn) {
    cancelChangePasswordBtn.addEventListener('click', () => {
        closeModal(changePasswordModal);
    });
}
if (securityTipsBtn) {
    securityTipsBtn.addEventListener('click', () => {
        showSection(securityTipsModal);
    });
}
if (closeSecurityTipsBtn) {
    closeSecurityTipsBtn.addEventListener('click', () => {
        closeModal(securityTipsModal);
    });
}
if (aboutUsBtn) {
    aboutUsBtn.addEventListener('click', () => {
        showSection(aboutUsModal);
    });
}
if (closeAboutUsBtn) {
    closeAboutUsBtn.addEventListener('click', () => {
        closeModal(aboutUsModal);
    });
}
if (contactSupportBtn) {
    contactSupportBtn.addEventListener('click', () => {
        showSection(contactSupportModal);
    });
}
if (closeContactSupportBtn) {
    closeContactSupportBtn.addEventListener('click', () => {
        closeModal(contactSupportModal);
    });
}
if (openSavingsAccountBtn) {
    openSavingsAccountBtn.addEventListener('click', () => {
        showSection(openSavingsAccountModal);
        savingsAccountForm.reset();
    });
}
if (cancelOpenSavingsAccountBtn) {
    cancelOpenSavingsAccountBtn.addEventListener('click', () => {
        closeModal(openSavingsAccountModal);
    });
}
if (viewSavingsAccountsBtn) {
    viewSavingsAccountsBtn.addEventListener('click', () => {
        showSection(viewSavingsAccountsModal);
        loadUserSavingsAccounts();
    });
}
if (closeViewSavingsAccountsBtn) {
    closeViewSavingsAccountsBtn.addEventListener('click', () => {
        closeModal(viewSavingsAccountsModal);
    });
}
if (editAnnouncementsBtn) {
    editAnnouncementsBtn.addEventListener('click', async () => {
        await loadAnnouncementsForEdit();
        showSection(editAnnouncementsModal);
    });
}
if (cancelEditAnnouncementsBtn) {
    cancelEditAnnouncementsBtn.addEventListener('click', () => {
        closeModal(editAnnouncementsModal);
    });
}
if (viewSavingsDebtsBtn) {
    viewSavingsDebtsBtn.addEventListener('click', () => {
        showSection(savingsDebtsModal);
        loadUserSavingsDebts();
    });
}
if (closeSavingsDebtsModalBtn) {
    closeSavingsDebtsModalBtn.addEventListener('click', () => {
        closeModal(savingsDebtsModal);
        if (savingsDebtsUnsubscribe) {
            savingsDebtsUnsubscribe();
            savingsDebtsUnsubscribe = null;
        }
    });
}
if (viewAdminSavingsDebtsBtn) {
    viewAdminSavingsDebtsBtn.addEventListener('click', () => {
        showSection(adminSavingsDebtsModal);
        loadAdminSavingsDebts();
    });
}
if (closeAdminSavingsDebtsModalBtn) {
    closeAdminSavingsDebtsModalBtn.addEventListener('click', () => {
        closeModal(adminSavingsDebtsModal);
        if (adminSavingsDebtsUnsubscribe) {
            adminSavingsDebtsUnsubscribe();
            adminSavingsDebtsUnsubscribe = null;
        }
    });
}

// --- Formularios de transacciones y perfiles ---

// Envío del formulario de transferencia
transferForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const recipientIdentifier = transferRecipientIdInput.value.trim();
    const amount = parseFloat(transferAmount.value);
    const currency = transferCurrency.value;

    if (!recipientIdentifier || isNaN(amount) || amount <= 0) {
        showMessage('Por favor, ingresa un ID de destinatario y un monto válido.', 'error');
        return;
    }

    if (currency === 'USD' && currentBalanceUSD < amount) {
        showMessage('Saldo USD insuficiente para la transferencia.', 'error');
        return;
    }
    if (currency === 'DOP' && currentBalanceDOP < amount) {
        showMessage('Saldo DOP insuficiente para la transferencia.', 'error');
        return;
    }

    try {
        let recipientUid = '';
        let recipientDisplayName = '';

        // Buscar al destinatario por userDisplayId, phoneNumber o email
        const usersRef = collection(db, 'artifacts', appId, 'users');
        let q;
        if (recipientIdentifier.includes('@')) {
            q = query(usersRef, where('email', '==', recipientIdentifier));
        } else if (recipientIdentifier.startsWith('+')) {
            q = query(usersRef, where('phoneNumber', '==', recipientIdentifier));
        } else {
            q = query(usersRef, where('userDisplayId', '==', recipientIdentifier));
        }

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showMessage('Destinatario no encontrado. Verifica el ID de usuario, número de teléfono o correo electrónico.', 'error');
            return;
        }

        const recipientDoc = querySnapshot.docs[0];
        recipientUid = recipientDoc.id;
        const recipientData = recipientDoc.data();
        recipientDisplayName = `${recipientData.name} ${recipientData.surname}`;

        if (recipientUid === currentUserId) {
            showMessage('No puedes transferir dinero a ti mismo.', 'error');
            return;
        }

        currentTransferRecipientUid = recipientUid;
        currentTransferAmount = amount;
        currentTransferCurrency = currency;
        currentTransferRecipientIdentifier = recipientIdentifier;
        currentTransferRecipientDisplayName = recipientDisplayName;

        // Mostrar confirmación
        recipientNameDisplay.textContent = `¿Confirmas la transferencia de ${amount.toFixed(2)} ${currency} a ${recipientDisplayName}?`;
        transferForm.classList.add('hidden');
        document.getElementById('transferConfirmation').classList.remove('hidden');

    } catch (error) {
        console.error("Error al buscar destinatario:", error);
        showMessage('Error al buscar destinatario. Inténtalo de nuevo.', 'error');
    }
});

// Confirmar transferencia
confirmTransferBtn.addEventListener('click', async () => {
    hideMessage();
    showTransactionStatus('Transferencia en curso...');
    closeModal(transferModal);
    transferForm.classList.remove('hidden');
    document.getElementById('transferConfirmation').classList.add('hidden');

    try {
        await runTransaction(db, async (transaction) => {
            const senderDocRef = doc(db, 'artifacts', appId, 'users', currentUserId);
            const recipientDocRef = doc(db, 'artifacts', appId, 'users', currentTransferRecipientUid);

            const senderDocSnap = await transaction.get(senderDocRef);
            const recipientDocSnap = await transaction.get(recipientDocRef);

            if (!senderDocSnap.exists() || !recipientDocSnap.exists()) {
                throw "Documento de remitente o destinatario no encontrado.";
            }

            const senderData = senderDocSnap.data();
            const recipientData = recipientDocSnap.data();

            let newSenderBalanceUSD = senderData.balanceUSD;
            let newSenderBalanceDOP = senderData.balanceDOP;
            let newRecipientBalanceUSD = recipientData.balanceUSD;
            let newRecipientBalanceDOP = recipientData.balanceDOP;

            if (currentTransferCurrency === 'USD') {
                if (newSenderBalanceUSD < currentTransferAmount) {
                    throw "Saldo USD insuficiente.";
                }
                newSenderBalanceUSD -= currentTransferAmount;
                newRecipientBalanceUSD += currentTransferAmount;
            } else if (currentTransferCurrency === 'DOP') {
                if (newSenderBalanceDOP < currentTransferAmount) {
                    throw "Saldo DOP insuficiente.";
                }
                newSenderBalanceDOP -= currentTransferAmount;
                newRecipientBalanceDOP += currentTransferAmount;
            }

            transaction.update(senderDocRef, {
                balanceUSD: newSenderBalanceUSD,
                balanceDOP: newSenderBalanceDOP
            });
            transaction.update(recipientDocRef, {
                balanceUSD: newRecipientBalanceUSD,
                balanceDOP: newRecipientBalanceDOP
            });

            // Registrar la transacción
            const newTransactionDocRef = doc(collection(db, 'artifacts', appId, 'transactions'));
            transaction.set(newTransactionDocRef, {
                type: 'transfer',
                senderId: currentUserId,
                recipientId: currentTransferRecipientUid,
                usersInvolved: [currentUserId, currentTransferRecipientUid], // Ambos usuarios involucrados
                amount: currentTransferAmount,
                currency: currentTransferCurrency,
                timestamp: serverTimestamp(),
                status: 'completed'
            });
        });

        showMessage('Transferencia realizada exitosamente.', 'success');
        transferForm.reset();
        hideTransactionStatus();
    } catch (error) {
        console.error("Error al realizar la transferencia:", error);
        showMessage(`Error en la transferencia: ${error}`, 'error');
        hideTransactionStatus();
    }
});

// Cancelar transferencia en curso
cancelOngoingTransferBtn.addEventListener('click', () => {
    if (transferInterval) {
        clearInterval(transferInterval);
        transferInterval = null;
    }
    hideTransactionStatus();
    showMessage('Transferencia cancelada.', 'info');
});

// Envío del formulario de depósito
depositForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const serialNumber = depositSerialNumberInput.value.trim();
    const amount = parseFloat(depositAmount.value);
    const currency = depositCurrency.value;

    if (!serialNumber || isNaN(amount) || amount <= 0) {
        showMessage('Por favor, completa el número de serie y un monto válido.', 'error');
        return;
    }

    try {
        // Verificar si ya hay una solicitud de depósito pendiente para este usuario
        const pendingDepositsQuery = query(
            collection(db, 'artifacts', appId, 'public', 'pending_requests'),
            where('userId', '==', currentUserId),
            where('type', '==', 'deposit'),
            where('status', '==', 'pending')
        );
        const existingPendingDeposits = await getDocs(pendingDepositsQuery);

        if (!existingPendingDeposits.empty) {
            showMessage('Ya tienes una solicitud de depósito pendiente. Por favor, espera a que sea aprobada antes de hacer otra.', 'error');
            return;
        }

        await addDoc(collection(db, 'artifacts', appId, 'public', 'pending_requests'), {
            userId: currentUserId,
            type: 'deposit',
            serialNumber: serialNumber,
            amount: amount,
            currency: currency,
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage('Solicitud de depósito enviada. Esperando aprobación del administrador.', 'success');
        closeModal(depositModal);
        depositForm.reset();

        // Enviar notificación al administrador por WhatsApp
        const userDocSnap = await getDoc(doc(db, 'artifacts', appId, 'users', currentUserId));
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
        showMessage('Error al procesar la solicitud de depósito. Por favor, inténtalo de nuevo.', 'error');
    }
});

// Envío del formulario de retiro
withdrawForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const amount = parseFloat(withdrawAmount.value);
    const currency = withdrawCurrency.value;

    if (isNaN(amount) || amount <= 0) {
        showMessage('Por favor, ingresa un monto válido.', 'error');
        return;
    }

    let amountInUSD = amount;
    if (currency === 'DOP') {
        amountInUSD = amount / USD_TO_DOP_RATE;
    }

    const estimatedFee = amountInUSD * WITHDRAWAL_FEE_RATE;
    const totalDeduction = amountInUSD + estimatedFee;

    if (currentBalanceUSD < totalDeduction) {
        showMessage(`Saldo insuficiente. Necesitas $${totalDeduction.toFixed(2)} USD (incluyendo tarifa de $${estimatedFee.toFixed(2)} USD).`, 'error');
        return;
    }

    try {
        // Verificar si ya hay una solicitud de retiro pendiente para este usuario
        const pendingWithdrawalsQuery = query(
            collection(db, 'artifacts', appId, 'public', 'pending_requests'),
            where('userId', '==', currentUserId),
            where('type', '==', 'withdrawal'),
            where('status', '==', 'pending')
        );
        const existingPendingWithdrawals = await getDocs(pendingWithdrawalsQuery);

        if (!existingPendingWithdrawals.empty) {
            showMessage('Ya tienes una solicitud de retiro pendiente. Por favor, espera a que sea aprobada antes de hacer otra.', 'error');
            return;
        }

        await addDoc(collection(db, 'artifacts', appId, 'public', 'pending_requests'), {
            userId: currentUserId,
            type: 'withdrawal',
            amount: amount, // Monto que el usuario quiere retirar
            currency: currency,
            estimatedFee: estimatedFee, // Tarifa estimada en USD
            totalDeduction: totalDeduction, // Monto total a deducir en USD
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage('Solicitud de retiro enviada. Esperando aprobación del administrador.', 'success');
        closeModal(withdrawModal);
        withdrawForm.reset();

        // Enviar notificación al administrador por WhatsApp
        const userDocSnap = await getDoc(doc(db, 'artifacts', appId, 'users', currentUserId));
        const userData = userDocSnap.data();
        const whatsappMessage = `
            Nueva solicitud de retiro pendiente:
            Usuario: ${userData.name} ${userData.surname} (ID: ${userData.userDisplayId || userData.userId})
            Monto: ${amount.toFixed(2)} ${currency}
            Tarifa estimada: ${estimatedFee.toFixed(2)} USD
            Total a deducir: ${totalDeduction.toFixed(2)} USD
            Por favor, revisa y confirma.
        `;
        const encodedMessage = encodeURIComponent(whatsappMessage);
        window.open(`https://wa.me/${ADMIN_PHONE_NUMBER_FULL}?text=${encodedMessage}`, '_blank');

    } catch (error) {
        console.error("Error al solicitar retiro:", error);
        showMessage('Error al procesar la solicitud de retiro. Por favor, inténtalo de nuevo.', 'error');
    }
});

// Envío del formulario de compras en línea
onlineShoppingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const productAmount = parseFloat(shoppingAmountInput.value);
    const productCurrency = shoppingCurrencyInput.value;
    const productLinks = productLinksInput.value.trim();
    const category = shoppingCategoryInput.value;

    if (isNaN(productAmount) || productAmount <= 0 || !productLinks || !category) {
        showMessage('Por favor, completa todos los campos correctamente.', 'error');
        return;
    }

    let amountInUSD = productAmount;
    if (productCurrency === 'DOP') {
        amountInUSD = productAmount / USD_TO_DOP_RATE;
    }
    const feeAmount = amountInUSD * COMMISSION_RATE;
    const totalAmountToDeduct = amountInUSD + feeAmount;

    if (currentBalanceUSD < totalAmountToDeduct) {
        showMessage(`Saldo insuficiente. Necesitas $${totalAmountToDeduct.toFixed(2)} USD (incluyendo tarifa de $${feeAmount.toFixed(2)} USD).`, 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'pending_requests'), {
            userId: currentUserId,
            type: 'online_purchase',
            productAmount: productAmount,
            productCurrency: productCurrency,
            productLinks: productLinks,
            category: category,
            feeAmount: feeAmount,
            totalAmountToDeduct: totalAmountToDeduct,
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage('Solicitud de compra en línea enviada. Esperando aprobación del administrador.', 'success');
        closeModal(onlineShoppingModal);
        onlineShoppingForm.reset();

        // Enviar notificación al administrador por WhatsApp
        const userDocSnap = await getDoc(doc(db, 'artifacts', appId, 'users', currentUserId));
        const userData = userDocSnap.data();
        const whatsappMessage = `
            Nueva solicitud de compra online pendiente:
            Usuario: ${userData.name} ${userData.surname} (ID: ${userData.userDisplayId || userData.userId})
            Monto Productos: ${productAmount.toFixed(2)} ${productCurrency}
            Categoría: ${category}
            Enlaces: ${productLinks.substring(0, 100)}...
            Total a deducir: ${totalAmountToDeduct.toFixed(2)} USD
            Por favor, revisa y confirma.
        `;
        const encodedMessage = encodeURIComponent(whatsappMessage);
        window.open(`https://wa.me/${ADMIN_PHONE_NUMBER_FULL}?text=${encodedMessage}`, '_blank');

    } catch (error) {
        console.error("Error al solicitar compra en línea:", error);
        showMessage('Error al procesar la solicitud de compra en línea. Por favor, inténtalo de nuevo.', 'error');
    }
});

// Envío del formulario de pago de streaming
streamingPaymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const service = streamingServiceInput.value.trim();
    const accountIdentifier = streamingAccountIdentifierInput.value.trim();
    const subscriptionAmount = parseFloat(streamingAmountInput.value);
    const subscriptionCurrency = streamingCurrencyInput.value;
    const category = streamingCategoryInput.value;

    if (!service || !accountIdentifier || isNaN(subscriptionAmount) || subscriptionAmount <= 0 || !category) {
        showMessage('Por favor, completa todos los campos correctamente.', 'error');
        return;
    }

    let amountInUSD = subscriptionAmount;
    if (subscriptionCurrency === 'DOP') {
        amountInUSD = subscriptionAmount / USD_TO_DOP_RATE;
    }
    const feeAmount = amountInUSD * COMMISSION_RATE;
    const totalAmountToDeduct = amountInUSD + feeAmount;

    if (currentBalanceUSD < totalAmountToDeduct) {
        showMessage(`Saldo insuficiente. Necesitas $${totalAmountToDeduct.toFixed(2)} USD (incluyendo tarifa de $${feeAmount.toFixed(2)} USD).`, 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'pending_requests'), {
            userId: currentUserId,
            type: 'streaming_payment',
            service: service,
            accountIdentifier: accountIdentifier,
            subscriptionAmount: subscriptionAmount,
            subscriptionCurrency: subscriptionCurrency,
            category: category,
            feeAmount: feeAmount,
            totalAmountToDeduct: totalAmountToDeduct,
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage('Solicitud de pago de streaming enviada. Esperando aprobación del administrador.', 'success');
        closeModal(streamingPaymentModal);
        streamingPaymentForm.reset();

        // Enviar notificación al administrador por WhatsApp
        const userDocSnap = await getDoc(doc(db, 'artifacts', appId, 'users', currentUserId));
        const userData = userDocSnap.data();
        const whatsappMessage = `
            Nueva solicitud de pago de streaming pendiente:
            Usuario: ${userData.name} ${userData.surname} (ID: ${userData.userDisplayId || userData.userId})
            Servicio: ${service}
            Cuenta: ${accountIdentifier}
            Monto Suscripción: ${subscriptionAmount.toFixed(2)} ${subscriptionCurrency}
            Categoría: ${category}
            Total a deducir: ${totalAmountToDeduct.toFixed(2)} USD
            Por favor, revisa y confirma.
        `;
        const encodedMessage = encodeURIComponent(whatsappMessage);
        window.open(`https://wa.me/${ADMIN_PHONE_NUMBER_FULL}?text=${encodedMessage}`, '_blank');

    } catch (error) {
        console.error("Error al solicitar pago de streaming:", error);
        showMessage('Error al procesar la solicitud de pago de streaming. Por favor, inténtalo de nuevo.', 'error');
    }
});

// Envío del formulario de recarga de juegos
gameRechargeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const gameName = gameNameInput.value.trim();
    const playerId = playerIdInput.value.trim();
    const rechargeAmount = parseFloat(rechargeAmountInput.value);
    const rechargeCurrency = rechargeCurrencyInput.value;
    const category = gameRechargeCategoryInput.value;

    if (!gameName || !playerId || isNaN(rechargeAmount) || rechargeAmount <= 0 || !category) {
        showMessage('Por favor, completa todos los campos correctamente.', 'error');
        return;
    }

    let amountInUSD = rechargeAmount;
    if (rechargeCurrency === 'DOP') {
        amountInUSD = rechargeAmount / USD_TO_DOP_RATE;
    }
    const feeAmount = amountInUSD * COMMISSION_RATE;
    const totalAmountToDeduct = amountInUSD + feeAmount;

    if (currentBalanceUSD < totalAmountToDeduct) {
        showMessage(`Saldo insuficiente. Necesitas $${totalAmountToDeduct.toFixed(2)} USD (incluyendo tarifa de $${feeAmount.toFixed(2)} USD).`, 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'pending_requests'), {
            userId: currentUserId,
            type: 'game_recharge',
            gameName: gameName,
            playerId: playerId,
            rechargeAmount: rechargeAmount,
            rechargeCurrency: rechargeCurrency,
            category: category,
            feeAmount: feeAmount,
            totalAmountToDeduct: totalAmountToDeduct,
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage('Solicitud de recarga de juego enviada. Esperando aprobación del administrador.', 'success');
        closeModal(gameRechargeModal);
        gameRechargeForm.reset();

        // Enviar notificación al administrador por WhatsApp
        const userDocSnap = await getDoc(doc(db, 'artifacts', appId, 'users', currentUserId));
        const userData = userDocSnap.data();
        const whatsappMessage = `
            Nueva solicitud de recarga de juego pendiente:
            Usuario: ${userData.name} ${userData.surname} (ID: ${userData.userDisplayId || userData.userId})
            Juego: ${gameName}
            ID Jugador: ${playerId}
            Monto Recarga: ${rechargeAmount.toFixed(2)} ${rechargeCurrency}
            Tipo: ${category}
            Total a deducir: ${totalAmountToDeduct.toFixed(2)} USD
            Por favor, revisa y confirma.
        `;
        const encodedMessage = encodeURIComponent(whatsappMessage);
        window.open(`https://wa.me/${ADMIN_PHONE_NUMBER_FULL}?text=${encodedMessage}`, '_blank');

    } catch (error) {
        console.error("Error al solicitar recarga de juego:", error);
        showMessage('Error al procesar la solicitud de recarga de juego. Por favor, inténtalo de nuevo.', 'error');
    }
});

// Envío del formulario de apertura de cuenta de ahorro
savingsAccountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const savingsGoal = savingsGoalInput.value.trim();
    const initialDepositAmount = parseFloat(initialDepositAmountInput.value);
    const initialDepositCurrency = initialDepositCurrencyInput.value;
    const preferredSavingsFrequency = preferredSavingsFrequencyInput.value;
    const periodicContributionAmount = parseFloat(periodicContributionAmountInput.value);
    const savingsEndDate = savingsEndDateInput.value; // Formato YYYY-MM-DD

    if (!savingsGoal || isNaN(initialDepositAmount) || initialDepositAmount < 0 || isNaN(periodicContributionAmount) || periodicContributionAmount < 0 || !preferredSavingsFrequency || !savingsEndDate) {
        showMessage('Por favor, completa todos los campos de la cuenta de ahorro correctamente.', 'error');
        return;
    }

    let initialDepositAmountInUSD = initialDepositAmount;
    if (initialDepositCurrency === 'DOP') {
        initialDepositAmountInUSD = initialDepositAmount / USD_TO_DOP_RATE;
    }

    if (currentBalanceUSD < initialDepositAmountInUSD) {
        showMessage(`Saldo insuficiente en tu cuenta principal para el depósito inicial. Necesitas $${initialDepositAmountInUSD.toFixed(2)} USD.`, 'error');
        return;
    }

    const startDate = new Date(); // La fecha de inicio es ahora
    const endDateObj = new Date(savingsEndDate);

    if (endDateObj <= startDate) {
        showMessage('La fecha de finalización debe ser posterior a la fecha actual.', 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'pending_requests'), {
            userId: currentUserId,
            type: 'savings_account_open',
            savingsGoal: savingsGoal,
            initialDepositAmount: initialDepositAmount,
            initialDepositCurrency: initialDepositCurrency,
            preferredSavingsFrequency: preferredSavingsFrequency,
            periodicContributionAmount: periodicContributionAmount,
            startDate: startDate, // Guarda como objeto Date
            endDate: savingsEndDate, // Guarda como string para visualización
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage('Solicitud para abrir cuenta de ahorro enviada. Esperando aprobación del administrador.', 'success');
        closeModal(openSavingsAccountModal);
        savingsAccountForm.reset();

        // Enviar notificación al administrador por WhatsApp
        const userDocSnap = await getDoc(doc(db, 'artifacts', appId, 'users', currentUserId));
        const userData = userDocSnap.data();
        const whatsappMessage = `
            Nueva solicitud de apertura de cuenta de ahorro pendiente:
            Usuario: ${userData.name} ${userData.surname} (ID: ${userData.userDisplayId || userData.userId})
            Objetivo: ${savingsGoal}
            Depósito Inicial: ${initialDepositAmount.toFixed(2)} ${initialDepositCurrency}
            Frecuencia: ${preferredSavingsFrequency}
            Cuota Periódica: ${periodicContributionAmount.toFixed(2)} USD
            Fecha Fin: ${savingsEndDate}
            Por favor, revisa y confirma.
        `;
        const encodedMessage = encodeURIComponent(whatsappMessage);
        window.open(`https://wa.me/${ADMIN_PHONE_NUMBER_FULL}?text=${encodedMessage}`, '_blank');

    } catch (error) {
        console.error("Error al solicitar apertura de cuenta de ahorro:", error);
        showMessage('Error al procesar la solicitud de apertura de cuenta de ahorro. Por favor, inténtalo de nuevo.', 'error');
    }
});


// Actualiza el precio total al cambiar la cantidad o la moneda para compras en línea
onlineShoppingForm.addEventListener('input', () => {
    const productAmount = parseFloat(shoppingAmountInput.value);
    const productCurrency = shoppingCurrencyInput.value;
    if (!isNaN(productAmount) && productAmount > 0) {
        let amountInUSD = productAmount;
        if (productCurrency === 'DOP') {
            amountInUSD = productAmount / USD_TO_DOP_RATE;
        }
        const fee = amountInUSD * COMMISSION_RATE;
        const totalAmount = amountInUSD + fee;
        shoppingFeeDisplay.textContent = `Tarifa (3%): $${fee.toFixed(2)} USD`;
        shoppingTotalDisplay.textContent = `Total a deducir: $${totalAmount.toFixed(2)} USD`;
    } else {
        shoppingFeeDisplay.textContent = 'Tarifa (3%): $0.00 USD';
        shoppingTotalDisplay.textContent = 'Total a deducir: $0.00 USD';
    }
});
// Evento para el formulario de pago de streaming
streamingPaymentForm.addEventListener('input', () => {
    const subscriptionAmount = parseFloat(streamingAmountInput.value);
    const subscriptionCurrency = streamingCurrencyInput.value;
    if (!isNaN(subscriptionAmount) && subscriptionAmount > 0) {
        let amountInUSD = subscriptionAmount;
        if (subscriptionCurrency === 'DOP') {
            amountInUSD = subscriptionAmount / USD_TO_DOP_RATE;
        }
        const fee = amountInUSD * COMMISSION_RATE;
        const totalAmount = amountInUSD + fee;
        streamingFeeDisplay.textContent = `Tarifa (3%): $${fee.toFixed(2)} USD`;
        streamingTotalDisplay.textContent = `Total a deducir: $${totalAmount.toFixed(2)} USD`;
    } else {
        streamingFeeDisplay.textContent = 'Tarifa (3%): $0.00 USD';
        streamingTotalDisplay.textContent = 'Total a deducir: $0.00 USD';
    }
});
// Evento para el formulario de recarga de juegos
gameRechargeForm.addEventListener('input', () => {
    const rechargeAmount = parseFloat(rechargeAmountInput.value);
    const rechargeCurrency = rechargeCurrencyInput.value;
    if (!isNaN(rechargeAmount) && rechargeAmount > 0) {
        let amountInUSD = rechargeAmount;
        if (rechargeCurrency === 'DOP') {
            amountInUSD = rechargeAmount / USD_TO_DOP_RATE;
        }
        const fee = amountInUSD * COMMISSION_RATE;
        const totalAmount = amountInUSD + fee;
        gameRechargeFeeDisplay.textContent = `Tarifa (3%): $${fee.toFixed(2)} USD`;
        gameRechargeTotalDisplay.textContent = `Total a deducir: $${totalAmount.toFixed(2)} USD`;
    } else {
        gameRechargeFeeDisplay.textContent = 'Tarifa (3%): $0.00 USD';
        gameRechargeTotalDisplay.textContent = 'Total a deducir: $0.00 USD';
    }
});


/**
 * Carga y muestra todas las solicitudes pendientes para el administrador.
 */
function loadAdminPendingRequests() {
    // Desuscribirse del oyente anterior si existe para evitar duplicados
    if (adminPendingRequestsUnsubscribe) {
        adminPendingRequestsUnsubscribe();
        adminPendingRequestsUnsubscribe = null;
        console.log("Admin: Desuscrito del oyente de solicitudes pendientes anterior.");
    }
    adminPendingRequestsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">Cargando solicitudes pendientes...</td></tr>';
    const pendingRequestsCollectionRef = collection(db, 'artifacts', appId, 'public', 'pending_requests');
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
            let newAttributes = ''; // Para nuevos atributos de la solicitud

            switch (request.type) {
                case 'deposit':
                    typeDisplay = 'Depósito';
                    amountDisplay = (request.amount ?? 0).toFixed(2);
                    currencyDisplay = request.currency;
                    detailsDisplay = `Serie: ${request.serialNumber}`;
                    break;
                case 'external_deposit': // NUEVO: Visualización de solicitud de depósito exterior para el administrador
                    typeDisplay = 'Depósito Exterior';
                    amountDisplay = (request.amount ?? 0).toFixed(2);
                    currencyDisplay = request.currency;
                    detailsDisplay = `Banco: ${request.senderBank || 'N/A'}, Remitente: ${request.senderName || 'N/A'}, Serie: ${request.serialNumber || 'N/A'}`;
                    newAttributes += `data-sender-name="${request.senderName || ''}" data-sender-bank="${request.senderBank || ''}" data-serial-number="${request.serialNumber || ''}"`;
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
                    currencyCurrency = 'USD'; // Asumiendo que totalToDeduct está en USD
                    detailsDisplay = `Servicio: ${request.service}, Cuenta: ${request.accountIdentifier}, Tarifa (3%): $${(request.feeAmount ?? 0).toFixed(2)} USD. Cat: ${request.category || 'N/A'}.`;
                    break;
                case 'game_recharge':
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
                    <button class="btn-success confirm-request-btn" data-request-id="${requestId}" data-user-id="${request.userId}" data-type="${request.type}" data-amount="${request.amount || 0}" data-currency="${request.currency || ''}" data-serial-number="${request.serialNumber || ''}" data-product-amount="${request.productAmount || 0}" data-product-currency="${request.productCurrency || ''}" data-product-links="${request.productLinks || ''}" data-service="${request.service || ''}" data-account-identifier="${request.accountIdentifier || ''}" data-subscription-amount="${request.subscriptionAmount || 0}" data-subscription-currency="${request.subscriptionCurrency || ''}" data-game-name="${request.gameName || ''}" data-player-id="${request.playerId || ''}" data-recharge-amount="${request.rechargeAmount || 0}" data-recharge-currency="${request.rechargeCurrency || ''}" data-fee-amount="${request.feeAmount || 0}" data-total-amount-to-deduct="${request.totalAmountToDeduct || 0}" data-category="${request.category || ''}" data-savings-goal="${request.savingsGoal || ''}" data-initial-deposit-amount="${request.initialDepositAmount || 0}" data-initial-deposit-currency="${request.initialDepositCurrency || ''}" data-preferred-savings-frequency="${request.preferredSavingsFrequency || ''}" data-periodic-contribution-amount="${request.periodicContributionAmount || 0}" data-start-date="${request.startDate ? request.startDate.seconds * 1000 : ''}" data-end-date="${request.endDate || ''}" ${newAttributes} >Confirmar</button>
                    <button class="btn-danger reject-request-btn" data-request-id="${requestId}" data-user-id="${request.userId}" data-type="${request.type}" >Rechazar</button>
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
            dataset.gameName,
            dataset.playerId,
            parseFloat(dataset.rechargeAmount),
            dataset.rechargeCurrency,
            parseFloat(dataset.feeAmount),
            parseFloat(dataset.totalAmountToDeduct),
            dataset.category,
            dataset.savingsGoal,
            parseFloat(dataset.initialDepositAmount),
            dataset.initialDepositCurrency,
            dataset.preferredSavingsFrequency,
            parseFloat(dataset.periodicContributionAmount),
            dataset.startDate,
            dataset.endDate,
            dataset.senderName, // NUEVO: Atributo para el nombre del remitente del depósito exterior
            dataset.senderBank // NUEVO: Atributo para el banco del remitente del depósito exterior
        );
    } else if (target.classList.contains('reject-request-btn')) {
        await rejectRequest(target.dataset.requestId, target.dataset.type);
    }
});


/**
 * Confirma y procesa una solicitud pendiente.
 * @param {string} requestId El ID del documento de la solicitud en 'pending_requests'.
 * @param {string} type El tipo de solicitud (ej: 'deposit', 'withdrawal', 'online_purchase', 'external_deposit').
 * @param {string} userId El ID del usuario que hizo la solicitud.
 * @param {number} amount El monto principal de la transacción.
 * @param {string} currency La moneda de la transacción.
 * @param {string} serialNumber El número de serie para depósitos.
 * @param {number} productAmount Monto de los productos para compras online.
 * @param {string} productCurrency Moneda de los productos.
 * @param {string} productLinks Enlaces de los productos.
 * @param {string} service Nombre del servicio de streaming.
 * @param {string} accountIdentifier Identificador de la cuenta de streaming.
 * @param {number} subscriptionAmount Monto de la suscripción.
 * @param {string} subscriptionCurrency Moneda de la suscripción.
 * @param {string} gameName Nombre del juego.
 * @param {string} playerId ID del jugador.
 * @param {number} rechargeAmount Monto de la recarga del juego.
 * @param {string} rechargeCurrency Moneda de la recarga del juego.
 * @param {number} feeAmount La tarifa aplicada.
 * @param {number} totalAmountToDeduct El monto total a deducir (incluye tarifa).
 * @param {string} category La categoría de la compra/pago.
 * @param {string} savingsGoal Objetivo de la cuenta de ahorro.
 * @param {number} initialDepositAmount Depósito inicial de la cuenta de ahorro.
 * @param {string} initialDepositCurrency Moneda del depósito inicial.
 * @param {string} preferredSavingsFrequency Frecuencia de ahorro preferida.
 * @param {number} periodicContributionAmount Contribución periódica de ahorro.
 * @param {string} startDate Fecha de inicio de la cuenta de ahorro.
 * @param {string} endDate Fecha de finalización de la cuenta de ahorro.
 * @param {string} senderName Nombre del remitente (para depósitos exteriores).
 * @param {string} senderBank Banco del remitente (para depósitos exteriores).
 */
async function confirmRequest(
    requestId, type, userId, amount, currency, serialNumber,
    productAmount, productCurrency, productLinks,
    service, accountIdentifier, subscriptionAmount, subscriptionCurrency,
    gameName, playerId, rechargeAmount, rechargeCurrency,
    feeAmount, totalAmountToDeduct, category,
    savingsGoal, initialDepositAmount, initialDepositCurrency, preferredSavingsFrequency, periodicContributionAmount, startDate, endDate,
    senderName, senderBank
) {
    console.log(`Confirmando solicitud ID: ${requestId} de tipo: ${type}`);
    const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
    const requestDocRef = doc(db, 'artifacts', appId, 'public', 'pending_requests', requestId);

    try {
        await runTransaction(db, async (transaction) => {
            const userDocSnap = await transaction.get(userDocRef);
            if (!userDocSnap.exists()) {
                throw "El documento del usuario no existe.";
            }
            const userData = userDocSnap.data();

            const requestDocSnap = await transaction.get(requestDocRef);
            if (!requestDocSnap.exists()) {
                throw "El documento de la solicitud no existe.";
            }
            const requestData = requestDocSnap.data();

            // Lógica para actualizar el saldo del usuario según el tipo de solicitud
            let newBalanceUSD = userData.balanceUSD || 0;
            let newBalanceDOP = userData.balanceDOP || 0;

            let transactionDocData = {
                type: type,
                userId: userId,
                usersInvolved: [userId], // Involucra al usuario en la transacción
                timestamp: serverTimestamp(),
                status: 'completed',
                amount: amount,
                currency: currency,
            };

            switch (type) {
                case 'deposit':
                    if (currency === 'USD') {
                        newBalanceUSD += amount;
                    } else if (currency === 'DOP') {
                        newBalanceDOP += amount;
                    }
                    transactionDocData = { ...transactionDocData, serialNumber: serialNumber };
                    break;
                case 'external_deposit': // NUEVO: Lógica para confirmar depósito exterior
                    if (currency === 'USD') {
                        newBalanceUSD += amount;
                    } else if (currency === 'DOP') {
                        newBalanceDOP += amount;
                    }
                    transactionDocData = { ...transactionDocData, senderName, senderBank, serialNumber };
                    break;
                case 'withdrawal':
                    // Ya verificamos el saldo al crear la solicitud, solo actualizamos
                    // El monto del retiro y la tarifa se gestionan en una transacción separada para el administrador
                    newBalanceUSD -= (amount / USD_TO_DOP_RATE); // Se asume que el retiro siempre se hace en USD internamente, aunque el usuario lo pida en DOP
                    
                    // Crea una transacción de tarifa
                    const adminFeeTransaction = {
                        type: 'withdrawal_fee',
                        payerId: userId,
                        receiverId: 'admin',
                        usersInvolved: [userId, 'admin'],
                        amount: feeAmount,
                        currency: 'USD',
                        originalRequestId: requestId,
                        timestamp: serverTimestamp(),
                        status: 'completed'
                    };
                    await addDoc(collection(db, 'artifacts', appId, 'transactions'), adminFeeTransaction);
                    break;
                case 'online_purchase':
                    if (totalAmountToDeduct > newBalanceUSD) {
                        throw "Error: Saldo insuficiente en la cuenta para la compra. Esto no debería suceder si la verificación inicial fue correcta.";
                    }
                    newBalanceUSD -= totalAmountToDeduct;
                    transactionDocData = { ...transactionDocData, productAmount, productCurrency, productLinks, feeAmount, totalAmountDeducted: totalAmountToDeduct, category };
                    break;
                case 'streaming_payment':
                    if (totalAmountToDeduct > newBalanceUSD) {
                        throw "Error: Saldo insuficiente en la cuenta para el pago de streaming. Esto no debería suceder si la verificación inicial fue correcta.";
                    }
                    newBalanceUSD -= totalAmountToDeduct;
                    transactionDocData = { ...transactionDocData, service, accountIdentifier, subscriptionAmount, subscriptionCurrency, feeAmount, totalAmountToDeduct, category };
                    break;
                case 'game_recharge':
                    if (totalAmountToDeduct > newBalanceUSD) {
                        throw "Error: Saldo insuficiente en la cuenta para la recarga de juego. Esto no debería suceder si la verificación inicial fue correcta.";
                    }
                    newBalanceUSD -= totalAmountToDeduct;
                    transactionDocData = { ...transactionDocData, gameName, playerId, rechargeAmount, rechargeCurrency, feeAmount, totalAmountToDeduct, category };
                    break;
                case 'savings_account_open':
                    let initialDepositAmountInUSD = initialDepositAmount;
                    if (initialDepositCurrency === 'DOP') {
                        initialDepositAmountInUSD = initialDepositAmount / USD_TO_DOP_RATE;
                    }
                    if (initialDepositAmountInUSD > newBalanceUSD) {
                        throw "Error: Saldo insuficiente para el depósito inicial de la cuenta de ahorro. Esto no debería suceder si la verificación inicial fue correcta.";
                    }
                    newBalanceUSD -= initialDepositAmountInUSD;

                    // Crea la nueva cuenta de ahorro
                    const savingsAccountRef = doc(collection(db, 'artifacts', appId, 'users', userId, 'savings_accounts'));
                    const savingsAccountId = savingsAccountRef.id;

                    const newSavingsAccountData = {
                        accountId: savingsAccountId,
                        savingsGoal: savingsGoal,
                        balanceUSD: initialDepositAmountInUSD,
                        balanceDOP: 0, // Las cuentas de ahorro se manejan en USD internamente
                        preferredSavingsFrequency: preferredSavingsFrequency,
                        periodicContributionAmount: parseFloat(periodicContributionAmount),
                        startDate: new Date(parseInt(startDate)),
                        endDate: endDate,
                        creationTimestamp: serverTimestamp(),
                        lastContributionAttemptDate: serverTimestamp(),
                        nextContributionDueDate: calculateNextDueDate(new Date(parseInt(startDate)), preferredSavingsFrequency),
                        status: 'active'
                    };
                    transaction.set(savingsAccountRef, newSavingsAccountData);

                    // Actualiza los datos de la transacción para reflejar el depósito inicial
                    transactionDocData = { ...transactionDocData,
                        type: 'savings_account_open',
                        savingsAccountId: savingsAccountId,
                        savingsGoal: savingsGoal,
                        initialDepositAmount: initialDepositAmount,
                        initialDepositCurrency: initialDepositCurrency,
                        preferredSavingsFrequency: preferredSavingsFrequency,
                        periodicContributionAmount: periodicContributionAmount,
                        startDate: new Date(parseInt(startDate)),
                        endDate: endDate
                    };
                    break;
                default:
                    // Si el tipo es desconocido, no hacemos nada con el saldo, pero confirmamos la solicitud para eliminarla
                    break;
            }

            // Actualiza el saldo del usuario
            transaction.update(userDocRef, {
                balanceUSD: newBalanceUSD,
                balanceDOP: newBalanceDOP
            });

            // Elimina la solicitud de la colección 'pending_requests'
            transaction.delete(requestDocRef);

            // Registra la transacción en la colección de transacciones del banco
            const newTransactionDocRef = doc(collection(db, 'artifacts', appId, 'transactions'));
            transaction.set(newTransactionDocRef, transactionDocData);

            console.log(`Solicitud ID: ${requestId} de tipo: ${type} confirmada.`);
        });

        showMessage(`Solicitud confirmada exitosamente. El saldo del usuario ha sido actualizado.`, 'success');
    } catch (error) {
        console.error("Error al confirmar la solicitud:", error);
        showMessage(`Error al confirmar la solicitud: ${error}`, 'error');
    }
}

/**
 * Rechaza una solicitud pendiente.
 * @param {string} requestId El ID del documento de la solicitud en 'pending_requests'.
 * @param {string} requestType El tipo de solicitud rechazada.
 */
async function rejectRequest(requestId, requestType) {
    console.log(`Rechazando solicitud ID: ${requestId} de tipo: ${requestType}`);
    const requestDocRef = doc(db, 'artifacts', appId, 'public', 'pending_requests', requestId);
    try {
        await updateDoc(requestDocRef, {
            status: 'rejected',
            rejectionTimestamp: serverTimestamp()
        });
        showMessage(`Solicitud de ${requestType} rechazada exitosamente.`, 'success');
    } catch (error) {
        console.error("Error al rechazar la solicitud:", error);
        showMessage('Error al rechazar la solicitud. Por favor, inténtalo de nuevo.', 'error');
    }
}

/**
 * Carga y muestra todas las solicitudes pendientes para el usuario actual.
 */
function loadUserPendingRequests() {
    userPendingRequestsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">Cargando solicitudes pendientes...</td></tr>';
    if (!currentUserId) {
        userPendingRequestsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500 py-4">Inicia sesión para ver tus solicitudes.</td></tr>';
        return;
    }
    const pendingRequestsCollectionRef = collection(db, 'artifacts', appId, 'public', 'pending_requests');
    const q = query(pendingRequestsCollectionRef,
        where('userId', '==', currentUserId),
        where('status', '==', 'pending'));

    onSnapshot(q, (snapshot) => {
        userPendingRequestsTableBody.innerHTML = '';
        if (snapshot.empty) {
            userPendingRequestsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">No hay solicitudes pendientes.</td></tr>';
            return;
        }

        snapshot.forEach(docEntry => {
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
                    detailsDisplay = `Serie: ${request.serialNumber}`;
                    break;
                case 'external_deposit':
                    typeDisplay = 'Depósito Exterior';
                    amountDisplay = (request.amount ?? 0).toFixed(2);
                    currencyDisplay = request.currency;
                    detailsDisplay = `Banco: ${request.senderBank || 'N/A'}, Remitente: ${request.senderName || 'N/A'}, Serie: ${request.serialNumber || 'N/A'}`;
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
                    detailsDisplay = `Monto productos: ${(request.productAmount ?? 0).toFixed(2)} ${request.productCurrency}, Tarifa: ${(request.feeAmount ?? 0).toFixed(2)} USD. Cat: ${request.category || 'N/A'}.`;
                    break;
                case 'streaming_payment':
                    typeDisplay = 'Pago Streaming';
                    amountDisplay = (request.totalAmountToDeduct ?? 0).toFixed(2);
                    currencyCurrency = 'USD';
                    detailsDisplay = `Servicio: ${request.service}, Cuenta: ${request.accountIdentifier}, Tarifa: ${(request.feeAmount ?? 0).toFixed(2)} USD. Cat: ${request.category || 'N/A'}.`;
                    break;
                case 'game_recharge':
                    typeDisplay = 'Recarga de Juego';
                    amountDisplay = (request.totalAmountToDeduct ?? 0).toFixed(2);
                    currencyDisplay = 'USD';
                    detailsDisplay = `Juego: ${request.gameName}, ID Jugador: ${request.playerId}, Tarifa: ${(request.feeAmount ?? 0).toFixed(2)} USD. Tipo: ${request.category || 'N/A'}.`;
                    break;
                case 'savings_account_open':
                    typeDisplay = 'Apertura Cta. Ahorro';
                    amountDisplay = (request.initialDepositAmount ?? 0).toFixed(2);
                    currencyCurrency = request.initialDepositCurrency;
                    detailsDisplay = `Objetivo: ${request.savingsGoal}, Frecuencia: ${request.preferredSavingsFrequency}, Cuota: $${(request.periodicContributionAmount ?? 0).toFixed(2)} USD.`;
                    break;
                default:
                    typeDisplay = request.type || 'Desconocido';
                    amountDisplay = (request.amount ?? 0).toFixed(2);
                    currencyDisplay = request.currency || 'N/A';
                    detailsDisplay = 'N/A';
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${requestDate}</td>
                <td>${typeDisplay}</td>
                <td>${amountDisplay}</td>
                <td>${currencyDisplay}</td>
                <td>${detailsDisplay}</td>
                <td><span class="badge bg-yellow-500">Pendiente</span></td>
            `;
            userPendingRequestsTableBody.appendChild(row);
        });
    }, (error) => {
        console.error("Error al cargar las solicitudes pendientes del usuario:", error);
        userPendingRequestsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-4">Error al cargar solicitudes pendientes.</td></tr>`;
    });
}

// --- Funciones del Dashboard y UI ---

/**
 * Actualiza el texto de balance en la interfaz de usuario.
 */
function updateBalanceDisplay() {
    let balanceText = '';
    if (showCurrencyUSD) {
        balanceText = `USD: $${currentBalanceUSD.toFixed(2)}`;
    } else {
        balanceText = `DOP: RD$${currentBalanceDOP.toFixed(2)}`;
    }
    accountBalance.textContent = balanceText;
}

/**
 * Muestra el panel de control del usuario o administrador.
 * @param {Object} userData Datos del usuario de Firestore.
 */
function showDashboard(userData) {
    dashboardUserName.textContent = `${userData.name} ${userData.surname}`;
    dashboardDisplayId.textContent = `ID de Usuario: ${userData.userDisplayId || userData.userId}`;
    currentBalanceUSD = userData.balanceUSD;
    currentBalanceDOP = userData.balanceDOP;
    updateBalanceDisplay();
    updateProfileAvatar(userData.name); // Actualiza el avatar del perfil
    showAnnouncements(); // Muestra los anuncios
    showSection(dashboardSection, loginSection, registerSection);

    // Muestra los botones de administrador si el usuario es admin
    if (userData.isAdmin) {
        adminButtonsContainer.classList.remove('hidden');
    } else {
        adminButtonsContainer.classList.add('hidden');
    }
}

/**
 * Actualiza el avatar de perfil con la primera letra del nombre.
 * @param {string} name El nombre del usuario.
 */
function updateProfileAvatar(name) {
    if (name && name.length > 0) {
        profileAvatar.textContent = name.charAt(0).toUpperCase();
        profileAvatar.classList.remove('bg-gray-300'); // Quita el color de fondo por defecto
        profileAvatar.classList.add('bg-blue-500', 'text-white'); // Añade colores para el avatar
    } else {
        profileAvatar.textContent = '?';
        profileAvatar.classList.add('bg-gray-300', 'text-gray-600');
    }
}

/**
 * Intenta encontrar el nombre de visualización de un usuario en caché o en Firestore.
 * @param {string} userId El UID del usuario.
 * @returns {Promise<string>} El nombre de visualización del usuario o un marcador de posición.
 */
async function getUserDisplayName(userId) {
    if (userId === 'admin') {
        return 'Administrador';
    }
    if (userDisplayNamesCache[userId]) {
        return userDisplayNamesCache[userId];
    }
    if (userId) {
        try {
            const userDocSnap = await getDoc(doc(db, 'artifacts', appId, 'users', userId));
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                const displayName = `${userData.name} ${userData.surname}`;
                userDisplayNamesCache[userId] = displayName;
                return displayName;
            }
        } catch (error) {
            console.error("Error al obtener el nombre del usuario:", error);
        }
    }
    return 'Usuario Desconocido';
}

/**
 * Carga el historial completo para el administrador y lo muestra en un modal.
 */
async function loadAdminFullHistory() {
    adminFullHistoryTableBodyModal.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">Cargando historial completo...</td></tr>';
    const transactionsCollectionRef = collection(db, 'artifacts', appId, 'transactions');
    try {
        const querySnapshot = await getDocs(transactionsCollectionRef);
        adminFullHistoryTableBodyModal.innerHTML = '';
        if (querySnapshot.empty) {
            adminFullHistoryTableBodyModal.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">No hay historial de transacciones.</td></tr>';
            return;
        }

        const transactions = [];
        for (const docEntry of querySnapshot.docs) {
            const transaction = docEntry.data();
            transactions.push({ id: docEntry.id, ...transaction });
        }
        // Ordena las transacciones por marca de tiempo, la más reciente primero
        transactions.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);

        for (const transaction of transactions) {
            const date = (transaction.timestamp && typeof transaction.timestamp.seconds !== 'undefined') ? new Date(transaction.timestamp.seconds * 1000).toLocaleString() : 'Fecha no disponible';
            const usersInvolved = transaction.usersInvolved || [];
            const userNames = [];
            for (const userId of usersInvolved) {
                userNames.push(await getUserDisplayName(userId));
            }
            const type = transaction.type || 'Desconocido';
            const amount = (transaction.amount ?? 0).toFixed(2);
            const currency = transaction.currency || 'N/A';
            const details = transaction.details || 'N/A'; // Usar un campo de detalles si existe, o construir uno

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date}</td>
                <td>${type}</td>
                <td>${userNames.join(', ')}</td>
                <td class="text-right">${amount}</td>
                <td>${currency}</td>
                <td>${details}</td>
                <td>
                    <button class="btn-info btn-sm view-receipt-btn" data-transaction-id="${transaction.id}">Ver Recibo</button>
                </td>
            `;
            adminFullHistoryTableBodyModal.appendChild(row);
        }
    } catch (error) {
        console.error("Error al cargar el historial completo del administrador:", error);
        adminFullHistoryTableBodyModal.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 py-4">Error al cargar el historial.</td></tr>`;
    }
}

/**
 * Carga los datos del perfil del usuario para el formulario de edición.
 */
async function loadEditProfileData() {
    if (!currentUserId) return;
    try {
        const userDocSnap = await getDoc(doc(db, 'artifacts', appId, 'users', currentUserId));
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            editNameInput.value = userData.name || '';
            editSurnameInput.value = userData.surname || '';
            editAgeInput.value = userData.age || '';
            editPhoneNumberInput.value = userData.phoneNumber || '';
        }
    } catch (error) {
        console.error("Error al cargar los datos del perfil para editar:", error);
        showMessage("Error al cargar los datos del perfil.", "error");
    }
}

// Envío del formulario de edición de perfil
editProfileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    if (!currentUserId) return;
    const newName = editNameInput.value.trim();
    const newSurname = editSurnameInput.value.trim();
    const newAge = parseInt(editAgeInput.value);
    const newPhoneNumber = editPhoneNumberInput.value.trim();

    if (!newName || !newSurname || isNaN(newAge) || newAge < 13 || !newPhoneNumber) {
        showMessage('Por favor, completa todos los campos correctamente.', 'error');
        return;
    }

    try {
        await updateDoc(doc(db, 'artifacts', appId, 'users', currentUserId), {
            name: newName,
            surname: newSurname,
            age: newAge,
            phoneNumber: newPhoneNumber
        });
        showMessage('Perfil actualizado exitosamente.', 'success');
        closeModal(editProfileModal);
        // Actualiza la visualización del dashboard inmediatamente
        dashboardUserName.textContent = `${newName} ${newSurname}`;
        updateProfileAvatar(newName);
    } catch (error) {
        console.error("Error al actualizar el perfil:", error);
        showMessage('Error al actualizar el perfil. Por favor, inténtalo de nuevo.', 'error');
    }
});

// Envío del formulario de cambio de contraseña
changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmNewPassword = confirmNewPasswordInput.value;

    if (newPassword !== confirmNewPassword) {
        showMessage('Las nuevas contraseñas no coinciden.', 'error');
        return;
    }
    if (newPassword.length < 6) {
        showMessage('La nueva contraseña debe tener al menos 6 caracteres.', 'error');
        return;
    }

    const user = auth.currentUser;
    const credential = EmailAuthProvider.credential(user.email, currentPassword);

    try {
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        showMessage('Contraseña actualizada exitosamente.', 'success');
        closeModal(changePasswordModal);
        changePasswordForm.reset();
    } catch (error) {
        console.error("Error al cambiar la contraseña:", error);
        if (error.code === 'auth/wrong-password') {
            showMessage('La contraseña actual es incorrecta.', 'error');
        } else {
            showMessage('Error al cambiar la contraseña. Inténtalo de nuevo.', 'error');
        }
    }
});


// --- Funciones para Cuentas de Ahorro ---
/**
 * Carga las cuentas de ahorro del usuario y las muestra en una tabla.
 */
async function loadUserSavingsAccounts() {
    if (!currentUserId) {
        savingsAccountsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">Inicia sesión para ver tus cuentas de ahorro.</td></tr>';
        return;
    }

    savingsAccountsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">Cargando cuentas de ahorro...</td></tr>';
    const savingsCollectionRef = collection(db, 'artifacts', appId, 'users', currentUserId, 'savings_accounts');
    const q = query(savingsCollectionRef, where('status', '==', 'active'));

    try {
        const querySnapshot = await getDocs(q);
        savingsAccountsTableBody.innerHTML = '';
        if (querySnapshot.empty) {
            savingsAccountsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">No tienes cuentas de ahorro activas.</td></tr>';
            return;
        }

        querySnapshot.forEach(docEntry => {
            const account = docEntry.data();
            const accountId = docEntry.id;
            const startDate = account.startDate ? new Date(account.startDate.seconds * 1000).toLocaleDateString() : 'N/A';
            const endDate = account.endDate || 'N/A';
            const nextDueDate = account.nextContributionDueDate ? new Date(account.nextContributionDueDate.seconds * 1000).toLocaleDateString() : 'N/A';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${account.savingsGoal || 'N/A'}</td>
                <td class="text-right">$${(account.balanceUSD ?? 0).toFixed(2)} USD</td>
                <td>${account.preferredSavingsFrequency || 'N/A'}</td>
                <td>$${(account.periodicContributionAmount ?? 0).toFixed(2)} USD</td>
                <td>${nextDueDate}</td>
                <td>${endDate}</td>
                <td class="whitespace-nowrap">
                    <button class="btn-success btn-sm deposit-to-savings-btn" data-account-id="${accountId}">Depositar</button>
                    <button class="btn-warning btn-sm withdraw-from-savings-btn" data-account-id="${accountId}" data-balance-usd="${account.balanceUSD}">Retirar</button>
                    <button class="btn-danger btn-sm delete-savings-account-btn" data-account-id="${accountId}" data-goal="${account.savingsGoal}" data-balance-usd="${account.balanceUSD}">Eliminar</button>
                </td>
            `;
            savingsAccountsTableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error al cargar las cuentas de ahorro:", error);
        savingsAccountsTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 py-4">Error al cargar cuentas de ahorro.</td></tr>`;
    }
}

/**
 * Carga las deudas de ahorro del usuario y las muestra en una tabla.
 */
function loadUserSavingsDebts() {
    if (!currentUserId) {
        savingsDebtsTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">Inicia sesión para ver tus deudas.</td></tr>';
        return;
    }

    if (savingsDebtsUnsubscribe) {
        savingsDebtsUnsubscribe();
        savingsDebtsUnsubscribe = null;
    }

    savingsDebtsTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">Cargando deudas de ahorro...</td></tr>';
    const debtsCollectionRef = collection(db, 'artifacts', appId, 'users', currentUserId, 'savings_debts');
    const q = query(debtsCollectionRef, where('status', '==', 'active'));

    savingsDebtsUnsubscribe = onSnapshot(q, async (snapshot) => {
        savingsDebtsTableBody.innerHTML = '';
        if (snapshot.empty) {
            savingsDebtsTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">No tienes deudas de ahorro pendientes.</td></tr>';
            return;
        }

        for (const docEntry of snapshot.docs) {
            const debt = docEntry.data();
            const debtId = docEntry.id;
            const savingsGoal = debt.savingsGoal || 'N/A';
            const amountOwed = (debt.amountOwed ?? 0).toFixed(2);
            const dueDate = debt.dueDate ? new Date(debt.dueDate.seconds * 1000).toLocaleDateString() : 'N/A';
            const dateCreated = debt.creationTimestamp ? new Date(debt.creationTimestamp.seconds * 1000).toLocaleDateString() : 'N/A';
            const indemnizationAmount = (debt.indemnizationAmount ?? 0).toFixed(2);
            const totalToPay = (parseFloat(amountOwed) + parseFloat(indemnizationAmount)).toFixed(2);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${savingsGoal}</td>
                <td class="text-right">$${amountOwed} USD</td>
                <td class="text-right">$${indemnizationAmount} USD</td>
                <td class="text-right">$${totalToPay} USD</td>
                <td>${dueDate}</td>
                <td>
                    <button class="btn-success btn-sm pay-debt-btn" data-debt-id="${debtId}" data-amount="${totalToPay}">Pagar</button>
                </td>
            `;
            savingsDebtsTableBody.appendChild(row);
        }
    }, (error) => {
        console.error("Error al cargar las deudas de ahorro del usuario:", error);
        savingsDebtsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-4">Error al cargar deudas.</td></tr>`;
    });
}

/**
 * Carga las deudas de ahorro de todos los usuarios para el administrador y las muestra en una tabla.
 */
function loadAdminSavingsDebts() {
    if (adminSavingsDebtsUnsubscribe) {
        adminSavingsDebtsUnsubscribe();
        adminSavingsDebtsUnsubscribe = null;
    }

    adminSavingsDebtsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">Cargando deudas de ahorro del administrador...</td></tr>';
    const allUsersRef = collection(db, 'artifacts', appId, 'users');
    // Esto es un enfoque simplificado. Un enfoque más eficiente sería tener una colección central de deudas.
    getDocs(allUsersRef).then(async (userSnapshots) => {
        adminSavingsDebtsTableBody.innerHTML = '';
        let allDebts = [];
        for (const userDoc of userSnapshots.docs) {
            const userId = userDoc.id;
            const userName = await getUserDisplayName(userId);
            const debtsRef = collection(db, 'artifacts', appId, 'users', userId, 'savings_debts');
            const q = query(debtsRef, where('status', '==', 'active'));
            const debtSnapshots = await getDocs(q);
            debtSnapshots.forEach(debtDoc => {
                const debt = debtDoc.data();
                allDebts.push({ ...debt, debtId: debtDoc.id, userId, userName });
            });
        }

        if (allDebts.length === 0) {
            adminSavingsDebtsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">No hay deudas de ahorro pendientes.</td></tr>';
            return;
        }

        for (const debt of allDebts) {
            const amountOwed = (debt.amountOwed ?? 0).toFixed(2);
            const indemnizationAmount = (debt.indemnizationAmount ?? 0).toFixed(2);
            const totalToPay = (parseFloat(amountOwed) + parseFloat(indemnizationAmount)).toFixed(2);
            const dueDate = debt.dueDate ? new Date(debt.dueDate.seconds * 1000).toLocaleDateString() : 'N/A';
            const dateCreated = debt.creationTimestamp ? new Date(debt.creationTimestamp.seconds * 1000).toLocaleDateString() : 'N/A';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${debt.userName}</td>
                <td>${debt.savingsGoal || 'N/A'}</td>
                <td class="text-right">$${amountOwed} USD</td>
                <td class="text-right">$${indemnizationAmount} USD</td>
                <td class="text-right">$${totalToPay} USD</td>
                <td>${dueDate}</td>
                <td><span class="badge bg-red-500">Activa</span></td>
            `;
            adminSavingsDebtsTableBody.appendChild(row);
        }
    }).catch(error => {
        console.error("Error al cargar las deudas del administrador:", error);
        adminSavingsDebtsTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 py-4">Error al cargar deudas.</td></tr>`;
    });
}

// Delegación de eventos para botones de cuenta de ahorro
savingsAccountsTableBody.addEventListener('click', (event) => {
    const target = event.target;
    if (target.classList.contains('deposit-to-savings-btn')) {
        currentSavingsAccountId = target.dataset.accountId;
        depositToSavingsAccountIdDisplay.textContent = `ID de Cuenta: ${currentSavingsAccountId.substring(0, 8)}...`;
        showSection(depositToSavingsModal);
        depositToSavingsForm.reset();
    } else if (target.classList.contains('withdraw-from-savings-btn')) {
        currentSavingsAccountId = target.dataset.accountId;
        currentSavingsAccountBalanceUSD = parseFloat(target.dataset.balanceUsd);
        withdrawFromSavingsAccountIdDisplay.textContent = `ID de Cuenta: ${currentSavingsAccountId.substring(0, 8)}...`;
        showSection(withdrawFromSavingsModal);
        withdrawFromSavingsForm.reset();
    } else if (target.classList.contains('delete-savings-account-btn')) {
        currentSavingsAccountId = target.dataset.accountId;
        currentSavingsAccountGoal = target.dataset.goal;
        currentSavingsAccountBalanceUSD = parseFloat(target.dataset.balanceUsd);
        const fee = currentSavingsAccountBalanceUSD * SAVINGS_DELETE_FEE_RATE;
        const remainingBalance = currentSavingsAccountBalanceUSD - fee;

        deleteSavingsAccountGoalDisplay.textContent = `Objetivo de Ahorro: ${currentSavingsAccountGoal}`;
        deleteSavingsAccountFeeDisplay.textContent = `Tarifa de Eliminación (2%): $${fee.toFixed(2)} USD`;
        deleteSavingsAccountRemainingDisplay.textContent = `Saldo restante a transferir: $${remainingBalance.toFixed(2)} USD`;
        showSection(confirmDeleteSavingsAccountModal);
    }
});

// Delegación de eventos para el botón de pago de deuda
savingsDebtsTableBody.addEventListener('click', async (event) => {
    const target = event.target;
    if (target.classList.contains('pay-debt-btn')) {
        const debtId = target.dataset.debtId;
        const amountToPay = parseFloat(target.dataset.amount);
        if (currentBalanceUSD >= amountToPay) {
            try {
                await paySavingsDebt(currentUserId, debtId, amountToPay);
                showMessage(`Deuda de ahorro pagada exitosamente.`, 'success');
            } catch (error) {
                console.error("Error al pagar la deuda de ahorro:", error);
                showMessage(`Error al pagar la deuda: ${error}`, 'error');
            }
        } else {
            showMessage(`Saldo insuficiente para pagar la deuda. Necesitas $${amountToPay.toFixed(2)} USD.`, 'error');
        }
    }
});

// Lógica de formulario de depósitos de ahorro
depositToSavingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const amount = parseFloat(depositToSavingsAmountInput.value);
    const currency = depositToSavingsCurrencyInput.value;

    if (isNaN(amount) || amount <= 0) {
        showMessage('Por favor, ingresa un monto válido.', 'error');
        return;
    }

    try {
        await handleSavingsDeposit(currentSavingsAccountId, amount, currency);
        showMessage('Depósito a cuenta de ahorro realizado exitosamente.', 'success');
        closeModal(depositToSavingsModal);
        loadUserSavingsAccounts();
    } catch (error) {
        console.error("Error al depositar en la cuenta de ahorro:", error);
        showMessage(`Error al depositar: ${error}`, 'error');
    }
});

// Lógica de formulario de retiros de ahorro
withdrawFromSavingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const amount = parseFloat(withdrawFromSavingsAmountInput.value);
    const currency = withdrawFromSavingsCurrencyInput.value;

    if (isNaN(amount) || amount <= 0) {
        showMessage('Por favor, ingresa un monto válido.', 'error');
        return;
    }

    let amountInUSD = amount;
    if (currency === 'DOP') {
        amountInUSD = amount / USD_TO_DOP_RATE;
    }

    if (amountInUSD > currentSavingsAccountBalanceUSD) {
        showMessage('Saldo insuficiente en la cuenta de ahorro para este retiro.', 'error');
        return;
    }

    try {
        await handleSavingsWithdrawal(currentSavingsAccountId, amount, currency, amountInUSD);
        showMessage('Retiro de cuenta de ahorro realizado exitosamente.', 'success');
        closeModal(withdrawFromSavingsModal);
        loadUserSavingsAccounts();
    }
    catch (error) {
        console.error("Error al retirar de la cuenta de ahorro:", error);
        showMessage(`Error al retirar: ${error}`, 'error');
    }
});

// Lógica de eliminación de cuenta de ahorro
confirmDeleteSavingsAccountBtn.addEventListener('click', async () => {
    try {
        await deleteSavingsAccount(currentSavingsAccountId, currentSavingsAccountBalanceUSD);
        showMessage('Cuenta de ahorro eliminada exitosamente.', 'success');
        closeModal(confirmDeleteSavingsAccountModal);
        loadUserSavingsAccounts();
    } catch (error) {
        console.error("Error al eliminar la cuenta de ahorro:", error);
        showMessage(`Error al eliminar la cuenta de ahorro: ${error}`, 'error');
    }
});
cancelDeleteSavingsAccountBtn.addEventListener('click', () => closeModal(confirmDeleteSavingsAccountModal));
cancelDeleteSavingsAccountBtn2.addEventListener('click', () => closeModal(confirmDeleteSavingsAccountModal));


/**
 * Maneja el proceso de depósito a una cuenta de ahorro.
 * @param {string} savingsAccountId El ID de la cuenta de ahorro.
 * @param {number} amount El monto a depositar.
 * @param {string} currency La moneda del depósito.
 */
async function handleSavingsDeposit(savingsAccountId, amount, currency) {
    if (!currentUserId) throw "Usuario no autenticado.";

    const userDocRef = doc(db, 'artifacts', appId, 'users', currentUserId);
    const savingsAccountDocRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'savings_accounts', savingsAccountId);

    await runTransaction(db, async (transaction) => {
        const userDocSnap = await transaction.get(userDocRef);
        const savingsAccountDocSnap = await transaction.get(savingsAccountDocRef);

        if (!userDocSnap.exists()) throw "Documento de usuario no encontrado.";
        if (!savingsAccountDocSnap.exists()) throw "Documento de cuenta de ahorro no encontrado.";

        const userData = userDocSnap.data();
        const savingsAccountData = savingsAccountDocSnap.data();

        let amountInUSD = amount;
        if (currency === 'DOP') {
            amountInUSD = amount / USD_TO_DOP_RATE;
        }

        if (userData.balanceUSD < amountInUSD) {
            throw "Saldo insuficiente en tu cuenta principal.";
        }

        // Actualizar saldos
        const newMainBalanceUSD = userData.balanceUSD - amountInUSD;
        const newSavingsBalanceUSD = savingsAccountData.balanceUSD + amountInUSD;

        transaction.update(userDocRef, {
            balanceUSD: newMainBalanceUSD
        });
        transaction.update(savingsAccountDocRef, {
            balanceUSD: newSavingsBalanceUSD
        });

        // Registrar transacción
        const newTransactionDocRef = doc(collection(db, 'artifacts', appId, 'transactions'));
        transaction.set(newTransactionDocRef, {
            type: 'deposit_to_savings',
            userId: currentUserId,
            usersInvolved: [currentUserId],
            timestamp: serverTimestamp(),
            status: 'completed',
            amount: amount,
            currency: currency,
            savingsAccountId: savingsAccountId,
            savingsGoal: savingsAccountData.savingsGoal
        });
    });
}

/**
 * Maneja el proceso de retiro de una cuenta de ahorro.
 * @param {string} savingsAccountId El ID de la cuenta de ahorro.
 * @param {number} amount El monto a retirar.
 * @param {string} currency La moneda del retiro.
 * @param {number} amountInUSD El monto en USD ya convertido.
 */
async function handleSavingsWithdrawal(savingsAccountId, amount, currency, amountInUSD) {
    if (!currentUserId) throw "Usuario no autenticado.";

    const userDocRef = doc(db, 'artifacts', appId, 'users', currentUserId);
    const savingsAccountDocRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'savings_accounts', savingsAccountId);

    await runTransaction(db, async (transaction) => {
        const userDocSnap = await transaction.get(userDocRef);
        const savingsAccountDocSnap = await transaction.get(savingsAccountDocRef);

        if (!userDocSnap.exists()) throw "Documento de usuario no encontrado.";
        if (!savingsAccountDocSnap.exists()) throw "Documento de cuenta de ahorro no encontrado.";

        const userData = userDocSnap.data();
        const savingsAccountData = savingsAccountDocSnap.data();

        if (savingsAccountData.balanceUSD < amountInUSD) {
            throw "Saldo insuficiente en la cuenta de ahorro.";
        }

        // Actualizar saldos
        const newMainBalanceUSD = userData.balanceUSD + amountInUSD;
        const newSavingsBalanceUSD = savingsAccountData.balanceUSD - amountInUSD;

        transaction.update(userDocRef, {
            balanceUSD: newMainBalanceUSD
        });
        transaction.update(savingsAccountDocRef, {
            balanceUSD: newSavingsBalanceUSD
        });

        // Registrar transacción
        const newTransactionDocRef = doc(collection(db, 'artifacts', appId, 'transactions'));
        transaction.set(newTransactionDocRef, {
            type: 'withdraw_from_savings',
            userId: currentUserId,
            usersInvolved: [currentUserId],
            timestamp: serverTimestamp(),
            status: 'completed',
            amount: amount,
            currency: currency,
            savingsAccountId: savingsAccountId,
            savingsGoal: savingsAccountData.savingsGoal
        });
    });
}

/**
 * Elimina una cuenta de ahorro y transfiere el saldo restante a la cuenta principal.
 * @param {string} savingsAccountId El ID de la cuenta de ahorro a eliminar.
 * @param {number} savingsBalanceUSD El saldo de la cuenta de ahorro en USD.
 */
async function deleteSavingsAccount(savingsAccountId, savingsBalanceUSD) {
    if (!currentUserId) throw "Usuario no autenticado.";

    const userDocRef = doc(db, 'artifacts', appId, 'users', currentUserId);
    const savingsAccountDocRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'savings_accounts', savingsAccountId);

    await runTransaction(db, async (transaction) => {
        const userDocSnap = await transaction.get(userDocRef);
        const savingsAccountDocSnap = await transaction.get(savingsAccountDocRef);

        if (!userDocSnap.exists()) throw "Documento de usuario no encontrado.";
        if (!savingsAccountDocSnap.exists()) throw "Documento de cuenta de ahorro no encontrado.";

        const userData = userDocSnap.data();
        const savingsAccountData = savingsAccountDocSnap.data();

        const feeAmount = savingsBalanceUSD * SAVINGS_DELETE_FEE_RATE;
        const remainingBalance = savingsBalanceUSD - feeAmount;

        // Actualizar saldos
        const newMainBalanceUSD = userData.balanceUSD + remainingBalance;
        transaction.update(userDocRef, {
            balanceUSD: newMainBalanceUSD
        });

        // Desactivar la cuenta de ahorro en lugar de eliminarla para mantener el historial
        transaction.update(savingsAccountDocRef, {
            status: 'deleted',
            balanceUSD: 0,
            deletionTimestamp: serverTimestamp()
        });

        // Registrar transacción de eliminación
        const newTransactionDocRef = doc(collection(db, 'artifacts', appId, 'transactions'));
        transaction.set(newTransactionDocRef, {
            type: 'delete_savings_account',
            userId: currentUserId,
            usersInvolved: [currentUserId],
            timestamp: serverTimestamp(),
            status: 'completed',
            savingsAccountId: savingsAccountId,
            savingsGoal: savingsAccountData.savingsGoal,
            feeAmount: feeAmount,
            remainingBalanceTransferred: remainingBalance
        });
    });
}

/**
 * Paga una deuda de ahorro.
 * @param {string} userId El ID del usuario.
 * @param {string} debtId El ID de la deuda.
 * @param {number} amountToPay El monto total a pagar.
 */
async function paySavingsDebt(userId, debtId, amountToPay) {
    const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
    const debtDocRef = doc(db, 'artifacts', appId, 'users', userId, 'savings_debts', debtId);
    
    await runTransaction(db, async (transaction) => {
        const userDocSnap = await transaction.get(userDocRef);
        const debtDocSnap = await transaction.get(debtDocRef);

        if (!userDocSnap.exists()) throw "Documento de usuario no encontrado.";
        if (!debtDocSnap.exists()) throw "Documento de deuda no encontrado.";

        const userData = userDocSnap.data();
        const debtData = debtDocSnap.data();

        if (userData.balanceUSD < amountToPay) {
            throw "Saldo insuficiente en tu cuenta principal.";
        }
        
        // Actualizar saldos
        const newMainBalanceUSD = userData.balanceUSD - amountToPay;
        transaction.update(userDocRef, {
            balanceUSD: newMainBalanceUSD
        });

        // Marcar la deuda como pagada
        transaction.update(debtDocRef, {
            status: 'paid',
            paidTimestamp: serverTimestamp()
        });

        // Registrar transacción de pago de deuda
        const newTransactionDocRef = doc(collection(db, 'artifacts', appId, 'transactions'));
        transaction.set(newTransactionDocRef, {
            type: 'savings_debt_payment',
            userId: userId,
            usersInvolved: [userId],
            timestamp: serverTimestamp(),
            status: 'completed',
            amount: amountToPay,
            currency: 'USD',
            debtId: debtId,
            savingsAccountId: debtData.savingsAccountId,
            savingsGoal: debtData.savingsGoal
        });
    });
}


// --- Funciones de Anuncios del Administrador ---

/**
 * Carga los anuncios para el formulario de edición del administrador.
 */
async function loadAnnouncementsForEdit() {
    try {
        const announcementsDocRef = doc(db, 'artifacts', appId, 'public', 'announcements');
        const docSnap = await getDoc(announcementsDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            announcementsTextarea.value = data.text || '';
        } else {
            announcementsTextarea.value = '';
        }
    } catch (error) {
        console.error("Error al cargar los anuncios:", error);
        showMessage("Error al cargar los anuncios para editar.", "error");
    }
}

/**
 * Muestra los anuncios en el dashboard del usuario.
 */
function showAnnouncements() {
    announcementsList.innerHTML = '';
    const announcementsDocRef = doc(db, 'artifacts', appId, 'public', 'announcements');
    onSnapshot(announcementsDocRef, (docSnap) => {
        announcementsList.innerHTML = ''; // Limpiar la lista para evitar duplicados
        if (docSnap.exists()) {
            const data = docSnap.data();
            const announcementsText = data.text || '';
            if (announcementsText.trim()) {
                const lines = announcementsText.split('\n');
                lines.forEach(line => {
                    const li = document.createElement('li');
                    li.textContent = line;
                    li.classList.add('py-1');
                    announcementsList.appendChild(li);
                });
            } else {
                announcementsList.innerHTML = '<li class="text-gray-500">No hay anuncios disponibles.</li>';
            }
        } else {
            announcementsList.innerHTML = '<li class="text-gray-500">No hay anuncios disponibles.</li>';
        }
    }, (error) => {
        console.error("Error al obtener anuncios:", error);
        announcementsList.innerHTML = '<li class="text-red-500">Error al cargar anuncios.</li>';
    });
}

// Envío del formulario de edición de anuncios
editAnnouncementsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    const newAnnouncementsText = announcementsTextarea.value;
    try {
        const announcementsDocRef = doc(db, 'artifacts', appId, 'public', 'announcements');
        await setDoc(announcementsDocRef, { text: newAnnouncementsText }, { merge: true });
        showMessage('Anuncios actualizados exitosamente.', 'success');
        closeModal(editAnnouncementsModal);
    } catch (error) {
        console.error("Error al actualizar los anuncios:", error);
        showMessage('Error al actualizar los anuncios. Por favor, inténtalo de nuevo.', 'error');
    }
});


// --- Funciones de Comprobación y Mantenimiento ---

/**
 * Revisa y actualiza el estado de las deudas de ahorro y aplica indemnizaciones.
 */
async function checkAndProcessSavingsDebts() {
    // Esta función se ejecutaría idealmente en un entorno del servidor (Cloud Function)
    // para asegurar que se ejecuta de manera confiable.
    const allUsersRef = collection(db, 'artifacts', appId, 'users');
    const userSnapshots = await getDocs(allUsersRef);

    for (const userDoc of userSnapshots.docs) {
        const userId = userDoc.id;
        const userDocRef = userDoc.ref;
        const userBalanceUSD = userDoc.data().balanceUSD;
        const debtsRef = collection(userDocRef, 'savings_debts');
        const q = query(debtsRef, where('status', '==', 'active'));
        const debtSnapshots = await getDocs(q);

        for (const debtDoc of debtSnapshots.docs) {
            const debtId = debtDoc.id;
            const debtData = debtDoc.data();
            const dueDate = debtData.dueDate.toDate();
            
            if (new Date() > dueDate) {
                // La deuda está vencida, aplica la indemnización si no se ha aplicado
                if (!debtData.indemnizationApplied) {
                    const indemnizationAmount = debtData.amountOwed * INDEMNIZATION_RATE;
                    const newDebtAmount = debtData.amountOwed + indemnizationAmount;

                    // Aplica la indemnización y actualiza la deuda
                    await updateDoc(debtDoc.ref, {
                        amountOwed: newDebtAmount,
                        indemnizationAmount: indemnizationAmount,
                        indemnizationApplied: true,
                        status: 'overdue' // Cambiar el estado a vencido
                    });

                    // Crea una transacción para la indemnización
                    const transactionRef = doc(collection(db, 'artifacts', appId, 'transactions'));
                    await setDoc(transactionRef, {
                        type: 'savings_indemnization_applied',
                        payerId: userId,
                        receiverId: 'admin',
                        usersInvolved: [userId, 'admin'],
                        amount: indemnizationAmount,
                        currency: 'USD',
                        debtId: debtId,
                        timestamp: serverTimestamp(),
                        status: 'completed'
                    });

                    // Deduce la indemnización del saldo del usuario si es posible
                    if (userBalanceUSD >= indemnizationAmount) {
                        await updateDoc(userDocRef, {
                            balanceUSD: userBalanceUSD - indemnizationAmount
                        });
                        console.log(`Indemnización de $${indemnizationAmount} USD aplicada y deducida del usuario ${userId}.`);
                    } else {
                        // Si el usuario no tiene fondos, la deuda simplemente se registra
                        console.log(`Indemnización de $${indemnizationAmount} USD aplicada al usuario ${userId}, pero no se pudo deducir por falta de fondos.`);
                    }
                }
            }
        }
    }
}

/**
 * Revisa y realiza cobros automáticos de las cuentas de ahorro.
 */
async function checkAndProcessSavingsCollections() {
    // Esta función también debería ejecutarse en el servidor.
    const allUsersRef = collection(db, 'artifacts', appId, 'users');
    const userSnapshots = await getDocs(allUsersRef);

    for (const userDoc of userSnapshots.docs) {
        const userId = userDoc.id;
        const userDocRef = userDoc.ref;
        const userData = userDoc.data();
        const userBalanceUSD = userData.balanceUSD;

        const savingsAccountsRef = collection(userDocRef, 'savings_accounts');
        const activeSavingsQ = query(savingsAccountsRef, where('status', '==', 'active'));
        const savingsSnapshots = await getDocs(activeSavingsQ);

        for (const savingsDoc of savingsSnapshots.docs) {
            const savingsData = savingsDoc.data();
            const savingsAccountId = savingsDoc.id;
            const nextDueDate = savingsData.nextContributionDueDate ? savingsData.nextContributionDueDate.toDate() : null;
            const contributionAmount = savingsData.periodicContributionAmount;

            if (nextDueDate && new Date() > nextDueDate) {
                if (userBalanceUSD >= contributionAmount) {
                    // Cobro exitoso
                    const newMainBalanceUSD = userBalanceUSD - contributionAmount;
                    const newSavingsBalanceUSD = savingsData.balanceUSD + contributionAmount;
                    const newNextDueDate = calculateNextDueDate(nextDueDate, savingsData.preferredSavingsFrequency);

                    await runTransaction(db, async (transaction) => {
                        transaction.update(userDocRef, { balanceUSD: newMainBalanceUSD });
                        transaction.update(savingsDoc.ref, {
                            balanceUSD: newSavingsBalanceUSD,
                            lastContributionAttemptDate: serverTimestamp(),
                            nextContributionDueDate: newNextDueDate
                        });
                        const transactionRef = doc(collection(db, 'artifacts', appId, 'transactions'));
                        transaction.set(transactionRef, {
                            type: 'automatic_savings_collection',
                            userId: userId,
                            usersInvolved: [userId],
                            timestamp: serverTimestamp(),
                            status: 'completed',
                            amount: contributionAmount,
                            currency: 'USD',
                            savingsAccountId: savingsAccountId,
                            savingsGoal: savingsData.savingsGoal
                        });
                    });
                    console.log(`Cobro automático de ahorro exitoso para el usuario ${userId} en la cuenta ${savingsAccountId}.`);
                } else {
                    // Saldo insuficiente, crea una deuda
                    const debtDocRef = doc(collection(userDocRef, 'savings_debts'));
                    const newNextDueDate = calculateNextDueDate(nextDueDate, savingsData.preferredSavingsFrequency);
                    
                    await runTransaction(db, async (transaction) => {
                        transaction.set(debtDocRef, {
                            savingsAccountId: savingsAccountId,
                            savingsGoal: savingsData.savingsGoal,
                            amountOwed: contributionAmount,
                            indemnizationAmount: 0,
                            creationTimestamp: serverTimestamp(),
                            dueDate: newNextDueDate,
                            status: 'active',
                            indemnizationApplied: false
                        });
                        transaction.update(savingsDoc.ref, {
                            lastContributionAttemptDate: serverTimestamp(),
                            nextContributionDueDate: newNextDueDate
                        });
                    });
                    console.log(`Saldo insuficiente para cobro automático. Deuda creada para el usuario ${userId} en la cuenta ${savingsAccountId}.`);
                }
            }
        }
    }
}


/**
 * Calcula la próxima fecha de vencimiento de una contribución de ahorro.
 * @param {Date} startDate La fecha de inicio o la última fecha de vencimiento.
 * @param {string} frequency La frecuencia ('daily', 'weekly', 'monthly').
 * @returns {Date} La próxima fecha de vencimiento.
 */
function calculateNextDueDate(startDate, frequency) {
    const today = new Date();
    let nextDate = new Date(startDate);
    
    // Si la fecha de inicio es en el pasado, la próxima fecha de vencimiento debe ser hoy o más tarde.
    if (nextDate < today) {
        let tempDate = new Date(startDate);
        while (tempDate < today) {
            switch (frequency) {
                case 'daily':
                    tempDate = addDays(tempDate, 1);
                    break;
                case 'weekly':
                    tempDate = addWeeks(tempDate, 1);
                    break;
                case 'monthly':
                    tempDate = addMonths(tempDate, 1);
                    break;
                default:
                    return new Date(); // Si la frecuencia es desconocida, usa la fecha actual
            }
        }
        nextDate = tempDate;
    } else {
        // La fecha de inicio está en el futuro, simplemente la usamos
        nextDate = startDate;
    }

    switch (frequency) {
        case 'daily':
            return addDays(nextDate, 1);
        case 'weekly':
            return addWeeks(nextDate, 1);
        case 'monthly':
            return addMonths(nextDate, 1);
        default:
            return nextDate; // Si la frecuencia es desconocida, no la cambiamos
    }
}

// Escuchar cambios en la autenticación
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Usuario está autenticado
        currentUser = user;
        currentUserId = user.uid;
        console.log("Usuario autenticado:", user.email);

        // Desuscribirse del oyente anterior si existe
        if (userProfileUnsubscribe) {
            userProfileUnsubscribe();
            userProfileUnsubscribe = null;
        }

        // Configurar un oyente en tiempo real para el perfil del usuario
        const userDocRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        userProfileUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                showDashboard(userData);
            } else {
                console.log("Perfil de usuario no encontrado, cerrando sesión.");
                signOut(auth);
            }
        }, (error) => {
            console.error("Error al escuchar el perfil del usuario:", error);
        });

        // Simulación de las funciones de mantenimiento del servidor
        // En un entorno de producción, esto debería ejecutarse en el servidor.
        checkAndProcessSavingsCollections();
        checkAndProcessSavingsDebts();

    } else {
        // Usuario no está autenticado
        currentUser = null;
        currentUserId = null;
        console.log("Usuario desautenticado.");
        showSection(loginSection, registerSection, dashboardSection);
        toggleTabs('login');
        hideMessage();
        // Desuscribirse si existe
        if (userProfileUnsubscribe) {
            userProfileUnsubscribe();
            userProfileUnsubscribe = null;
        }
    }
});
