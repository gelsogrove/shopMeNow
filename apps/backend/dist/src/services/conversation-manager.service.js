"use strict";
/**
 * ConversationManager
 *
 * Manages conversation history for LLM context.
 *
 * Strategy:
 * - Loads last 10 MINUTES of messages (not 20 messages)
 * - Saves all message types: user, assistant, function, function_result
 * - Auto-cleanup messages older than 10 minutes
 *
 * @architecture Clean Architecture - Uses ConversationMessageRepository
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
exports.ConversationManager = void 0;
const conversation_message_repository_1 = require("../repositories/conversation-message.repository");
const whatsapp_queue_service_1 = require("./whatsapp-queue.service");
const logger_1 = __importDefault(require("../utils/logger"));
class ConversationManager {
    constructor(prisma, historyWindowMinutes = 5) {
        this.prisma = prisma;
        this.conversationRepo = new conversation_message_repository_1.ConversationMessageRepository(prisma);
        this.whatsappQueueService = new whatsapp_queue_service_1.WhatsAppQueueService(prisma);
        this.historyWindowMinutes = historyWindowMinutes;
        logger_1.default.info(`✅ ConversationManager initialized (history window: ${historyWindowMinutes} minutes)`);
    }
    /**
     * Load conversation history for LLM context
     *
     * Returns messages from last N minutes (default: 10)
     * Formatted for OpenRouter API
     *
     * @param workspaceId - Workspace ID
     * @param conversationId - Conversation ID
     * @returns Array of messages in OpenRouter format
     */
    loadHistory(workspaceId, conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("📖 Loading conversation history", {
                    workspaceId,
                    conversationId,
                    windowMinutes: this.historyWindowMinutes,
                });
                // Calculate cutoff timestamp (10 minutes ago)
                const cutoffTime = new Date();
                cutoffTime.setMinutes(cutoffTime.getMinutes() - this.historyWindowMinutes);
                // Load messages from repository (filtered by time)
                const messages = yield this.conversationRepo.getHistoryByTime(workspaceId, conversationId, cutoffTime);
                // Transform to OpenRouter format
                const formattedMessages = messages.map((msg) => {
                    const message = {
                        role: msg.role,
                        content: msg.content,
                    };
                    // Add function name if present
                    if ("name" in msg && msg.name) {
                        message.name = msg.name;
                    }
                    return message;
                });
                logger_1.default.info(`✅ Loaded ${formattedMessages.length} messages from last ${this.historyWindowMinutes} minutes`);
                return formattedMessages;
            }
            catch (error) {
                logger_1.default.error("❌ Failed to load conversation history", error);
                // Return empty array on error (stateless fallback)
                return [];
            }
        });
    }
    /**
     * Save user message
     */
    saveUserMessage(params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.conversationRepo.saveMessage(Object.assign(Object.assign({}, params), { role: "user" }));
                logger_1.default.debug("💬 User message saved", {
                    conversationId: params.conversationId,
                });
            }
            catch (error) {
                logger_1.default.error("❌ Failed to save user message", error);
            }
        });
    }
    /**
     * Save system context message (hidden from user, visible to LLM)
     * Used for passing JSON context like group mappings, cart state, etc.
     */
    saveSystemContext(params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.conversationRepo.saveMessage(Object.assign(Object.assign({}, params), { role: "system", deliveryStatus: "not_queued" }));
                logger_1.default.info("📋 System context saved to history", {
                    conversationId: params.conversationId,
                    contentPreview: params.content.substring(0, 100),
                });
            }
            catch (error) {
                logger_1.default.error("❌ Failed to save system context", error);
            }
        });
    }
    /**
     * Save user + assistant in a single transaction to avoid orphaned messages.
     * Enqueue to WhatsApp after transaction if phone is available.
     */
    saveUserAndAssistantAtomic(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { workspaceId, customerId, conversationId, userContent, assistantContent, agentType, tokensUsed, debugInfo, } = params;
            if (!(assistantContent === null || assistantContent === void 0 ? void 0 : assistantContent.trim())) {
                logger_1.default.error("🚨 Empty assistant content detected - cannot save/enqueue empty message", {
                    customerId,
                    conversationId,
                    agentType,
                });
                return {};
            }
            try {
                // Determine delivery status and phone (outside transaction)
                let deliveryStatus = "not_queued";
                let customerPhone = null;
                if (agentType === "REGISTRATION_FLOW") {
                    deliveryStatus = "not_queued";
                }
                else {
                    const customer = yield this.prisma.customers.findFirst({
                        where: { id: customerId, workspaceId },
                        select: { phone: true },
                    });
                    customerPhone = (customer === null || customer === void 0 ? void 0 : customer.phone) || null;
                    deliveryStatus = customerPhone ? "pending" : "not_queued";
                    if (!customerPhone) {
                        logger_1.default.warn("⚠️ Customer has no phone number, skipping WhatsApp queue", {
                            customerId,
                        });
                    }
                }
                // Save both messages atomically
                const result = yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    const userId = yield tx.conversationMessage.create({
                        data: {
                            workspaceId,
                            customerId,
                            conversationId,
                            role: "user",
                            content: userContent,
                            deliveryStatus: "not_queued",
                        },
                        select: { id: true },
                    });
                    const assistantId = yield tx.conversationMessage.create({
                        data: {
                            workspaceId,
                            customerId,
                            conversationId,
                            role: "assistant",
                            content: assistantContent,
                            agentType,
                            tokensUsed,
                            deliveryStatus,
                            debugInfo: debugInfo ? JSON.stringify(debugInfo) : undefined,
                        },
                        select: { id: true },
                    });
                    return { userId: userId.id, assistantId: assistantId.id };
                }));
                logger_1.default.debug("💾 [ConversationManager] Saved user+assistant atomically", {
                    conversationId,
                    userId: result.userId,
                    assistantId: result.assistantId,
                    deliveryStatus,
                });
                // Enqueue after transaction if needed
                if (deliveryStatus === "pending" && customerPhone) {
                    try {
                        yield this.whatsappQueueService.enqueue({
                            workspaceId,
                            customerId,
                            phoneNumber: customerPhone,
                            messageContent: assistantContent,
                            conversationMessageId: result.assistantId,
                        });
                    }
                    catch (queueError) {
                        logger_1.default.error("❌ Failed to add message to WhatsApp queue (atomic path):", queueError);
                        yield this.conversationRepo.updateDeliveryStatus(result.assistantId, "not_queued");
                    }
                }
                return { assistantMessageId: result.assistantId };
            }
            catch (error) {
                logger_1.default.error("❌ [ConversationManager] Failed to save user+assistant atomically", error);
                return {};
            }
        });
    }
    /**
     * Save assistant response
     */
    saveAssistantMessage(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                let deliveryStatus = params.deliveryStatus || "not_queued"; // Default: not queued unless enqueueing succeeds
                let customerPhone = null;
                // 🛡️ GUARDIA: Skip empty messages entirely - never enqueue or save empty content
                if (!((_a = params.content) === null || _a === void 0 ? void 0 : _a.trim())) {
                    logger_1.default.error("🚨 Empty message content detected - cannot save/enqueue empty message", {
                        customerId: params.customerId,
                        conversationId: params.conversationId,
                        agentType: params.agentType,
                    });
                    // Don't save empty messages - this is a critical bug upstream
                    return undefined;
                }
                // 🆕 Feature 181: If message is already marked as blocked, skip enqueueing entirely
                if (deliveryStatus === "blocked") {
                    logger_1.default.warn("🚫 Message is blocked - skipping WhatsApp queue", {
                        customerId: params.customerId,
                        conversationId: params.conversationId,
                    });
                    // Fall through to save with blocked status - don't try to enqueue
                }
                // 🚫 SKIP ENQUEUEING FOR REGISTRATION FLOW MESSAGES
                // Welcome messages from new user registration should NOT go to WhatsApp queue
                else if (params.agentType !== "REGISTRATION_FLOW") {
                    // Check if customer has phone number (needed for queue)
                    const customer = yield this.prisma.customers.findFirst({
                        where: { id: params.customerId, workspaceId: params.workspaceId }, // 🔒 Workspace isolation
                        select: { phone: true },
                    });
                    customerPhone = (customer === null || customer === void 0 ? void 0 : customer.phone) || null;
                    if (customerPhone) {
                        deliveryStatus = "pending"; // Will be enqueued after save
                    }
                    else {
                        logger_1.default.warn("⚠️  Customer has no phone number, skipping WhatsApp queue", {
                            customerId: params.customerId,
                        });
                        deliveryStatus = "not_queued"; // No phone = not queued
                    }
                }
                else {
                    logger_1.default.info("🚫 Skipping WhatsApp queue for REGISTRATION_FLOW message (welcome message)", {
                        customerId: params.customerId,
                    });
                    deliveryStatus = "not_queued"; // Registration flow = not queued
                }
                // 1️⃣ Save to History (conversationMessage) FIRST to get the ID
                const messageId = yield this.conversationRepo.saveMessage(Object.assign(Object.assign({}, params), { role: "assistant", deliveryStatus }));
                logger_1.default.debug("🤖 Assistant message saved to history", {
                    messageId,
                    conversationId: params.conversationId,
                    deliveryStatus: deliveryStatus,
                });
                // 2️⃣ If pending status, try to add to WhatsApp Queue with the message ID
                if (deliveryStatus === "pending" && customerPhone) {
                    try {
                        yield this.whatsappQueueService.enqueue({
                            workspaceId: params.workspaceId,
                            customerId: params.customerId,
                            phoneNumber: customerPhone,
                            messageContent: params.content,
                            conversationMessageId: messageId, // ✅ Link queue to conversation message for timeline tracking
                        });
                        logger_1.default.debug("📤 Assistant message added to WhatsApp queue", {
                            messageId,
                            customerId: params.customerId,
                            phone: customerPhone,
                            deliveryStatus: "pending",
                        });
                    }
                    catch (queueError) {
                        // Non-critical: update message status and log error
                        logger_1.default.error("❌ Failed to add message to WhatsApp queue:", queueError);
                        // Update message to not_queued since enqueue failed
                        yield this.conversationRepo.updateDeliveryStatus(messageId, "not_queued");
                    }
                }
                // 🆕 Return the message ID for translation update
                return messageId;
            }
            catch (error) {
                logger_1.default.error("❌ Failed to save assistant message", error);
                return undefined;
            }
        });
    }
    /**
     * Save function call
     *
     * When Router LLM calls a function, we save it as a "function" message
     */
    saveFunctionCall(params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.conversationRepo.saveMessage(Object.assign(Object.assign({}, params), { role: "function", content: JSON.stringify(params.functionArguments) }));
                logger_1.default.debug("⚙️ Function call saved", {
                    conversationId: params.conversationId,
                    functionName: params.functionName,
                });
            }
            catch (error) {
                logger_1.default.error("❌ Failed to save function call", error);
            }
        });
    }
    /**
     * Save function result
     *
     * After executing function, save result for LLM context
     */
    saveFunctionResult(params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.conversationRepo.saveMessage(Object.assign(Object.assign({}, params), { role: "function", content: typeof params.result === "string"
                        ? params.result
                        : JSON.stringify(params.result), functionName: params.functionName }));
                logger_1.default.debug("✅ Function result saved", {
                    conversationId: params.conversationId,
                    functionName: params.functionName,
                });
            }
            catch (error) {
                logger_1.default.error("❌ Failed to save function result", error);
            }
        });
    }
    /**
     * Cleanup old messages
     *
     * Delete messages older than history window
     * Call this periodically (e.g., every hour via cron job)
     */
    cleanupOldMessages(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cutoffTime = new Date();
                cutoffTime.setMinutes(cutoffTime.getMinutes() - this.historyWindowMinutes);
                const deletedCount = yield this.conversationRepo.cleanupOldMessages(workspaceId, cutoffTime);
                logger_1.default.info(`🧹 Cleaned up ${deletedCount} old messages for workspace ${workspaceId}`);
                return deletedCount;
            }
            catch (error) {
                logger_1.default.error("❌ Failed to cleanup old messages", error);
                return 0;
            }
        });
    }
    /**
     * Get conversation count (for monitoring)
     */
    getMessageCount(workspaceId, conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.conversationRepo.countMessages(workspaceId, conversationId);
            }
            catch (error) {
                logger_1.default.error("❌ Failed to get message count", error);
                return 0;
            }
        });
    }
    /**
     * Delete entire conversation
     *
     * Use when customer requests data deletion (GDPR)
     */
    deleteConversation(workspaceId, conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const deletedCount = yield this.conversationRepo.deleteConversation(workspaceId, conversationId);
                logger_1.default.info(`🗑️ Deleted ${deletedCount} messages from conversation ${conversationId}`);
                return deletedCount;
            }
            catch (error) {
                logger_1.default.error("❌ Failed to delete conversation", error);
                return 0;
            }
        });
    }
    /**
     * Get all conversations for a customer (for UI)
     */
    getCustomerConversations(workspaceId_1, customerId_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, customerId, limit = 10) {
            try {
                return yield this.conversationRepo.getCustomerConversations(workspaceId, customerId, limit);
            }
            catch (error) {
                logger_1.default.error("❌ Failed to get customer conversations", error);
                return [];
            }
        });
    }
}
exports.ConversationManager = ConversationManager;
//# sourceMappingURL=conversation-manager.service.js.map