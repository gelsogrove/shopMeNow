"use strict";
/**
 * SearchProduct - LLM-Callable Function
 *
 * Registra la ricerca di un prodotto da parte del cliente.
 * Viene usata quando l'utente cerca un prodotto (anche se non presente nel DB).
 * Raccoglie dati per analytics: "Top Searched Products".
 *
 * Utilizzata quando l'utente chiede: "Hai il Panettone italiano?", "Mi piace il Panettone", "Cerco vino rosso", etc.
 *
 * ⚠️ IMPORTANTE: Questa funzione è in BACKGROUND - l'LLM continua a rispondere normalmente.
 * Non interrompe il flusso conversazionale.
 *
 * @see docs/prompt_agent.md - Sezione "searchProduct()"
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
exports.searchProduct = searchProduct;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Registra ricerca prodotto nel database per analytics
 *
 * @param request - Request parameters con customerId, workspaceId, productName
 * @returns Result con conferma del salvataggio
 */
function searchProduct(request) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            logger_1.default.info("🔍 SearchProduct called with:", {
                customerId: request.customerId,
                workspaceId: request.workspaceId,
                productName: request.productName,
            });
            // Validazione parametri obbligatori
            if (!request.customerId || !request.workspaceId || !request.productName) {
                logger_1.default.error("❌ Missing required parameters in SearchProduct");
                return {
                    success: false,
                    error: "Parametri richiesti mancanti",
                    message: "Impossibile registrare ricerca. Parametri incompleti.",
                    timestamp: new Date().toISOString(),
                };
            }
            // Validazione lunghezza productName (max 255 char)
            if (request.productName.length > 255) {
                logger_1.default.error("❌ Product name too long:", request.productName.length);
                return {
                    success: false,
                    error: "Nome prodotto troppo lungo",
                    message: "Nome prodotto supera limite caratteri.",
                    timestamp: new Date().toISOString(),
                };
            }
            // Validazione: productName deve essere una stringa non vuota
            if (request.productName.trim().length === 0) {
                logger_1.default.error("❌ Empty product name");
                return {
                    success: false,
                    error: "Nome prodotto vuoto",
                    message: "Inserire un nome prodotto valido.",
                    timestamp: new Date().toISOString(),
                };
            }
            // prisma imported
            try {
                // Salva ricerca nel database
                const productSearch = yield database_1.prisma.productSearch.create({
                    data: {
                        query: request.productName.trim(),
                        customerId: request.customerId,
                        workspaceId: request.workspaceId,
                    },
                });
                logger_1.default.info("✅ SearchProduct saved:", {
                    searchId: productSearch.id,
                    productName: request.productName,
                });
                yield database_1.prisma.$disconnect();
                return {
                    success: true,
                    message: `Ricerca registrata: "${request.productName}"`,
                    searchId: productSearch.id,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (dbError) {
                logger_1.default.error("❌ Database error in SearchProduct:", dbError);
                yield database_1.prisma.$disconnect();
                return {
                    success: false,
                    error: dbError instanceof Error ? dbError.message : "Database error",
                    message: "Errore nel salvataggio della ricerca.",
                    timestamp: new Date().toISOString(),
                };
            }
        }
        catch (error) {
            logger_1.default.error("❌ Error in SearchProduct:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Errore interno",
                message: "Errore interno del sistema.",
                timestamp: new Date().toISOString(),
            };
        }
    });
}
//# sourceMappingURL=searchProduct.js.map