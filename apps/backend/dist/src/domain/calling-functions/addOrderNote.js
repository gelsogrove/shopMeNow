"use strict";
/**
 * addOrderNote - Append a customer note to a specific order.
 *
 * Triggered after the customer selects "add note" from the post-order options.
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
exports.addOrderNote = addOrderNote;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../../utils/logger"));
function addOrderNote(request) {
    return __awaiter(this, void 0, void 0, function* () {
        const { workspaceId, customerId, orderCode, note } = request;
        try {
            if (!workspaceId || !customerId || !orderCode || !(note === null || note === void 0 ? void 0 : note.trim())) {
                return {
                    success: false,
                    message: "Ho bisogno di una nota valida da aggiungere all'ordine.",
                    error: "missing_parameters",
                    timestamp: new Date().toISOString(),
                };
            }
            const order = yield database_1.prisma.orders.findFirst({
                where: {
                    workspaceId,
                    customerId,
                    orderCode,
                },
            });
            if (!order) {
                return {
                    success: false,
                    message: "Non trovo questo ordine. Puoi indicarmi il codice corretto?",
                    error: "order_not_found",
                    timestamp: new Date().toISOString(),
                };
            }
            const trimmedNote = note.trim();
            const timestampLabel = new Date().toISOString().replace("T", " ").substring(0, 19);
            const formattedNote = `[${timestampLabel}] ${trimmedNote}`;
            const newNotes = order.notes
                ? `${order.notes}\n${formattedNote}`
                : formattedNote;
            yield database_1.prisma.orders.update({
                where: { id: order.id },
                data: { notes: newNotes },
            });
            return {
                success: true,
                message: `Perfetto, ho aggiunto la nota all'ordine **${orderCode}**.\n` +
                    `Se desideri aggiungere un'altra nota, scrivila pure. Se vuoi vedere la lista ordini digita "ordini".`,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            logger_1.default.error("❌ Error in addOrderNote:", error);
            return {
                success: false,
                message: "C'è stato un problema nell'aggiungere la nota. Puoi riprovare o dirmi se vuoi una strada alternativa?",
                error: error instanceof Error ? error.message : "unknown_error",
                timestamp: new Date().toISOString(),
            };
        }
        finally {
            yield database_1.prisma.$disconnect();
        }
    });
}
//# sourceMappingURL=addOrderNote.js.map