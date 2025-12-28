"use strict";
/**
 * getLinkOrderByCode - LLM-Callable Function
 *
 * Genera un link sicuro per visualizzare i dettagli di un ordine specifico.
 * Utilizzata quando l'utente chiede: "dammi ordine", "mostrami ultimo ordine", "fattura ordine XXX"
 *
 * @see docs/prompt_agent.md - Line 247: Definizione della calling function
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
exports.getLinkOrderByCode = getLinkOrderByCode;
const calling_functions_service_1 = require("../../services/calling-functions.service");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Generates a secure link to view order details
 *
 * @param request - Request parameters
 * @returns Token response with secure link
 */
function getLinkOrderByCode(request) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            logger_1.default.info("📄 getLinkOrderByCode called with:", request);
            const callingFunctionsService = new calling_functions_service_1.CallingFunctionsService();
            // Use getOrdersListLink which handles both specific orders and order lists
            const result = yield callingFunctionsService.getOrdersListLink({
                customerId: request.customerId,
                workspaceId: request.workspaceId,
                orderCode: request.orderCode, // If provided, shows specific order; otherwise shows all orders
            });
            logger_1.default.info("✅ getLinkOrderByCode result:", result);
            return result;
        }
        catch (error) {
            logger_1.default.error("❌ Error in getLinkOrderByCode:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Errore interno",
                message: "Impossibile generare il link all'ordine. Riprova più tardi.",
                timestamp: new Date().toISOString(),
            };
        }
    });
}
//# sourceMappingURL=getLinkOrderByCode.js.map