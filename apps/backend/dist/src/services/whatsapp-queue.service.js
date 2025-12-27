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
exports.WhatsAppQueueService = void 0;
// Internal core
const logger_1 = __importDefault(require("../utils/logger"));
// Agents
const SecurityAgent_1 = require("../application/agents/SecurityAgent");
// Repositories
const whatsapp_queue_repository_1 = require("../repositories/whatsapp-queue.repository");
// Services
const subscription_billing_service_1 = require("../application/services/subscription-billing.service");
class WhatsAppQueueService {
    constructor(prisma) {
        this.prisma = prisma;
        this.repository = new whatsapp_queue_repository_1.WhatsAppQueueRepository(prisma);
        this.securityAgent = new SecurityAgent_1.SecurityAgent(prisma); // Initialize Security Agent
        this.billingService = new subscription_billing_service_1.SubscriptionBillingService(prisma); // Initialize billing service
    }
    /**
     * Get queue status for a workspace
     * @param workspaceId Workspace ID (workspace isolation)
     * @param status Optional status filter
     * @returns Array of queue messages
     */
    getQueueStatus(workspaceId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`[WhatsAppQueueService] Getting queue status for workspace: ${workspaceId}, status: ${status || "all"}`);
                return yield this.repository.findByWorkspace(workspaceId, status);
            }
            catch (error) {
                logger_1.default.error(`[WhatsAppQueueService] Error in getQueueStatus:`, error);
                throw new Error("Failed to get queue status");
            }
        });
    }
    /**
     * Add message to queue with validation
     * @param data Message data
     * @returns Created queue message
     */
    enqueue(data) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug(`[WhatsAppQueueService] Enqueue called`, {
                customerId: data.customerId,
                phoneNumber: data.phoneNumber,
            });
            try {
                // Validate required fields
                if (!data.phoneNumber || data.phoneNumber.trim() === "") {
                    throw new Error("Phone number is required");
                }
                if (!data.messageContent || data.messageContent.trim() === "") {
                    throw new Error("Message content is required");
                }
                if (!data.workspaceId || data.workspaceId.trim() === "") {
                    throw new Error("Workspace ID is required");
                }
                if (!data.customerId || data.customerId.trim() === "") {
                    throw new Error("Customer ID is required");
                }
                // Check for duplicates (within 1 minute)
                const isDuplicate = yield this.repository.checkDuplicate(data.customerId, data.messageContent, 1);
                if (isDuplicate) {
                    logger_1.default.warn(`[WhatsAppQueueService] Duplicate message detected for customer ${data.customerId}, skipping enqueue`);
                    throw new Error("Duplicate message detected (within 1 minute window)");
                }
                logger_1.default.info(`[WhatsAppQueueService] Enqueueing message for customer: ${data.customerId}`);
                const result = yield this.repository.create({
                    workspaceId: data.workspaceId,
                    customerId: data.customerId,
                    phoneNumber: data.phoneNumber,
                    messageContent: data.messageContent,
                    status: "pending",
                    conversationMessageId: data.conversationMessageId,
                });
                logger_1.default.debug(`[WhatsAppQueueService] Message queued with ID: ${result.id}`);
                return result;
            }
            catch (error) {
                logger_1.default.error(`[WhatsAppQueueService] Error in enqueue:`, error);
                throw error;
            }
        });
    }
    /**
     * Process pending messages for a workspace (called by cron)
     * If debugMode is enabled for the workspace, messages are NOT sent (stay pending)
     * @param workspaceId Workspace ID
     */
    processPendingMessages(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 🔧 DEBUG MODE CHECK: If debugMode is enabled, skip sending entirely
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: { debugMode: true, name: true },
                });
                if ((workspace === null || workspace === void 0 ? void 0 : workspace.debugMode) === true) {
                    logger_1.default.info(`[WhatsAppQueueService] 🔧 DEBUG MODE ENABLED for workspace "${workspace.name}" (${workspaceId}) - messages will NOT be sent`);
                    // Skip processing - messages remain in "pending" status
                    return;
                }
                // Fetch ONE pending message (FIFO)
                const message = yield this.repository.findPending(workspaceId, 1);
                if (!message) {
                    // No pending messages
                    return;
                }
                logger_1.default.info(`[WhatsAppQueueService] Processing message ID: ${message.id} for customer: ${message.customerId}`);
                // Validate and send
                const result = yield this.validateAndSend(message);
                if (result.success) {
                    // Success: update status to 'sent' (keep in queue for history)
                    yield this.repository.updateStatus(message.id, "sent");
                    logger_1.default.info(`[WhatsAppQueueService] Message ${message.id} sent successfully, updated status to 'sent'`);
                    // 💰 BILLING: Deduct credit NOW that message is actually sent
                    try {
                        const deductResult = yield this.billingService.deductMessageCredit(message.workspaceId, message.id);
                        if (deductResult.success) {
                            logger_1.default.info(`[WhatsAppQueueService] 💰 Credit deducted for message ${message.id}`, {
                                workspaceId: message.workspaceId,
                                newBalance: deductResult.newBalance,
                            });
                        }
                        else {
                            logger_1.default.warn(`[WhatsAppQueueService] ⚠️ Failed to deduct credit for message ${message.id}`, {
                                workspaceId: message.workspaceId,
                                error: deductResult.error,
                            });
                        }
                    }
                    catch (billingError) {
                        // Don't fail the message send if billing fails - just log it
                        logger_1.default.error(`[WhatsAppQueueService] ⚠️ Billing error for message ${message.id}:`, billingError);
                    }
                    // Mark as delivered in conversation history (if exists)
                    yield this.markDeliveredInHistory(message.conversationMessageId, message.customerId, message.messageContent);
                }
                else {
                    // Error: update status to 'error' with error message
                    yield this.repository.updateStatus(message.id, "error", result.error);
                    logger_1.default.error(`[WhatsAppQueueService] Message ${message.id} failed: ${result.error}`);
                }
            }
            catch (error) {
                logger_1.default.error(`[WhatsAppQueueService] Error in processPendingMessages:`, error);
                // Don't throw - let cron continue with next cycle
            }
        });
    }
    /**
     * Append a step to the conversation message timeline (debugInfo)
     * Used when cronjob processes queue messages to add Security Check and Send to WhatsApp steps
     *
     * @param conversationMessageId - The ID of the conversation message to update
     * @param step - The timeline step to append
     */
    appendTimelineStep(conversationMessageId, step) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!conversationMessageId) {
                logger_1.default.debug("[WhatsAppQueueService] No conversationMessageId - skipping timeline append");
                return;
            }
            try {
                // Get current message with debugInfo
                const message = yield this.prisma.conversationMessage.findUnique({
                    where: { id: conversationMessageId },
                    select: { id: true, debugInfo: true },
                });
                if (!message) {
                    logger_1.default.warn(`[WhatsAppQueueService] Conversation message ${conversationMessageId} not found for timeline append`);
                    return;
                }
                // Parse existing debugInfo or create new structure
                let debugInfo;
                if (message.debugInfo) {
                    try {
                        debugInfo = JSON.parse(message.debugInfo);
                        if (!debugInfo.steps) {
                            debugInfo.steps = [];
                        }
                    }
                    catch (_b) {
                        // Invalid JSON, create new structure
                        debugInfo = {
                            steps: [],
                            totalTokens: 0,
                            totalCost: 0,
                            executionTimeMs: 0,
                        };
                    }
                }
                else {
                    debugInfo = {
                        steps: [],
                        totalTokens: 0,
                        totalCost: 0,
                        executionTimeMs: 0,
                    };
                }
                // Append the new step
                debugInfo.steps.push(step);
                // Update execution time if provided
                if ((_a = step.output) === null || _a === void 0 ? void 0 : _a.executionTimeMs) {
                    debugInfo.executionTimeMs += step.output.executionTimeMs;
                }
                // Save updated debugInfo
                yield this.prisma.conversationMessage.update({
                    where: { id: conversationMessageId },
                    data: {
                        debugInfo: JSON.stringify(debugInfo),
                    },
                });
                logger_1.default.debug(`[WhatsAppQueueService] Appended "${step.agent}" step to timeline for message ${conversationMessageId}`);
            }
            catch (error) {
                // Non-critical error - log but don't throw
                logger_1.default.error(`[WhatsAppQueueService] Error appending timeline step:`, error);
            }
        });
    }
    /**
     * Validate message fields and run through Security Agent
     * (🆕 Feature 181: Security check before sending to WhatsApp)
     * @param message Queue message
     * @returns Validation result
     */
    validateAndSend(message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate phone number format (basic check)
                if (!message.phoneNumber || message.phoneNumber.trim() === "") {
                    return { success: false, error: "Invalid phone number: empty" };
                }
                // Simple phone validation: must start with + and contain digits
                const phoneRegex = /^\+?[0-9]{8,15}$/;
                if (!phoneRegex.test(message.phoneNumber.replace(/\s/g, ""))) {
                    return {
                        success: false,
                        error: `Invalid phone number format: ${message.phoneNumber}`,
                    };
                }
                // Validate message content
                if (!message.messageContent || message.messageContent.trim() === "") {
                    return { success: false, error: "Invalid message: empty content" };
                }
                // 🆕 STEP 1: Run message through Security Agent (Feature 181)
                logger_1.default.info("🛡️ Step 1: Running Security Agent before WhatsApp send");
                const securityStartTime = Date.now();
                const securityResult = yield this.securityAgent.process({
                    workspaceId: message.workspaceId,
                    message: message.messageContent,
                    customerId: message.customerId,
                    customerName: "", // Not always available from queue record
                });
                const securityDuration = Date.now() - securityStartTime;
                // 📊 Append Security Check step to timeline
                yield this.appendTimelineStep(message.conversationMessageId, {
                    type: "sub_agent",
                    agent: "Security Check",
                    timestamp: new Date().toISOString(),
                    output: {
                        result: {
                            safe: securityResult.safe,
                            blockedReason: securityResult.blockedReason || null,
                        },
                        executionTimeMs: securityDuration,
                    },
                });
                // If Security Agent blocks the message, don't send
                if (!securityResult.safe) {
                    logger_1.default.warn("🚫 Message BLOCKED by Security Agent before WhatsApp send", {
                        reason: securityResult.blockedReason,
                        customerId: message.customerId,
                        messageId: message.id,
                    });
                    return {
                        success: false,
                        error: `Security check failed: ${securityResult.blockedReason}`,
                    };
                }
                logger_1.default.info("✅ Message passed Security Agent check");
                // 🆕 STEP 2: Send to WhatsApp (placeholder for now)
                const whatsappStartTime = Date.now();
                // 🚨 PLACEHOLDER: Log instead of actual WhatsApp send (API not yet integrated)
                logger_1.default.info("📤 [PLACEHOLDER] WhatsApp message ready for send", {
                    phone: message.phoneNumber,
                    customerId: message.customerId,
                    workspaceId: message.workspaceId,
                    messageLength: message.messageContent.length,
                });
                const whatsappDuration = Date.now() - whatsappStartTime;
                // 📊 Append Send to WhatsApp step to timeline
                yield this.appendTimelineStep(message.conversationMessageId, {
                    type: "sub_agent",
                    agent: "Send to WhatsApp",
                    timestamp: new Date().toISOString(),
                    output: {
                        result: {
                            success: true,
                            phone: message.phoneNumber,
                        },
                        executionTimeMs: whatsappDuration,
                    },
                });
                // Simulate success
                return { success: true };
            }
            catch (error) {
                logger_1.default.error(`[WhatsAppQueueService] Error in validateAndSend:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                };
            }
        });
    }
    /**
     * Mark message as delivered in conversation history
     * Uses conversationMessageId for direct update (if available),
     * otherwise falls back to content matching
     *
     * @param conversationMessageId - Direct ID of the conversation message (preferred)
     * @param customerId - Customer ID (fallback if conversationMessageId not available)
     * @param messageContent - Message content for fallback matching
     */
    markDeliveredInHistory(conversationMessageId, customerId, messageContent) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Prefer direct update via conversationMessageId
                if (conversationMessageId) {
                    yield this.prisma.conversationMessage.update({
                        where: { id: conversationMessageId },
                        data: {
                            deliveredAt: new Date(),
                            deliveryStatus: "sent",
                        },
                    });
                    logger_1.default.info(`[WhatsAppQueueService] Marked conversation message ${conversationMessageId} as delivered (direct ID)`);
                    return;
                }
                // Fallback: Find matching conversation message by content (legacy behavior)
                const conversationMessage = yield this.prisma.conversationMessage.findFirst({
                    where: {
                        customerId,
                        content: messageContent,
                        deliveredAt: null, // Only update if not already marked
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                });
                if (conversationMessage) {
                    yield this.prisma.conversationMessage.update({
                        where: { id: conversationMessage.id },
                        data: {
                            deliveredAt: new Date(),
                            deliveryStatus: "sent",
                        },
                    });
                    logger_1.default.info(`[WhatsAppQueueService] Marked conversation message ${conversationMessage.id} as delivered (content match)`);
                }
                else {
                    logger_1.default.warn(`[WhatsAppQueueService] No matching conversation message found for customer ${customerId}`);
                }
            }
            catch (error) {
                logger_1.default.error(`[WhatsAppQueueService] Error marking delivered in history:`, error);
                // Don't throw - this is non-critical
            }
        });
    }
    /**
     * Get queue statistics for a workspace
     * @param workspaceId Workspace ID
     * @returns Statistics object
     */
    getStatistics(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.repository.countByStatus(workspaceId);
            }
            catch (error) {
                logger_1.default.error(`[WhatsAppQueueService] Error in getStatistics:`, error);
                throw new Error("Failed to get queue statistics");
            }
        });
    }
    /**
     * Clear all messages from queue for a workspace
     * @param workspaceId Workspace ID
     * @returns Number of deleted messages
     */
    clearQueue(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.warn(`[WhatsAppQueueService] Clearing entire queue for workspace: ${workspaceId}`);
                const result = yield this.prisma.whatsAppQueue.deleteMany({
                    where: { workspaceId },
                });
                logger_1.default.info(`[WhatsAppQueueService] Deleted ${result.count} messages from queue`);
                return result.count;
            }
            catch (error) {
                logger_1.default.error(`[WhatsAppQueueService] Error in clearQueue:`, error);
                throw new Error("Failed to clear queue");
            }
        });
    }
    /**
     * Delete a single message from queue
     * @param messageId Message ID to delete
     * @param workspaceId Workspace ID (for isolation)
     * @returns True if deleted, false if not found
     */
    deleteMessage(messageId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`[WhatsAppQueueService] Deleting message ${messageId} from workspace ${workspaceId}`);
                const result = yield this.prisma.whatsAppQueue.deleteMany({
                    where: {
                        id: messageId,
                        workspaceId, // Ensure workspace isolation
                    },
                });
                if (result.count === 0) {
                    logger_1.default.warn(`[WhatsAppQueueService] Message ${messageId} not found in workspace ${workspaceId}`);
                    return false;
                }
                logger_1.default.info(`[WhatsAppQueueService] Successfully deleted message ${messageId}`);
                return true;
            }
            catch (error) {
                logger_1.default.error(`[WhatsAppQueueService] Error in deleteMessage:`, error);
                throw new Error("Failed to delete message");
            }
        });
    }
    /**
     * Get queue enabled status for a workspace (based on channelStatus)
     * @param workspaceId Workspace ID
     * @returns Queue enabled status (based on channelStatus) and debug mode
     */
    getQueueEnabledStatus(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.debug(`[WhatsAppQueueService] getQueueEnabledStatus: ${workspaceId}`);
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: { channelStatus: true, debugMode: true },
                });
                if (!workspace) {
                    throw new Error("Workspace not found");
                }
                logger_1.default.debug(`[WhatsAppQueueService] Queue status: enabled=${workspace.channelStatus}, debugMode=${workspace.debugMode}`);
                return { enabled: workspace.channelStatus, debugMode: workspace.debugMode };
            }
            catch (error) {
                console.error(`🔴 [WhatsAppQueueService.getQueueEnabledStatus] Error:`, error);
                logger_1.default.error(`[WhatsAppQueueService] Error in getQueueEnabledStatus:`, error);
                throw new Error("Failed to get queue status");
            }
        });
    }
    /**
     * Update channel status for a workspace (controls queue processing)
     * @param workspaceId Workspace ID
     * @param enabled Enable or disable channel
     * @returns Updated status
     */
    updateQueueStatus(workspaceId, enabled) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`[WhatsAppQueueService] Updating channel status for workspace ${workspaceId}: ${enabled ? "ENABLED" : "DISABLED"}`);
                const updated = yield this.prisma.workspace.update({
                    where: { id: workspaceId },
                    data: { channelStatus: enabled },
                });
                logger_1.default.debug(`[WhatsAppQueueService] Updated workspace: ${updated.id}`);
                return { enabled };
            }
            catch (error) {
                console.error(`🔴 [WhatsAppQueueService.updateQueueStatus] Error:`, error);
                logger_1.default.error(`[WhatsAppQueueService] Error in updateQueueStatus:`, error);
                throw new Error("Failed to update queue status");
            }
        });
    }
    /**
     * Update debug mode for a workspace
     * When debugMode=true, messages will NOT be sent (stay pending)
     * When debugMode=false, messages will be sent normally
     * @param workspaceId Workspace ID
     * @param debugMode Debug mode setting
     * @returns Updated debug mode status
     */
    updateDebugMode(workspaceId, debugMode) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`[WhatsAppQueueService] Updating debug mode for workspace ${workspaceId}: ${debugMode ? "ENABLED" : "DISABLED"}`);
                const updated = yield this.prisma.workspace.update({
                    where: { id: workspaceId },
                    data: { debugMode },
                });
                logger_1.default.debug(`[WhatsAppQueueService] Updated workspace: ${updated.id}`);
                return { debugMode };
            }
            catch (error) {
                console.error(`🔴 [WhatsAppQueueService.updateDebugMode] Error:`, error);
                logger_1.default.error(`[WhatsAppQueueService] Error in updateDebugMode:`, error);
                throw new Error("Failed to update debug mode");
            }
        });
    }
}
exports.WhatsAppQueueService = WhatsAppQueueService;
//# sourceMappingURL=whatsapp-queue.service.js.map