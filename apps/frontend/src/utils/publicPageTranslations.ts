// 🌍 Sistema di traduzioni unificato per le pagine pubbliche

export type SupportedLanguage = "IT" | "EN" | "ES" | "PT"

export interface PublicPageTexts {
  // Loading states
  loading: string
  loadingMessage: string
  pleaseWait: string

  // Navigation buttons
  viewCart: string
  viewOrders: string
  viewProfile: string
  finalizeOrder: string

  // Menu labels
  menuTitle: string
  cart: string
  myOrders: string
  profile: string

  // Common actions
  save: string
  cancel: string
  close: string
  edit: string
  delete: string
  confirm: string
  back: string
  continue: string

  // Status labels
  pending: string
  confirmed: string
  shipped: string
  delivered: string
  cancelled: string

  // Form labels
  name: string
  email: string
  phone: string
  address: string
  company: string

  // Cart labels
  product: string
  service: string
  productBadge: string
  serviceBadge: string
  quantity: string
  price: string
  total: string
  discount: string
  originalPrice: string
  finalPrice: string
  format: string
  formatLabel: string
  duration: string
  notes: string

  // Order labels
  orderCode: string
  orderDate: string
  orderStatus: string
  paymentStatus: string
  items: string
  orderSummary: string
  orderDetails: string
  paymentMethod: string
  tracking: string
  products: string
  subtotal: string
  vat: string
  shipping: string

  // Profile labels
  personalData: string
  contactInfo: string
  billingAddress: string
  shippingAddress: string
  preferences: string

  // Payment labels (Step 4)
  cardNumber: string
  cardholderName: string
  expiry: string
  cvcTooltip: string
  securePayment: string
  totalToPay: string
  includesVAT: string
  confirmPayment: string
  processing: string
  paymentDisclaimer: string
  proceedToPayment: string

  // Messages
  noData: string
  error: string
  success: string
  dataUpdated: string

  // Greetings
  hello: string
  welcome: string

  // Checkout specific
  yourProducts: string
  addProducts: string
  addServices: string
  emptyCart: string
  addProductsToContinue: string
  confirmOrder: string
  productSummary: string
  selectProducts: string
  loadingProducts: string
  confirmDelete: string
  confirmDeleteMessage: string
  remove: string
  addToCart: string
  thanks: string
  greeting: string
  creatingOrder: string
  steps: {
    products: string
    addresses: string
    confirm: string
    payment: string
  }

  // Checkout Success specific
  orderConfirmed: string
  orderReceived: string
  contactSoon: string
  closePage: string

  // Form placeholders
  streetPlaceholder: string
  cityPlaceholder: string
  postalCodePlaceholder: string
  provincePlaceholder: string
  countryPlaceholder: string
  namePlaceholder: string
  phonePlaceholder: string
  companyPlaceholder: string
  notesPlaceholder: string
  searchProductsPlaceholder: string

  // Form labels
  streetLabel: string
  cityLabel: string
  postalCodeLabel: string
  provinceLabel: string
  countryLabel: string
  sameAsShippingLabel: string
  additionalNotesLabel: string
  orderSuccessMessage: string
  notSpecified: string
  goBack: string

  // Registration page
  registerTitle: string
  registerSubtitle: string
  firstName: string
  lastName: string
  preferredLanguage: string
  currency: string
  gdprConsent: string
  pushNotifications: string
  registerButton: string
  registrationSuccessTitle: string
  registrationSuccessMessage: string
  returnToWhatsApp: string
  registrationErrorTitle: string
  tryAgain: string
  validatingLink: string
  // Registration success page (detailed)
  whatHappensNext: string
  welcomeMessageStep: string
  browseProductsStep: string
  preferencesSavedStep: string
  goToHomepage: string

  // Payment page (Mock Stripe)
  paymentTitle: string
  paymentSubtitle: string
  paymentCardNumber: string
  paymentCardName: string
  paymentExpiry: string
  paymentCvv: string
  paymentPayNow: string
  paymentProcessing: string
  paymentSecure: string
  paymentMockNotice: string
  paymentTestCards: string
  paymentSuccess: string
  paymentAnyExpiry: string
  paymentAnyCvv: string
  paymentCardNameRequired: string
  paymentCardNumberInvalid: string
  paymentExpiryInvalid: string
  paymentCvvInvalid: string

  // Order confirmation page
  orderConfirmedTitle: string
  orderConfirmedMessage: string
  orderConfirmedThankYou: string
  orderConfirmedNumber: string
  orderConfirmedTotal: string
  orderConfirmedDownload: string
  orderConfirmedEmail: string
  orderConfirmedBackToOrders: string

  // Documents (invoice, DDT, credit note)
  documentsTitle: string
  downloadInvoice: string
  downloadDdt: string
  downloadCreditNote: string
  documentNotAvailable: string
  documentBeingPrepared: string

  // Delete Account
  deleteAccountTitle: string
  deleteAccountDescription: string
  deleteAccountButton: string
  deleteAccountConfirmTitle: string
  deleteAccountConfirmMessage: string
  deleteAccountConfirmButton: string
  deleteAccountSuccess: string
  deleteAccountError: string
  deleteAccountDeleting: string
}

export const publicPageTranslations: Record<
  SupportedLanguage,
  PublicPageTexts
> = {
  IT: {
    // Loading states
    loading: "Caricamento...",
    loadingMessage: "Stiamo preparando i tuoi dati",
    pleaseWait: "Attendere prego...",

    // Navigation buttons
    viewCart: "Carrello",
    viewOrders: "Ordini",
    viewProfile: "Profilo",
    finalizeOrder: "Finalizza Ordine",

    // Menu labels
    menuTitle: "Menu",
    cart: "Carrello",
    myOrders: "I Miei Ordini",
    profile: "Profilo",

    // Common actions
    save: "Salva",
    cancel: "Annulla",
    close: "Chiudi",
    edit: "Modifica",
    delete: "Elimina",
    confirm: "Conferma",
    back: "Indietro",
    continue: "Continua",

    // Status labels
    pending: "In Attesa",
    confirmed: "Confermato",
    shipped: "Spedito",
    delivered: "Consegnato",
    cancelled: "Annullato",

    // Form labels
    name: "Nome",
    email: "Email",
    phone: "Telefono",
    address: "Indirizzo",
    company: "Azienda",

    // Cart labels
    product: "Prodotto",
    service: "Servizio",
    productBadge: "PRODOTTO",
    serviceBadge: "SERVIZIO",
    quantity: "Quantità",
    price: "Prezzo",
    total: "Totale",
    discount: "Sconto",
    originalPrice: "Prezzo Originale",
    finalPrice: "Prezzo Finale",
    format: "Formato",
    formatLabel: "Formato:",
    duration: "Durata",
    notes: "Note",

    // Order labels
    orderCode: "Codice Ordine",
    orderDate: "Data Ordine",
    orderStatus: "Stato Ordine",
    paymentStatus: "Stato Pagamento",
    items: "Articoli",
    orderSummary: "Riepilogo Ordine",
    orderDetails: "Dettagli Ordine",
    paymentMethod: "Metodo di Pagamento",
    tracking: "Tracking",
    products: "Prodotti",
    subtotal: "Subtotale",
    vat: "IVA",
    shipping: "Spedizione",

    // Profile labels
    personalData: "Dati Personali",
    contactInfo: "Informazioni di Contatto",
    billingAddress: "Indirizzo di Fatturazione",
    shippingAddress: "Indirizzo di Spedizione",
    preferences: "Preferenze",

    // Payment labels (Step 4)
    cardNumber: "Numero Carta",
    cardholderName: "Nome Titolare",
    expiry: "Scadenza",
    cvcTooltip: "Codice di 3 cifre sul retro della carta",
    securePayment: "Pagamento sicuro crittografato SSL",
    totalToPay: "Totale da Pagare",
    includesVAT: "IVA inclusa",
    confirmPayment: "Conferma Pagamento",
    processing: "Elaborazione...",
    paymentDisclaimer:
      "Cliccando su 'Conferma Pagamento' accetti i nostri Termini e Condizioni",
    proceedToPayment: "Procedi al Pagamento",

    // Messages
    noData: "Nessun dato disponibile",
    error: "Si è verificato un errore",
    success: "Operazione completata con successo",
    dataUpdated: "Dati aggiornati correttamente",

    // Greetings
    hello: "Ciao",
    welcome: "Benvenuto",

    // Checkout specific
    yourProducts: "I Tuoi Prodotti",
    addProducts: "Prodotti",
    addServices: "Servizi",
    emptyCart: "Il tuo carrello è vuoto",
    addProductsToContinue: "Aggiungi prodotti per continuare",
    confirmOrder: "Conferma Ordine",
    productSummary: "Riepilogo Prodotti",
    selectProducts: "Seleziona Prodotti",
    loadingProducts: "Caricamento prodotti...",
    confirmDelete: "Sei sicuro?",
    confirmDeleteMessage: 'Vuoi rimuovere "{name}" dal carrello?',
    remove: "Rimuovi",
    addToCart: "Aggiungi",
    thanks: "Grazie",
    greeting: "Ciao {name}, completa il tuo ordine in pochi passaggi",
    creatingOrder: "Creazione ordine...",
    steps: {
      products: "Prodotti",
      addresses: "Indirizzi",
      confirm: "Conferma",
      payment: "Pagamento",
    },

    // Checkout Success specific
    orderConfirmed: "Ordine Confermato!",
    orderReceived: "Il tuo ordine è stato ricevuto con successo.",
    contactSoon: "Ti contatteremo il prima possibile per la conferma.",
    closePage: "Puoi chiudere questa pagina e tornare alla chat WhatsApp.",

    // Form placeholders
    streetPlaceholder: "Via e numero civico",
    cityPlaceholder: "Città",
    postalCodePlaceholder: "CAP",
    provincePlaceholder: "Provincia",
    countryPlaceholder: "Paese",
    namePlaceholder: "Nome completo",
    phonePlaceholder: "Telefono",
    companyPlaceholder: "Nome azienda",
    notesPlaceholder: "Eventuali note per la consegna...",
    searchProductsPlaceholder: "Cerca prodotti...",

    // Form labels
    streetLabel: "Via e numero civico",
    cityLabel: "Città",
    postalCodeLabel: "CAP",
    provinceLabel: "Provincia",
    countryLabel: "Paese",
    sameAsShippingLabel: "Stesso indirizzo di spedizione",
    additionalNotesLabel: "Note aggiuntive",
    orderSuccessMessage:
      "✅ Ordine creato con successo! Verrai reindirizzato...",
    notSpecified: "Non specificato",
    goBack: "← Indietro",

    // Registration page
    registerTitle: "Registrati per {workspaceName}",
    registerSubtitle: "Completa il modulo qui sotto per iniziare",
    firstName: "Nome *",
    lastName: "Cognome *",
    preferredLanguage: "Lingua Preferita *",
    currency: "Valuta *",
    gdprConsent: "Accetto i termini sulla privacy e il trattamento dei dati",
    pushNotifications: "Accetto di ricevere notifiche push",
    registerButton: "Registrati",
    registrationSuccessTitle: "Registrazione Completata!",
    registrationSuccessMessage:
      "Grazie per esserti registrato. Ora puoi tornare su WhatsApp per continuare la conversazione.",
    returnToWhatsApp: "Torna su WhatsApp",
    registrationErrorTitle: "Errore di Registrazione",
    tryAgain: "Riprova",
    validatingLink: "Validazione link di registrazione...",
    whatHappensNext: "Cosa succede ora?",
    welcomeMessageStep: "Riceverai un messaggio di benvenuto su WhatsApp",
    browseProductsStep: "Potrai sfogliare prodotti e servizi tramite WhatsApp",
    preferencesSavedStep: "Le tue preferenze sono state salvate e verranno usate per personalizzare la tua esperienza",
    goToHomepage: "Vai alla Homepage",

    // Payment page (Mock Stripe)
    paymentTitle: "Pagamento Sicuro",
    paymentSubtitle: "Completa il tuo acquisto in sicurezza",
    paymentCardNumber: "Numero Carta",
    paymentCardName: "Titolare della Carta",
    paymentExpiry: "Scadenza",
    paymentCvv: "CVV",
    paymentPayNow: "Paga Ora",
    paymentProcessing: "Elaborazione Pagamento...",
    paymentSecure: "Il tuo pagamento è protetto",
    paymentMockNotice:
      "Questa è un'interfaccia di pagamento simulata. Non verrà effettuato nessun addebito reale.",
    paymentTestCards: "Carte di Test (Mock)",
    paymentSuccess: "Successo",
    paymentAnyExpiry: "Qualsiasi data futura",
    paymentAnyCvv: "Qualsiasi CVV a 3 cifre",
    paymentCardNameRequired: "Nome richiesto",
    paymentCardNumberInvalid: "Numero carta non valido",
    paymentExpiryInvalid: "Data di scadenza non valida",
    paymentCvvInvalid: "CVV non valido",

    // Order confirmation page
    orderConfirmedTitle: "Ordine Confermato!",
    orderConfirmedMessage: "Il tuo ordine è stato ricevuto con successo",
    orderConfirmedThankYou: "Grazie per il tuo acquisto!",
    orderConfirmedNumber: "Numero Ordine",
    orderConfirmedTotal: "Totale Pagato",
    orderConfirmedDownload: "Scarica Ricevuta",
    orderConfirmedEmail: "Ti abbiamo inviato una email di conferma",
    orderConfirmedBackToOrders: "Torna agli Ordini",

    // Documents
    documentsTitle: "Documenti",
    downloadInvoice: "Scarica Fattura",
    downloadDdt: "Scarica DDT",
    downloadCreditNote: "Scarica Nota di Credito",
    documentNotAvailable: "Non disponibile",
    documentBeingPrepared: "Documento in preparazione",

    // Delete Account
    deleteAccountTitle: "Elimina Account",
    deleteAccountDescription: "Questa azione eliminerà permanentemente il tuo account e tutti i dati associati: cronologia chat, ordini, carrello e preferenze. Questa azione è irreversibile.",
    deleteAccountButton: "Elimina il mio account",
    deleteAccountConfirmTitle: "Sei sicuro?",
    deleteAccountConfirmMessage: "Tutti i tuoi dati verranno eliminati permanentemente. Questa azione non può essere annullata.",
    deleteAccountConfirmButton: "Sì, elimina il mio account",
    deleteAccountSuccess: "Account eliminato con successo",
    deleteAccountError: "Errore durante l'eliminazione dell'account",
    deleteAccountDeleting: "Eliminazione in corso...",
  },

  EN: {
    // Loading states
    loading: "Loading...",
    loadingMessage: "We're preparing your data",
    pleaseWait: "Please wait...",

    // Navigation buttons
    viewCart: "Cart",
    viewOrders: "Orders",
    viewProfile: "Profile",
    finalizeOrder: "Finalize Order",

    // Menu labels
    menuTitle: "Menu",
    cart: "Cart",
    myOrders: "My Orders",
    profile: "Profile",

    // Common actions
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    edit: "Edit",
    delete: "Delete",
    confirm: "Confirm",
    back: "Back",
    continue: "Continue",

    // Status labels
    pending: "Pending",
    confirmed: "Confirmed",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",

    // Form labels
    name: "Name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    company: "Company",

    // Cart labels
    product: "Product",
    service: "Service",
    productBadge: "PRODUCT",
    serviceBadge: "SERVICE",
    quantity: "Quantity",
    price: "Price",
    total: "Total",
    discount: "Discount",
    originalPrice: "Original Price",
    finalPrice: "Final Price",
    format: "Format",
    formatLabel: "Format:",
    duration: "Duration",
    notes: "Notes",

    // Order labels
    orderCode: "Order Code",
    orderDate: "Order Date",
    orderStatus: "Order Status",
    paymentStatus: "Payment Status",
    items: "Items",
    orderSummary: "Order Summary",
    orderDetails: "Order Details",
    paymentMethod: "Payment Method",
    tracking: "Tracking",
    products: "Products",
    subtotal: "Subtotal",
    vat: "VAT",
    shipping: "Shipping",

    // Profile labels
    personalData: "Personal Data",
    contactInfo: "Contact Information",
    billingAddress: "Billing Address",
    shippingAddress: "Shipping Address",
    preferences: "Preferences",

    // Payment labels (Step 4)
    cardNumber: "Card Number",
    cardholderName: "Cardholder Name",
    expiry: "Expiry",
    cvcTooltip: "3-digit code on the back of the card",
    securePayment: "Secure SSL encrypted payment",
    totalToPay: "Total to Pay",
    includesVAT: "VAT included",
    confirmPayment: "Confirm Payment",
    processing: "Processing...",
    paymentDisclaimer:
      "By clicking 'Confirm Payment' you accept our Terms and Conditions",
    proceedToPayment: "Proceed to Payment",

    // Messages
    noData: "No data available",
    error: "An error occurred",
    success: "Operation completed successfully",
    dataUpdated: "Data updated successfully",

    // Greetings
    hello: "Hello",
    welcome: "Welcome",

    // Checkout specific
    yourProducts: "Your Products",
    addProducts: "Products",
    addServices: "Services",
    emptyCart: "Your cart is empty",
    addProductsToContinue: "Add products to continue",
    confirmOrder: "Confirm Order",
    productSummary: "Product Summary",
    selectProducts: "Select Products",
    loadingProducts: "Loading products...",
    confirmDelete: "Are you sure?",
    confirmDeleteMessage: 'Do you want to remove "{name}" from your cart?',
    remove: "Remove",
    addToCart: "Add",
    thanks: "Thanks",
    greeting: "Hello {name}, complete your order in a few steps",
    creatingOrder: "Creating order...",
    steps: {
      products: "Products",
      addresses: "Addresses",
      confirm: "Confirm",
      payment: "Payment",
    },

    // Checkout Success specific
    orderConfirmed: "Order Confirmed!",
    orderReceived: "Your order has been received successfully.",
    contactSoon: "We will contact you as soon as possible for confirmation.",
    closePage: "You can close this page and return to WhatsApp chat.",

    // Form placeholders
    streetPlaceholder: "Street and number",
    cityPlaceholder: "City",
    postalCodePlaceholder: "ZIP Code",
    provincePlaceholder: "State/Province",
    countryPlaceholder: "Country",
    namePlaceholder: "Full name",
    phonePlaceholder: "Phone",
    companyPlaceholder: "Company name",
    notesPlaceholder: "Additional delivery notes...",
    searchProductsPlaceholder: "Search products...",

    // Form labels
    streetLabel: "Street and number",
    cityLabel: "City",
    postalCodeLabel: "ZIP Code",
    provinceLabel: "State/Province",
    countryLabel: "Country",
    sameAsShippingLabel: "Same as shipping address",
    additionalNotesLabel: "Additional notes",
    orderSuccessMessage:
      "✅ Order created successfully! You will be redirected...",
    notSpecified: "Not specified",
    goBack: "← Back",

    // Registration page
    registerTitle: "Register for {workspaceName}",
    registerSubtitle: "Complete the form below to get started",
    firstName: "First Name *",
    lastName: "Last Name *",
    preferredLanguage: "Preferred Language *",
    currency: "Currency *",
    gdprConsent: "I accept the privacy terms and data processing",
    pushNotifications: "I accept to receive push notifications",
    registerButton: "Register",
    registrationSuccessTitle: "Registration Successful!",
    registrationSuccessMessage:
      "Thank you for registering. You can now return to WhatsApp to continue your conversation.",
    returnToWhatsApp: "Return to WhatsApp",
    registrationErrorTitle: "Registration Error",
    tryAgain: "Try Again",
    validatingLink: "Validating registration link...",
    whatHappensNext: "What happens next?",
    welcomeMessageStep: "You'll receive a welcome message on WhatsApp",
    browseProductsStep: "You can now browse products and services via WhatsApp",
    preferencesSavedStep: "Your preferences have been saved and will be used to personalize your experience",
    goToHomepage: "Go to Homepage",

    // Payment page (Mock Stripe)
    paymentTitle: "Secure Payment",
    paymentSubtitle: "Complete your purchase securely",
    paymentCardNumber: "Card Number",
    paymentCardName: "Cardholder Name",
    paymentExpiry: "Expiry Date",
    paymentCvv: "CVV",
    paymentPayNow: "Pay Now",
    paymentProcessing: "Processing Payment...",
    paymentSecure: "Your payment information is secure",
    paymentMockNotice:
      "This is a mock payment interface. No actual charges will be made.",
    paymentTestCards: "Test Cards (Mock)",
    paymentSuccess: "Success",
    paymentAnyExpiry: "Any future expiry date",
    paymentAnyCvv: "Any 3-digit CVV",
    paymentCardNameRequired: "Name required",
    paymentCardNumberInvalid: "Invalid card number",
    paymentExpiryInvalid: "Invalid expiry date",
    paymentCvvInvalid: "Invalid CVV",

    // Order confirmation page
    orderConfirmedTitle: "Order Confirmed!",
    orderConfirmedMessage: "Your order has been successfully received",
    orderConfirmedThankYou: "Thank you for your purchase!",
    orderConfirmedNumber: "Order Number",
    orderConfirmedTotal: "Total Paid",
    orderConfirmedDownload: "Download Receipt",
    orderConfirmedEmail: "We've sent you a confirmation email",
    orderConfirmedBackToOrders: "Back to Orders",

    // Documents
    documentsTitle: "Documents",
    downloadInvoice: "Download Invoice",
    downloadDdt: "Download Delivery Note",
    downloadCreditNote: "Download Credit Note",
    documentNotAvailable: "Not available",
    documentBeingPrepared: "Document being prepared",

    // Delete Account
    deleteAccountTitle: "Delete Account",
    deleteAccountDescription: "This action will permanently delete your account and all associated data: chat history, orders, cart and preferences. This action is irreversible.",
    deleteAccountButton: "Delete my account",
    deleteAccountConfirmTitle: "Are you sure?",
    deleteAccountConfirmMessage: "All your data will be permanently deleted. This action cannot be undone.",
    deleteAccountConfirmButton: "Yes, delete my account",
    deleteAccountSuccess: "Account deleted successfully",
    deleteAccountError: "Error deleting account",
    deleteAccountDeleting: "Deleting...",
  },

  ES: {
    // Loading states
    loading: "Cargando...",
    loadingMessage: "Estamos preparando tus datos",
    pleaseWait: "Por favor espera...",

    // Navigation buttons
    viewCart: "Carrito",
    viewOrders: "Pedidos",
    viewProfile: "Perfil",
    finalizeOrder: "Finalizar Pedido",

    // Menu labels
    menuTitle: "Menú",
    cart: "Carrito",
    myOrders: "Mis Pedidos",
    profile: "Perfil",

    // Common actions
    save: "Guardar",
    cancel: "Cancelar",
    close: "Cerrar",
    edit: "Editar",
    delete: "Eliminar",
    confirm: "Confirmar",
    back: "Atrás",
    continue: "Continuar",

    // Status labels
    pending: "Pendiente",
    confirmed: "Confirmado",
    shipped: "Enviado",
    delivered: "Entregado",
    cancelled: "Cancelado",

    // Form labels
    name: "Nombre",
    email: "Email",
    phone: "Teléfono",
    address: "Dirección",
    company: "Empresa",

    // Cart labels
    product: "Producto",
    service: "Servicio",
    productBadge: "PRODUCTO",
    serviceBadge: "SERVICIO",
    quantity: "Cantidad",
    price: "Precio",
    total: "Total",
    discount: "Descuento",
    originalPrice: "Precio Original",
    finalPrice: "Precio Final",
    format: "Formato",
    formatLabel: "Formato:",
    duration: "Duración",
    notes: "Notas",

    // Order labels
    orderCode: "Código de Pedido",
    orderDate: "Fecha del Pedido",
    orderStatus: "Estado del Pedido",
    paymentStatus: "Estado del Pago",
    items: "Artículos",
    orderSummary: "Resumen del Pedido",
    orderDetails: "Detalles del Pedido",
    paymentMethod: "Método de Pago",
    tracking: "Seguimiento",
    products: "Productos",
    subtotal: "Subtotal",
    vat: "IVA",
    shipping: "Envío",

    // Profile labels
    personalData: "Datos Personales",
    contactInfo: "Información de Contacto",
    billingAddress: "Dirección de Facturación",
    shippingAddress: "Dirección de Envío",
    preferences: "Preferencias",

    // Payment labels (Step 4)
    cardNumber: "Número de Tarjeta",
    cardholderName: "Nombre del Titular",
    expiry: "Vencimiento",
    cvcTooltip: "Código de 3 dígitos en el reverso de la tarjeta",
    securePayment: "Pago seguro encriptado SSL",
    totalToPay: "Total a Pagar",
    includesVAT: "IVA incluido",
    confirmPayment: "Confirmar Pago",
    processing: "Procesando...",
    paymentDisclaimer:
      "Al hacer clic en 'Confirmar Pago' aceptas nuestros Términos y Condiciones",
    proceedToPayment: "Proceder al Pago",

    // Messages
    noData: "No hay datos disponibles",
    error: "Ha ocurrido un error",
    success: "Operación completada exitosamente",
    dataUpdated: "Datos actualizados correctamente",

    // Greetings
    hello: "Hola",
    welcome: "Bienvenido",

    // Checkout specific
    yourProducts: "Tus Productos",
    addProducts: "Productos",
    addServices: "Servicios",
    emptyCart: "Tu carrito está vacío",
    addProductsToContinue: "Agrega productos para continuar",
    confirmOrder: "Confirmar Pedido",
    productSummary: "Resumen de Productos",
    selectProducts: "Seleccionar Productos",
    loadingProducts: "Cargando productos...",
    confirmDelete: "¿Estás seguro?",
    confirmDeleteMessage: '¿Quieres eliminar "{name}" de tu carrito?',
    remove: "Eliminar",
    addToCart: "Agregar",
    thanks: "Gracias",
    greeting: "Hola {name}, completa tu pedido en pocos pasos",
    creatingOrder: "Creando pedido...",
    steps: {
      products: "Productos",
      addresses: "Direcciones",
      confirm: "Confirmar",
      payment: "Pago",
    },

    // Checkout Success specific
    orderConfirmed: "¡Pedido Confirmado!",
    orderReceived: "Su pedido ha sido recibido con éxito.",
    contactSoon:
      "Nos pondremos en contacto contigo lo antes posible para la confirmación.",
    closePage: "Puedes cerrar esta página y volver al chat de WhatsApp.",

    // Form placeholders
    streetPlaceholder: "Calle y número",
    cityPlaceholder: "Ciudad",
    postalCodePlaceholder: "Código Postal",
    provincePlaceholder: "Provincia",
    countryPlaceholder: "País",
    namePlaceholder: "Nombre completo",
    phonePlaceholder: "Teléfono",
    companyPlaceholder: "Nombre de la empresa",
    notesPlaceholder: "Notas adicionales para la entrega...",
    searchProductsPlaceholder: "Buscar productos...",

    // Form labels
    streetLabel: "Calle y número",
    cityLabel: "Ciudad",
    postalCodeLabel: "Código Postal",
    provinceLabel: "Provincia",
    countryLabel: "País",
    sameAsShippingLabel: "Misma dirección de envío",
    additionalNotesLabel: "Notas adicionales",
    orderSuccessMessage: "✅ ¡Pedido creado con éxito! Serás redirigido...",
    notSpecified: "No especificado",
    goBack: "← Volver",

    // Registration page
    registerTitle: "Regístrate en {workspaceName}",
    registerSubtitle: "Completa el formulario para comenzar",
    firstName: "Nombre *",
    lastName: "Apellido *",
    preferredLanguage: "Idioma Preferido *",
    currency: "Moneda *",
    gdprConsent: "Acepto los términos de privacidad y tratamiento de datos",
    pushNotifications: "Acepto recibir notificaciones push",
    registerButton: "Registrarse",
    registrationSuccessTitle: "¡Registro Exitoso!",
    registrationSuccessMessage:
      "Gracias por registrarte. Ahora puedes volver a WhatsApp para continuar la conversación.",
    returnToWhatsApp: "Volver a WhatsApp",
    registrationErrorTitle: "Error de Registro",
    tryAgain: "Intentar de Nuevo",
    validatingLink: "Validando enlace de registro...",
    whatHappensNext: "¿Qué pasa ahora?",
    welcomeMessageStep: "Recibirás un mensaje de bienvenida en WhatsApp",
    browseProductsStep: "Ahora puedes explorar productos y servicios a través de WhatsApp",
    preferencesSavedStep: "Tus preferencias han sido guardadas y se usarán para personalizar tu experiencia",
    goToHomepage: "Ir a la Página Principal",

    // Payment page (Mock Stripe)
    paymentTitle: "Pago Seguro",
    paymentSubtitle: "Completa tu compra de forma segura",
    paymentCardNumber: "Número de Tarjeta",
    paymentCardName: "Titular de la Tarjeta",
    paymentExpiry: "Vencimiento",
    paymentCvv: "CVV",
    paymentPayNow: "Pagar Ahora",
    paymentProcessing: "Procesando Pago...",
    paymentSecure: "Tu pago está protegido",
    paymentMockNotice:
      "Esta es una interfaz de pago simulada. No se realizará ningún cargo real.",
    paymentTestCards: "Tarjetas de Prueba (Mock)",
    paymentSuccess: "Éxito",
    paymentAnyExpiry: "Cualquier fecha futura",
    paymentAnyCvv: "Cualquier CVV de 3 dígitos",
    paymentCardNameRequired: "Se requiere nombre",
    paymentCardNumberInvalid: "Número de tarjeta no válido",
    paymentExpiryInvalid: "Fecha de vencimiento no válida",
    paymentCvvInvalid: "CVV no válido",

    // Order confirmation page
    orderConfirmedTitle: "¡Pedido Confirmado!",
    orderConfirmedMessage: "Tu pedido ha sido recibido con éxito",
    orderConfirmedThankYou: "¡Gracias por tu compra!",
    orderConfirmedNumber: "Número de Pedido",
    orderConfirmedTotal: "Total Pagado",
    orderConfirmedDownload: "Descargar Recibo",
    orderConfirmedEmail: "Te hemos enviado un email de confirmación",
    orderConfirmedBackToOrders: "Volver a los Pedidos",

    // Documents
    documentsTitle: "Documentos",
    downloadInvoice: "Descargar Factura",
    downloadDdt: "Descargar Albarán",
    downloadCreditNote: "Descargar Nota de Crédito",
    documentNotAvailable: "No disponible",
    documentBeingPrepared: "Documento en preparación",

    // Delete Account
    deleteAccountTitle: "Eliminar Cuenta",
    deleteAccountDescription: "Esta acción eliminará permanentemente tu cuenta y todos los datos asociados: historial de chat, pedidos, carrito y preferencias. Esta acción es irreversible.",
    deleteAccountButton: "Eliminar mi cuenta",
    deleteAccountConfirmTitle: "¿Estás seguro?",
    deleteAccountConfirmMessage: "Todos tus datos serán eliminados permanentemente. Esta acción no se puede deshacer.",
    deleteAccountConfirmButton: "Sí, eliminar mi cuenta",
    deleteAccountSuccess: "Cuenta eliminada con éxito",
    deleteAccountError: "Error al eliminar la cuenta",
    deleteAccountDeleting: "Eliminando...",
  },

  PT: {
    // Loading states
    loading: "Carregando...",
    loadingMessage: "Estamos preparando seus dados",
    pleaseWait: "Por favor aguarde...",

    // Navigation buttons
    viewCart: "Carrinho",
    viewOrders: "Pedidos",
    viewProfile: "Perfil",
    finalizeOrder: "Finalizar Pedido",

    // Menu labels
    menuTitle: "Menu",
    cart: "Carrinho",
    myOrders: "Meus Pedidos",
    profile: "Perfil",

    // Common actions
    save: "Salvar",
    cancel: "Cancelar",
    close: "Fechar",
    edit: "Editar",
    delete: "Excluir",
    confirm: "Confirmar",
    back: "Voltar",
    continue: "Continuar",

    // Status labels
    pending: "Pendente",
    confirmed: "Confirmado",
    shipped: "Enviado",
    delivered: "Entregue",
    cancelled: "Cancelado",

    // Form labels
    name: "Nome",
    email: "Email",
    phone: "Telefone",
    address: "Endereço",
    company: "Empresa",

    // Cart labels
    product: "Produto",
    service: "Serviço",
    productBadge: "PRODUTO",
    serviceBadge: "SERVIÇO",
    quantity: "Quantidade",
    price: "Preço",
    total: "Total",
    discount: "Desconto",
    originalPrice: "Preço Original",
    finalPrice: "Preço Final",
    format: "Formato",
    formatLabel: "Formato:",
    duration: "Duração",
    notes: "Notas",

    // Order labels
    orderCode: "Código do Pedido",
    orderDate: "Data do Pedido",
    orderStatus: "Status do Pedido",
    paymentStatus: "Status do Pagamento",
    items: "Itens",
    orderSummary: "Resumo do Pedido",
    orderDetails: "Detalhes do Pedido",
    paymentMethod: "Método de Pagamento",
    tracking: "Rastreamento",
    products: "Produtos",
    subtotal: "Subtotal",
    vat: "IVA",
    shipping: "Frete",

    // Profile labels
    personalData: "Dados Pessoais",
    contactInfo: "Informações de Contato",
    billingAddress: "Endereço de Cobrança",
    shippingAddress: "Endereço de Entrega",
    preferences: "Preferências",

    // Payment labels (Step 4)
    cardNumber: "Número do Cartão",
    cardholderName: "Nome do Titular",
    expiry: "Validade",
    cvcTooltip: "Código de 3 dígitos no verso do cartão",
    securePayment: "Pagamento seguro criptografado SSL",
    totalToPay: "Total a Pagar",
    includesVAT: "IVA incluído",
    confirmPayment: "Confirmar Pagamento",
    processing: "Processando...",
    paymentDisclaimer:
      "Ao clicar em 'Confirmar Pagamento' você aceita nossos Termos e Condições",
    proceedToPayment: "Prosseguir para Pagamento",

    // Messages
    noData: "Nenhum dado disponível",
    error: "Ocorreu um erro",
    success: "Operação concluída com sucesso",
    dataUpdated: "Dados atualizados com sucesso",

    // Greetings
    hello: "Olá",
    welcome: "Bem-vindo",

    // Checkout specific
    yourProducts: "Seus Produtos",
    addProducts: "Produtos",
    addServices: "Serviços",
    emptyCart: "Seu carrinho está vazio",
    addProductsToContinue: "Adicione produtos para continuar",
    confirmOrder: "Confirmar Pedido",
    productSummary: "Resumo de Produtos",
    selectProducts: "Selecionar Produtos",
    loadingProducts: "Carregando produtos...",
    confirmDelete: "Tem certeza?",
    confirmDeleteMessage: 'Você quer remover "{name}" do seu carrinho?',
    remove: "Remover",
    addToCart: "Adicionar",
    thanks: "Obrigado",
    greeting: "Olá {name}, complete seu pedido em poucos passos",
    creatingOrder: "Criando pedido...",
    steps: {
      products: "Produtos",
      addresses: "Endereços",
      confirm: "Confirmar",
      payment: "Pagamento",
    },

    // Checkout Success specific
    orderConfirmed: "Pedido Confirmado!",
    orderReceived: "Seu pedido foi recebido com sucesso.",
    contactSoon:
      "Entraremos em contato com você o mais breve possível para confirmação.",
    closePage: "Você pode fechar esta página e voltar ao chat do WhatsApp.",

    // Form placeholders
    streetPlaceholder: "Rua e número",
    cityPlaceholder: "Cidade",
    postalCodePlaceholder: "Código Postal",
    provincePlaceholder: "Estado/Província",
    countryPlaceholder: "País",
    namePlaceholder: "Nome completo",
    phonePlaceholder: "Telefone",
    companyPlaceholder: "Nome da empresa",
    notesPlaceholder: "Notas adicionais para entrega...",
    searchProductsPlaceholder: "Buscar produtos...",

    // Form labels
    streetLabel: "Rua e número",
    cityLabel: "Cidade",
    postalCodeLabel: "Código Postal",
    provinceLabel: "Estado/Província",
    countryLabel: "País",
    sameAsShippingLabel: "Mesmo endereço de envio",
    additionalNotesLabel: "Notas adicionais",
    orderSuccessMessage:
      "✅ Pedido criado com sucesso! Você será redirecionado...",
    notSpecified: "Não especificado",
    goBack: "← Voltar",

    // Registration page
    registerTitle: "Registrar-se em {workspaceName}",
    registerSubtitle: "Preencha o formulário abaixo para começar",
    firstName: "Nome *",
    lastName: "Sobrenome *",
    preferredLanguage: "Idioma Preferido *",
    currency: "Moeda *",
    gdprConsent: "Aceito os termos de privacidade e tratamento de dados",
    pushNotifications: "Aceito receber notificações push",
    registerButton: "Registrar",
    registrationSuccessTitle: "Registro Bem-sucedido!",
    registrationSuccessMessage:
      "Obrigado por se registrar. Agora você pode voltar ao WhatsApp para continuar a conversa.",
    returnToWhatsApp: "Voltar ao WhatsApp",
    registrationErrorTitle: "Erro de Registro",
    tryAgain: "Tentar Novamente",
    validatingLink: "Validando link de registro...",
    whatHappensNext: "O que acontece agora?",
    welcomeMessageStep: "Você receberá uma mensagem de boas-vindas no WhatsApp",
    browseProductsStep: "Agora você pode navegar por produtos e serviços pelo WhatsApp",
    preferencesSavedStep: "Suas preferências foram salvas e serão usadas para personalizar sua experiência",
    goToHomepage: "Ir para a Página Inicial",

    // Payment page (Mock Stripe)
    paymentTitle: "Pagamento Seguro",
    paymentSubtitle: "Complete sua compra com segurança",
    paymentCardNumber: "Número do Cartão",
    paymentCardName: "Titular do Cartão",
    paymentExpiry: "Validade",
    paymentCvv: "CVV",
    paymentPayNow: "Pagar Agora",
    paymentProcessing: "Processando Pagamento...",
    paymentSecure: "Seu pagamento está protegido",
    paymentMockNotice:
      "Esta é uma interface de pagamento simulada. Nenhuma cobrança real será realizada.",
    paymentTestCards: "Cartões de Teste (Mock)",
    paymentSuccess: "Sucesso",
    paymentAnyExpiry: "Qualquer data futura",
    paymentAnyCvv: "Qualquer CVV de 3 dígitos",
    paymentCardNameRequired: "Nome obrigatório",
    paymentCardNumberInvalid: "Número de cartão inválido",
    paymentExpiryInvalid: "Data de validade inválida",
    paymentCvvInvalid: "CVV inválido",

    // Order confirmation page
    orderConfirmedTitle: "Pedido Confirmado!",
    orderConfirmedMessage: "Seu pedido foi recebido com sucesso",
    orderConfirmedThankYou: "Obrigado pela sua compra!",
    orderConfirmedNumber: "Número do Pedido",
    orderConfirmedTotal: "Total Pago",
    orderConfirmedDownload: "Baixar Recibo",
    orderConfirmedEmail: "Enviamos um email de confirmação para você",
    orderConfirmedBackToOrders: "Voltar aos Pedidos",

    // Documents
    documentsTitle: "Documentos",
    downloadInvoice: "Baixar Fatura",
    downloadDdt: "Baixar Guia de Transporte",
    downloadCreditNote: "Baixar Nota de Crédito",
    documentNotAvailable: "Não disponível",
    documentBeingPrepared: "Documento em preparação",

    // Delete Account
    deleteAccountTitle: "Excluir Conta",
    deleteAccountDescription: "Esta ação excluirá permanentemente sua conta e todos os dados associados: histórico de chat, pedidos, carrinho e preferências. Esta ação é irreversível.",
    deleteAccountButton: "Excluir minha conta",
    deleteAccountConfirmTitle: "Tem certeza?",
    deleteAccountConfirmMessage: "Todos os seus dados serão excluídos permanentemente. Esta ação não pode ser desfeita.",
    deleteAccountConfirmButton: "Sim, excluir minha conta",
    deleteAccountSuccess: "Conta excluída com sucesso",
    deleteAccountError: "Erro ao excluir conta",
    deleteAccountDeleting: "Excluindo...",
  },
}

// 🎯 Funzione per ottenere le traduzioni basate sulla lingua del cliente
export const getPublicPageTexts = (
  customerLanguage?: string
): PublicPageTexts => {
  // Map database language codes to our localization keys
  // Supports: 2-letter (IT, EN), 3-letter (ITA, ENG), full names (italian, english)
  const languageMap: { [key: string]: SupportedLanguage } = {
    // 2-letter codes
    it: "IT",
    en: "EN",
    es: "ES",
    pt: "PT",
    // 3-letter codes (from some DB records)
    ita: "IT",
    eng: "EN",
    esp: "ES",
    prt: "PT",
    por: "PT",
    // Full names
    italian: "IT",
    english: "EN",
    spanish: "ES",
    portuguese: "PT",
  }

  const mappedLanguage =
    languageMap[customerLanguage?.toLowerCase() || ""] || "IT"
  return publicPageTranslations[mappedLanguage]
}

export default publicPageTranslations
