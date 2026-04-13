/**
 * Prompt Variables - SINGLE SOURCE OF TRUTH
 * 
 * Definisce TUTTE le variabili disponibili nei template dei prompt.
 * Ogni variabile ha un nome standard che DEVE corrispondere al placeholder nel template.
 * 
 * REGOLE:
 * 1. I template usano {{variableName}} - il nome DEVE corrispondere a questa interfaccia
 * 2. Il Router costruisce questo oggetto UNA VOLTA usando PromptVariableBuilder
 * 3. I sub-agenti ricevono questo oggetto già popolato - NON ricaricano dal DB
 * 4. preProcessPrompt() fa SOLO sostituzione, niente logica
 * 
 * @see docs/regole_di_prompts.md
 * @see PromptVariableBuilder per la costruzione
 */

/**
 * Variabili standard disponibili in tutti i template
 * 
 * Naming convention:
 * - customerXxx: dati del cliente (from customers table)
 * - companyXxx: dati dell'azienda (from workspace table)
 * - xxxContent: contenuto dinamico (products, categories, etc.)
 */
export interface PromptVariables {
  // ══════════════════════════════════════════════════════════════
  // CUSTOMER VARIABLES (from customers table)
  // ══════════════════════════════════════════════════════════════

  /** Nome cliente - usato per personalizzare i messaggi
   * Template: {{customerName}}
   * Source: customer.name || 'Cliente'
   */
  customerName: string

  /** Telefono cliente (formato WhatsApp)
   * Template: {{customerPhone}}
   * Source: customer.phone || ''
   */
  customerPhone: string

  /** Email cliente
   * Template: {{customerEmail}}
   * Source: customer.email || ''
   */
  customerEmail: string

  /** Sconto percentuale cliente (0-100)
   * Template: {{customerDiscount}}
   * Source: customer.discount || 0
   */
  customerDiscount: number

  /** 🔒 Feature 174: Registration status (controls price visibility)
   * Template: {{customerIsActive}}
   * Source: customer.isActive || false
   * If false: hide prices, show registration prompt
   */
  customerIsActive?: boolean

  /** Lingua del cliente (display name)
   * Template: {{languageUser}}
   * Source: getLanguageDisplayName(customer.language) || 'ENGLISH'
   * Values: ITALIANO, ENGLISH, ESPAÑOL, PORTUGUÊS
   */
  languageUser: string

  /** Consenso notifiche push
   * Template: {{pushNotificationsConsent}}
   * Source: customer.push_notifications_consent
   */
  pushNotificationsConsent?: boolean

  // ══════════════════════════════════════════════════════════════
  // SALES AGENT VARIABLES (from customer.sales relation)
  // ══════════════════════════════════════════════════════════════

  /** 🆕 Nome agente commerciale assegnato (STANDARD)
   * Template: {{salesAgentName}}
   * Source: customer.sales?.firstName + lastName || 'Non assegnato'
   * Used when: workspace.hasSalesAgents = true AND customer.salesId exists
   */
  salesAgentName: string

  /** 🆕 Telefono agente commerciale (STANDARD)
   * Template: {{salesAgentPhone}}
   * Source: customer.sales?.phone || 'N/A'
   * Used when: workspace.hasSalesAgents = true AND customer.salesId exists
   */
  salesAgentPhone: string

  /** 🆕 Email agente commerciale (STANDARD)
   * Template: {{salesAgentEmail}}
   * Source: customer.sales?.email || 'N/A'
   * Used when: workspace.hasSalesAgents = true AND customer.salesId exists
   */
  salesAgentEmail: string

  /** @deprecated Use salesAgentName instead (backward compatibility)
   * Template: {{agentName}}
   */
  agentName: string

  /** @deprecated Use salesAgentPhone instead (backward compatibility)
   * Template: {{agentPhone}}
   */
  agentPhone: string

  /** @deprecated Use salesAgentEmail instead (backward compatibility)
   * Template: {{agentEmail}}
   */
  agentEmail: string

  // ══════════════════════════════════════════════════════════════
  // WORKSPACE/COMPANY VARIABLES (from workspace table)
  // ══════════════════════════════════════════════════════════════

  /** Nome azienda/workspace
   * Template: {{companyName}}
   * Source: workspace.name
   * CRITICAL: Must NEVER be empty - fallback to 'Shop'
   */
  companyName: string

  /** Identità del bot per domande "chi siete?"
   * Template: {{botIdentityResponse}}
   * Source: workspace.botIdentityResponse || ''
   */
  botIdentityResponse: string

  /** Regole AI personalizzate (override defaults)
   * Template: {{customAiRules}}
   * Source: workspace.customAiRules || ''
   */
  customAiRules: string

  /** Indirizzo fisico dell'azienda
   * Template: {{address}}
   * Source: workspace.address || ''
   */
  address: string

  /** Email amministratore/supporto per escalation
   * Template: {{adminEmail}}
   * Source: workspace.adminEmail || ''
   * Used for: contact support, escalation links
   */
  adminEmail: string

  /** Nome del canale (WhatsApp, Web, etc.)
   * Template: {{channelName}}
   * Source: channel.name || 'Shop'
   */
  channelName: string

  /** URL del workspace
   * Template: {{url}}
   * Source: workspace.url || ''
   */
  workspaceUrl: string

  /** Tone of voice configurato
   * Template: {{toneOfVoice}}
   * Source: workspace.toneOfVoice || 'friendly'
   */
  toneOfVoice: string

  /** Support umano abilitato
   * Template: {{hasHumanSupport}} (boolean for {{#if}})
   * Source: workspace.hasHumanSupport
   */
  hasHumanSupport: boolean

  /** Istruzioni supporto umano
   * Template: {{humanSupportInstructions}}
   * Source: workspace.humanSupportInstructions || ''
   */
  humanSupportInstructions: string

  /** 🆕 Istruzioni escalation per frustrazione cliente
   * Template: {{frustrationEscalationInstructions}}
   * Source: workspace.frustrationEscalationInstructions || ''
   * Used for: Custom escalation triggers in router/support prompts
   */
  frustrationEscalationInstructions: string

  /** Ha agenti commerciali
   * Template: {{hasSalesAgents}} (boolean for {{#if}})
   * Source: workspace.hasSalesAgents
   */
  hasSalesAgents: boolean

  /** Channel mode: ECOMMERCE, INFORMATIONAL, or FLOW
   * Template: {{channelMode}} (string enum)
   * Also: {{isEcommerce}} (boolean for {{#if}}) derived from channelMode
   * Source: workspace.channelMode
   */
  channelMode: string
  isEcommerce: boolean

  /** Prenotazione appuntamenti abilitata
   * Template: {{hasCalendarEnabled}} (boolean for {{#if}})
   * Source: workspace.enableCalendarBooking
   */
  hasCalendarEnabled: boolean

  /** Tipi di appuntamento disponibili (servizi con enableForBooking=true)
   * Template: {{appointmentTypes}}
   * Source: Services[] from DB where enableForBooking=true, formatted as text
   */
  appointmentTypes: string

  /** Appuntamenti futuri del cliente
   * Template: {{customerUpcomingAppointments}}
   * Source: Appointment[] for current customer
   */
  customerUpcomingAppointments: string

  /** Domini esterni autorizzati per link
   * Template: {{allowedExternalLinks}}
   * Source: workspace.allowedExternalLinks?.join('\n') || ''
   */
  allowedExternalLinks: string

  /** Nome custom del chatbot
   * Template: {{chatbotName}}
   * Source: workspace.chatbotName || 'Assistant'
   */
  chatbotName: string

  /** Tipo di business (food, fashion, tech, etc.)
   * Template: {{businessType}}
   * Source: workspace.businessType || ''
   */
  businessType: string

  /** Metodo contatto operatore (email, whatsapp)
   * Template: {{operatorContactMethod}}
   * Source: workspace.operatorContactMethod || 'email'
   */
  operatorContactMethod: string

  /** Numero WhatsApp operatore support
   * Template: {{operatorWhatsappNumber}}
   * Source: workspace.operatorWhatsappNumber || ''
   */
  operatorWhatsappNumber: string

  /** URL website dell'azienda
   * Template: {{websiteUrl}}
   * Source: workspace.websiteUrl || workspace.url || ''
   */
  websiteUrl: string

  /** Email supporto
   * Template: {{supportEmail}}
   * Source: workspace.notificationEmail || ''
   */
  supportEmail: string

  /** Pagina registrazione custom
   * Template: {{registrationPage}}
   * Source: workspace.registrationPage || ''
   */
  registrationPage: string

  /** Approvazione manuale registrazione
   * Template: {{requireManualApproval}} (boolean for {{#if}})
   * Source: workspace.requireManualApproval
   */
  requireManualApproval: boolean

  /** Prenotazione calendario abilitata
   * Template: {{enableCalendarBooking}} (boolean for {{#if}})
   * Source: workspace.enableCalendarBooking
   */
  enableCalendarBooking: boolean

  /** Lingua default workspace
   * Template: {{defaultLanguage}}
   * Source: workspace.defaultLanguage || 'en'
   */
  defaultLanguage: string

  /** Lingua base catalogo
   * Template: {{catalogBaseLanguage}}
   * Source: workspace.catalogBaseLanguage || 'it'
   */
  catalogBaseLanguage: string

  /** Traduzione nomi prodotti abilitata
   * Template: {{translateProductNames}} (boolean for {{#if}})
   * Source: workspace.translateProductNames
   */
  translateProductNames: boolean

  /** Traduzione nomi categorie abilitata
   * Template: {{translateCategoryNames}} (boolean for {{#if}})
   * Source: workspace.translateCategoryNames
   */
  translateCategoryNames: boolean

  /** Traduzione nomi servizi abilitata
   * Template: {{translateServiceNames}} (boolean for {{#if}})
   * Source: workspace.translateServiceNames
   */
  translateServiceNames: boolean

  // ══════════════════════════════════════════════════════════════
  // DYNAMIC CONTENT (loaded separately, not from single DB query)
  // E-COMMERCE ONLY: These variables are filtered when channelMode !== ECOMMERCE
  // ══════════════════════════════════════════════════════════════

  /** Lista prodotti formattata
   * Template: {{products}}
   * Source: MessageRepository.getActiveProducts()
   * WARNING: Can be 50k+ tokens - validate before using
   * 🛒 E-COMMERCE ONLY: Empty when channelMode !== ECOMMERCE
   */
  products?: string
  /** 🆕 Lista prodotti raggruppati per categoria
   * Template: {{productsByCategory}}
   * Source: SmartPromptBuilder.buildProductsByCategory()
   * Format: Organized by category with selective characteristics
   * Example:
   * 🏷️ **Immobili Residenziali** (12 prodotti):
   *   • Appartamento Via Roma - €180k (42mq, 2loc, centro)
   * 🛒 E-COMMERCE ONLY: Empty when channelMode !== ECOMMERCE
   */
  productsByCategory?: string

  /** 🆕 Lista prodotti con dettagli completi (Heavy)
   * Template: {{productsWithDetails}}
   * Source: PromptVariableBuilder.buildProductsWithCharacteristics()
   * Format: Detailed multi-line format per product
   * Example:
   * 📦 **Appartamento** ... 📋 Caratteristiche: ...
   * 🛒 E-COMMERCE ONLY: Empty when channelMode !== ECOMMERCE
   */
  productsWithDetails?: string

  /** 🆕 Prodotti in evidenza
   * Template: {{featuredProducts}}
   * Source: PromptVariableBuilder.buildFeaturedProducts()
   * Format: Starred list of featured items
   * 🛒 E-COMMERCE ONLY: Empty when channelMode !== ECOMMERCE
   */
  featuredProducts?: string

  /** 🆕 Lista caratteristiche prodotto disponibili
   * Template: {{productCharacteristics}}
   * Source: SmartPromptBuilder.buildProductCharacteristics()
   * Format: All unique characteristics used in workspace
   * Example:
   * 🔍 superficie: 42mq, 38mq, 120mq (+15 altri)
   * 🔍 locali: 2n., 3n., 4n.
   * 🛒 E-COMMERCE ONLY: Empty when channelMode !== ECOMMERCE
   */
  productCharacteristics?: string
  
  /** Lista categorie formattata
   * Template: {{categories}}
   * Source: MessageRepository.getActiveCategories()
   * 🛒 E-COMMERCE ONLY: Empty when channelMode !== ECOMMERCE
   */
  categories?: string

  /** Lista servizi formattata
   * Template: {{services}}
   * Source: MessageRepository.getActiveServices()
   * 🛒 E-COMMERCE ONLY: Empty when channelMode !== ECOMMERCE
   */
  services?: string

  /** Offerte attive formattate
   * Template: {{offers}}
   * Source: MessageRepository.getActiveOffers()
   * 🛒 E-COMMERCE ONLY: Empty when channelMode !== ECOMMERCE
   */
  offers?: string

  /** FAQ formattate
   * Template: {{faq}}
   * Source: MessageRepository.getActiveFAQs() or searchFAQ()
   */
  faqs?: string

  // ══════════════════════════════════════════════════════════════
  // AGENT-SPECIFIC VARIABLES
  // E-COMMERCE ONLY: Order/Cart variables filtered when channelMode !== ECOMMERCE
  // ══════════════════════════════════════════════════════════════

  /** Ultimo codice ordine del cliente
   * Template: {{lastordercode}} or {{lastOrderCode}}
   * Source: orders.findFirst({ orderBy: createdAt: 'desc' })
   * Used by: OrderTrackingAgent
   * 🛒 E-COMMERCE ONLY: Empty when channelMode !== ECOMMERCE
   */
  lastOrderCode?: string

  /** Contenuto carrello formattato
   * Template: {{cartContents}}
   * Source: CartService.getCartSummary()
   * Used by: CartManagementAgent
   * 🛒 E-COMMERCE ONLY: Empty when channelMode !== ECOMMERCE
   */
  cartContents?: string

  /** 🔒 Feature 174: Registration status flag for LLM (explicit)
   * Template: {{customerIsRegistered}}
   * Source: customerIsActive ?? false
   * Used by: PRODUCT_SEARCH, CART agents to check registration
   */
  customerIsRegistered?: boolean

  /** 🔒 Feature 174: Pricing instructions for LLM (explicit warning)
   * Template: {{pricingInstructions}}
   * Source: "Non registrato" → warning, "Registrato" → empty
   * Used by: PRODUCT_SEARCH agent to enforce price hiding
   */
  pricingInstructions?: string

  /** Durata token (human readable)
   * Template: {{TOKEN_DURATION}}
   * Source: formatTokenDuration(process.env.TOKEN_EXPIRATION)
   */
  tokenDuration?: string

  /** 🚫 WIDGET FIX: Channel type (widget vs whatsapp)
   * Used to determine if customer name should be in greetings
   * Widget: customer name REMOVED from all greetings (visitors are anonymous)
   * WhatsApp: customer name KEPT in greetings (customers have identity)
   * Values: 'widget', 'whatsapp', or other channel type
   */
  channel?: string
}

/**
 * Mapping tra nomi LEGACY e nomi STANDARD
 * 
 * Usato per backward compatibility durante la migrazione.
 * I vecchi template potrebbero usare {{nameUser}} invece di {{customerName}}.
 * 
 * DEPRECATION: Questi alias verranno rimossi nella prossima major version.
 * Aggiornare i template per usare i nomi standard.
 */
export const VARIABLE_ALIASES: Record<string, keyof PromptVariables> = {
  // Customer aliases
  'nameUser': 'customerName',
  'nome': 'customerName',
  'phone': 'customerPhone',
  'email': 'customerEmail',
  'discountUser': 'customerDiscount',

  // Sales agent aliases (backward compatibility)
  'agentName': 'salesAgentName',
  'agentPhone': 'salesAgentPhone',
  'agentEmail': 'salesAgentEmail',

  // Order aliases
  'lastordercode': 'lastOrderCode',

  // Workspace aliases  
  'url': 'workspaceUrl',
  'faq': 'faqs',
}

/**
 * Variabili richieste (non possono essere vuote)
 * 
 * If any of these is empty, PromptVariableBuilder.validate() returns error.
 */
export const REQUIRED_VARIABLES: (keyof PromptVariables)[] = [
  'companyName',
  'customerName',
]

/**
 * Variabili che possono contenere molti token (>10k)
 * 
 * Queste variabili vengono validate per evitare prompt troppo lunghi.
 * Usate per il check di Constitution Principle III (max 1 occurrence per variable).
 */
export const LARGE_VARIABLES: (keyof PromptVariables)[] = [
  'products',
  'categories',
  'services',
  'offers',
  'faqs',
  'allowedExternalLinks',
  'customAiRules',
]

/**
 * Default values for workspace variables
 * Used when workspace config is missing
 */
export const VARIABLE_DEFAULTS: Partial<PromptVariables> = {
  companyName: 'Shop',
  customerName: 'Cliente',
  languageUser: 'ITALIANO',
  // Sales agent - standard names
  salesAgentName: 'Non assegnato',
  salesAgentPhone: 'N/A',
  salesAgentEmail: 'N/A',
  // Sales agent - legacy names (backward compatibility)
  agentName: 'Non assegnato',
  agentPhone: 'N/A',
  agentEmail: 'N/A',
  toneOfVoice: 'friendly',
  hasHumanSupport: true,
  hasSalesAgents: false,
  channelMode: 'ECOMMERCE',
  isEcommerce: true,
  hasCalendarEnabled: false,
  appointmentTypes: '',
  customerUpcomingAppointments: '',
  channelName: 'Shop',
  chatbotName: 'Assistente',
  businessType: '',
  operatorContactMethod: 'email',
  operatorWhatsappNumber: '',
  websiteUrl: '',
  supportEmail: '',
  channel: 'whatsapp', // Default to WhatsApp, widget will override
}
