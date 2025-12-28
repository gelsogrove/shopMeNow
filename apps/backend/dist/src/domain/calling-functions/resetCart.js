"use strict";
/**
 * 🗑️ ResetCart - LLM-Callable Function (PRIORITY 3.5)
 *
 * Svuota completamente il carrello del cliente, eliminando TUTTI i prodotti/servizi.
 *
 * 🎯 **QUANDO USARE**:
 * - Cliente dice: "cancella carrello", "svuota carrello", "elimina tutto dal carrello"
 * - Cliente vuole ricominciare da capo: "reset carrello", "pulisci carrello", "ricomincia"
 *
 * ⚠️ **DISAMBIGUAZIONE CRITICA**:
 * - ✅ "cancella carrello" / "svuota carrello" → ResetCart() (elimina TUTTO)
 * - ❌ "cancella burrata" / "rimuovi parmigiano" → removeProduct() (elimina UN prodotto)
 *
 * 🔒 **SECURITY**:
 * - Validazione customerId + workspaceId obbligatori
 * - Verifica esistenza cliente nel workspace prima di operare
 *
 * 📋 **FLOW**:
 * 1. LLM chiede SEMPRE conferma: "Vuoi davvero svuotare il carrello?"
 * 2. Cliente conferma ("sì", "ok", "procedi") → chiama questa funzione
 * 3. Funzione svuota carrello e restituisce messaggio di successo
 * 4. LLM mostra messaggio con numero prodotti rimossi + suggerimenti
 *
 * @see docs/prompt_agent.md - Sezione "resetCart()" per documentazione completa
 * @example
 * // LLM riceve: "cancella il carrello"
 * // LLM chiede: "Vuoi davvero svuotare il carrello? Perderai tutti i prodotti! 🗑️"
 * // Cliente: "sì, procedi"
 * // LLM chiama: resetCart()
 * // Risposta: { success: true, message: "Ho svuotato il carrello...", itemsRemoved: 3 }
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetCart = resetCart;
const logger_1 = __importDefault(require("../../utils/logger"));
const database_1 = require("@echatbot/database");
/**
 * Svuota completamente il carrello del cliente
 *
 * **LOGICA**:
 * 1. Valida parametri obbligatori (customerId, workspaceId)
 * 2. Verifica esistenza cliente nel workspace (SECURITY)
 * 3. Cerca carrello del cliente
 * 4. Se carrello vuoto → messaggio "già vuoto"
 * 5. Se carrello con prodotti → elimina tutti gli items, conta prodotti rimossi
 * 6. Restituisce messaggio di successo con dettagli
 *
 * @param request - Parametri richiesti (customerId, workspaceId)
 * @returns Promise<ResetCartResult> - Risultato operazione con messaggio personalizzato
 *
 * @example
 * const result = await ResetCart({
 *   customerId: "cust_123",
 *   workspaceId: "ws_456"
 * });
 * // result: { success: true, message: "Ho svuotato il carrello...", itemsRemoved: 3 }
 */
function resetCart(request) {
    return __awaiter(this, void 0, void 0, function* () {
        const timestamp = new Date().toISOString();
        logger_1.default.info("🗑️ ResetCart called with:", {
            customerId: request.customerId,
            workspaceId: request.workspaceId,
            timestamp,
        });
        // 🔒 SECURITY: Validazione parametri obbligatori
        if (!request.customerId || !request.workspaceId) {
            logger_1.default.error("❌ ResetCart - Missing required parameters");
            return createErrorResponse("Parametri richiesti mancanti", "Ops {{nameUser}}! 😅\n\n" +
                "Non riesco a svuotare il carrello per un problema tecnico.\n\n" +
                "📞 Contatta il supporto: {{agentPhone}}\n\n" +
                "Ti aiuteremo subito! 🚀", timestamp);
        }
        try {
            // 🔒 SECURITY: Verifica esistenza cliente nel workspace
            const customer = yield database_1.prisma.customers.findFirst({
                where: {
                    id: request.customerId,
                    workspaceId: request.workspaceId,
                },
                select: { id: true }, // Ottimizzazione: prendiamo solo l'ID
            });
            if (!customer) {
                logger_1.default.error("❌ ResetCart - Customer not found or wrong workspace");
                yield database_1.prisma.$disconnect();
                return createErrorResponse("Cliente non trovato", "Ops {{nameUser}}! 😅\n\n" +
                    "Non riesco a trovare il tuo account nel sistema.\n\n" +
                    "📞 Contatta il supporto: {{agentPhone}}\n" +
                    "📧 Email: {{agentEmail}}\n\n" +
                    "Ti aiuteremo subito! 🚀", timestamp);
            }
            // Trova carrello del cliente con conteggio items
            const cart = yield database_1.prisma.carts.findFirst({
                where: {
                    customerId: request.customerId,
                    workspaceId: request.workspaceId,
                },
                include: {
                    items: {
                        select: { id: true }, // Ottimizzazione: prendiamo solo l'ID per il count
                    },
                },
            });
            // Caso 1: Nessun carrello esistente
            if (!cart || cart.items.length === 0) {
                const status = !cart ? "no cart found" : "cart empty";
                logger_1.default.info(`ℹ️ ResetCart - ${status} for customer ${request.customerId}`);
                yield database_1.prisma.$disconnect();
                return {
                    success: true,
                    message: createEmptyCartMessage(),
                    itemsRemoved: 0,
                    timestamp,
                };
            }
            // Caso 2: Carrello con prodotti → svuota
            const itemsRemoved = cart.items.length;
            yield database_1.prisma.cartItems.deleteMany({
                where: {
                    cartId: cart.id,
                },
            });
            yield database_1.prisma.$disconnect();
            logger_1.default.info(`✅ ResetCart success - Removed ${itemsRemoved} items from cart ${cart.id}`);
            return {
                success: true,
                message: createSuccessMessage(itemsRemoved),
                itemsRemoved,
                timestamp,
            };
        }
        catch (error) {
            logger_1.default.error("❌ ResetCart - Database error:", error);
            yield database_1.prisma.$disconnect();
            return createErrorResponse(error instanceof Error ? error.message : "Errore database", "Ops {{nameUser}}! 😅\n\n" +
                "Si è verificato un problema tecnico durante lo svuotamento del carrello.\n\n" +
                "Non preoccuparti! Puoi:\n" +
                "• Riprovare tra qualche minuto ⏰\n" +
                "• Contattare il supporto: {{agentPhone}} 📞\n\n" +
                "Ci scusiamo per l'inconveniente! 🙏", timestamp);
        }
    });
}
// ============================================================================
// 📌 HELPER FUNCTIONS - Message Templates
// ============================================================================
/**
 * Messaggio quando carrello è già vuoto
 * @returns Messaggio personalizzato con suggerimenti
 */
function createEmptyCartMessage() {
    return ("Ciao {{nameUser}}! 👋\n\n" +
        "Il tuo carrello è già vuoto! 🛒✨\n\n" +
        "Vuoi dare un'occhiata alle nostre **offerte speciali**? 🎉\n\n" +
        "💡 Ricorda: hai uno sconto del **{{discountUser}}%** su tutti i prodotti! 🛍️");
}
/**
 * Messaggio di successo dopo svuotamento
 * @param itemsRemoved - Numero prodotti rimossi
 * @returns Messaggio personalizzato con conferma
 */
function createSuccessMessage(itemsRemoved) {
    return (`Fatto {{nameUser}}! ✅\n\n` +
        `Ho **svuotato il carrello** rimuovendo **${itemsRemoved} prodotto/i**! 🗑️\n\n` +
        `Il tuo carrello è ora pulito e pronto per un nuovo ordine! 🛒✨\n\n` +
        `💡 **Ricorda**: hai uno sconto del **{{discountUser}}%** su tutti i prodotti! 🎉\n\n` +
        `Cosa ti piacerebbe ordinare oggi? 😊`);
}
/**
 * Messaggio di errore generico
 * @param error - Descrizione tecnica errore
 * @param userMessage - Messaggio user-friendly
 * @param timestamp - Timestamp operazione
 * @returns ResetCartResult con errore
 */
function createErrorResponse(error, userMessage, timestamp) {
    return {
        success: false,
        error,
        message: userMessage,
        timestamp,
    };
}
//# sourceMappingURL=resetCart.js.map