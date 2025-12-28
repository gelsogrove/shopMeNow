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
exports.WhatsAppSendController = void 0;
const database_1 = require("@echatbot/database");
const message_sending_service_1 = __importDefault(require("../../../services/message-sending.service"));
const logger_1 = __importDefault(require("../../../utils/logger"));
class WhatsAppSendController {
    /**
     * POST /api/whatsapp/send
     * Send message to customer (operator manual send)
     *
     * SECURITY:
     * - ✅ Requires X-Session-Id (validated by authMiddleware)
     * - ✅ All IDs cross-validated
     * - ✅ Audit trail logged
     */
    sendMessage(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                // 🔒 SECURITY: Get validated session from middleware
                const session = req.session; // Set by authMiddleware
                if (!session) {
                    logger_1.default.error("[WHATSAPP-SEND] ❌ No session found - middleware failed?");
                    res.status(401).json({ error: "Unauthorized - invalid session" });
                    return;
                }
                // Extract request parameters
                const { workspaceId, customerId, phoneNumber, message } = req.body;
                logger_1.default.info("[WHATSAPP-SEND] 📤 Send request received", {
                    userId: session.userId,
                    workspaceId,
                    customerId,
                    phoneNumber,
                });
                // 🔒 VALIDATION 1: WorkspaceId must match session
                if (session.workspaceId && session.workspaceId !== workspaceId) {
                    logger_1.default.error("[WHATSAPP-SEND] ❌ Workspace mismatch", {
                        sessionWorkspace: session.workspaceId,
                        requestWorkspace: workspaceId,
                        userId: session.userId,
                    });
                    res.status(403).json({
                        error: "Workspace mismatch",
                        message: "Session does not belong to this workspace",
                    });
                    return;
                }
                // 🔒 VALIDATION 2: Customer must exist and belong to workspace
                const customer = yield database_1.prisma.customers.findUnique({
                    where: { id: customerId },
                    include: { workspace: true },
                });
                if (!customer) {
                    logger_1.default.error("[WHATSAPP-SEND] ❌ Customer not found", { customerId });
                    res.status(404).json({ error: "Customer not found" });
                    return;
                }
                if (customer.workspaceId !== workspaceId) {
                    logger_1.default.error("[WHATSAPP-SEND] ❌ Customer workspace mismatch", {
                        customerWorkspace: customer.workspaceId,
                        requestWorkspace: workspaceId,
                        customerId,
                    });
                    res.status(403).json({
                        error: "Customer does not belong to this workspace",
                    });
                    return;
                }
                // 🔒 VALIDATION 3: Phone number must match customer
                if (customer.phone !== phoneNumber) {
                    logger_1.default.error("[WHATSAPP-SEND] ❌ Phone number mismatch", {
                        customerPhone: customer.phone,
                        requestPhone: phoneNumber,
                        customerId,
                    });
                    res.status(400).json({
                        error: "Phone number mismatch",
                        message: "Provided phone number does not match customer record",
                    });
                    return;
                }
                // 🔒 VALIDATION 4: Workspace must have WhatsApp configured
                if (!customer.workspace.whatsappApiKey ||
                    !customer.workspace.whatsappPhoneNumber) {
                    logger_1.default.error("[WHATSAPP-SEND] ❌ WhatsApp not configured", {
                        workspaceId,
                    });
                    res.status(400).json({
                        error: "WhatsApp not configured for this workspace",
                        message: "Please configure WhatsApp API credentials in workspace settings",
                    });
                    return;
                }
                logger_1.default.info("[WHATSAPP-SEND] ✅ All validations passed", {
                    customerId,
                    workspaceId,
                    userId: session.userId,
                });
                // � Send via MessageSendingService
                // Admin manual send: NO security layer (admin è fidato)
                // Ma passa comunque dal service per centralizzazione e audit
                const sendResult = yield message_sending_service_1.default.sendMessage({
                    phoneNumber,
                    message, // Already in markdown format
                    workspaceId,
                    customerId,
                    sendType: "ADMIN_MANUAL",
                    skipSecurityLayer: true, // Admin è fidato, no security check
                    userLanguage: customer.language || "it",
                    metadata: {
                        sentBy: session.userId,
                        sentByEmail: (_a = session.user) === null || _a === void 0 ? void 0 : _a.email,
                        operatorName: ((_b = session.user) === null || _b === void 0 ? void 0 : _b.name) || "Unknown",
                    },
                });
                const { success, error, messageId } = sendResult.success
                    ? { success: true, error: undefined, messageId: sendResult.messageId }
                    : { success: false, error: sendResult.error, messageId: undefined };
                // 💾 Get or create active chat session
                let chatSession = yield database_1.prisma.chatSession.findFirst({
                    where: {
                        customerId,
                        workspaceId,
                        status: "active",
                    },
                });
                if (!chatSession) {
                    logger_1.default.info("[WHATSAPP-SEND] Creating new chat session", {
                        customerId,
                        workspaceId,
                    });
                    chatSession = yield database_1.prisma.chatSession.create({
                        data: {
                            customerId,
                            workspaceId,
                            status: "active",
                            context: {
                                createdBy: "operator-manual-send",
                                createdByUserId: session.userId,
                            },
                        },
                    });
                }
                // 💾 Save to database with AUDIT TRAIL
                const savedMessage = yield database_1.prisma.message.create({
                    data: {
                        chatSessionId: chatSession.id,
                        direction: "OUTBOUND",
                        content: message, // Original markdown
                        whatsappStatus: success ? "sent" : "failed",
                        whatsappError: error || null,
                        whatsappMessageId: messageId || null,
                        sentBy: session.userId, // 🔒 AUDIT: Who sent it
                        metadata: {
                            sendType: "OPERATOR_MANUAL",
                            phoneNumber,
                            customerId,
                            workspaceId,
                            sentByUserId: session.userId,
                            sentByEmail: (_c = session.user) === null || _c === void 0 ? void 0 : _c.email,
                            timestamp: new Date().toISOString(),
                        },
                    },
                });
                logger_1.default.info("[WHATSAPP-SEND] ✅ Message sent and saved", {
                    success,
                    messageId,
                    savedMessageId: savedMessage.id,
                    customerId,
                    workspaceId,
                    sentBy: session.userId,
                });
                // 📤 Return success response
                res.status(200).json({
                    success,
                    messageId,
                    savedMessageId: savedMessage.id,
                    error: error || null,
                    customer: {
                        id: customer.id,
                        name: customer.name,
                        phone: customer.phone,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("[WHATSAPP-SEND] ❌ Error sending message:", {
                    error: error.message,
                    stack: error.stack,
                });
                res.status(500).json({
                    error: "Failed to send message",
                    message: error.message,
                });
            }
        });
    }
}
exports.WhatsAppSendController = WhatsAppSendController;
//# sourceMappingURL=whatsapp-send.controller.js.map