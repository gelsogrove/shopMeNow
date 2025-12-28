"use strict";
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
exports.sendToWhatsApp = sendToWhatsApp;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Send a text message via WhatsApp Business API
 *
 * @param phoneNumber - Customer phone number (with + prefix)
 * @param message - Text message to send (already in WhatsApp format)
 * @param workspaceId - Workspace ID to fetch credentials
 * @returns Result object with success status and optional error/messageId
 *
 * @example
 * const result = await sendToWhatsApp('+393491234567', 'Ciao!', workspaceId)
 * if (!result.success) {
 *   logger.error('Failed to send WhatsApp message:', result.error)
 * }
 */
function sendToWhatsApp(phoneNumber, message, workspaceId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            // 1. Get workspace WhatsApp settings from database
            const workspace = yield database_1.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: {
                    whatsappApiKey: true,
                    whatsappPhoneNumber: true,
                },
            });
            // 2. Validate workspace configuration
            if (!(workspace === null || workspace === void 0 ? void 0 : workspace.whatsappApiKey) || !(workspace === null || workspace === void 0 ? void 0 : workspace.whatsappPhoneNumber)) {
                logger_1.default.warn(`WhatsApp not configured for workspace ${workspaceId}`);
                return {
                    success: false,
                    error: "WhatsApp not configured for this workspace",
                };
            }
            // 3. Prepare WhatsApp API request
            // TODO: Will be replaced with new WhatsApp library
            const apiUrl = `https://graph.facebook.com/v18.0/${workspace.whatsappPhoneNumber}/messages`;
            const payload = {
                messaging_product: "whatsapp",
                to: phoneNumber.replace("+", ""), // WhatsApp expects no + prefix
                type: "text",
                text: {
                    body: message,
                },
            };
            // 4. Send to WhatsApp Business API
            const response = yield fetch(apiUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${workspace.whatsappApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            // 5. Handle API response
            if (!response.ok) {
                const errorData = yield response.text();
                logger_1.default.error(`WhatsApp API error: ${response.status} ${errorData}`, {
                    workspaceId,
                    phoneNumber,
                    status: response.status,
                });
                return {
                    success: false,
                    error: `WhatsApp API error: ${response.status}`,
                };
            }
            // 6. Extract message ID from response
            const data = yield response.json();
            const messageId = (_b = (_a = data.messages) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.id;
            logger_1.default.info(`WhatsApp message sent successfully`, {
                messageId,
                workspaceId,
                phoneNumber,
            });
            return {
                success: true,
                messageId,
            };
        }
        catch (error) {
            logger_1.default.error("Failed to send WhatsApp message:", {
                error: error.message,
                stack: error.stack,
                workspaceId,
                phoneNumber,
            });
            return {
                success: false,
                error: error.message,
            };
        }
    });
}
//# sourceMappingURL=whatsapp-api.service.js.map