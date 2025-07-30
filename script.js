import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, orderBy } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

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
const ADMIN_EMAIL = `admin.jhonnio@banco-juvenil-12903.com`;
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

// NUEVO: Variables globales para las funciones de desuscripción de oyentes (PARA EVITAR DUPLICACIÓN)
let userHistoryUnsubscribe = null;
let userPendingRequestsUnsubscribe = null;
let adminPendingRequestsUnsubscribe = null;
let adminSavingsDebtsUnsubscribe = null; // Nueva desuscripción para deudas de ahorro del administrador
let savingsDebtsUnsubscribe = null;


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
const receiveMoneyFromExternalBtn = document.getElementById('receiveMoneyFromExternalBtn'); // NUEVO: Botón para recibir dinero de banco exterior

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
    <p class="mb-2"><strong>12. Recepción de Fondos Externos:</strong> Las solicitudes para recibir dinero de bancos externos requieren la aprobación del administrador.</p>
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

// NUEVO: Modal de deudas de ahorro (cliente)
const savingsDebtsModal = document.getElementById('savingsDebtsModal');
const closeSavingsDebtsModalBtn = document.getElementById('closeSavingsDebtsModalBtn');
const savingsDebtsTableBody = document.getElementById('savingsDebtsTableBody');

// NUEVO: Modal de deudas de ahorro del administrador
const adminSavingsDebtsModal = document.getElementById('adminSavingsDebtsModal');
const closeAdminSavingsDebtsModalBtn = document.getElementById('closeAdminSavingsDebtsModalBtn');
const adminSavingsDebtsTableBody = document.getElementById('adminSavingsDebtsTableBody');

// NUEVO: Modal para recibir dinero de banco exterior
const receiveMoneyFromExternalModal = document.getElementById('receiveMoneyFromExternalModal');
const closeReceiveMoneyFromExternalBtn = document.getElementById('closeReceiveMoneyFromExternalBtn');
const receiveMoneyFromExternalForm = document.getElementById('receiveMoneyFromExternalForm');
const externalSenderNameInput = document.getElementById('senderName'); // Corregido ID
const externalAmountInput = document.getElementById('externalAmount');
const externalOriginBankInput = document.getElementById('originBank'); // Corregido ID
const externalSerialNumberInput = document.getElementById('externalSerialNumber'); // Corregido ID


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
    if (transaction.type === 'transfer_sent') {
        const recipientName = await getUserDisplayName(transaction.recipientId);
        typeDisplay = 'Transferencia Enviada';
        amountDisplay = (transaction.amount ?? 0).toFixed(2);
        currencyDisplay = transaction.currency;
        otherDetails += `<p><strong>Destinatario:</strong> ${recipientName}</p>`;
    } else if (transaction.type === 'transfer_received') {
        const senderName = await getUserDisplayName(transaction.senderId);
        typeDisplay = 'Transferencia Recibida';
        amountDisplay = (transaction.amount ?? 0).toFixed(2);
        currencyDisplay = transaction.currency;
        otherDetails += `<p><strong>Remitente:</strong> ${senderName}</p>`;
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
            transaction.productLinks.forEach(link => {
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
    } else if (transaction.type === 'external_deposit_approved') { // NUEVO: Recibo de depósito externo aprobado
        typeDisplay = 'Depósito Externo Aprobado';
        amountDisplay = (transaction.amount ?? 0).toFixed(2);
        currencyDisplay = transaction.currency;
        otherDetails += `<p><strong>Remitente:</strong> ${transaction.senderName || 'N/A'}</p>`;
        otherDetails += `<p><strong>Banco de Origen:</strong> ${transaction.sourceBank || 'N/A'}</p>`;
        otherDetails += `<p><strong>Referencia:</strong> ${transaction.referenceNumber || 'N/A'}</p>`;
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
        showSection(loginSection, registerSection, dashboardSection, rulesConsentModal, userHistoryModal, adminFullHistoryModal, adminPendingRequestsModal, faqModal, onlineShoppingModal, streamingPaymentModal, gameRechargeModal, userPendingRequestsModal, receiptModal, editProfileModal, changePasswordModal, securityTipsModal, aboutUsModal, contactSupportModal, openSavingsAccountModal, viewSavingsAccountsModal, editAnnouncementsModal, depositToSavingsModal, withdrawFromSavingsModal, confirmDeleteSavingsAccountModal, savingsDebtsModal, adminSavingsDebtsModal, receiveMoneyFromExternalModal);
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        // Oculta todas las secciones principales y modales
        showSection(registerSection, loginSection, dashboardSection, rulesConsentModal, userHistoryModal, adminFullHistoryModal, adminPendingRequestsModal, faqModal, onlineShoppingModal, streamingPaymentModal, gameRechargeModal, userPendingRequestsModal, receiptModal, editProfileModal, changePasswordModal, securityTipsModal, aboutUsModal, contactSupportModal, openSavingsAccountModal, viewSavingsAccountsModal, editAnnouncementsModal, depositToSavingsModal, withdrawFromSavingsModal, confirmDeleteSavingsAccountModal, savingsDebtsModal, adminSavingsDebtsModal, receiveMoneyFromExternalModal);
    }
}

/**
 * Cierra un modal específico y reinicia su formulario si se proporciona.
 * @param {HTMLElement} modal El elemento modal a cerrar.
 * @param {HTMLElement} [formToReset] El formulario dentro del modal a resetear.
 */
function closeModal(modal, formToReset = null) {
    modal.classList.add('hidden');
    if (formToReset) {
        formToReset.reset();
    }
    hideMessage(); // Oculta cualquier mensaje al cerrar un modal
    hideTransactionStatus(); // Oculta el estado de transacción
}

// Inicialmente, muestra la sección de inicio de sesión
toggleTabs('login');

// Oyentes de eventos para cambiar entre pestañas de inicio de sesión y registro
loginTab.addEventListener('click', () => toggleTabs('login'));
registerTab.addEventListener('click', () => toggleTabs('register'));

// Oyentes de eventos para cerrar el cuadro de mensajes
closeMessage.addEventListener('click', hideMessage);

// --- Funciones de autenticación y perfil de usuario ---

/**
 * Maneja el registro de un nuevo usuario.
 */
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage(); // Oculta cualquier mensaje anterior

    const email = registerNameInput.value.trim().toLowerCase() + '.' + registerSurnameInput.value.trim().toLowerCase() + '@' + appId + '.com';
    const password = registerPasswordInput.value;
    const name = registerNameInput.value.trim();
    const surname = registerSurnameInput.value.trim();
    const age = parseInt(registerAgeInput.value);
    const phoneNumber = registerPhoneNumberInput.value.trim(); // NUEVO: Número de teléfono

    if (age < 13) {
        showMessage('Debes tener al menos 13 años para registrarte.', 'error');
        return;
    }
    if (password.length < 6) {
        showMessage('La contraseña debe tener al menos 6 caracteres.', 'error');
        return;
    }
    if (!phoneNumber.match(/^\d{10,}$/)) { // Simple validación de 10 dígitos o más
        showMessage('Por favor, introduce un número de teléfono válido (mínimo 10 dígitos).', 'error');
        return;
    }

    // Guarda temporalmente los datos para el consentimiento de las reglas
    tempRegisterData = { email, password, name, surname, age, phoneNumber };

    // Muestra el modal de consentimiento de reglas
    briefRulesTextContainer.innerHTML = briefRulesText;
    rulesConsentModal.classList.remove('hidden');
});

// Manejo del consentimiento de reglas
acceptRulesBtn.addEventListener('click', async () => {
    rulesConsentModal.classList.add('hidden'); // Cierra el modal de reglas
    const { email, password, name, surname, age, phoneNumber } = tempRegisterData;

    try {
        // 1. Crea el usuario en Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userId = user.uid;

        // 2. Genera un userDisplayId (ej. una parte del UID)
        const userDisplayId = userId.substring(0, 8).toUpperCase();

        // 3. Almacena información adicional en Firestore
        await setDoc(doc(db, 'artifacts', appId, 'users', userId), {
            userId: userId,
            email: email,
            name: name,
            surname: surname,
            age: age,
            phoneNumber: phoneNumber, // Guarda el número de teléfono
            balanceUSD: 0,
            balanceDOP: 0,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            userDisplayId: userDisplayId, // ID amigable para mostrar
            hasPendingDeposit: false // Bandera para controlar depósitos pendientes
        });

        showMessage('¡Registro exitoso! Ahora puedes iniciar sesión.', 'success');
        registerForm.reset();
        toggleTabs('login'); // Vuelve a la pestaña de inicio de sesión
    } catch (error) {
        console.error("Error durante el registro:", error);
        let errorMessage = 'Error al registrar. Por favor, inténtalo de nuevo.';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Este nombre y apellido ya están registrados. Por favor, elige otros.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'La contraseña es demasiado débil. Necesita al menos 6 caracteres.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'El formato del email generado es inválido. Contacta a soporte.';
        }
        showMessage(errorMessage, 'error');
    } finally {
        tempRegisterData = {}; // Limpia los datos temporales
    }
});

rejectRulesBtn.addEventListener('click', () => {
    rulesConsentModal.classList.add('hidden'); // Cierra el modal de reglas
    tempRegisterData = {}; // Limpia los datos temporales
    showMessage('Debes aceptar las reglas para registrarte.', 'info');
});


/**
 * Maneja el inicio de sesión de un usuario.
 */
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage(); // Oculta cualquier mensaje anterior

    const identifier = loginIdentifierInput.value.trim(); // Podría ser email o userDisplayId
    const password = loginPassword.value;

    if (!identifier || !password) {
        showMessage('Por favor, ingresa tu ID de usuario y contraseña.', 'error');
        return;
    }

    try {
        let userToSignIn = null;
        let emailToSignIn = identifier;

        // Si el identificador no parece un email, intenta buscar el email real en Firestore
        if (!identifier.includes('@')) {
            const userQuery = query(collection(db, 'artifacts', appId, 'users'), where('userDisplayId', '==', identifier));
            const querySnapshot = await getDocs(userQuery);
            if (!querySnapshot.empty) {
                userToSignIn = querySnapshot.docs[0].data();
                emailToSignIn = userToSignIn.email; // Obtiene el email real para el inicio de sesión
            } else {
                showMessage('ID de usuario no encontrado. Intenta con tu email o un ID válido.', 'error');
                return;
            }
        }

        // Inicia sesión con el email (ya sea el original o el encontrado por userDisplayId)
        await signInWithEmailAndPassword(auth, emailToSignIn, password);
        // onAuthStateChanged manejará la actualización de la interfaz de usuario

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
});

/**
 * Maneja el cierre de sesión del usuario.
 */
async function handleLogout() {
    try {
        console.log("Intentando cerrar sesión...");
        // Desuscribirse de todos los oyentes de onSnapshot
        if (userProfileUnsubscribe) userProfileUnsubscribe();
        if (userHistoryUnsubscribe) userHistoryUnsubscribe();
        if (userPendingRequestsUnsubscribe) userPendingRequestsUnsubscribe();
        if (adminPendingRequestsUnsubscribe) adminPendingRequestsUnsubscribe();
        if (adminSavingsDebtsUnsubscribe) adminSavingsDebtsUnsubscribe();
        if (savingsDebtsUnsubscribe) savingsDebtsUnsubscribe();

        userProfileUnsubscribe = null;
        userHistoryUnsubscribe = null;
        userPendingRequestsUnsubscribe = null;
        adminPendingRequestsUnsubscribe = null;
        adminSavingsDebtsUnsubscribe = null;
        savingsDebtsUnsubscribe = null;

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
                profileAvatar.textContent = (userData.name ? userData.name.substring(0, 1) : 'U').toUpperCase(); // Establece la inicial del avatar
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
        showSection(dashboardSection, loginSection, registerSection, rulesConsentModal, userHistoryModal, adminFullHistoryModal, adminPendingRequestsModal, faqModal, onlineShoppingModal, streamingPaymentModal, gameRechargeModal, userPendingRequestsModal, receiptModal, editProfileModal, changePasswordModal, securityTipsModal, aboutUsModal, contactSupportModal, openSavingsAccountModal, viewSavingsAccountsModal, editAnnouncementsModal, depositToSavingsModal, withdrawFromSavingsModal, confirmDeleteSavingsAccountModal, savingsDebtsModal, adminSavingsDebtsModal, receiveMoneyFromExternalModal);
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

        // Registra la transacción para el REMITENTE
        const newTransactionSenderRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: senderUid, // El ID del usuario que realizó la acción
            senderId: senderUid,
            recipientId: actualRecipientUid,
            amount: amount,
            currency: currency,
            timestamp: serverTimestamp(),
            type: 'transfer_sent', // Tipo específico para el remitente
            status: 'completed',
            description: `Transferencia enviada a ${recipientDisplayName}`
        });

        // Registra la transacción para el RECEPTOR
        const newTransactionRecipientRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: actualRecipientUid, // El ID del usuario que recibió la acción
            senderId: senderUid,
            recipientId: actualRecipientUid,
            amount: amount,
            currency: currency,
            timestamp: serverTimestamp(),
            type: 'transfer_received', // Tipo específico para el receptor
            status: 'completed',
            description: `Transferencia recibida de ${senderData.name} ${senderData.surname}`
        });


        showMessage(`Transferencia de ${amount.toFixed(2)} ${currency} a ${recipientDisplayName} completada exitosamente.`, 'success');
        // Los saldos se actualizarán automáticamente por el oyente onSnapshot
        // Muestra el recibo para el remitente
        const transactionDoc = await getDoc(newTransactionSenderRef); // Mostrar el recibo del remitente
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
        await updateDoc(userDocRef, { hasPendingDeposit: true });

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
        shoppingFeeDisplay.textContent = '$0.00 USD';
        shoppingTotalDisplay.textContent = '$0.00 USD';
        return;
    }

    let amountInUSD = amount;
    if (currency === 'DOP') {
        amountInUSD = amount / USD_TO_DOP_RATE;
    }

    const fee = amountInUSD * COMMISSION_RATE;
    const total = amountInUSD + fee;

    shoppingFeeDisplay.textContent = `$${fee.toFixed(2)} USD`;
    shoppingTotalDisplay.textContent = `$${total.toFixed(2)} USD`;
}

onlineShoppingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const productAmount = parseFloat(shoppingAmountInput.value);
    const productCurrency = shoppingCurrencyInput.value;
    const productLinks = productLinksInput.value.trim().split('\n').map(link => link.trim()).filter(link => link); // Asegurarse de que sea un array
    const category = shoppingCategoryInput.value;

    if (isNaN(productAmount) || productAmount <= 0) {
        showMessage('El monto de la compra debe ser un número positivo.', 'error');
        return;
    }
    if (productLinks.length === 0) { // Validar que haya al menos un enlace
        showMessage('Por favor, ingresa los enlaces de los productos.', 'error');
        return;
    }
    if (!category) {
        showMessage('Por favor, selecciona una categoría de compra.', 'error');
        return;
    }

    let amountInUSD = productAmount;
    if (productCurrency === 'DOP') {
        amountInUSD = productAmount / USD_TO_DOP_RATE;
    }

    const feeAmount = amountInUSD * COMMISSION_RATE;
    const totalAmountDeducted = amountInUSD + feeAmount;

    if (currentBalanceUSD < totalAmountDeducted) {
        showMessage(`Saldo insuficiente para esta compra. Necesitas $${totalAmountDeducted.toFixed(2)} USD.`, 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'online_purchase',
            productAmount: productAmount,
            productCurrency: productCurrency,
            productLinks: productLinks,
            category: category,
            feeAmount: feeAmount,
            totalAmountDeducted: totalAmountDeducted,
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage(`Solicitud de compra online de ${productAmount.toFixed(2)} ${productCurrency} enviada. Esperando aprobación del administrador.`, 'success');
        closeModal(onlineShoppingModal);
    } catch (error) {
        console.error("Error al solicitar compra online:", error);
        showMessage('Error al procesar la solicitud de compra online. Intenta de nuevo.', 'error');
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

streamingAmountInput.addEventListener('input', updateStreamingCalculation);
streamingCurrencyInput.addEventListener('change', updateStreamingCalculation);

function updateStreamingCalculation() {
    const amount = parseFloat(streamingAmountInput.value);
    const currency = streamingCurrencyInput.value;

    if (isNaN(amount) || amount <= 0) {
        streamingFeeDisplay.textContent = '$0.00 USD';
        streamingTotalDisplay.textContent = '$0.00 USD';
        return;
    }

    let amountInUSD = amount;
    if (currency === 'DOP') {
        amountInUSD = amount / USD_TO_DOP_RATE;
    }

    const fee = amountInUSD * COMMISSION_RATE;
    const total = amountInUSD + fee;

    streamingFeeDisplay.textContent = `$${fee.toFixed(2)} USD`;
    streamingTotalDisplay.textContent = `$${total.toFixed(2)} USD`;
}

streamingPaymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const service = streamingServiceInput.value.trim();
    const accountIdentifier = streamingAccountIdentifierInput.value.trim();
    const subscriptionAmount = parseFloat(streamingAmountInput.value);
    const subscriptionCurrency = streamingCurrencyInput.value;
    const category = streamingCategoryInput.value;

    if (isNaN(subscriptionAmount) || subscriptionAmount <= 0) {
        showMessage('El monto de la suscripción debe ser un número positivo.', 'error');
        return;
    }
    if (!service) {
        showMessage('Por favor, ingresa el nombre del servicio de streaming.', 'error');
        return;
    }
    if (!accountIdentifier) {
        showMessage('Por favor, ingresa el identificador de tu cuenta (email, usuario, etc.).', 'error');
        return;
    }
    if (!category) {
        showMessage('Por favor, selecciona una categoría de streaming.', 'error');
        return;
    }

    let amountInUSD = subscriptionAmount;
    if (subscriptionCurrency === 'DOP') {
        amountInUSD = subscriptionAmount / USD_TO_DOP_RATE;
    }

    const feeAmount = amountInUSD * COMMISSION_RATE;
    const totalAmountDeducted = amountInUSD + feeAmount;

    if (currentBalanceUSD < totalAmountDeducted) {
        showMessage(`Saldo insuficiente para este pago de streaming. Necesitas $${totalAmountDeducted.toFixed(2)} USD.`, 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'streaming_payment',
            service: service,
            accountIdentifier: accountIdentifier,
            subscriptionAmount: subscriptionAmount,
            subscriptionCurrency: subscriptionCurrency,
            category: category,
            feeAmount: feeAmount,
            totalAmountDeducted: totalAmountDeducted,
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage(`Solicitud de pago de streaming de ${subscriptionAmount.toFixed(2)} ${subscriptionCurrency} enviada. Esperando aprobación del administrador.`, 'success');
        closeModal(streamingPaymentModal);
    } catch (error) {
        console.error("Error al solicitar pago de streaming:", error);
        showMessage('Error al procesar la solicitud de pago de streaming. Intenta de nuevo.', 'error');
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
        gameRechargeFeeDisplay.textContent = '$0.00 USD';
        gameRechargeTotalDisplay.textContent = '$0.00 USD';
        return;
    }

    let amountInUSD = amount;
    if (currency === 'DOP') {
        amountInUSD = amount / USD_TO_DOP_RATE;
    }

    const fee = amountInUSD * COMMISSION_RATE; // Asumiendo la misma comisión del 3%
    const total = amountInUSD + fee;

    gameRechargeFeeDisplay.textContent = `$${fee.toFixed(2)} USD`;
    gameRechargeTotalDisplay.textContent = `$${total.toFixed(2)} USD`;
}

gameRechargeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const gameName = gameNameInput.value.trim();
    const playerId = playerIdInput.value.trim();
    const rechargeAmount = parseFloat(rechargeAmountInput.value);
    const rechargeCurrency = rechargeCurrencyInput.value;
    const category = gameRechargeCategoryInput.value;

    if (isNaN(rechargeAmount) || rechargeAmount <= 0) {
        showMessage('El monto de la recarga debe ser un número positivo.', 'error');
        return;
    }
    if (!gameName) {
        showMessage('Por favor, ingresa el nombre del juego.', 'error');
        return;
    }
    if (!playerId) {
        showMessage('Por favor, ingresa tu ID de jugador.', 'error');
        return;
    }
    if (!category) {
        showMessage('Por favor, selecciona un tipo de recarga.', 'error');
        return;
    }

    let amountInUSD = rechargeAmount;
    if (rechargeCurrency === 'DOP') {
        amountInUSD = rechargeAmount / USD_TO_DOP_RATE;
    }

    const feeAmount = amountInUSD * COMMISSION_RATE;
    const totalAmountDeducted = amountInUSD + feeAmount;

    if (currentBalanceUSD < totalAmountDeducted) {
        showMessage(`Saldo insuficiente para esta recarga de juego. Necesitas $${totalAmountDeducted.toFixed(2)} USD.`, 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'game_recharge',
            gameName: gameName,
            playerId: playerId,
            rechargeAmount: rechargeAmount,
            rechargeCurrency: rechargeCurrency,
            category: category,
            feeAmount: feeAmount,
            totalAmountDeducted: totalAmountDeducted,
            timestamp: serverTimestamp(),
            status: 'pending'
        });

        showMessage(`Solicitud de recarga de juego de ${rechargeAmount.toFixed(2)} ${rechargeCurrency} enviada. Esperando aprobación del administrador.`, 'success');
        closeModal(gameRechargeModal);
    } catch (error) {
        console.error("Error al solicitar recarga de juego:", error);
        showMessage('Error al procesar la solicitud de recarga de juego. Intenta de nuevo.', 'error');
    }
});


// --- Funciones de historial de transacciones ---
viewHistoryBtn.addEventListener('click', () => {
    userHistoryModal.classList.remove('hidden');
    loadUserHistory();
});

closeUserHistoryModalBtn.addEventListener('click', () => {
    closeModal(userHistoryModal);
    if (userHistoryUnsubscribe) { // Desuscribirse al cerrar el modal
        userHistoryUnsubscribe();
        userHistoryUnsubscribe = null;
    }
});

/**
 * Carga y muestra el historial de transacciones del usuario.
 * Utiliza un oyente onSnapshot para actualizaciones en tiempo real.
 */
function loadUserHistory() {
    if (!currentUserId) {
        showMessage('No se pudo cargar el historial. Usuario no autenticado.', 'error');
        return;
    }

    // Desuscribirse de cualquier oyente anterior para evitar duplicados si la función se llama varias veces
    if (userHistoryUnsubscribe) {
        userHistoryUnsubscribe();
        userHistoryUnsubscribe = null;
    }

    const transactionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    // Consulta para transacciones donde el usuario es el userId principal (deposit, withdrawal, etc.)
    // O donde es el senderId o recipientId para transferencias.
    // Firestore no soporta OR en campos diferentes para onSnapshot,
    // así que la mejor práctica es tener un campo 'userId' en cada transacción
    // que apunte al usuario principal de esa transacción, o realizar múltiples consultas.
    // Para simplificar y dado que hemos modificado la creación de transacciones para incluir 'userId'
    // en todos los tipos relevantes, usaremos una sola consulta.
    const q = query(
        transactionsRef,
        where('userId', '==', currentUserId),
        orderBy('timestamp', 'desc')
    );

    userHistoryUnsubscribe = onSnapshot(q, (snapshot) => {
        userHistoryTableBody.innerHTML = ''; // Limpiar el contenido existente primero
        userTransactionsData = []; // Limpiar el array global para nuevos datos

        if (snapshot.empty) {
            userHistoryTableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-gray-500">No hay transacciones todavía.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const transaction = { id: doc.id, ...doc.data() };
            userTransactionsData.push(transaction); // Añadir al array global
            appendTransactionToTable(transaction, userHistoryTableBody);
        });
    }, (error) => {
        console.error("Error al cargar historial de transacciones:", error);
        showMessage('Error al cargar tu historial de transacciones.', 'error');
    });
}


/**
 * Añade una fila de transacción a la tabla de historial.
 * @param {Object} transaction El objeto de transacción.
 * @param {HTMLElement} tableBody El tbody de la tabla a la que añadir.
 */
async function appendTransactionToTable(transaction, tableBody) {
    const row = tableBody.insertRow();
    row.classList.add('hover:bg-gray-50');

    let typeDisplay = '';
    let amountDisplay = '';
    let currencyDisplay = '';
    let descriptionDisplay = transaction.description || '';
    let statusDisplay = transaction.status || 'N/A';
    let relatedUserDisplay = '';

    const timestamp = transaction.timestamp ? new Date(transaction.timestamp.seconds * 1000).toLocaleString() : 'N/A';

    // Obtener nombres para remitente/destinatario si aplica
    if (transaction.type === 'transfer_sent') {
        typeDisplay = 'Transferencia Enviada';
        amountDisplay = `${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
        const recipientName = await getUserDisplayName(transaction.recipientId);
        descriptionDisplay = `A: ${recipientName}`;
    } else if (transaction.type === 'transfer_received') {
        typeDisplay = 'Transferencia Recibida';
        amountDisplay = `${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
        const senderName = await getUserDisplayName(transaction.senderId);
        descriptionDisplay = `De: ${senderName}`;
    } else if (transaction.type === 'deposit') {
        typeDisplay = 'Depósito';
        amountDisplay = `${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
        descriptionDisplay = `Serie: ${transaction.serialNumber || 'N/A'}`;
    } else if (transaction.type === 'withdrawal') {
        typeDisplay = 'Retiro';
        amountDisplay = `${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
        descriptionDisplay = `Tarifa: $${(transaction.feeAmount ?? 0).toFixed(2)} USD`;
    } else if (transaction.type === 'online_purchase') {
        typeDisplay = 'Compra Online';
        amountDisplay = `$${(transaction.totalAmountDeducted ?? 0).toFixed(2)} USD`;
        descriptionDisplay = `${transaction.category || 'N/A'} - ${transaction.productLinks[0] ? transaction.productLinks[0].substring(0, 30) + '...' : ''}`;
    } else if (transaction.type === 'streaming_payment') {
        typeDisplay = 'Pago Streaming';
        amountDisplay = `$${(transaction.totalAmountDeducted ?? 0).toFixed(2)} USD`;
        descriptionDisplay = `${transaction.service || 'N/A'} - ${transaction.accountIdentifier || 'N/A'}`;
    } else if (transaction.type === 'game_recharge') {
        typeDisplay = 'Recarga Juego';
        amountDisplay = `$${(transaction.totalAmountDeducted ?? 0).toFixed(2)} USD`;
        descriptionDisplay = `${transaction.gameName || 'N/A'} - ID:${transaction.playerId || 'N/A'}`;
    } else if (transaction.type === 'withdrawal_fee') {
        typeDisplay = 'Tarifa Retiro';
        amountDisplay = `$${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
        const otherUserId = transaction.payerId === currentUserId ? transaction.receiverId : transaction.payerId;
        const otherUserName = await getUserDisplayName(otherUserId);
        descriptionDisplay = `Rel. a ${otherUserName}`;
    } else if (transaction.type === 'savings_account_open') {
        typeDisplay = 'Cuenta Ahorro Abierta';
        amountDisplay = `$${(transaction.initialDepositAmount ?? 0).toFixed(2)} ${transaction.initialDepositCurrency}`;
        descriptionDisplay = `Objetivo: ${transaction.savingsGoal || 'N/A'}`;
    } else if (transaction.type === 'deposit_to_savings') {
        typeDisplay = 'Depósito Ahorro';
        amountDisplay = `$${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
        descriptionDisplay = `A ${transaction.savingsGoal || 'N/A'}`;
    } else if (transaction.type === 'withdraw_from_savings') {
        typeDisplay = 'Retiro Ahorro';
        amountDisplay = `$${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
        descriptionDisplay = `De ${transaction.savingsGoal || 'N/A'}`;
    } else if (transaction.type === 'delete_savings_account') {
        typeDisplay = 'Cuenta Ahorro Eliminada';
        amountDisplay = `$${(transaction.remainingBalanceTransferred ?? 0).toFixed(2)} USD`;
        descriptionDisplay = `De ${transaction.savingsGoal || 'N/A'} (Tarifa: $${(transaction.feeAmount ?? 0).toFixed(2)} USD)`;
    } else if (transaction.type === 'automatic_savings_collection') {
        typeDisplay = 'Cobro Ahorro Automático';
        amountDisplay = `$${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
        descriptionDisplay = `Para ${transaction.savingsGoal || 'N/A'}`;
    } else if (transaction.type === 'savings_debt_payment') {
        typeDisplay = 'Pago Deuda Ahorro';
        amountDisplay = `$${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
        descriptionDisplay = `Deuda: ${transaction.debtId ? transaction.debtId.substring(0, 8) : 'N/A'}`;
    } else if (transaction.type === 'savings_indemnization_applied') {
        typeDisplay = 'Indemnización Ahorro';
        amountDisplay = `$${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
        const otherUserName = await getUserDisplayName(transaction.receiverId);
        descriptionDisplay = `A ${otherUserName} (Deuda: ${transaction.debtId ? transaction.debtId.substring(0, 8) : 'N/A'})`;
    } else if (transaction.type === 'external_deposit_approved') { // NUEVO: Recibo de depósito externo aprobado
        typeDisplay = 'Depósito Externo Aprobado';
        amountDisplay = (transaction.amount ?? 0).toFixed(2);
        currencyDisplay = transaction.currency;
        descriptionDisplay = `De ${transaction.senderName || 'N/A'} (${transaction.sourceBank || 'N/A'})`;
    }

    // Celdas comunes para todas las transacciones
    row.insertCell(0).textContent = timestamp;
    row.insertCell(1).textContent = typeDisplay;
    row.insertCell(2).textContent = amountDisplay;
    row.insertCell(3).textContent = descriptionDisplay;
    row.insertCell(4).textContent = statusDisplay;

    const actionsCell = row.insertCell(5);
    const viewReceiptBtn = document.createElement('button');
    viewReceiptBtn.textContent = 'Ver Recibo';
    viewReceiptBtn.classList.add('bg-blue-500', 'hover:bg-blue-700', 'text-white', 'font-bold', 'py-1', 'px-2', 'rounded', 'text-xs', 'transition', 'duration-150');
    viewReceiptBtn.onclick = () => showReceipt(transaction);
    actionsCell.appendChild(viewReceiptBtn);
}


// --- Funciones de historial de transacciones del administrador ---
adminFullHistoryBtn.addEventListener('click', () => {
    adminFullHistoryModal.classList.remove('hidden');
    loadAdminFullHistory();
});

closeAdminFullHistoryModalBtn.addEventListener('click', () => {
    closeModal(adminFullHistoryModal);
    // No hay oyente en tiempo real aquí, por lo que no hay desuscripción necesaria.
});

/**
 * Carga y muestra el historial completo de transacciones para el administrador.
 */
async function loadAdminFullHistory() {
    if (!currentUser || currentUser.email !== ADMIN_EMAIL) {
        showMessage('Acceso denegado. Solo los administradores pueden ver esto.', 'error');
        return;
    }

    adminFullHistoryTableBodyModal.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-gray-500">Cargando historial completo...</td></tr>';

    try {
        const transactionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
        const q = query(transactionsRef, orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);

        adminFullHistoryTableBodyModal.innerHTML = ''; // Limpiar después de cargar

        if (querySnapshot.empty) {
            adminFullHistoryTableBodyModal.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-gray-500">No hay transacciones todavía.</td></tr>';
            return;
        }

        querySnapshot.forEach(async (docSnap) => {
            const transaction = { id: docSnap.id, ...docSnap.data() };
            appendAdminTransactionToTable(transaction, adminFullHistoryTableBodyModal);
        });

    } catch (error) {
        console.error("Error al cargar historial completo del administrador:", error);
        showMessage('Error al cargar el historial completo del administrador.', 'error');
    }
}

/**
 * Añade una fila de transacción a la tabla de historial del administrador.
 * @param {Object} transaction El objeto de transacción.
 * @param {HTMLElement} tableBody El tbody de la tabla a la que añadir.
 */
async function appendAdminTransactionToTable(transaction, tableBody) {
    const row = tableBody.insertRow();
    row.classList.add('hover:bg-gray-50');

    const timestamp = transaction.timestamp ? new Date(transaction.timestamp.seconds * 1000).toLocaleString() : 'N/A';
    const userId = transaction.userId;
    const userName = userId ? await getUserDisplayName(userId) : 'N/A';

    let typeDisplay = transaction.type || 'N/A';
    let amountDisplay = `${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency || 'USD'}`;
    let descriptionDisplay = transaction.description || '';
    let statusDisplay = transaction.status || 'N/A';
    let associatedDetails = ''; // Para detalles adicionales como sender/recipient

    if (transaction.type === 'transfer_sent') {
        const senderName = await getUserDisplayName(transaction.senderId);
        const recipientName = await getUserDisplayName(transaction.recipientId);
        associatedDetails = `De: ${senderName}, A: ${recipientName}`;
        amountDisplay = `${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
    } else if (transaction.type === 'transfer_received') {
        const senderName = await getUserDisplayName(transaction.senderId);
        const recipientName = await getUserDisplayName(transaction.recipientId);
        associatedDetails = `De: ${senderName}, A: ${recipientName}`;
        amountDisplay = `${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
    } else if (transaction.type === 'deposit') {
        associatedDetails = `Serie: ${transaction.serialNumber || 'N/A'}`;
    } else if (transaction.type === 'withdrawal') {
        associatedDetails = `Tarifa: $${(transaction.estimatedFee ?? transaction.feeAmount ?? 0).toFixed(2)} USD`;
    } else if (transaction.type === 'online_purchase') {
        amountDisplay = `$${(transaction.totalAmountDeducted ?? 0).toFixed(2)} USD`;
        associatedDetails = `Links: ${transaction.productLinks[0] ? transaction.productLinks[0].substring(0, 30) + '...' : ''}`;
    } else if (transaction.type === 'streaming_payment') {
        amountDisplay = `$${(transaction.totalAmountDeducted ?? 0).toFixed(2)} USD`;
        associatedDetails = `Servicio: ${transaction.service || 'N/A'}`;
    } else if (transaction.type === 'game_recharge') {
        amountDisplay = `$${(transaction.totalAmountDeducted ?? 0).toFixed(2)} USD`;
        associatedDetails = `Juego: ${transaction.gameName || 'N/A'}, ID Jugador: ${transaction.playerId || 'N/A'}`;
    } else if (transaction.type === 'withdrawal_fee') {
        const payerName = await getUserDisplayName(transaction.payerId);
        const receiverName = await getUserDisplayName(transaction.receiverId);
        associatedDetails = `Pagador: ${payerName}, Receptor: ${receiverName}`;
    } else if (transaction.type === 'savings_account_open' || transaction.type === 'deposit_to_savings' || transaction.type === 'withdraw_from_savings' || transaction.type === 'automatic_savings_collection') {
        associatedDetails = `Cuenta Ahorro: ${transaction.savingsGoal || 'N/A'}`;
        if (transaction.type === 'delete_savings_account') {
            associatedDetails = `Cuenta Eliminada: ${transaction.savingsGoal || 'N/A'}`;
            amountDisplay = `$${(transaction.remainingBalanceTransferred ?? 0).toFixed(2)} USD`;
        }
    } else if (transaction.type === 'savings_debt_payment') {
        associatedDetails = `Deuda ID: ${transaction.debtId ? transaction.debtId.substring(0, 8) : 'N/A'}`;
    } else if (transaction.type === 'savings_indemnization_applied') {
        const payerName = await getUserDisplayName(transaction.payerId);
        const receiverName = await getUserDisplayName(transaction.receiverId);
        associatedDetails = `Pagador: ${payerName}, Receptor: ${receiverName}, Deuda: ${transaction.debtId ? transaction.debtId.substring(0, 8) : 'N/A'}`;
    } else if (transaction.type === 'external_deposit_approved') { // NUEVO: Fila para depósito externo en admin
        amountDisplay = `${(transaction.amount ?? 0).toFixed(2)} ${transaction.currency}`;
        associatedDetails = `Remitente: ${transaction.senderName || 'N/A'}, Banco: ${transaction.sourceBank || 'N/A'}, Ref: ${transaction.referenceNumber || 'N/A'}`;
    }


    row.insertCell(0).textContent = timestamp;
    row.insertCell(1).textContent = userName;
    row.insertCell(2).textContent = typeDisplay;
    row.insertCell(3).textContent = amountDisplay;
    row.insertCell(4).textContent = statusDisplay;
    row.insertCell(5).textContent = associatedDetails;

    const actionsCell = row.insertCell(6);
    const viewReceiptBtn = document.createElement('button');
    viewReceiptBtn.textContent = 'Ver Recibo';
    viewReceiptBtn.classList.add('bg-blue-500', 'hover:bg-blue-700', 'text-white', 'font-bold', 'py-1', 'px-2', 'rounded', 'text-xs', 'transition', 'duration-150');
    viewReceiptBtn.onclick = () => showReceipt(transaction);
    actionsCell.appendChild(viewReceiptBtn);
}


// --- Funciones de solicitudes pendientes del usuario ---
viewUserPendingRequestsBtn.addEventListener('click', () => {
    userPendingRequestsModal.classList.remove('hidden');
    loadUserPendingRequests();
});

closeUserPendingRequestsModalBtn.addEventListener('click', () => {
    closeModal(userPendingRequestsModal);
    if (userPendingRequestsUnsubscribe) { // Desuscribirse al cerrar el modal
        userPendingRequestsUnsubscribe();
        userPendingRequestsUnsubscribe = null;
    }
});

/**
 * Carga y muestra las solicitudes pendientes del usuario actual.
 * Utiliza un oyente onSnapshot para actualizaciones en tiempo real.
 */
function loadUserPendingRequests() {
    if (!currentUserId) {
        showMessage('No se pudieron cargar tus solicitudes pendientes. Usuario no autenticado.', 'error');
        return;
    }

    // Desuscribirse de cualquier oyente anterior para evitar duplicados si la función se llama varias veces
    if (userPendingRequestsUnsubscribe) {
        userPendingRequestsUnsubscribe();
        userPendingRequestsUnsubscribe = null;
    }

    const pendingRequestsRef = collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests');
    const externalBankRequestsRef = collection(db, 'artifacts', appId, 'public', 'data', 'externalBankRequests'); // NUEVO: Referencia a la nueva colección

    const qPending = query(
        pendingRequestsRef,
        where('userId', '==', currentUserId),
        where('status', '==', 'pending'),
        orderBy('timestamp', 'desc')
    );

    const qExternal = query( // NUEVO: Consulta para solicitudes externas
        externalBankRequestsRef,
        where('userId', '==', currentUserId),
        where('status', '==', 'pending'),
        orderBy('timestamp', 'desc')
    );

    // Array para combinar resultados de ambas consultas
    let combinedPendingRequests = [];

    // onSnapshot para pending_requests
    const unsubscribePending = onSnapshot(qPending, (snapshot) => {
        // Filtra y elimina las solicitudes de 'pending_requests' existentes antes de añadir las nuevas
        combinedPendingRequests = combinedPendingRequests.filter(req => req.source !== 'pending_requests');
        snapshot.forEach(doc => {
            combinedPendingRequests.push({ id: doc.id, ...doc.data(), source: 'pending_requests' }); // Añadir source
        });
        renderUserPendingRequestsTable();
    }, (error) => {
        console.error("Error al cargar solicitudes pendientes del usuario (pending_requests):", error);
        showMessage('Error al cargar tus solicitudes pendientes.', 'error');
    });

    // onSnapshot para externalBankRequests
    const unsubscribeExternal = onSnapshot(qExternal, (snapshot) => {
        // Filtra y elimina las solicitudes de 'externalBankRequests' existentes antes de añadir las nuevas
        combinedPendingRequests = combinedPendingRequests.filter(req => req.source !== 'externalBankRequests');
        snapshot.forEach(doc => {
            combinedPendingRequests.push({ id: doc.id, ...doc.data(), source: 'externalBankRequests' }); // Añadir source
        });
        renderUserPendingRequestsTable();
    }, (error) => {
        console.error("Error al cargar solicitudes pendientes del usuario (externalBankRequests):", error);
        showMessage('Error al cargar tus solicitudes pendientes.', 'error');
    });

    // Almacenar las funciones de desuscripción combinadas
    userPendingRequestsUnsubscribe = () => {
        unsubscribePending();
        unsubscribeExternal();
    };

    function renderUserPendingRequestsTable() {
        userPendingRequestsTableBody.innerHTML = ''; // Limpiar tabla antes de añadir

        if (combinedPendingRequests.length === 0) {
            userPendingRequestsTableBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-500">No tienes solicitudes pendientes.</td></tr>';
            return;
        }

        // Ordenar todas las solicitudes combinadas por timestamp
        combinedPendingRequests.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        combinedPendingRequests.forEach(request => {
            appendUserPendingRequestToTable(request);
        });
    }
}

/**
 * Añade una fila de solicitud pendiente a la tabla del usuario.
 * @param {Object} request El objeto de solicitud pendiente.
 */
function appendUserPendingRequestToTable(request) {
    const row = userPendingRequestsTableBody.insertRow();
    row.classList.add('hover:bg-gray-50');

    const timestamp = request.timestamp ? new Date(request.timestamp.seconds * 1000).toLocaleString() : 'N/A';
    let typeDisplay = request.type || 'N/A';
    let amountDisplay = `${(request.amount ?? 0).toFixed(2)} ${request.currency || 'USD'}`;
    let description = '';

    if (request.type === 'deposit') {
        description = `Número de Serie: ${request.serialNumber || 'N/A'}`;
    } else if (request.type === 'withdrawal') {
        description = `Tarifa estimada: $${(request.estimatedFee ?? 0).toFixed(2)} USD`;
    } else if (request.type === 'online_purchase') {
        amountDisplay = `$${(request.totalAmountDeducted ?? 0).toFixed(2)} USD`;
        description = `Compra de ${request.category || 'N/A'}`;
    } else if (request.type === 'streaming_payment') {
        amountDisplay = `$${(request.totalAmountDeducted ?? 0).toFixed(2)} USD`;
        description = `Pago de ${request.service || 'N/A'}`;
    } else if (request.type === 'game_recharge') {
        amountDisplay = `$${(request.totalAmountDeducted ?? 0).toFixed(2)} USD`;
        description = `Recarga para ${request.gameName || 'N/A'}`;
    } else if (request.type === 'savings_account_open') {
        amountDisplay = `$${(request.initialDepositAmount ?? 0).toFixed(2)} ${request.initialDepositCurrency}`;
        description = `Objetivo: ${request.savingsGoal || 'N/A'}`;
    } else if (request.type === 'receive_external_bank_money') { // NUEVO: Fila para solicitud de depósito externo
        description = `De: ${request.senderName || 'N/A'}, Banco: ${request.sourceBank || 'N/A'}`;
        amountDisplay = `${(request.amount ?? 0).toFixed(2)} ${request.currency || 'USD'}`;
        typeDisplay = 'Solicitud Ext. Dinero';
    }


    row.insertCell(0).textContent = timestamp;
    row.insertCell(1).textContent = typeDisplay;
    row.insertCell(2).textContent = amountDisplay;
    row.insertCell(3).textContent = description;
    row.insertCell(4).textContent = request.status;
}


// --- Funciones de solicitudes pendientes del administrador ---
viewAdminPendingRequestsBtn.addEventListener('click', () => {
    adminPendingRequestsModal.classList.remove('hidden');
    loadAdminPendingRequests();
});

closeAdminPendingRequestsModalBtn.addEventListener('click', () => {
    closeModal(adminPendingRequestsModal);
    if (adminPendingRequestsUnsubscribe) { // Desuscribirse al cerrar el modal
        adminPendingRequestsUnsubscribe();
        adminPendingRequestsUnsubscribe = null;
    }
});

/**
 * Carga y muestra las solicitudes pendientes para el administrador.
 * Utiliza un oyente onSnapshot para actualizaciones en tiempo real.
 */
function loadAdminPendingRequests() {
    if (!currentUser || currentUser.email !== ADMIN_EMAIL) { // Solo para admin
        showMessage('Acceso denegado. Solo los administradores pueden ver esto.', 'error');
        return;
    }

    // Desuscribirse de cualquier oyente anterior para evitar duplicados
    if (adminPendingRequestsUnsubscribe) {
        adminPendingRequestsUnsubscribe();
        adminPendingRequestsUnsubscribe = null;
    }

    const pendingRequestsRef = collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests');
    const externalBankRequestsRef = collection(db, 'artifacts', appId, 'public', 'data', 'externalBankRequests'); // NUEVO: Referencia a la nueva colección

    // Consulta para pending_requests
    const qPending = query(
        pendingRequestsRef,
        where('status', '==', 'pending'),
        orderBy('timestamp', 'desc')
    );

    // Consulta para externalBankRequests
    const qExternal = query(
        externalBankRequestsRef,
        where('status', '==', 'pending'),
        orderBy('timestamp', 'desc')
    );

    let combinedAdminRequests = [];

    // onSnapshot para pending_requests
    const unsubscribePending = onSnapshot(qPending, (snapshot) => {
        combinedAdminRequests = combinedAdminRequests.filter(req => req.source !== 'pending_requests');
        snapshot.forEach(doc => {
            combinedAdminRequests.push({ id: doc.id, ...doc.data(), source: 'pending_requests' });
        });
        renderAdminPendingRequestsTable();
    }, (error) => {
        console.error("Error al cargar solicitudes pendientes del administrador (pending_requests):", error);
    });

    // onSnapshot para externalBankRequests
    const unsubscribeExternal = onSnapshot(qExternal, (snapshot) => {
        combinedAdminRequests = combinedAdminRequests.filter(req => req.source !== 'externalBankRequests');
        snapshot.forEach(doc => {
            combinedAdminRequests.push({ id: doc.id, ...doc.data(), source: 'externalBankRequests' });
        });
        renderAdminPendingRequestsTable();
    }, (error) => {
        console.error("Error al cargar solicitudes pendientes del administrador (externalBankRequests):", error);
    });

    // Almacenar las funciones de desuscripción combinadas
    adminPendingRequestsUnsubscribe = () => {
        unsubscribePending();
        unsubscribeExternal();
    };

    async function renderAdminPendingRequestsTable() {
        adminPendingRequestsTableBody.innerHTML = ''; // Limpiar tabla antes de añadir

        if (combinedAdminRequests.length === 0) {
            adminPendingRequestsTableBody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-gray-500">No hay solicitudes pendientes en este momento.</td></tr>';
            return;
        }

        // Ordenar todas las solicitudes combinadas por timestamp
        combinedAdminRequests.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        for (const request of combinedAdminRequests) {
            // Populate display name for the user who made the request
            request.userName = await getUserDisplayName(request.userId);
            appendAdminPendingRequestToTable(request);
        }
    }
}

/**
 * Añade una fila de solicitud pendiente a la tabla del administrador.
 * @param {Object} request El objeto de solicitud pendiente.
 */
async function appendAdminPendingRequestToTable(request) {
    const row = adminPendingRequestsTableBody.insertRow();
    row.classList.add('hover:bg-gray-50');

    const timestamp = request.timestamp ? new Date(request.timestamp.seconds * 1000).toLocaleString() : 'N/A';
    const userName = request.userName || 'N/A';
    let typeDisplay = request.type || 'N/A';
    let amountDisplay = `${(request.amount ?? 0).toFixed(2)} ${request.currency || 'USD'}`;
    let details = '';

    if (request.type === 'deposit') {
        details = `Número de Serie: ${request.serialNumber || 'N/A'}`;
    } else if (request.type === 'withdrawal') {
        details = `Tarifa estimada: $${(request.estimatedFee ?? 0).toFixed(2)} USD`;
    } else if (request.type === 'online_purchase') {
        amountDisplay = `$${(request.totalAmountDeducted ?? 0).toFixed(2)} USD`;
        details = `Categoría: ${request.category || 'N/A'}, Enlaces: ${request.productLinks[0] ? request.productLinks[0].substring(0, 30) + '...' : ''}`;
    } else if (request.type === 'streaming_payment') {
        amountDisplay = `$${(request.totalAmountDeducted ?? 0).toFixed(2)} USD`;
        details = `Servicio: ${request.service || 'N/A'}, Cuenta: ${request.accountIdentifier || 'N/A'}`;
    } else if (request.type === 'game_recharge') {
        amountDisplay = `$${(request.totalAmountDeducted ?? 0).toFixed(2)} USD`;
        details = `Juego: ${request.gameName || 'N/A'}, ID Jugador: ${request.playerId || 'N/A'}`;
    } else if (request.type === 'savings_account_open') {
        amountDisplay = `$${(request.initialDepositAmount ?? 0).toFixed(2)} ${request.initialDepositCurrency}`;
        details = `Objetivo: ${request.savingsGoal || 'N/A'}, Frecuencia: ${request.preferredSavingsFrequency || 'N/A'}`;
    } else if (request.type === 'receive_external_bank_money') { // NUEVO: Detalles para solicitud de depósito externo
        typeDisplay = 'Solicitud Ext. Dinero';
        details = `Remitente: ${request.senderName || 'N/A'}, Banco: ${request.sourceBank || 'N/A'}, Ref: ${request.serialNumber || 'N/A'}`;
    }

    row.insertCell(0).textContent = timestamp;
    row.insertCell(1).textContent = userName;
    row.insertCell(2).textContent = typeDisplay;
    row.insertCell(3).textContent = amountDisplay;
    row.insertCell(4).textContent = details;
    row.insertCell(5).textContent = request.status;

    const actionsCell = row.insertCell(6);
    // Botón de Aprobar
    const approveBtn = document.createElement('button');
    approveBtn.textContent = 'Aprobar';
    approveBtn.classList.add('bg-green-500', 'hover:bg-green-700', 'text-white', 'font-bold', 'py-1', 'px-2', 'rounded', 'text-xs', 'mr-2', 'transition', 'duration-150');
    approveBtn.onclick = () => approvePendingRequest(request);
    actionsCell.appendChild(approveBtn);

    // Botón de Rechazar
    const rejectBtn = document.createElement('button');
    rejectBtn.textContent = 'Rechazar';
    rejectBtn.classList.add('bg-red-500', 'hover:bg-red-700', 'text-white', 'font-bold', 'py-1', 'px-2', 'rounded', 'text-xs', 'transition', 'duration-150');
    rejectBtn.onclick = () => rejectPendingRequest(request);
    actionsCell.appendChild(rejectBtn);
}

/**
 * Permite al administrador aprobar una solicitud pendiente.
 * @param {Object} request La solicitud a aprobar.
 */
async function approvePendingRequest(request) {
    hideMessage();
    try {
        let requestRef;
        if (request.source === 'pending_requests') {
            requestRef = doc(db, 'artifacts', appId, 'public', 'data', 'pending_requests', request.id);
        } else if (request.source === 'externalBankRequests') {
            requestRef = doc(db, 'artifacts', appId, 'public', 'data', 'externalBankRequests', request.id);
        } else {
            showMessage('Error: Origen de solicitud desconocido.', 'error');
            return;
        }

        const userProfileRef = doc(db, 'artifacts', appId, 'users', request.userId);

        // Actualizar el estado de la solicitud a 'approved'
        await updateDoc(requestRef, { status: 'approved' });

        const userSnap = await getDoc(userProfileRef);
        if (!userSnap.exists()) {
            showMessage(`Error: Perfil de usuario no encontrado para la solicitud ${request.id}.`, 'error');
            return;
        }
        const userData = userSnap.data();
        let newBalanceUSD = userData.balanceUSD || 0;
        let newBalanceDOP = userData.balanceDOP || 0;
        let transactionType = request.type;
        let transactionAmount = request.amount;
        let transactionCurrency = request.currency;
        let description = '';

        if (request.type === 'deposit') {
            let amountInUSD = request.amount;
            if (request.currency === 'DOP') {
                amountInUSD = request.amount / USD_TO_DOP_RATE;
            }
            newBalanceUSD += amountInUSD;
            newBalanceDOP = newBalanceUSD * USD_TO_DOP_RATE;
            description = `Depósito aprobado, Serie: ${request.serialNumber || 'N/A'}`;

            // Si es un depósito, restablecer la bandera hasPendingDeposit del usuario
            await updateDoc(userProfileRef, { balanceUSD: newBalanceUSD, balanceDOP: newBalanceDOP, hasPendingDeposit: false });

        } else if (request.type === 'receive_external_bank_money') { // NUEVO: Lógica para aprobar dinero de banco exterior
            let amountInUSD = request.amount;
            if (request.currency === 'DOP') {
                amountInUSD = request.amount / USD_TO_DOP_RATE;
            }
            newBalanceUSD += amountInUSD;
            newBalanceDOP = newBalanceUSD * USD_TO_DOP_RATE;
            description = `Depósito externo aprobado. Remitente: ${request.senderName || 'N/A'}, Banco: ${request.sourceBank || 'N/A'}`;
            transactionType = 'external_deposit_approved'; // Nuevo tipo de transacción para el historial

            await updateDoc(userProfileRef, { balanceUSD: newBalanceUSD, balanceDOP: newBalanceDOP });

        } else if (request.type === 'withdrawal') {
            let amountInUSD = request.amount;
            if (request.currency === 'DOP') {
                amountInUSD = request.amount / USD_TO_DOP_RATE;
            }
            const feeAmount = amountInUSD * WITHDRAWAL_FEE_RATE;
            const totalDeducted = amountInUSD + feeAmount;

            if (newBalanceUSD < totalDeducted) {
                showMessage(`Error: Saldo insuficiente (${userData.userName}) para completar el retiro. Contactar al usuario.`, 'error');
                await updateDoc(requestRef, { status: 'failed_insufficient_funds' }); // Marcar como fallido
                return;
            }

            newBalanceUSD -= totalDeducted;
            newBalanceDOP = newBalanceUSD * USD_TO_DOP_RATE;
            await updateDoc(userProfileRef, { balanceUSD: newBalanceUSD, balanceDOP: newBalanceDOP });

            // Registrar transacción de la tarifa de retiro (hacia el administrador)
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
                userId: request.userId,
                payerId: request.userId,
                receiverId: currentUser.uid, // El administrador recibe la tarifa
                type: 'withdrawal_fee',
                amount: feeAmount,
                currency: 'USD',
                originalRequestId: request.id,
                timestamp: serverTimestamp(),
                status: 'completed',
                description: `Tarifa de retiro de ${request.userName}`
            });
            description = `Retiro aprobado (Tarifa: $${feeAmount.toFixed(2)} USD)`;
            transactionAmount = request.amount; // Mostrar el monto original del retiro
            transactionCurrency = request.currency;

        } else if (request.type === 'online_purchase' || request.type === 'streaming_payment' || request.type === 'game_recharge') {
            const totalAmountDeducted = request.totalAmountDeducted; // Este ya incluye la comisión
            if (newBalanceUSD < totalAmountDeducted) {
                showMessage(`Error: Saldo insuficiente (${userData.userName}) para completar la compra/pago. Contactar al usuario.`, 'error');
                await updateDoc(requestRef, { status: 'failed_insufficient_funds' }); // Marcar como fallido
                return;
            }
            newBalanceUSD -= totalAmountDeducted;
            newBalanceDOP = newBalanceUSD * USD_TO_DOP_RATE;
            await updateDoc(userProfileRef, { balanceUSD: newBalanceUSD, balanceDOP: newBalanceDOP });

            transactionAmount = request.totalAmountDeducted; // Monto total deducido
            transactionCurrency = 'USD'; // Siempre en USD para estos tipos
            description = `Aprobado. Total deducido (incluye tarifa): $${totalAmountDeducted.toFixed(2)} USD`;
        } else if (request.type === 'savings_account_open') {
            // Para abrir cuenta de ahorro, el monto inicial ya fue "deducido" como un depósito
            // pero el saldo del usuario se actualiza aquí después de la aprobación
            let initialAmountInUSD = request.initialDepositAmount;
            if (request.initialDepositCurrency === 'DOP') {
                initialAmountInUSD = request.initialDepositAmount / USD_TO_DOP_RATE;
            }

            // Asegurarse de que el usuario tiene el saldo inicial para la cuenta de ahorro
            if (newBalanceUSD < initialAmountInUSD) {
                showMessage(`Error: Saldo insuficiente (${userData.userName}) para el depósito inicial de la cuenta de ahorro. Contactar al usuario.`, 'error');
                await updateDoc(requestRef, { status: 'failed_insufficient_funds' }); // Marcar como fallido
                return;
            }

            // Deduce el monto inicial de la cuenta principal del usuario
            newBalanceUSD -= initialAmountInUSD;
            newBalanceDOP = newBalanceUSD * USD_TO_DOP_RATE;

            // Crea la cuenta de ahorro en una subcolección del usuario
            const savingsAccountId = crypto.randomUUID(); // Genera un ID único para la cuenta de ahorro
            const savingsAccountRef = doc(db, 'artifacts', appId, 'users', request.userId, 'savings_accounts', savingsAccountId);
            await setDoc(savingsAccountRef, {
                accountId: savingsAccountId,
                userId: request.userId,
                savingsGoal: request.savingsGoal,
                initialDepositAmount: request.initialDepositAmount,
                initialDepositCurrency: request.initialDepositCurrency,
                preferredSavingsFrequency: request.preferredSavingsFrequency,
                periodicContributionAmount: request.periodicContributionAmount,
                startDate: serverTimestamp(),
                endDate: request.endDate, // La fecha de finalización ya debe venir del formulario
                balanceUSD: initialAmountInUSD, // Inicialmente con el depósito en USD
                balanceDOP: initialAmountInUSD * USD_TO_DOP_RATE,
                status: 'active',
                createdAt: serverTimestamp(),
                lastContributionDate: serverTimestamp(), // La primera contribución es ahora
                nextContributionDueDate: getNextDueDate(request.preferredSavingsFrequency, new Date()), // Calcula la próxima fecha de vencimiento
            });

            // Actualiza el saldo principal del usuario
            await updateDoc(userProfileRef, { balanceUSD: newBalanceUSD, balanceDOP: newBalanceDOP });

            description = `Apertura de cuenta de ahorro aprobada para objetivo: "${request.savingsGoal}"`;
            transactionType = 'savings_account_open';
            transactionAmount = request.initialDepositAmount;
            transactionCurrency = request.initialDepositCurrency;

            // Registra la transacción de apertura de cuenta de ahorro
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
                userId: request.userId,
                type: 'savings_account_open',
                amount: transactionAmount, // Monto inicial
                currency: transactionCurrency, // Moneda inicial
                savingsGoal: request.savingsGoal,
                savingsAccountId: savingsAccountId,
                initialDepositAmount: request.initialDepositAmount,
                initialDepositCurrency: request.initialDepositCurrency,
                preferredSavingsFrequency: request.preferredSavingsFrequency,
                periodicContributionAmount: request.periodicContributionAmount,
                startDate: serverTimestamp(),
                endDate: request.endDate,
                timestamp: serverTimestamp(),
                status: 'completed',
                description: description
            });

            showMessage(`Solicitud de ${request.type} para ${request.userName} aprobada con éxito.`, 'success');
            return; // Salir de la función para evitar la creación de una transacción duplicada
        }


        // Registrar la transacción
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: request.userId,
            type: transactionType,
            amount: transactionAmount,
            currency: transactionCurrency,
            timestamp: serverTimestamp(),
            status: 'completed',
            description: description
        });

        showMessage(`Solicitud de ${request.type} para ${request.userName} aprobada con éxito.`, 'success');

    } catch (error) {
        console.error("Error al aprobar solicitud pendiente:", error);
        showMessage(`Error al aprobar la solicitud de ${request.type}. Intenta de nuevo.`, 'error');
    }
}

/**
 * Permite al administrador rechazar una solicitud pendiente.
 * @param {Object} request La solicitud a rechazar.
 */
async function rejectPendingRequest(request) {
    hideMessage();
    try {
        let requestRef;
        if (request.source === 'pending_requests') {
            requestRef = doc(db, 'artifacts', appId, 'public', 'data', 'pending_requests', request.id);
        } else if (request.source === 'externalBankRequests') {
            requestRef = doc(db, 'artifacts', appId, 'public', 'data', 'externalBankRequests', request.id);
        } else {
            showMessage('Error: Origen de solicitud desconocido.', 'error');
            return;
        }
        const userProfileRef = doc(db, 'artifacts', appId, 'users', request.userId);

        // Actualizar el estado de la solicitud a 'rejected'
        await updateDoc(requestRef, { status: 'rejected' });

        // Si es un depósito, restablecer la bandera hasPendingDeposit del usuario
        if (request.type === 'deposit') {
            await updateDoc(userProfileRef, { hasPendingDeposit: false });
        }

        showMessage(`Solicitud de ${request.type} para ${request.userName} rechazada.`, 'info');
    } catch (error) {
        console.error("Error al rechazar solicitud pendiente:", error);
        showMessage(`Error al rechazar la solicitud de ${request.type}. Intenta de nuevo.`, 'error');
    }
}


// --- Funciones del FAQ ---
viewFAQBtn.addEventListener('click', () => {
    faqModal.classList.remove('hidden');
});

closeFAQModalBtn.addEventListener('click', () => {
    closeModal(faqModal);
});

// --- Funciones del modal de edición de perfil ---
editProfileBtn.addEventListener('click', async () => {
    if (!currentUser || !currentUserId) {
        showMessage('No se pudo cargar el perfil. Usuario no autenticado.', 'error');
        return;
    }
    try {
        const userDocRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const userData = docSnap.data();
            editNameInput.value = userData.name || '';
            editSurnameInput.value = userData.surname || '';
            editAgeInput.value = userData.age || '';
            editPhoneNumberInput.value = userData.phoneNumber || ''; // Precargar número de teléfono
            editProfileModal.classList.remove('hidden');
        } else {
            showMessage('Perfil de usuario no encontrado.', 'error');
        }
    } catch (error) {
        console.error("Error al cargar datos del perfil para edición:", error);
        showMessage('Error al cargar datos de tu perfil. Intenta de nuevo.', 'error');
    }
});

cancelEditProfileBtn.addEventListener('click', () => {
    closeModal(editProfileModal, editProfileForm);
});

editProfileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();
    if (!currentUserId) {
        showMessage('Usuario no autenticado para actualizar el perfil.', 'error');
        return;
    }

    const newName = editNameInput.value.trim();
    const newSurname = editSurnameInput.value.trim();
    const newAge = parseInt(editAgeInput.value);
    const newPhoneNumber = editPhoneNumberInput.value.trim(); // NUEVO: Obtener número de teléfono

    if (!newName || !newSurname || isNaN(newAge) || newAge < 13 || !newPhoneNumber.match(/^\d{10,}$/)) {
        showMessage('Por favor, completa todos los campos correctamente. La edad debe ser al menos 13 y el número de teléfono válido.', 'error');
        return;
    }

    try {
        const userDocRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        await updateDoc(userDocRef, {
            name: newName,
            surname: newSurname,
            age: newAge,
            phoneNumber: newPhoneNumber, // Actualizar número de teléfono
            lastUpdated: serverTimestamp()
        });
        showMessage('¡Perfil actualizado con éxito!', 'success');
        closeModal(editProfileModal, editProfileForm);
    } catch (error) {
        console.error("Error al actualizar perfil:", error);
        showMessage('Error al actualizar el perfil. Intenta de nuevo.', 'error');
    }
});


// --- Funciones de cambio de contraseña ---
changePasswordBtn.addEventListener('click', () => {
    changePasswordModal.classList.remove('hidden');
    changePasswordForm.reset();
});

cancelChangePasswordBtn.addEventListener('click', () => {
    closeModal(changePasswordModal, changePasswordForm);
});

changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmNewPassword = confirmNewPasswordInput.value;

    if (newPassword.length < 6) {
        showMessage('La nueva contraseña debe tener al menos 6 caracteres.', 'error');
        return;
    }
    if (newPassword !== confirmNewPassword) {
        showMessage('Las nuevas contraseñas no coinciden.', 'error');
        return;
    }

    if (!currentUser) {
        showMessage('No hay usuario autenticado.', 'error');
        return;
    }

    try {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
        showMessage('¡Contraseña actualizada con éxito!', 'success');
        closeModal(changePasswordModal, changePasswordForm);
    } catch (error) {
        console.error("Error al cambiar contraseña:", error);
        let errorMessage = 'Error al cambiar contraseña. Por favor, verifica tu contraseña actual.';
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = 'La contraseña actual es incorrecta.';
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = 'Por favor, inicia sesión de nuevo para cambiar tu contraseña.';
            handleLogout(); // Forzar el cierre de sesión para que el usuario se reautentique
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

// --- Funciones de contacto y soporte (WhatsApp) ---
contactSupportBtn.addEventListener('click', () => {
    const defaultMessage = encodeURIComponent("Hola, necesito ayuda con...");
    window.open(`https://wa.me/${ADMIN_PHONE_NUMBER_FULL}?text=${defaultMessage}`, '_blank');
});


// --- NUEVO: Funciones de cuentas de ahorro ---
openSavingsAccountBtn.addEventListener('click', () => {
    openSavingsAccountModal.classList.remove('hidden');
    savingsAccountForm.reset();
    savingsEndDateInput.min = formatDateToYYYYMMDD(new Date()); // No permitir fechas pasadas
});

cancelOpenSavingsAccountBtn.addEventListener('click', () => {
    closeModal(openSavingsAccountModal, savingsAccountForm);
});

savingsAccountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const savingsGoal = savingsGoalInput.value.trim();
    const initialDepositAmount = parseFloat(initialDepositAmountInput.value);
    const initialDepositCurrency = initialDepositCurrencyInput.value;
    const preferredSavingsFrequency = preferredSavingsFrequencyInput.value;
    const periodicContributionAmount = parseFloat(periodicContributionAmountInput.value);
    const endDate = savingsEndDateInput.value;

    if (!savingsGoal || isNaN(initialDepositAmount) || initialDepositAmount <= 0 || !preferredSavingsFrequency || isNaN(periodicContributionAmount) || periodicContributionAmount <= 0 || !endDate) {
        showMessage('Por favor, completa todos los campos correctamente para abrir tu cuenta de ahorro.', 'error');
        return;
    }
    if (new Date(endDate) <= new Date()) {
        showMessage('La fecha de finalización debe ser en el futuro.', 'error');
        return;
    }

    let initialDepositAmountInUSD = initialDepositAmount;
    if (initialDepositCurrency === 'DOP') {
        initialDepositAmountInUSD = initialDepositAmount / USD_TO_DOP_RATE;
    }

    // Verificar si el usuario tiene suficiente saldo para el depósito inicial
    if (currentBalanceUSD < initialDepositAmountInUSD) {
        showMessage(`Saldo insuficiente en tu cuenta principal para el depósito inicial de ${initialDepositAmount.toFixed(2)} ${initialDepositCurrency}. Necesitas al menos $${initialDepositAmountInUSD.toFixed(2)} USD.`, 'error');
        return;
    }

    try {
        // Enviar la solicitud de apertura de cuenta de ahorro a pending_requests
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pending_requests'), {
            userId: currentUserId,
            type: 'savings_account_open',
            savingsGoal: savingsGoal,
            initialDepositAmount: initialDepositAmount,
            initialDepositCurrency: initialDepositCurrency,
            preferredSavingsFrequency: preferredSavingsFrequency,
            periodicContributionAmount: periodicContributionAmount,
            endDate: endDate,
            timestamp: serverTimestamp(),
            status: 'pending' // Pendiente de aprobación del administrador
        });

        showMessage(`Solicitud para abrir cuenta de ahorro "${savingsGoal}" enviada. Esperando aprobación del administrador.`, 'success');
        closeModal(openSavingsAccountModal, savingsAccountForm);

        // Notificar al administrador
        const userDocSnap = await getDoc(doc(db, 'artifacts', appId, 'users', currentUserId));
        const userData = userDocSnap.data();
        const whatsappMessage = `
Nueva solicitud de apertura de cuenta de ahorro:
Usuario: ${userData.name} ${userData.surname} (ID: ${userData.userDisplayId || userData.userId})
Objetivo: ${savingsGoal}
Depósito Inicial: ${initialDepositAmount.toFixed(2)} ${initialDepositCurrency}
Frecuencia: ${preferredSavingsFrequency}
Contribución Periódica: ${periodicContributionAmount.toFixed(2)} USD
Fecha Fin: ${endDate}
Por favor, revisa y confirma.
`;
        const encodedMessage = encodeURIComponent(whatsappMessage);
        window.open(`https://wa.me/${ADMIN_PHONE_NUMBER_FULL}?text=${encodedMessage}`, '_blank');

    } catch (error) {
        console.error("Error al solicitar apertura de cuenta de ahorro:", error);
        showMessage('Error al procesar la solicitud de apertura de cuenta de ahorro. Intenta de nuevo.', 'error');
    }
});


// Función para obtener el nombre de visualización del usuario
async function getUserDisplayName(uid) {
    if (userDisplayNamesCache[uid]) {
        return userDisplayNamesCache[uid];
    }
    try {
        const userDoc = await getDoc(doc(db, 'artifacts', appId, 'users', uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const displayName = `${userData.name || 'Usuario'} ${userData.surname || ''}`;
            userDisplayNamesCache[uid] = displayName;
            return displayName;
        }
    } catch (error) {
        console.error("Error fetching user display name:", error);
    }
    return `Usuario (${uid.substring(0, 5)}...)`;
}

// Función para obtener el número de teléfono del usuario (para WhatsApp)
async function getUserPhoneNumber(uid) {
    if (userPhoneNumbersCache[uid]) {
        return userPhoneNumbersCache[uid];
    }
    try {
        const userDoc = await getDoc(doc(db, 'artifacts', appId, 'users', uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const phoneNumber = userData.phoneNumber || null;
            userPhoneNumbersCache[uid] = phoneNumber;
            return phoneNumber;
        }
    } catch (error) {
        console.error("Error fetching user phone number:", error);
    }
    return null;
}


// --- Funciones para ver cuentas de ahorro (cliente) ---
viewSavingsAccountsBtn.addEventListener('click', () => {
    viewSavingsAccountsModal.classList.remove('hidden');
    loadSavingsAccounts();
});

closeViewSavingsAccountsBtn.addEventListener('click', () => {
    closeModal(viewSavingsAccountsModal);
    // No hay oyente en tiempo real aquí, por lo que no hay desuscripción necesaria.
});

/**
 * Carga y muestra las cuentas de ahorro del usuario actual.
 */
async function loadSavingsAccounts() {
    if (!currentUserId) {
        showMessage('No se pudieron cargar tus cuentas de ahorro. Usuario no autenticado.', 'error');
        return;
    }

    savingsAccountsTableBody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-gray-500">Cargando cuentas de ahorro...</td></tr>';

    try {
        const savingsAccountsRef = collection(db, 'artifacts', appId, 'users', currentUserId, 'savings_accounts');
        const q = query(savingsAccountsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        savingsAccountsTableBody.innerHTML = ''; // Limpiar tabla antes de añadir

        if (querySnapshot.empty) {
            savingsAccountsTableBody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-gray-500">No tienes cuentas de ahorro.</td></tr>';
            return;
        }

        querySnapshot.forEach(docSnap => {
            const account = { id: docSnap.id, ...docSnap.data() };
            appendSavingsAccountToTable(account);
        });
    } catch (error) {
        console.error("Error al cargar cuentas de ahorro:", error);
        showMessage('Error al cargar tus cuentas de ahorro.', 'error');
    }
}

/**
 * Añade una fila de cuenta de ahorro a la tabla del usuario.
 * @param {Object} account El objeto de la cuenta de ahorro.
 */
function appendSavingsAccountToTable(account) {
    const row = savingsAccountsTableBody.insertRow();
    row.classList.add('hover:bg-gray-50');

    const startDate = account.startDate ? new Date(account.startDate.seconds * 1000).toLocaleDateString() : 'N/A';
    const endDate = account.endDate || 'N/A';
    const balanceUSD = `$${(account.balanceUSD ?? 0).toFixed(2)} USD`;
    const periodicAmount = `$${(account.periodicContributionAmount ?? 0).toFixed(2)} USD`;

    row.insertCell(0).textContent = account.savingsGoal;
    row.insertCell(1).textContent = balanceUSD;
    row.insertCell(2).textContent = account.preferredSavingsFrequency;
    row.insertCell(3).textContent = periodicAmount;
    row.insertCell(4).textContent = startDate;
    row.insertCell(5).textContent = endDate;
    row.insertCell(6).textContent = account.status;

    const actionsCell = row.insertCell(7);
    // Botón de Depositar en Ahorros
    const depositBtn = document.createElement('button');
    depositBtn.textContent = 'Depositar';
    depositBtn.classList.add('bg-blue-500', 'hover:bg-blue-700', 'text-white', 'font-bold', 'py-1', 'px-2', 'rounded', 'text-xs', 'mr-2', 'transition', 'duration-150');
    depositBtn.onclick = () => showDepositToSavingsModal(account.accountId, account.savingsGoal);
    actionsCell.appendChild(depositBtn);

    // Botón de Retirar de Ahorros
    const withdrawBtn = document.createElement('button');
    withdrawBtn.textContent = 'Retirar';
    withdrawBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-700', 'text-white', 'font-bold', 'py-1', 'px-2', 'rounded', 'text-xs', 'mr-2', 'transition', 'duration-150');
    withdrawBtn.onclick = () => showWithdrawFromSavingsModal(account.accountId, account.savingsGoal, account.balanceUSD);
    actionsCell.appendChild(withdrawBtn);

    // Botón de Eliminar Cuenta de Ahorro
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Eliminar';
    deleteBtn.classList.add('bg-red-500', 'hover:bg-red-700', 'text-white', 'font-bold', 'py-1', 'px-2', 'rounded', 'text-xs', 'transition', 'duration-150');
    deleteBtn.onclick = () => showConfirmDeleteSavingsAccountModal(account.accountId, account.savingsGoal, account.balanceUSD);
    actionsCell.appendChild(deleteBtn);
}


// --- NUEVO: Funciones de anuncios ---
editAnnouncementsBtn.addEventListener('click', async () => {
    editAnnouncementsModal.classList.remove('hidden');
    await loadAnnouncementsForEdit();
});

cancelEditAnnouncementsBtn.addEventListener('click', () => {
    closeModal(editAnnouncementsModal, editAnnouncementsForm);
});

/**
 * Carga el anuncio actual en el textarea de edición.
 */
async function loadAnnouncementsForEdit() {
    try {
        // La ruta es artifacts/{appId}/public/data/settings/announcements/current
        const announcementDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcements', 'current');
        const docSnap = await getDoc(announcementDocRef);
        if (docSnap.exists()) {
            announcementsTextarea.value = docSnap.data().text || '';
        } else {
            announcementsTextarea.value = 'No hay anuncios configurados todavía.';
        }
    } catch (error) {
        console.error("Error al cargar anuncios para edición:", error);
        showMessage('Error al cargar los anuncios para edición. Intenta de nuevo.', 'error');
    }
}

/**
 * Guarda los anuncios editados en Firestore.
 */
editAnnouncementsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    if (!currentUser || currentUser.email !== ADMIN_EMAIL) {
        showMessage('Acceso denegado. Solo los administradores pueden editar anuncios.', 'error');
        return;
    }

    const newAnnouncementText = announcementsTextarea.value.trim();

    try {
        const announcementDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcements', 'current');
        await setDoc(announcementDocRef, {
            text: newAnnouncementText,
            lastUpdated: serverTimestamp(),
            updatedBy: currentUserId
        }, { merge: true }); // Usar merge para no sobrescribir otros campos si los hubiera

        showMessage('Anuncio actualizado con éxito.', 'success');
        closeModal(editAnnouncementsModal, editAnnouncementsForm);
        loadAnnouncements(); // Recarga los anuncios en el panel de control
    } catch (error) {
        console.error("Error al guardar anuncio:", error);
        showMessage('Error al guardar el anuncio. Intenta de nuevo.', 'error');
    }
});

/**
 * Carga y muestra los anuncios en el panel de control del usuario.
 */
async function loadAnnouncements() {
    try {
        const announcementDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'announcements', 'current');
        onSnapshot(announcementDocRef, (docSnap) => {
            announcementsList.innerHTML = ''; // Limpiar lista
            if (docSnap.exists()) {
                const announcementText = docSnap.data().text || 'No hay anuncios disponibles.';
                // Divide por líneas y crea elementos de lista
                announcementText.split('\n').forEach(line => {
                    if (line.trim()) {
                        const li = document.createElement('li');
                        li.textContent = line.trim();
                        li.classList.add('mb-1');
                        announcementsList.appendChild(li);
                    }
                });
                if (!announcementsText.trim()) {
                    announcementsList.innerHTML = '<li>No hay anuncios disponibles.</li>';
                }
            } else {
                announcementsList.innerHTML = '<li>No hay anuncios disponibles.</li>';
            }
        });
    } catch (error) {
        console.error("Error al cargar anuncios:", error);
        announcementsList.innerHTML = '<li>Error al cargar anuncios.</li>';
    }
}


// --- NUEVO: Funciones de depósito/retiro de ahorros ---
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
    currentSavingsAccountGoal = savingsGoal; // Guardar el objetivo para mostrar
    currentSavingsAccountBalanceUSD = balanceUsd; // Guardar el saldo para cálculo de tarifa

    const feeAmountUSD = balanceUsd * SAVINGS_DELETE_FEE_RATE;
    const remainingBalance = balanceUsd - feeAmountUSD;

    deleteSavingsAccountGoalDisplay.textContent = `Objetivo: ${savingsGoal}`;
    deleteSavingsAccountFeeDisplay.textContent = `Tarifa de Eliminación (2%): $${feeAmountUSD.toFixed(2)} USD`;
    deleteSavingsAccountRemainingDisplay.textContent = `Saldo Restante Transferido: $${remainingBalance.toFixed(2)} USD`;

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
    if (!currentSavingsAccountId || !currentUserId) {
        showMessage('Error: No se pudo identificar la cuenta de ahorro o el usuario.', 'error');
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

        const currentSavingsBalanceUSD = savingsData.balanceUSD;
        const feeAmount = currentSavingsBalanceUSD * SAVINGS_DELETE_FEE_RATE;
        const remainingBalanceToTransfer = currentSavingsBalanceUSD - feeAmount;

        // Agrega el saldo restante (después de la tarifa) a la cuenta principal del usuario
        let newUserBalanceUSD = userData.balanceUSD + remainingBalanceToTransfer;
        let newUserBalanceDOP = newUserBalanceUSD * USD_TO_DOP_RATE;

        await updateDoc(userProfileRef, {
            balanceUSD: newUserBalanceUSD,
            balanceDOP: newUserBalanceDOP
        });

        // Elimina el documento de la cuenta de ahorro
        await deleteDoc(savingsAccountRef);

        // Registra la transacción de eliminación de cuenta de ahorro
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: currentUserId,
            type: 'delete_savings_account',
            savingsAccountId: currentSavingsAccountId,
            savingsGoal: savingsData.savingsGoal,
            originalBalance: currentSavingsBalanceUSD,
            feeAmount: feeAmount,
            remainingBalanceTransferred: remainingBalanceToTransfer,
            timestamp: serverTimestamp(),
            status: 'completed',
            description: `Cuenta de ahorro "${savingsData.savingsGoal}" eliminada. Saldo transferido a cuenta principal.`
        });

        showMessage(`¡Cuenta de ahorro "${currentSavingsAccountGoal}" eliminada con éxito! $${remainingBalanceToTransfer.toFixed(2)} USD transferidos a tu cuenta principal.`, 'success');
        closeModal(confirmDeleteSavingsAccountModal);
        loadSavingsAccounts(); // Recargar la lista de cuentas de ahorro

    } catch (error) {
        console.error("Error al eliminar cuenta de ahorro:", error);
        showMessage('Error al eliminar la cuenta de ahorro. Intenta de nuevo.', 'error');
    }
});


// --- NUEVO: Funciones para deudas de ahorro (cliente) ---
viewSavingsDebtsBtn.addEventListener('click', () => {
    savingsDebtsModal.classList.remove('hidden');
    loadUserSavingsDebts();
});

closeSavingsDebtsModalBtn.addEventListener('click', () => {
    closeModal(savingsDebtsModal);
    if (savingsDebtsUnsubscribe) {
        savingsDebtsUnsubscribe();
        savingsDebtsUnsubscribe = null;
    }
});

/**
 * Carga y muestra las deudas de ahorro del usuario actual.
 */
function loadUserSavingsDebts() {
    if (!currentUserId) {
        showMessage('No se pudieron cargar tus deudas de ahorro. Usuario no autenticado.', 'error');
        return;
    }

    if (savingsDebtsUnsubscribe) {
        savingsDebtsUnsubscribe();
        savingsDebtsUnsubscribe = null;
    }

    const savingsDebtsRef = collection(db, 'artifacts', appId, 'public', 'data', 'savings_debts');
    const q = query(
        savingsDebtsRef,
        where('userId', '==', currentUserId),
        where('status', '==', 'pending'), // Solo deudas pendientes
        orderBy('createdAt', 'desc')
    );

    savingsDebtsUnsubscribe = onSnapshot(q, (snapshot) => {
        savingsDebtsTableBody.innerHTML = ''; // Limpiar tabla

        if (snapshot.empty) {
            savingsDebtsTableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-gray-500">No tienes deudas de ahorro pendientes.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const debt = { id: doc.id, ...doc.data() };
            appendUserSavingsDebtToTable(debt);
        });
    }, (error) => {
        console.error("Error al cargar deudas de ahorro del usuario:", error);
        showMessage('Error al cargar tus deudas de ahorro.', 'error');
    });
}

/**
 * Añade una fila de deuda de ahorro a la tabla del cliente.
 * @param {Object} debt El objeto de la deuda de ahorro.
 */
function appendUserSavingsDebtToTable(debt) {
    const row = savingsDebtsTableBody.insertRow();
    row.classList.add('hover:bg-gray-50');

    const dueDate = debt.dueDate ? new Date(debt.dueDate).toLocaleDateString() : 'N/A';
    const amountDue = `$${(debt.amountDue ?? 0).toFixed(2)} ${debt.currency || 'USD'}`;
    const status = debt.status || 'N/A';

    row.insertCell(0).textContent = debt.savingsGoal;
    row.insertCell(1).textContent = amountDue;
    row.insertCell(2).textContent = dueDate;
    row.insertCell(3).textContent = status;

    const actionsCell = row.insertCell(4);
    if (debt.status === 'pending') {
        const payBtn = document.createElement('button');
        payBtn.textContent = 'Pagar Deuda';
        payBtn.classList.add('bg-green-500', 'hover:bg-green-700', 'text-white', 'font-bold', 'py-1', 'px-2', 'rounded', 'text-xs', 'transition', 'duration-150');
        payBtn.onclick = () => paySavingsDebt(debt.id, debt.amountDue, debt.currency, debt.savingsGoal);
        actionsCell.appendChild(payBtn);
    } else {
        actionsCell.textContent = 'N/A';
    }
}

/**
 * Permite al usuario pagar una deuda de ahorro.
 * @param {string} debtId El ID del documento de deuda.
 * @param {number} amountDue La cantidad adeudada.
 * @param {string} currency La moneda de la deuda.
 * @param {string} savingsGoal El objetivo de ahorro relacionado.
 */
async function paySavingsDebt(debtId, amountDue, currency, savingsGoal) {
    hideMessage();
    if (!currentUserId) {
        showMessage('Usuario no autenticado para pagar la deuda.', 'error');
        return;
    }

    let amountInUSD = amountDue;
    if (currency === 'DOP') {
        amountInUSD = amountDue / USD_TO_DOP_RATE;
    }

    if (currentBalanceUSD < amountInUSD) {
        showMessage(`Saldo insuficiente en tu cuenta principal para pagar la deuda. Necesitas $${amountInUSD.toFixed(2)} USD.`, 'error');
        return;
    }

    try {
        const userProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        const debtDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'savings_debts', debtId);

        // Actualiza el saldo del usuario
        let newUserBalanceUSD = currentBalanceUSD - amountInUSD;
        let newUserBalanceDOP = newUserBalanceUSD * USD_TO_DOP_RATE;

        await updateDoc(userProfileRef, { balanceUSD: newUserBalanceUSD, balanceDOP: newUserBalanceDOP });

        // Marca la deuda como pagada
        await updateDoc(debtDocRef, {
            status: 'paid',
            paidAt: serverTimestamp(),
            paidAmount: amountInUSD,
            paidCurrency: 'USD'
        });

        // Registra la transacción de pago de deuda
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: currentUserId,
            type: 'savings_debt_payment',
            amount: amountDue,
            currency: currency,
            savingsGoal: savingsGoal,
            debtId: debtId,
            timestamp: serverTimestamp(),
            status: 'completed',
            description: `Pago de deuda de ahorro para "${savingsGoal}"`
        });

        showMessage(`¡Deuda de ahorro para "${savingsGoal}" pagada con éxito!`, 'success');
        // El oyente onSnapshot en loadUserSavingsDebts actualizará la tabla
    } catch (error) {
        console.error("Error al pagar la deuda de ahorro:", error);
        showMessage('Error al pagar la deuda de ahorro. Intenta de nuevo.', 'error');
    }
}


// --- NUEVO: Funciones para deudas de ahorro del administrador ---
viewAdminSavingsDebtsBtn.addEventListener('click', () => {
    adminSavingsDebtsModal.classList.remove('hidden');
    loadAdminSavingsDebts();
});

closeAdminSavingsDebtsModalBtn.addEventListener('click', () => {
    closeModal(adminSavingsDebtsModal);
    if (adminSavingsDebtsUnsubscribe) {
        adminSavingsDebtsUnsubscribe();
        adminSavingsDebtsUnsubscribe = null;
    }
});

/**
 * Carga y muestra todas las deudas de ahorro para el administrador.
 */
function loadAdminSavingsDebts() {
    if (!currentUser || currentUser.email !== ADMIN_EMAIL) {
        showMessage('Acceso denegado. Solo los administradores pueden ver esto.', 'error');
        return;
    }

    if (adminSavingsDebtsUnsubscribe) {
        adminSavingsDebtsUnsubscribe();
        adminSavingsDebtsUnsubscribe = null;
    }

    const savingsDebtsRef = collection(db, 'artifacts', appId, 'public', 'data', 'savings_debts');
    const q = query(savingsDebtsRef, orderBy('createdAt', 'desc'));

    adminSavingsDebtsUnsubscribe = onSnapshot(q, (snapshot) => {
        adminSavingsDebtsTableBody.innerHTML = ''; // Limpiar tabla

        if (snapshot.empty) {
            adminSavingsDebtsTableBody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-gray-500">No hay deudas de ahorro registradas.</td></tr>';
            return;
        }

        snapshot.forEach(async (doc) => {
            const debt = { id: doc.id, ...doc.data() };
            debt.userName = await getUserDisplayName(debt.userId); // Obtener nombre del usuario
            appendAdminSavingsDebtToTable(debt);
        });
    }, (error) => {
        console.error("Error al cargar deudas de ahorro del administrador:", error);
        showMessage('Error al cargar las deudas de ahorro del administrador.', 'error');
    });
}

/**
 * Añade una fila de deuda de ahorro a la tabla del administrador.
 * @param {Object} debt El objeto de la deuda de ahorro.
 */
async function appendAdminSavingsDebtToTable(debt) {
    const row = adminSavingsDebtsTableBody.insertRow();
    row.classList.add('hover:bg-gray-50');

    const dueDate = debt.dueDate ? new Date(debt.dueDate).toLocaleDateString() : 'N/A';
    const amountDue = `$${(debt.amountDue ?? 0).toFixed(2)} ${debt.currency || 'USD'}`;
    const status = debt.status || 'N/A';
    const contactPhoneNumber = await getUserPhoneNumber(debt.userId);
    const whatsappLink = contactPhoneNumber ? `https://wa.me/${contactPhoneNumber}?text=${encodeURIComponent(`Hola ${debt.userName}, sobre tu deuda de ahorro de ${debt.savingsGoal} por ${amountDue} que vence el ${dueDate}.`)}` : '#';

    row.insertCell(0).textContent = debt.userName;
    row.insertCell(1).textContent = debt.savingsGoal;
    row.insertCell(2).textContent = amountDue;
    row.insertCell(3).textContent = dueDate;
    row.insertCell(4).textContent = status;

    const contactCell = row.insertCell(5);
    if (contactPhoneNumber) {
        const contactBtn = document.createElement('a');
        contactBtn.textContent = 'WhatsApp';
        contactBtn.href = whatsappLink;
        contactBtn.target = '_blank';
        contactBtn.classList.add('bg-green-500', 'hover:bg-green-700', 'text-white', 'font-bold', 'py-1', 'px-2', 'rounded', 'text-xs', 'transition', 'duration-150');
        contactCell.appendChild(contactBtn);
    } else {
        contactCell.textContent = 'N/A';
    }


    const actionsCell = row.insertCell(6);
    if (debt.status === 'pending') {
        // Botón de Aplicar Indemnización
        const penalizeBtn = document.createElement('button');
        penalizeBtn.textContent = 'Indemnizar';
        penalizeBtn.classList.add('bg-red-500', 'hover:bg-red-700', 'text-white', 'font-bold', 'py-1', 'px-2', 'rounded', 'text-xs', 'mr-2', 'transition', 'duration-150');
        penalizeBtn.onclick = () => applySavingsIndemnization(debt.id, debt.userId, debt.amountDue, debt.savingsGoal);
        actionsCell.appendChild(penalizeBtn);

        // Botón de Marcar como Pagada (Manualmente)
        const markPaidBtn = document.createElement('button');
        markPaidBtn.textContent = 'Marcar Pagada';
        markPaidBtn.classList.add('bg-blue-500', 'hover:bg-blue-700', 'text-white', 'font-bold', 'py-1', 'px-2', 'rounded', 'text-xs', 'transition', 'duration-150');
        markPaidBtn.onclick = () => resolveSavingsDebtManually(debt.id, debt.userId, debt.amountDue, debt.savingsGoal);
        actionsCell.appendChild(markPaidBtn);
    } else {
        actionsCell.textContent = 'N/A';
    }
}


/**
 * Aplica una indemnización a una deuda de ahorro vencida.
 * @param {string} debtId El ID del documento de deuda.
 * @param {string} userId El UID de Firebase del usuario.
 * @param {number} amountDue La cantidad original adeudada por la deuda.
 * @param {string} savingsGoal El objetivo de la cuenta de ahorro asociada.
 */
async function applySavingsIndemnization(debtId, userId, amountDue, savingsGoal) {
    hideMessage();
    if (!currentUser || currentUser.email !== ADMIN_EMAIL) {
        showMessage('Acceso denegado. Solo los administradores pueden aplicar indemnizaciones.', 'error');
        return;
    }

    try {
        const debtDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'savings_debts', debtId);
        const userProfileRef = doc(db, 'artifacts', appId, 'users', userId);
        const adminProfileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid);

        const userDocSnap = await getDoc(userProfileRef);
        const adminDocSnap = await getDoc(adminProfileRef);

        if (!userDocSnap.exists() || !adminDocSnap.exists()) {
            showMessage('Error: Perfil de usuario o administrador no encontrado.', 'error');
            return;
        }

        const userData = userDocSnap.data();
        const adminData = adminDocSnap.data();

        let amountDueInUSD = amountDue; // Asumiendo que amountDue ya está en USD para cálculos de indemnización

        const penaltyAmount = amountDueInUSD * INDEMNIZATION_RATE;

        // Verificar si el usuario tiene suficiente saldo para la penalización
        if (userData.balanceUSD < penaltyAmount) {
            showMessage(`Error: Saldo insuficiente (${userData.name}) para aplicar la indemnización.`, 'error');
            return;
        }

        // Deduce la penalización del usuario
        let newUserBalanceUSD = userData.balanceUSD - penaltyAmount;
        let newUserBalanceDOP = newUserBalanceUSD * USD_TO_DOP_RATE;

        // Añade la penalización al administrador
        let newAdminBalanceUSD = adminData.balanceUSD + penaltyAmount;
        let newAdminBalanceDOP = newAdminBalanceUSD * USD_TO_DOP_RATE;

        await updateDoc(userProfileRef, { balanceUSD: newUserBalanceUSD, balanceDOP: newUserBalanceDOP });
        await updateDoc(adminProfileRef, { balanceUSD: newAdminBalanceUSD, balanceDOP: newAdminBalanceDOP });

        // Actualiza el estado de la deuda
        await updateDoc(debtDocRef, {
            status: 'penalized',
            penaltyAmount: penaltyAmount,
            penalizedAt: serverTimestamp()
        });

        // Registra la transacción de indemnización
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
            userId: userId, // Usuario que pagó la penalización
            payerId: userId,
            receiverId: currentUser.uid,
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
    if (!currentUser || currentUser.email !== ADMIN_EMAIL) {
        showMessage('Acceso denegado. Solo los administradores pueden marcar deudas como pagadas.', 'error');
        return;
    }

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
            currency: 'USD', // Asumiendo USD para el registro
            savingsGoal: savingsGoal,
            debtId: debtId,
            timestamp: serverTimestamp(),
            status: 'completed',
            description: `Deuda de ahorro para "${savingsGoal}" marcada como pagada manualmente.`
        });

        showMessage(`¡Deuda de ahorro para "${await getUserDisplayName(userId)}" (${savingsGoal}) marcada como pagada manualmente!`, 'success');

    } catch (error) {
        console.error("Error al marcar la deuda como pagada manualmente:", error);
        showMessage('Error al marcar la deuda como pagada. Intenta de nuevo.', 'error');
    }
}

/**
 * Función que se ejecuta periódicamente para revisar las cuentas de ahorro y aplicar cobros.
 * En un entorno real, esto sería una función de Cloud Scheduler + Cloud Function.
 */
async function runAutomatedSavingsCollection() {
    // Esta función solo debe ser ejecutada por el administrador o un proceso en segundo plano
    // Para propósitos de demostración, un administrador podría activarla manualmente.
    // O podrías llamarla al iniciar sesión el administrador.

    if (!currentUser || currentUser.email !== ADMIN_EMAIL) {
        // showMessage('Esta función es solo para administradores o procesos automáticos.', 'info');
        return;
    }
    console.log("Iniciando revisión automatizada de cobros de ahorro...");
    try {
        const allUsersSnapshot = await getDocs(collection(db, 'artifacts', appId, 'users'));
        for (const userDoc of allUsersSnapshot.docs) {
            const userId = userDoc.id;
            const savingsAccountsRef = collection(db, 'artifacts', appId, 'users', userId, 'savings_accounts');
            const savingsSnapshot = await getDocs(savingsAccountsRef);

            for (const savingsDoc of savingsSnapshot.docs) {
                const savingsData = savingsDoc.data();
                const savingsAccountRef = doc(db, 'artifacts', appId, 'users', userId, 'savings_accounts', savingsDoc.id);

                const nextDueDate = savingsData.nextContributionDueDate ? new Date(savingsData.nextContributionDueDate.seconds * 1000) : null;
                const periodicAmountUSD = savingsData.periodicContributionAmount;
                const userBalanceUSD = (await getDoc(doc(db, 'artifacts', appId, 'users', userId))).data().balanceUSD;

                const today = new Date();
                today.setHours(0, 0, 0, 0); // Normalizar a inicio del día

                if (nextDueDate && nextDueDate <= today && savingsData.status === 'active') {
                    console.log(`Deuda vencida para ${savingsData.savingsGoal} de ${userId}.`);
                    await attemptSavingsCollection(userId, savingsAccountRef, savingsData, periodicAmountUSD, userBalanceUSD);
                }
            }
        }
        console.log("Revisión automatizada de cobros de ahorro completada.");
    } catch (error) {
        console.error("Error en la revisión automatizada de cobros de ahorro:", error);
    }
}


/**
 * Intenta cobrar una contribución de ahorro o registrar una deuda.
 * @param {string} userId El UID del usuario.
 * @param {DocumentReference} savingsAccountRef Referencia al documento de la cuenta de ahorro.
 * @param {Object} savingsData Datos de la cuenta de ahorro.
 * @param {number} periodicAmountUSD Monto periódico en USD.
 * @param {number} userBalanceUSD Saldo principal del usuario en USD.
 */
async function attemptSavingsCollection(userId, savingsAccountRef, savingsData, periodicAmountUSD, userBalanceUSD) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Verificar si ya existe una deuda pendiente para este período para evitar duplicados
    const existingDebtQuery = query(
        collection(db, 'artifacts', appId, 'public', 'data', 'savings_debts'),
        where('userId', '==', userId),
        where('savingsAccountId', '==', savingsData.accountId),
        where('status', '==', 'pending'),
        where('dueDate', '==', formatDateToYYYYMMDD(savingsData.nextContributionDueDate ? new Date(savingsData.nextContributionDueDate.seconds * 1000) : today)) // Asumiendo que nextContributionDueDate es la fecha de la cuota actual
    );
    const existingDebtSnapshot = await getDocs(existingDebtQuery);

    if (existingDebtSnapshot.empty) { // Solo si no hay una deuda pendiente para este período
        if (userBalanceUSD >= periodicAmountUSD) {
            // Realizar cobro automático
            const userProfileRef = doc(db, 'artifacts', appId, 'users', userId);
            const userDocSnap = await getDoc(userProfileRef);
            const userData = userDocSnap.data();

            let newUserBalanceUSD = userData.balanceUSD - periodicAmountUSD;
            let newUserBalanceDOP = newUserBalanceUSD * USD_TO_DOP_RATE;

            let newSavingsBalanceUSD = savingsData.balanceUSD + periodicAmountUSD;
            let newSavingsBalanceDOP = newSavingsBalanceUSD * USD_TO_DOP_RATE;

            await updateDoc(userProfileRef, { balanceUSD: newUserBalanceUSD, balanceDOP: newUserBalanceDOP });
            await updateDoc(savingsAccountRef, { balanceUSD: newSavingsBalanceUSD, balanceDOP: newSavingsBalanceDOP, lastContributionDate: serverTimestamp() });

            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
                userId: userId,
                type: 'automatic_savings_collection',
                amount: periodicAmountUSD,
                currency: 'USD',
                savingsAccountId: savingsData.accountId,
                savingsGoal: savingsData.savingsGoal,
                timestamp: serverTimestamp(),
                status: 'completed',
                description: `Cobro automático de ahorro para "${savingsData.savingsGoal}"`
            });
            console.log(`Cobro automático de $${periodicAmountUSD.toFixed(2)} USD para "${savingsData.savingsGoal}" de ${await getUserDisplayName(userId)} realizado con éxito.`);
            showMessage(`¡Cobro automático de $${periodicAmountUSD.toFixed(2)} USD para "${savingsData.savingsGoal}" realizado con éxito!`, 'success');

        } else {
            // Registrar deuda
            const dueDateForDebt = getNextDueDate(savingsData.preferredSavingsFrequency, today); // La fecha de vencimiento de la deuda es la próxima cuota + el ciclo
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'savings_debts'), {
                userId: userId,
                savingsAccountId: savingsData.accountId,
                savingsGoal: savingsData.savingsGoal,
                amountDue: periodicAmountUSD,
                currency: 'USD',
                dueDate: formatDateToYYYYMMDD(dueDateForDebt), // Fecha de vencimiento para pagar la deuda
                status: 'pending', // 'pending', 'paid', 'penalized'
                penaltyApplied: false,
                createdAt: serverTimestamp(),
                lastUpdated: serverTimestamp()
            });
            console.log(`No hay suficiente saldo para el cobro automático de "${savingsData.savingsGoal}". Se ha registrado una deuda de $${periodicAmountUSD.toFixed(2)} USD para ${await getUserDisplayName(userId)}.`);
            showMessage(`No hay suficiente saldo para el cobro automático de "${savingsData.savingsGoal}". Se ha registrado una deuda de $${periodicAmountUSD.toFixed(2)} USD. Tienes hasta el ${dueDateForDebt.toLocaleDateString()} para pagar.`, 'error');
        }

        // Actualiza la próxima fecha de vencimiento de la contribución después de intentar el cobro/crear la deuda
        await updateDoc(savingsAccountRef, { nextContributionDueDate: getNextDueDate(savingsData.preferredSavingsFrequency, today) });
    } else {
        console.log(`Ya existe una deuda para ${savingsData.savingsGoal} para este período. No se creó ninguna deuda nueva.`);
        // showMessage(`Ya tienes una deuda pendiente para tu cuenta de ahorro "${savingsData.savingsGoal}".`, 'info'); // No mostrar esto cada vez que el admin carga la página
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
    }
    else if (frequency === 'Mensual') {
        nextDate = addMonths(nextDate, 1);
    }
    return nextDate;
}

// Ejecutar la revisión automatizada cuando el administrador inicia sesión
// Descomenta la línea de abajo si quieres que se ejecute al cargar la página para el admin
// onAuthStateChanged(auth, user => { if (user && user.email === ADMIN_EMAIL) runAutomatedSavingsCollection(); });

// --- NUEVO: Funciones para recibir dinero de banco exterior ---
receiveMoneyFromExternalBtn.addEventListener('click', () => {
    receiveMoneyFromExternalModal.classList.remove('hidden');
    receiveMoneyFromExternalForm.reset();
});

closeReceiveMoneyFromExternalBtn.addEventListener('click', () => {
    closeModal(receiveMoneyFromExternalModal, receiveMoneyFromExternalForm);
});

receiveMoneyFromExternalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const senderName = externalSenderNameInput.value.trim();
    const amount = parseFloat(externalAmountInput.value);
    const currency = 'USD'; // Asumimos USD para depósitos externos por simplicidad
    const sourceBank = externalOriginBankInput.value.trim();
    const serialNumber = externalSerialNumberInput.value.trim();

    if (!senderName || isNaN(amount) || amount <= 0 || !sourceBank || !serialNumber) {
        showMessage('Por favor, completa todos los campos para solicitar la recepción de dinero.', 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'externalBankRequests'), { // Nueva colección para estas solicitudes
            userId: currentUserId,
            type: 'receive_external_bank_money', // Nuevo tipo de solicitud
            senderName: senderName,
            amount: amount,
            currency: currency,
            sourceBank: sourceBank,
            serialNumber: serialNumber,
            timestamp: serverTimestamp(),
            status: 'pending' // Siempre pendiente de aprobación del administrador
        });

        showMessage(`Solicitud de recepción de ${amount.toFixed(2)} ${currency} de ${senderName} enviada. Esperando aprobación del administrador.`, 'success');
        closeModal(receiveMoneyFromExternalModal, receiveMoneyFromExternalForm);

        // Envía un mensaje de WhatsApp al administrador
        const userDocSnap = await getDoc(doc(db, 'artifacts', appId, 'users', currentUserId));
        const userData = userDocSnap.data();
        const whatsappMessage = `
Nueva solicitud de depósito externo pendiente:
Usuario: ${userData.name} ${userData.surname} (ID: ${userData.userDisplayId || userData.userId})
Remitente: ${senderName}
Monto: ${amount.toFixed(2)} ${currency}
Banco de Origen: ${sourceBank}
Número de Referencia: ${serialNumber}
Por favor, revisa y confirma.
`;
        const encodedMessage = encodeURIComponent(whatsappMessage);
        window.open(`https://wa.me/${ADMIN_PHONE_NUMBER_FULL}?text=${encodedMessage}`, '_blank');

    } catch (error) {
        console.error("Error al solicitar recepción de dinero externo:", error);
        showMessage('Error al procesar la solicitud de recepción de dinero. Intenta de nuevo.', 'error');
    }
});
