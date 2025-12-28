"use strict";
/**
 * AddService - LLM-Callable Function
 *
 * Aggiunge uno o più servizi al carrello del cliente.
 * Utilizzata quando il cliente chiede servizi (es: "aggiungi servizio consegna", "voglio il gift wrapping")
 *
 * ⚠️ IMPORTANTE: Questa funzione deve essere chiamata SOLO DOPO la conferma del cliente
 *
 * @see docs/prompt_agent.md - Sezione "addService()"
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
exports.addService = addService;
const logger_1 = __importDefault(require("../../utils/logger"));
const calling_functions_service_1 = require("../../services/calling-functions.service");
/**
 * Aggiunge uno o più servizi al carrello
 *
 * @param request - Request parameters con customerId, workspaceId, services[]
 * @returns Result con riepilogo aggiunte e link carrello
 */
function addService(request) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            logger_1.default.info("🛠️ AddService called with:", {
                customerId: request.customerId,
                workspaceId: request.workspaceId,
                servicesCount: ((_a = request.services) === null || _a === void 0 ? void 0 : _a.length) || 0,
                services: request.services,
            });
            // Validazione parametri obbligatori
            if (!request.customerId || !request.workspaceId || !request.services) {
                logger_1.default.error("❌ Missing required parameters in AddService");
                return {
                    success: false,
                    error: "Parametri richiesti mancanti",
                    message: "Impossibile aggiungere i servizi al carrello. Parametri incompleti.",
                    totalAdded: 0,
                    skipped: 0,
                    timestamp: new Date().toISOString(),
                };
            }
            // Validazione array servizi
            if (!Array.isArray(request.services) || request.services.length === 0) {
                logger_1.default.error("❌ Invalid services array in AddService");
                return {
                    success: false,
                    error: "Array servizi non valido",
                    message: "Devi fornire almeno un servizio da aggiungere al carrello.",
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
            // Itera su ogni servizio e aggiungilo al carrello
            for (const service of request.services) {
                try {
                    // Validazione quantità
                    const quantity = service.quantity || 1;
                    if (quantity < 1 || !Number.isInteger(quantity)) {
                        logger_1.default.warn(`⚠️ Invalid quantity for ${service.serviceCode}: ${quantity}`);
                        skipped++;
                        details.push({
                            serviceCode: service.serviceCode,
                            success: false,
                            message: "Quantità non valida",
                        });
                        continue;
                    }
                    // Chiama il servizio per aggiungere il servizio
                    const result = yield callingFunctionsService.addServiceToCart({
                        customerId: request.customerId,
                        workspaceId: request.workspaceId,
                        serviceCode: service.serviceCode,
                        quantity,
                        notes: service.notes,
                    });
                    if (result.success) {
                        totalAdded++;
                        // Salva cartUrl e expiresAt dalla prima aggiunta riuscita
                        if (!cartUrl && result.cartUrl) {
                            cartUrl = result.cartUrl;
                            expiresAt = result.expiresAt;
                        }
                        details.push({
                            serviceCode: service.serviceCode,
                            serviceName: result.serviceName,
                            success: true,
                            message: result.message,
                        });
                    }
                    else {
                        skipped++;
                        details.push({
                            serviceCode: service.serviceCode,
                            success: false,
                            message: result.message || result.error,
                        });
                    }
                }
                catch (error) {
                    logger_1.default.error(`❌ Error adding service ${service.serviceCode}:`, error);
                    skipped++;
                    details.push({
                        serviceCode: service.serviceCode,
                        success: false,
                        message: error instanceof Error ? error.message : "Errore sconosciuto",
                    });
                }
            }
            // Genera messaggio di riepilogo
            let message = "";
            if (totalAdded > 0 && skipped === 0) {
                message = `✅ Ho aggiunto ${totalAdded} servizio/i al carrello!`;
            }
            else if (totalAdded > 0 && skipped > 0) {
                message = `✅ Ho aggiunto ${totalAdded} servizio/i al carrello. ⚠️ ${skipped} servizio/i non disponibile/i.`;
            }
            else {
                message = `❌ Nessun servizio aggiunto. Tutti i ${skipped} servizi non sono disponibili.`;
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
            logger_1.default.info("✅ AddService result:", finalResult);
            return finalResult;
        }
        catch (error) {
            logger_1.default.error("❌ Error in AddService:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Errore interno",
                message: "Impossibile aggiungere i servizi al carrello. Riprova più tardi.",
                totalAdded: 0,
                skipped: 0,
                timestamp: new Date().toISOString(),
            };
        }
    });
}
//# sourceMappingURL=addService.js.map