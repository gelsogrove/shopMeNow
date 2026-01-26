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
   * Source: getLanguageDisplayName(customer.language) || 'ITALIANO'
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
  
  /** Nome agente commerciale assegnato
   * Template: {{agentName}}
   * Source: customer.sales?.firstName + lastName || 'Non assegnato'
   */
  agentName: string
  
  /** Telefono agente commerciale
   * Template: {{agentPhone}}
   * Source: customer.sales?.phone || 'N/A'
   */
  agentPhone: string
  
  /** Email agente commerciale
   * Template: {{agentEmail}}
   * Source: customer.sales?.email || 'N/A'
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
  
  /** Ha agenti commerciali
   * Template: {{hasSalesAgents}} (boolean for {{#if}})
   * Source: workspace.hasSalesAgents
   */
  hasSalesAgents: boolean
  
  /** Vende prodotti/servizi (ecommerce mode)
   * Template: {{sellsProductsAndServices}} (boolean for {{#if}})
   * Source: workspace.sellsProductsAndServices
   */
  sellsProductsAndServices: boolean
  
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
  
  // ══════════════════════════════════════════════════════════════
  // DYNAMIC CONTENT (loaded separately, not from single DB query)
  // ══════════════════════════════════════════════════════════════
  
  /** Lista prodotti formattata
   * Template: {{products}}
   * Source: MessageRepository.getActiveProducts()
   * WARNING: Can be 50k+ tokens - validate before using
   */
  products?: string
  
  /** Lista categorie formattata
   * Template: {{categories}}
   * Source: MessageRepository.getActiveCategories()
   */
  categories?: string
  
  /** Lista servizi formattata
   * Template: {{services}}
   * Source: MessageRepository.getActiveServices()
   */
  services?: string
  
  /** Offerte attive formattate
   * Template: {{offers}}
   * Source: MessageRepository.getActiveOffers()
   */
  offers?: string
  
  /** FAQ formattate
   * Template: {{faq}}
   * Source: MessageRepository.getActiveFAQs() or searchFAQ()
   */
  faqs?: string
  
  // ══════════════════════════════════════════════════════════════
  // AGENT-SPECIFIC VARIABLES
  // ══════════════════════════════════════════════════════════════
  
  /** Ultimo codice ordine del cliente
   * Template: {{lastordercode}}
   * Source: orders.findFirst({ orderBy: createdAt: 'desc' })
   * Used by: OrderTrackingAgent
   */
  lastOrderCode?: string
  
  /** Contenuto carrello formattato
   * Template: {{cartContents}}
   * Source: CartService.getCartSummary()
   * Used by: CartManagementAgent
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
  
  // Order aliases
  'lastordercode': 'lastOrderCode',
  
  // Workspace aliases  
  'url': 'workspaceUrl',
  'faq': 'faqs',
}

/**
 * Variabili richieste (non possono essere vuote)
 * 
 * Se una di queste è vuota, PromptVariableBuilder.validate() restituisce errore.
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
  agentName: 'Non assegnato',
  agentPhone: 'N/A',
  agentEmail: 'N/A',
  toneOfVoice: 'friendly',
  hasHumanSupport: true,
  hasSalesAgents: false,
  sellsProductsAndServices: true,
  channelName: 'Shop',
  chatbotName: 'Assistente',
  businessType: '',
  operatorContactMethod: 'email',
  operatorWhatsappNumber: '',
  websiteUrl: '',
  supportEmail: '',
  channel: 'whatsapp', // Default to WhatsApp, widget will override
}
