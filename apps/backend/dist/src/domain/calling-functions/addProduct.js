"use strict";
/**
 * AddProduct - LLM-Callable Function
 *
 * Aggiunge uno o più prodotti al carrello del cliente.
 * Utilizzata quando il cliente confirma: "Sì, voglio aggiungerlo/i al carrello"
 *
 * ⚠️ IMPORTANTE: Questa funzione deve essere chiamata SOLO DOPO la conferma del cliente
 *
 * @see docs/prompt_agent.md - Sezione "addProduct()"
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
exports.addProduct = addProduct;
const logger_1 = __importDefault(require("../../utils/logger"));
const calling_functions_service_1 = require("../../services/calling-functions.service");
/**
 * Aggiunge uno o più prodotti al carrello
 *
 * @param request - Request parameters con customerId, workspaceId, products[]
 * @returns Result con riepilogo aggiunte e link carrello
 */
function addProduct(request) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            logger_1.default.info("🛒 AddProduct called with:", {
                customerId: request.customerId,
                workspaceId: request.workspaceId,
                productsCount: ((_a = request.products) === null || _a === void 0 ? void 0 : _a.length) || 0,
                products: request.products,
            });
            // Validazione parametri obbligatori
            if (!request.customerId || !request.workspaceId || !request.products) {
                logger_1.default.error("❌ Missing required parameters in AddProduct");
                return {
                    success: false,
                    error: "Parametri richiesti mancanti",
                    message: "Impossibile aggiungere i prodotti al carrello. Parametri incompleti.",
                    totalAdded: 0,
                    skipped: 0,
                    timestamp: new Date().toISOString(),
                };
            }
            // Validazione array prodotti
            if (!Array.isArray(request.products) || request.products.length === 0) {
                logger_1.default.error("❌ Invalid products array in AddProduct");
                return {
                    success: false,
                    error: "Array prodotti non valido",
                    message: "Devi fornire almeno un prodotto da aggiungere al carrello.",
                    totalAdded: 0,
                    skipped: 0,
                    timestamp: new Date().toISOString(),
                };
            }
            const callingFunctionsService = new calling_functions_service_1.CallingFunctionsService();
            const details = [];
            let totalAdded = 0;
            let skipped = 0;
            let cartUrl;
            let expiresAt;
            // Itera su ogni prodotto e aggiungilo al carrello
            for (const product of request.products) {
                try {
                    // Validazione quantità
                    const quantity = product.quantity || 1;
                    if (quantity < 1 || !Number.isInteger(quantity)) {
                        logger_1.default.warn(`⚠️ Invalid quantity for ${product.sku}: ${quantity}`);
                        skipped++;
                        details.push({
                            sku: product.sku,
                            success: false,
                            message: "Quantità non valida",
                        });
                        continue;
                    }
                    // Chiama il servizio per aggiungere il prodotto
                    const result = yield callingFunctionsService.addProductToCart({
                        customerId: request.customerId,
                        workspaceId: request.workspaceId,
                        sku: product.sku,
                        quantity,
                        notes: product.notes,
                    });
                    if (result.success) {
                        totalAdded++;
                        // Salva cartUrl e expiresAt dalla prima aggiunta riuscita
                        if (!cartUrl && result.cartUrl) {
                            cartUrl = result.cartUrl;
                            expiresAt = result.expiresAt;
                        }
                        details.push({
                            sku: product.sku,
                            productName: result.productName,
                            success: true,
                            message: result.message,
                        });
                    }
                    else {
                        skipped++;
                        details.push({
                            sku: product.sku,
                            success: false,
                            message: result.message || result.error,
                        });
                    }
                }
                catch (error) {
                    logger_1.default.error(`❌ Error adding product ${product.sku}:`, error);
                    skipped++;
                    details.push({
                        sku: product.sku,
                        success: false,
                        message: error instanceof Error ? error.message : "Errore sconosciuto",
                    });
                }
            }
            // Genera messaggio di riepilogo
            let message = "";
            if (totalAdded > 0 && skipped === 0) {
                message = `✅ Ho aggiunto ${totalAdded} prodotto/i al carrello!`;
            }
            else if (totalAdded > 0 && skipped > 0) {
                message = `✅ Ho aggiunto ${totalAdded} prodotto/i al carrello. ⚠️ ${skipped} prodotto/i non disponibile/i.`;
            }
            else {
                message = `❌ Nessun prodotto aggiunto. Tutti i ${skipped} prodotti non sono disponibili.`;
            }
            // ✅ Aggiungi link al carrello e scadenza al messaggio
            if (totalAdded > 0 && cartUrl) {
                message += `\n\n🛒 Vedi il tuo carrello: ${cartUrl}\n\n⏰ Link valido per 15 minuti`;
            }
            const finalResult = {
                success: totalAdded > 0,
                message,
                totalAdded,
                skipped,
                cartUrl,
                expiresAt,
                timestamp: new Date().toISOString(),
                details,
            };
            logger_1.default.info("✅ AddProduct result:", finalResult);
            return finalResult;
        }
        catch (error) {
            logger_1.default.error("❌ Error in AddProduct:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Errore interno",
                message: "Impossibile aggiungere i prodotti al carrello. Riprova più tardi.",
                totalAdded: 0,
                skipped: 0,
                timestamp: new Date().toISOString(),
            };
        }
    });
}
//# sourceMappingURL=addProduct.js.map