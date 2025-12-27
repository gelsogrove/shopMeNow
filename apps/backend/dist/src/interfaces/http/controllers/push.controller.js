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
exports.PushController = exports.SystemNotificationType = void 0;
const llm_router_service_1 = require("../../../services/llm-router.service");
const whatsapp_queue_service_1 = require("../../../services/whatsapp-queue.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * System notification types
 */
var SystemNotificationType;
(function (SystemNotificationType) {
    SystemNotificationType["CHATBOT_REACTIVATED"] = "CHATBOT_REACTIVATED";
    SystemNotificationType["ACCOUNT_ACTIVATED"] = "ACCOUNT_ACTIVATED";
    SystemNotificationType["DISCOUNT_CHANGED"] = "DISCOUNT_CHANGED";
})(SystemNotificationType || (exports.SystemNotificationType = SystemNotificationType = {}));
/**
 * Notification message templates (Italian base language)
 * Will be translated by SafetyTranslationAgent to customer's language
 */
const NOTIFICATION_TEMPLATES = {
    [SystemNotificationType.CHATBOT_REACTIVATED]: (data) => `🤖 Ciao ${data.customerName}, da questo momento la tua chat è attiva. Sono qui per aiutarti!`,
    [SystemNotificationType.ACCOUNT_ACTIVATED]: (data) => `👋 Benvenuto ${data.customerName}! Il tuo account è ora attivo. Puoi iniziare a fare acquisti.`,
    [SystemNotificationType.DISCOUNT_CHANGED]: (data) => `💸 Ciao ${data.customerName}! Da oggi puoi usufruire del ${data.discountPercentage}% di sconto sui nostri prodotti.`,
};
/**
 * Controller for push notification operations
 */
class PushController {
    constructor(prisma, llmRouterService, whatsappQueueService) {
        this.prisma = prisma;
        this.llmRouterService =
            llmRouterService || new llm_router_service_1.LLMRouterService(this.prisma);
        this.whatsappQueueService =
            whatsappQueueService || new whatsapp_queue_service_1.WhatsAppQueueService(this.prisma);
    }
    /**
     * Send system notification to customers
     *
     * Unified endpoint for all system notifications:
     * - CHATBOT_REACTIVATED: When admin enables chatbot
     * - ACCOUNT_ACTIVATED: When admin activates a new customer
     * - DISCOUNT_CHANGED: When admin changes customer discount percentage
     *
     * @route POST /workspaces/:workspaceId/push/system-notification
     * @param req - Express request with workspaceId in params, type, customerIds, templateData in body
     * @param res - Express response
     * @returns Success response with sent/failed counts
     */
    sendSystemNotification(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId } = req.params;
                const { type, customerIds, templateData = {} } = req.body;
                logger_1.default.info(`[PUSH-CONTROLLER] 🔔 sendSystemNotification called`, {
                    workspaceId,
                    type,
                    customerIds,
                    templateData,
                    body: req.body,
                });
                // Validation
                if (!workspaceId ||
                    !type ||
                    !customerIds ||
                    !Array.isArray(customerIds)) {
                    logger_1.default.error("[PUSH-CONTROLLER] Validation failed", {
                        hasWorkspaceId: !!workspaceId,
                        hasType: !!type,
                        hasCustomerIds: !!customerIds,
                        isArray: Array.isArray(customerIds),
                    });
                    return res.status(400).json({
                        error: "Invalid request",
                        message: "workspaceId, type, and customerIds array are required",
                    });
                }
                // Validate notification type
                if (!Object.values(SystemNotificationType).includes(type)) {
                    logger_1.default.error(`[PUSH-CONTROLLER] Invalid notification type: ${type}`);
                    return res.status(400).json({
                        error: "Invalid notification type",
                        message: `Type must be one of: ${Object.values(SystemNotificationType).join(", ")}`,
                    });
                }
                logger_1.default.info(`[PUSH-CONTROLLER] 🚀 Sending ${type} notification to ${customerIds.length} customer(s) in workspace ${workspaceId}`);
                const results = {
                    sent: 0,
                    failed: 0,
                    errors: [],
                };
                // Send notification to each customer
                for (const customerId of customerIds) {
                    try {
                        // Fetch customer data with workspace isolation
                        const customer = yield this.prisma.customers.findUnique({
                            where: { id: customerId, workspaceId },
                            select: {
                                id: true,
                                phone: true,
                                name: true,
                                language: true,
                            },
                        });
                        if (!customer) {
                            results.failed++;
                            results.errors.push(`Customer ${customerId}: Not found`);
                            logger_1.default.warn(`[PUSH-CONTROLLER] Customer ${customerId} not found in workspace ${workspaceId}`);
                            continue;
                        }
                        if (!customer.phone) {
                            results.failed++;
                            results.errors.push(`Customer ${customer.name}: Missing phone number`);
                            logger_1.default.warn(`[PUSH-CONTROLLER] Customer ${customer.name} has no phone number`);
                            continue;
                        }
                        // Get or create chat session
                        let chatSession = yield this.prisma.chatSession.findFirst({
                            where: {
                                customerId: customer.id,
                                workspaceId,
                                status: "active",
                            },
                        });
                        if (!chatSession) {
                            chatSession = yield this.prisma.chatSession.create({
                                data: {
                                    customerId: customer.id,
                                    workspaceId,
                                    status: "active",
                                    context: {},
                                },
                            });
                        }
                        // Generate message from template (Italian base language)
                        const messageTemplate = NOTIFICATION_TEMPLATES[type];
                        const notificationMessage = messageTemplate(Object.assign({ customerName: customer.name }, templateData));
                        logger_1.default.info(`[PUSH-CONTROLLER] 📤 Calling routeMessage for ${customer.name}`, {
                            workspaceId,
                            customerId: customer.id,
                            conversationId: chatSession.id,
                            notificationMessage,
                            customerLanguage: customer.language,
                        });
                        const result = yield this.llmRouterService.routeMessage({
                            workspaceId,
                            customerId: customer.id,
                            conversationId: chatSession.id,
                            messageId: `system-${type.toLowerCase()}-${Date.now()}`,
                            message: notificationMessage,
                            customerLanguage: customer.language,
                            customerName: customer.name,
                            isSystemMessage: true,
                        });
                        logger_1.default.info(`[PUSH-CONTROLLER] 📥 routeMessage result for ${customer.name}`, {
                            response: result.response,
                            isBlocked: result.isBlocked,
                            agentUsed: result.agentUsed,
                            tokensUsed: result.tokensUsed,
                        });
                        if (result.isBlocked) {
                            results.failed++;
                            results.errors.push(`Customer ${customer.name}: Message blocked by security`);
                            logger_1.default.warn(`[PUSH-CONTROLLER] Notification blocked for ${customer.name}`);
                        }
                        else {
                            // ✅ NEW: Enqueue message in WhatsApp queue for actual delivery
                            try {
                                yield this.whatsappQueueService.enqueue({
                                    workspaceId,
                                    customerId: customer.id,
                                    phoneNumber: customer.phone,
                                    messageContent: result.response, // Use translated message from LLM router
                                });
                                logger_1.default.info(`[PUSH-CONTROLLER] Message queued for WhatsApp delivery to ${customer.name}`);
                            }
                            catch (queueError) {
                                logger_1.default.error(`[PUSH-CONTROLLER] Failed to enqueue message for ${customer.name}:`, queueError);
                                results.failed++;
                                results.errors.push(`Customer ${customer.name}: Failed to queue message for delivery`);
                                continue;
                            }
                            results.sent++;
                        }
                    }
                    catch (error) {
                        logger_1.default.error(`[PUSH-CONTROLLER] Error processing customer ${customerId}:`, error);
                        results.failed++;
                        results.errors.push(`Customer ${customerId}: ${error instanceof Error ? error.message : "Unknown error"}`);
                    }
                }
                return res.status(200).json({
                    success: true,
                    sent: results.sent,
                    failed: results.failed,
                    errors: results.errors,
                });
            }
            catch (error) {
                logger_1.default.error("[PUSH-CONTROLLER] Error in sendSystemNotification:", error);
                return res.status(500).json({
                    error: "Internal server error",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
}
exports.PushController = PushController;
//# sourceMappingURL=push.controller.js.map