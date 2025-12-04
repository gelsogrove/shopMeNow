/**
 * SINGLE SOURCE OF TRUTH - Agent Available Functions
 *
 * This file defines ALL functions that LLM agents can call.
 * Used by:
 * - llm.service.ts (LLM function calling)
 * - agent-config.repository.ts (Database seed)
 * - Frontend /agents page (UI display)
 *
 * ⚠️ CRITICAL: This is the ONLY place where functions are defined!
 * Database availableFunctions field stores a COPY of these definitions.
 */

export interface FunctionDefinition {
  type: "function"
  function: {
    name: string
    description: string
    parameters: {
      type: "object"
      properties: Record<string, any>
      required: string[]
    }
  }
}

/**
 * Router Agent Functions
 * Pure orchestration - delegates to specialist agents
 */
export const ROUTER_FUNCTIONS: FunctionDefinition[] = [
  {
    type: "function",
    function: {
      name: "productSearchAgent",
      description:
        "🔍 Delega al Product & Services Search Agent. Usare quando cliente cerca prodotti/servizi, categorie, filtri, certificazioni, o seleziona numero da lista.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Query di ricerca del cliente o selezione numerata",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cartManagementAgent",
      description:
        "🛒 Delega al Cart Management Agent. Usare quando cliente vuole gestire carrello (add/remove/view/clear).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Richiesta carrello del cliente",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "orderTrackingAgent",
      description:
        "📦 Delega al Order Tracking Agent. Usare quando cliente chiede ordini (lista, tracking, fatture, ripeti ordine).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Richiesta ordine del cliente",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "customerSupportAgent",
      description:
        "💬 Delega al Customer Support Agent. Usare quando cliente frustrato, problema serio, richiede assistenza umana.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Richiesta supporto del cliente",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "profileManagementAgent",
      description:
        "👤 Delega al Profile Management Agent. Usare quando cliente vuole gestire profilo (modifica dati, preferenze) o notifiche push (attiva/disattiva).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Richiesta profilo/notifiche del cliente",
          },
        },
        required: ["query"],
      },
    },
  },
]

/**
 * Product & Services Search Agent Functions
 */
export const PRODUCT_SEARCH_FUNCTIONS: FunctionDefinition[] = [
  {
    type: "function",
    function: {
      name: "getProductDetails",
      description:
        "🔍 PRIORITY 1 - Recupera dettagli completi di un prodotto cercandolo per productCode (priorità) o nome. OBBLIGATORIO chiamarla quando l'utente seleziona un prodotto dalla lista (es: risponde '1', '2', '3'). Ritorna: codice interno (MAI mostrarlo all'utente!), nome, prezzo, stock, descrizione, certificazioni. Il codice interno serve per passare a CartManagementAgent. FLOW: Lista → utente dice '1' → getProductDetails(productCode o nome) → mostra dettagli SENZA codice → chiedi conferma → se 'sì' passa codice a CartManagementAgent.",
      parameters: {
        type: "object",
        properties: {
          productName: {
            type: "string",
            description:
              "Il productCode [es: PARM-500G] o nome del prodotto da cercare. Preferire sempre il codice dalla lista prodotti.",
          },
          formato: {
            type: "string",
            description:
              "Opzionale: il formato/peso del prodotto. Es: '1kg', '250g', '500ml'.",
          },
        },
        required: ["productName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getServiceDetails",
      description:
        "🔍 PRIORITY 1 - Recupera dettagli completi di un servizio cercandolo per serviceCode (priorità) o nome. OBBLIGATORIO chiamarla quando l'utente seleziona un servizio dalla lista. Ritorna: codice interno (MAI mostrarlo all'utente!), nome, prezzo, descrizione. Il codice interno serve per passare a CartManagementAgent.",
      parameters: {
        type: "object",
        properties: {
          serviceName: {
            type: "string",
            description:
              "Il serviceCode [es: SHIPPING, GIFT-WRAP] o nome del servizio da cercare. Preferire sempre il codice dalla lista servizi.",
          },
        },
        required: ["serviceName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchProductForStatistic",
      description:
        "📊 PRIORITY 5 - BACKGROUND ONLY (non-blocking). Registra la ricerca di un prodotto da parte del cliente per analytics e trend analysis. Usare quando l'utente cerca/chiede di un prodotto alimentare: 'hai la burrata?', 'avete prosciutto?', 'mi serve parmigiano', 'vendete champagne?', 'non trovate tartufo?'. Viene chiamata SIA per prodotti trovati CHE per prodotti NON trovati. ⚠️ BACKGROUND FUNCTION: Il LLM continua a rispondere NORMALMENTE dopo la chiamata, l'utente NON deve sapere della registrazione. NON bloccare il flusso conversazionale con messaggi tecnici tipo 'sto registrando'. La funzione viene eseguita in parallelo alla risposta. NON usare per prodotti non alimentari (software, auto, abbigliamento). NON chiamare due volte per stesso prodotto nella stessa conversazione. DISAMBIGUAZIONE: 'hai burrata?' = searchProductForStatistic (BACKGROUND) | 'aggiungi burrata' (DOPO conferma) = addProduct.",
      parameters: {
        type: "object",
        properties: {
          productName: {
            type: "string",
            description:
              "Il nome del prodotto cercato dal cliente (obbligatorio, max 255 caratteri). Es: 'burrata', 'prosciutto di parma', 'vino rosso', 'champagne', 'tartufo', 'mozzarella'.",
          },
        },
        required: ["productName"],
      },
    },
  },
]

/**
 * Cart Management Agent Functions
 */
export const CART_MANAGEMENT_FUNCTIONS: FunctionDefinition[] = [
  {
    type: "function",
    function: {
      name: "addItemToCart",
      description:
        "⚙️ PRIORITY 4 - MEDIUM. Aggiunge uno o più prodotti/servizi al carrello del cliente. Usare SOLO DOPO che il cliente ha CONFERMATO di voler aggiungere. FLOW OBBLIGATORIO: 1) Mostra prodotto/servizio con prezzo e stock, 2) Chiedi 'Vuoi aggiungerlo al carrello? 🛒', 3) Se conferma ('sì', 'ok', 'perfetto', 'aggiungi') → chiama addItemToCart(items), 4) Dopo aggiunta → mostra carrello formattato inline. SUPPORTA PRODOTTI E SERVIZI. ESEMPI: SINGOLO PRODOTTO: [{code:'BUR-001',quantity:1,type:'PRODUCT'}] | SINGOLO SERVIZIO: [{code:'SRV-001',quantity:1,type:'SERVICE'}] | MULTIPLI: [{code:'PASTA-005',quantity:1,type:'PRODUCT'},{code:'SRV-001',quantity:1,type:'SERVICE'}]. NON chiamare se: cliente non ha confermato, stock insufficiente, code mancante, prodotto/servizio non trovato.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description:
              "Array di prodotti/servizi da aggiungere. Anche per singolo item, usare array con 1 elemento.",
            items: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  description:
                    "Codice esatto del prodotto o servizio. Es: 'BUR-001', 'PASTA-005', 'SRV-001'.",
                },
                quantity: {
                  type: "number",
                  description:
                    "Quantità (default: 1, intero positivo). Min: 1.",
                },
                type: {
                  type: "string",
                  enum: ["PRODUCT", "SERVICE"],
                  description:
                    "Tipo di item: PRODUCT per prodotti, SERVICE per servizi.",
                },
                notes: {
                  type: "string",
                  description: "Note opzionali per questo item specifico.",
                },
              },
              required: ["code", "type"],
            },
          },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "viewCart",
      description:
        "👀 Mostra il contenuto del carrello del cliente con lista prodotti, quantità, prezzi e totale. Risponde con visualizzazione testuale inline (nessun link).",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateCartItem",
      description:
        "✏️ PRIORITY 3.5 - MEDIUM. Modifica la quantità di un prodotto nel carrello. Usare quando cliente dice 'voglio 5 panettoni invece di 3', 'cambia mozzarella a 2', 'metti 3 burrate'. Se newQuantity=0, il prodotto viene rimosso. DOPO modifica → mostra carrello aggiornato inline.",
      parameters: {
        type: "object",
        properties: {
          productCode: {
            type: "string",
            description: "Codice del prodotto o servizio da modificare (es: 'BUR-001'). Usare se conosciuto.",
          },
          productName: {
            type: "string",
            description: "Nome del prodotto o servizio da modificare (es: 'Mozzarella di Bufala'). Usare se codice non conosciuto.",
          },
          newQuantity: {
            type: "number",
            description: "Nuova quantità. Deve essere >= 0. Se 0, il prodotto viene rimosso dal carrello.",
          },
        },
        required: ["newQuantity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "removeFromCart",
      description:
        "🗑️ PRIORITY 3.5 - MEDIUM. Rimuove uno o più prodotti specifici dal carrello. Usare quando cliente dice 'togli la mozzarella', 'rimuovi il panettone', 'elimina burrata e prosciutto'. Supporta rimozione singola o multipla. DOPO rimozione → mostra carrello aggiornato inline. ⚠️ DISAMBIGUAZIONE: 'rimuovi BURRATA' / 'togli mozzarella e prosciutto' → removeFromCart() (UNO o PIÙ prodotti specifici) | 'svuota TUTTO' → clearCart() (TUTTO il carrello).",
      parameters: {
        type: "object",
        properties: {
          productCode: {
            oneOf: [
              { type: "string", description: "Singolo codice prodotto" },
              { type: "array", items: { type: "string" }, description: "Array di codici prodotto" }
            ],
            description: "Codice/i del prodotto da rimuovere. Può essere stringa singola 'BUR-001' o array ['BUR-001', 'MOZZ-002'].",
          },
          productName: {
            oneOf: [
              { type: "string", description: "Singolo nome prodotto" },
              { type: "array", items: { type: "string" }, description: "Array di nomi prodotto" }
            ],
            description: "Nome/i del prodotto da rimuovere. Può essere stringa singola 'Mozzarella' o array ['Mozzarella', 'Prosciutto'].",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clearCart",
      description:
        "🗑️ PRIORITY 3.5 - MEDIUM (Richiede SEMPRE conferma). Svuota COMPLETAMENTE il carrello del cliente, eliminando TUTTI i prodotti/servizi. QUANDO USARE: Cliente dice 'cancella carrello', 'svuota carrello', 'elimina tutto dal carrello', 'pulisci carrello', 'ricomincia da capo', 'reset carrello', 'rimuovi tutto'. ⚠️ DISAMBIGUAZIONE CRITICA: 'cancella CARRELLO' / 'svuota TUTTO' → clearCart() (elimina TUTTO il carrello) | 'cancella BURRATA' / 'rimuovi PARMIGIANO' → removeFromCart() (elimina UN prodotto specifico). 🚨 FLOW OBBLIGATORIO: 1) Cliente chiede di svuotare carrello → 2) TU chiedi SEMPRE conferma: 'Vuoi davvero svuotare il carrello? Perderai tutti i prodotti! 🗑️' → 3) Aspetti risposta → 4a) Se conferma ('sì', 'ok', 'procedi', 'conferma') → chiami clearCart() → mostri messaggio successo | 4b) Se rifiuta ('no', 'aspetta', 'annulla') → NON chiami clearCart(), mantieni carrello. ❌ NON chiamare se: cliente vuole rimuovere UN prodotto specifico, cliente non ha confermato esplicitamente, carrello già vuoto. DOPO svuotamento: mostra messaggio risultato + suggerisci offerte/prodotti per ricominciare.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
]

/**
 * Order Tracking Agent Functions
 */
export const ORDER_TRACKING_FUNCTIONS: FunctionDefinition[] = [
  {
    type: "function",
    function: {
      name: "GetLinkOrderByCode",
      description:
        "🚨 PRIORITY 2 - HIGH. Fornisce il link per visualizzare UN SINGOLO ordine specifico tramite codice ordine. Usare quando l'utente vuole: 'vedere ordine specifico', 'dettagli ordine', 'fattura ordine', 'ultimo ordine', 'ordine ORD-123'. Se orderCode non specificato → usa automaticamente lastordercode. IMPORTANTE: Ha PRIORITÀ sulle FAQ per 'ultimo ordine'. Per 'lista ordini' mostra i dettagli inline (NO link). NON usare per tracking 'dov'è il mio ordine' (tracking fisico).",
      parameters: {
        type: "object",
        properties: {
          orderCode: {
            type: "string",
            description:
              "Il codice dell'ordine da visualizzare. Se l'utente dice 'ultimo ordine' usa il lastordercode.",
          },
        },
        required: ["orderCode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "repeatOrder",
      description:
        "⚙️ PRIORITY 3 - MEDIUM. Ripete esattamente lo stesso ordine di una volta precedente, aggiungendo TUTTI i prodotti al carrello. Usare quando l'utente dice: 'ripeti ordine', 'ordina di nuovo come prima', 'voglio lo stesso di prima', 'ripeti ultimo ordine', 'voglio rifare l'ultimo ordine', 'rifare ordine', 'come l'ultima volta', 'stesso ordine', 'stessi prodotti', 'ordina stessa cosa'. FLOW OBBLIGATORIO: 1) Mostra contenuto ordine, 2) Chiedi SEMPRE conferma 'Ricreo il tuo ultimo ordine?', 3) Se conferma → chiama repeatOrder(). Svuota carrello esistente e ricomincia pulito. Se orderCode non specificato → usa automaticamente ultimo ordine. Verifica disponibilità e avvisa se prodotti non disponibili. Dopo aggiunta → mostra link carrello. DISAMBIGUAZIONE: 'ripeti ordine'/'rifare ordine' = repeatOrder | 'aggiungi burrata' = addToCart.",
      parameters: {
        type: "object",
        properties: {
          orderCode: {
            type: "string",
            description:
              "Codice ordine da ripetere (opzionale). Se non specificato, usa automaticamente l'ultimo ordine del cliente. Es: 'ORD-123'.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getOrderDetails",
      description:
        "📋 PRIORITY 1 - HIGHEST. Recupera i dettagli completi di un ordine specifico dal database. Usare quando l'utente seleziona un ordine dalla lista (es: risponde '1', '2', '3' dopo aver visto lista ordini) oppure fornisce direttamente un codice ordine. Ritorna: codice ordine, stato, data, totale €, lista prodotti con quantità e prezzi, documenti disponibili (fattura, nota di credito se esiste). FLOW: Lista ordini → utente dice '1' o codice ordine → getOrderDetails(orderCode) → mostra dettagli completi → offri download documenti.",
      parameters: {
        type: "object",
        properties: {
          orderCode: {
            type: "string",
            description:
              "Il codice dell'ordine da recuperare. Es: 'ORD-ABC12' o 'ABCDE'. Se utente seleziona numero da lista, estrai il codice ordine corrispondente dalla conversazione.",
          },
        },
        required: ["orderCode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirmOrder",
      description:
        "✅ PRIORITY 2 - HIGH. Conferma il carrello attuale e CREA un nuovo ordine nel database. Usare SOLO quando l'utente conferma esplicitamente dopo aver visto il riepilogo carrello: 'confermo', 'ok', 'sì', 'procedi', 'conferma ordine', 'va bene'. FLOW: repeatOrder() aggiunge prodotti al carrello → mostra riepilogo con 'Rispondi confermo o ok' → utente dice 'confermo' → confirmOrder() crea ordine e svuota carrello. NON usare se utente non ha visto il riepilogo carrello prima.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "showCheckout",
      description:
        "🛒 PRIORITY 2 - HIGH. Mostra il riepilogo carrello e chiede conferma per creare l'ordine. Usare quando l'utente vuole procedere all'ordine: 'checkout', 'procedi all'ordine', 'voglio comprare', 'finalizza acquisto', 'procedi', '2' (dopo menu carrello). Mostra: lista prodotti, totale con sconto cliente, link per verifica dati spedizione. Chiede 'Rispondi confermo o ok per procedere'.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
]

/**
 * Customer Support Agent Functions
 */
export const CUSTOMER_SUPPORT_FUNCTIONS: FunctionDefinition[] = [
  {
    type: "function",
    function: {
      name: "ContactOperator",
      description:
        "🚨 PRIORITY 1 - HIGHEST. CHIAMA IMMEDIATAMENTE quando utente: 1) RICHIEDE ESPLICITAMENTE operatore: 'operatore', 'parlare con operatore', 'assistenza umana', 'customer service', 'voglio parlare con', 'operator', 'human'. 2) ESPRIME FRUSTRAZIONE/PROBLEMA CRITICO (🔴 trigger automatico - NO conferma): 'merce scaduta', 'prodotto scaduto', 'scaduto', 'danneggiato', 'rotto', 'difettoso', 'marcio', 'andato a male', 'stufo/a', 'problema grave', 'sempre problemi', 'ogni volta', 'mai funziona', 'pessimo servizio', 'non funziona mai'. Se rilevi UNA di queste parole → ESEGUI SUBITO ContactOperator() senza chiedere conferma! NON rispondere con testo generico, CHIAMA la funzione!",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
]

/**
 * Summary Agent Functions
 * Used for generating conversation summaries for email notifications
 */
export const SUMMARY_AGENT_FUNCTIONS: FunctionDefinition[] = [
  // Summary Agent typically doesn't call functions - it processes existing data
  // It's used as a utility service by ContactOperator function
]

/**
 * Profile Management Agent Functions
 */
export const PROFILE_MANAGEMENT_FUNCTIONS: FunctionDefinition[] = [
  {
    type: "function",
    function: {
      name: "handlePushNotifications",
      description:
        "🔔 PRIORITY 2 - HIGH. Gestisce SOLO sottoscrizione/cancellazione notifiche push promozionali. QUANDO USARE: Cliente vuole attivare/disattivare ESCLUSIVAMENTE notifiche/offerte/messaggi promozionali. ESEMPI: 'attiva notifiche', 'voglio ricevere offerte', 'disattiva messaggi', 'stop promozioni'. FLOW OBBLIGATORIO: 1) Mostra stato attuale, 2) Spiega cosa cambia, 3) Chiedi conferma esplicita 'SI', 4) SOLO dopo 'SI' → chiama handlePushNotifications(value). NON usare per modifiche dati profilo (email/telefono/indirizzo → usa getProfileLink invece).",
      parameters: {
        type: "object",
        properties: {
          value: {
            type: "boolean",
            description:
              "true = attiva notifiche push (SUBSCRIBE), false = disattiva notifiche push (UNSUBSCRIBE).",
          },
        },
        required: ["value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getProfileLink",
      description:
        "🔗 PRIORITY 1 - HIGHEST. Genera link sicuro per modificare dati profilo cliente. QUANDO USARE: Cliente vuole modificare/cambiare/aggiornare QUALSIASI dato personale: 📦 indirizzo spedizione, 📧 email, 📞 telefono, 👤 nome. ESEMPI TRIGGER: 'cambia indirizzo', 'modifica email', 'aggiorna telefono', 'voglio cambiare nome', 'aggiorna profilo', 'modifica dati'. Link ha validità 1 ora con token JWT. IMPORTANTE: NON usare per notifiche push (usa handlePushNotifications). NON usare per vedere profilo senza modifiche (mostra info direttamente). DOPO chiamata: mostrare SEMPRE [LINK_PROFILE_WITH_TOKEN] token nel response.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
]

/**
 * Get all available functions for a specific agent type
 */
export function getAgentFunctions(
  agentType: string
): FunctionDefinition[] | null {
  switch (agentType) {
    case "ROUTER":
      return ROUTER_FUNCTIONS
    case "PRODUCT_SEARCH":
      return PRODUCT_SEARCH_FUNCTIONS
    case "CART_MANAGEMENT":
      return CART_MANAGEMENT_FUNCTIONS
    case "ORDER_TRACKING":
      return ORDER_TRACKING_FUNCTIONS
    case "CUSTOMER_SUPPORT":
      return CUSTOMER_SUPPORT_FUNCTIONS
    case "SUMMARY_AGENT":
      return SUMMARY_AGENT_FUNCTIONS
    case "PROFILE_MANAGEMENT":
      return PROFILE_MANAGEMENT_FUNCTIONS
    case "SECURITY":
      return [] // Security agent calls sendAlertEmail only
    case "TRANSLATION":
      return [] // Translation agent doesn't call functions, just translates IT → target
    default:
      return null
  }
}

/**
 * Get ALL functions (for LLM - all agents combined)
 * Currently returns global functions (used by all agents)
 */
export function getAllFunctions(): FunctionDefinition[] {
  return [
    ...ROUTER_FUNCTIONS,
    ...PRODUCT_SEARCH_FUNCTIONS,
    ...CART_MANAGEMENT_FUNCTIONS,
    ...ORDER_TRACKING_FUNCTIONS,
    ...CUSTOMER_SUPPORT_FUNCTIONS,
    ...SUMMARY_AGENT_FUNCTIONS,
    ...PROFILE_MANAGEMENT_FUNCTIONS,
  ]
}

/**
 * Get function NAMES only for a specific agent type (for database seed)
 * Returns JSON-compatible array of function names
 */
export function getAgentFunctionNames(agentType: string): string[] | null {
  const functions = getAgentFunctions(agentType)
  if (!functions) return null
  return functions.map((fn) => fn.function.name)
}
