"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VARIABLE_DEFAULTS = exports.LARGE_VARIABLES = exports.REQUIRED_VARIABLES = exports.VARIABLE_ALIASES = void 0;
/**
 * Mapping tra nomi LEGACY e nomi STANDARD
 *
 * Usato per backward compatibility durante la migrazione.
 * I vecchi template potrebbero usare {{nameUser}} invece di {{customerName}}.
 *
 * DEPRECATION: Questi alias verranno rimossi nella prossima major version.
 * Aggiornare i template per usare i nomi standard.
 */
exports.VARIABLE_ALIASES = {
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
};
/**
 * Variabili richieste (non possono essere vuote)
 *
 * Se una di queste è vuota, PromptVariableBuilder.validate() restituisce errore.
 */
exports.REQUIRED_VARIABLES = [
    'companyName',
    'customerName',
];
/**
 * Variabili che possono contenere molti token (>10k)
 *
 * Queste variabili vengono validate per evitare prompt troppo lunghi.
 * Usate per il check di Constitution Principle III (max 1 occurrence per variable).
 */
exports.LARGE_VARIABLES = [
    'products',
    'categories',
    'services',
    'offers',
    'faqs',
];
/**
 * Default values for workspace variables
 * Used when workspace config is missing
 */
exports.VARIABLE_DEFAULTS = {
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
};
//# sourceMappingURL=prompt-variables.types.js.map