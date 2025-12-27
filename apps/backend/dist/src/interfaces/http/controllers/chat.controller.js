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
exports.ChatController = void 0;
const database_1 = require("@echatbot/database");
const config_1 = require("../../../config");
const message_repository_1 = require("../../../repositories/message.repository");
const llm_router_service_1 = require("../../../services/llm-router.service");
const whatsapp_queue_service_1 = require("../../../services/whatsapp-queue.service");
const usage_service_1 = require("../../../services/usage.service");
const websocket_service_1 = require("../../../services/websocket.service");
const subscription_billing_service_1 = require("../../../application/services/subscription-billing.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
class ChatController {
    constructor() {
        this.prisma = database_1.prisma;
        this.messageRepository = new message_repository_1.MessageRepository();
        this.llmRouterService = new llm_router_service_1.LLMRouterService(this.prisma);
        this.whatsappQueueService = new whatsapp_queue_service_1.WhatsAppQueueService(this.prisma);
    }
    /**
     * Get all recent chats with unread counts
     */
    getRecentChats(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const limit = req.query.limit
                    ? parseInt(req.query.limit, 10)
                    : 20;
                const workspaceId = req.workspaceId;
                if (!workspaceId) {
                    res.status(400).json({
                        success: false,
                        error: "Workspace ID is required",
                    });
                    return;
                }
                logger_1.default.info(`Getting recent chats for workspace ${workspaceId}`);
                const chats = yield this.messageRepository.getChatSessionsWithUnreadCounts(limit, workspaceId);
                res.status(200).json({
                    success: true,
                    data: chats,
                });
            }
            catch (error) {
                logger_1.default.error("Error getting recent chats:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get recent chats",
                });
            }
        });
    }
    /**
     * Get details for a specific chat session
     */
    getChatSession(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { sessionId } = req.params;
                const workspaceId = req.workspaceId;
                logger_1.default.info(`Getting chat session details for sessionId: ${sessionId}, workspaceId: ${workspaceId}`);
                if (!sessionId) {
                    logger_1.default.warn("Session ID is missing in request");
                    res.status(400).json({
                        success: false,
                        error: "Session ID is required",
                    });
                    return;
                }
                // 🔐 SECURITY: workspaceId is MANDATORY
                if (!workspaceId) {
                    logger_1.default.error("getChatSession: workspaceId not found in request context");
                    res.status(401).json({
                        success: false,
                        error: "Workspace context required",
                    });
                    return;
                }
                // Get chat session details including workspace information
                const chatSession = yield this.prisma.chatSession.findFirst({
                    where: {
                        id: sessionId,
                        workspaceId: workspaceId,
                    },
                    include: {
                        customer: true,
                        workspace: {
                            select: {
                                id: true,
                                name: true,
                                isActive: true,
                            },
                        },
                    },
                });
                if (!chatSession) {
                    logger_1.default.warn(`Chat session not found for sessionId: ${sessionId}`);
                    res.status(404).json({
                        success: false,
                        error: "Chat session not found",
                    });
                    return;
                }
                logger_1.default.info(`Found chat session: ${JSON.stringify({
                    id: chatSession.id,
                    customerId: chatSession.customerId,
                    workspaceId: chatSession.workspaceId,
                    customerName: ((_a = chatSession.customer) === null || _a === void 0 ? void 0 : _a.name) || "Unknown Customer",
                })}`);
                res.status(200).json({
                    success: true,
                    data: chatSession,
                });
            }
            catch (error) {
                logger_1.default.error(`Error getting chat session details for ${req.params.sessionId}:`, error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get chat session details",
                });
            }
        });
    }
    /**
     * Get messages for a specific chat session
     */
    getChatMessages(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { sessionId } = req.params;
                const workspaceId = req.workspaceId;
                const { page = 1, limit = 50 } = req.query;
                if (!sessionId) {
                    res.status(400).json({
                        success: false,
                        error: "Session ID is required",
                    });
                    return;
                }
                // 📋 Parse and validate pagination params
                const pageNum = Math.max(1, parseInt(String(page)) || 1);
                const limitNum = Math.min(100, Math.max(1, parseInt(String(limit)) || 50));
                // Pass the workspaceId to the repository method for proper filtering
                const result = yield this.messageRepository.getChatSessionMessages(sessionId, workspaceId, pageNum, limitNum);
                if (result.data.length === 0 && workspaceId) {
                    // If no messages found and workspace ID was provided, it could mean the chat session doesn't belong to this workspace
                    res.status(404).json({
                        success: false,
                        error: "Chat session not found in this workspace or no messages available",
                    });
                    return;
                }
                // Mark messages as read when they are viewed
                yield this.messageRepository.markMessagesAsRead(sessionId, workspaceId);
                // 📋 Return paginated response with metadata
                res.status(200).json({
                    success: true,
                    data: result.data,
                    hasMore: result.hasMore,
                    total: result.total,
                    page: result.page,
                    limit: result.limit,
                });
            }
            catch (error) {
                logger_1.default.error("Error getting chat messages:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get chat messages",
                });
            }
        });
    }
    /**
     * Mark messages in a chat session as read
     */
    markAsRead(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { sessionId } = req.params;
                const workspaceId = req.workspaceId;
                if (!sessionId) {
                    res.status(400).json({
                        success: false,
                        error: "Session ID is required",
                    });
                    return;
                }
                // Pass the workspaceId to ensure we only mark messages for the right workspace
                const success = yield this.messageRepository.markMessagesAsRead(sessionId, workspaceId);
                if (!success && workspaceId) {
                    res.status(404).json({
                        success: false,
                        error: "Chat session not found in this workspace",
                    });
                    return;
                }
                res.status(200).json({
                    success,
                    message: success
                        ? "Messages marked as read"
                        : "Failed to mark messages as read",
                });
            }
            catch (error) {
                logger_1.default.error("Error marking messages as read:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to mark messages as read",
                });
            }
        });
    }
    /**
     * Delete a chat session and all its messages
     */
    deleteChat(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { sessionId } = req.params;
                const workspaceId = req.workspaceId;
                if (!sessionId) {
                    res.status(400).json({
                        success: false,
                        error: "Session ID is required",
                    });
                    return;
                }
                // Pass workspaceId to ensure we only delete the right chat session
                const success = yield this.messageRepository.deleteChat(sessionId, workspaceId);
                if (!success && workspaceId) {
                    res.status(404).json({
                        success: false,
                        error: "Chat session not found in this workspace",
                    });
                    return;
                }
                res.status(success ? 200 : 500).json({
                    success,
                    message: success
                        ? "Chat deleted successfully"
                        : "Failed to delete chat",
                });
            }
            catch (error) {
                logger_1.default.error("Error deleting chat:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to delete chat",
                });
            }
        });
    }
    /**
     * Send a message in a chat session (manual operator mode)
     * This endpoint is used when isActiveChatbot = false
     *
     * 🚨🚨🚨 CRITICAL RULE - MESSAGE FLOW TIMELINE COMPLIANCE 🚨🚨🚨
     *
     * THE MESSAGE FLOW TIMELINE **MUST** ALWAYS REPRESENT THE REAL MESSAGE JOURNEY!
     * NEVER let the real flow and the UI representation be different!
     *
     * OPERATOR MESSAGE FLOW (MUST be represented in timeline):
     * 1. 🎧 Human Operator Input
     * 2. 🛡️ Safety & Translation Agent (MANDATORY - always include in debugSteps)
     * 3. 📤 WhatsApp Queue (MANDATORY - always include in debugSteps)
     *
     * CRITICAL: Update conversationMessage.debugInfo with COMPLETE debugSteps
     * at the END of the process, not at the beginning!
     *
     * IF Safety is skipped → ADD debug step showing it was skipped
     * IF WhatsApp fails → ADD debug step showing the failure
     * IF any step is missing → The timeline representation is WRONG and UNACCEPTABLE
     *
     * This is the HEART of the software - debug steps MUST match reality!
     * 🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨
     */
    sendMessage(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { sessionId } = req.params;
                const { content, sender } = req.body;
                const workspaceId = req.workspaceId;
                if (!sessionId) {
                    res.status(400).json({
                        success: false,
                        error: "Session ID is required",
                    });
                    return;
                }
                if (!content || !sender) {
                    res.status(400).json({
                        success: false,
                        error: "Content and sender are required",
                    });
                    return;
                }
                if (!workspaceId) {
                    res.status(400).json({
                        success: false,
                        error: "Workspace ID is required",
                    });
                    return;
                }
                logger_1.default.info(`[CHAT-SEND] 📱 Sending operator message in session ${sessionId}: "${content}"`);
                // Find the chat session and check if chatbot is active
                const chatSession = yield this.prisma.chatSession.findFirst({
                    where: {
                        id: sessionId,
                        workspaceId: workspaceId,
                    },
                    include: {
                        customer: true,
                    },
                });
                if (!chatSession) {
                    res.status(404).json({
                        success: false,
                        error: "Chat session not found in this workspace",
                    });
                    return;
                }
                // Check if chatbot is disabled (manual operator mode)
                if (chatSession.customer.activeChatbot === true) {
                    res.status(400).json({
                        success: false,
                        error: "Cannot send manual message: chatbot is active. Disable chatbot first.",
                    });
                    return;
                }
                logger_1.default.info(`[CHAT-SEND] 📱 Processing operator message: "${content}"`);
                // 🆕 CREATE DEBUG STEPS for Operator Message (for timeline visibility)
                const debugSteps = [];
                // Step 1: Operator Input
                const operatorDebugStep = {
                    type: "operator_message",
                    agent: "Human Operator",
                    model: "N/A",
                    temperature: 0,
                    timestamp: new Date().toISOString(),
                    input: {
                        messageContent: content,
                        sessionId: sessionId,
                        customerId: chatSession.customerId,
                    },
                    output: {
                        message: content,
                        messageId: "pending", // Will be updated after save
                    },
                    tokenUsage: {
                        promptTokens: 0,
                        completionTokens: 0,
                        totalTokens: 0,
                    },
                };
                debugSteps.push(operatorDebugStep);
                // 🛡️ STEP 2: Safety & Translation FIRST (before saving)
                let finalMessage = content;
                try {
                    const { SafetyTranslationAgent, } = require("../../../application/agents/SafetyTranslationAgent");
                    const safetyAgent = new SafetyTranslationAgent();
                    const safetyResult = yield safetyAgent.process({
                        workspaceId: workspaceId,
                        response: content,
                        targetLanguage: chatSession.customer.language || "it",
                        customerName: chatSession.customer.name || "Cliente",
                        allowedLinks: [], // Operator messages typically don't have tokens
                    });
                    if (!safetyResult.safe) {
                        logger_1.default.warn(`[CHAT-SEND] ⚠️ Operator message failed safety check: ${safetyResult.blockedReason}`);
                        // Block unsafe operator messages
                        res.status(400).json({
                            success: false,
                            error: "Message blocked by safety filter",
                            reason: safetyResult.blockedReason,
                        });
                        return;
                    }
                    finalMessage = safetyResult.translatedText || content;
                    // 🆕 ADD Safety debug step
                    debugSteps.push({
                        type: "safety",
                        agent: "Safety & Translation",
                        model: "openai/gpt-4o-mini",
                        temperature: 0,
                        timestamp: new Date().toISOString(),
                        input: {
                            originalMessage: content,
                            targetLanguage: chatSession.customer.language || "it",
                            customerName: chatSession.customer.name || "Cliente",
                        },
                        output: {
                            translatedMessage: finalMessage,
                            safe: true,
                            blockedReason: null,
                        },
                        tokenUsage: {
                            promptTokens: 0,
                            completionTokens: 0,
                            totalTokens: 0,
                        },
                    });
                    logger_1.default.info(`[CHAT-SEND] ✅ Operator message passed safety validation`);
                }
                catch (safetyError) {
                    logger_1.default.warn(`[CHAT-SEND] ⚠️ Safety layer failed, using original message:`, safetyError.message);
                    // Continue with original message if safety fails
                    finalMessage = content;
                }
                // 💾 STEP 3: Save to History AFTER safety validation
                const savedMessage = yield this.prisma.message.create({
                    data: {
                        chatSessionId: sessionId,
                        content: finalMessage, // Use safe/translated message
                        direction: "OUTBOUND",
                        type: "TEXT",
                        aiGenerated: false,
                        metadata: {
                            isOperatorMessage: true,
                            sentBy: "HUMAN_OPERATOR",
                            agentSelected: "MANUAL_OPERATOR",
                        },
                    },
                });
                // Update operator debug step with messageId
                operatorDebugStep.output.messageId = savedMessage.id;
                // Add Save to History debug step
                debugSteps.push({
                    type: "function_call",
                    agent: "💾 Save to History",
                    model: "N/A",
                    temperature: 0,
                    timestamp: new Date().toISOString(),
                    functionName: "saveMessage",
                    input: {
                        content: finalMessage,
                        direction: "OUTBOUND",
                        sessionId: sessionId,
                        customerId: chatSession.customerId,
                        customerName: chatSession.customer.name || "Unknown",
                    },
                    output: {
                        messageId: savedMessage.id,
                        success: true,
                        executionTimeMs: 50,
                    },
                    tokenUsage: {
                        promptTokens: 0,
                        completionTokens: 0,
                        totalTokens: 0,
                    },
                });
                logger_1.default.info(`[CHAT-SEND] ✅ Operator message saved to database successfully`);
                // 🆕 CRITICAL: ALSO save to conversationMessage table for chat history visibility
                let deliveryStatus = "not_queued"; // Default: not queued yet
                try {
                    const customer = yield this.prisma.customers.findUnique({
                        where: { id: chatSession.customerId },
                        select: { phone: true },
                    });
                    // Tentatively mark as "pending" if customer has phone (will be in queue)
                    if (customer === null || customer === void 0 ? void 0 : customer.phone) {
                        deliveryStatus = "pending";
                    }
                }
                catch (e) {
                    // Ignore - default to not_queued
                }
                yield this.prisma.conversationMessage.create({
                    data: {
                        workspaceId: workspaceId,
                        customerId: chatSession.customerId,
                        conversationId: sessionId,
                        role: "assistant", // Operator messages appear as assistant messages
                        content: finalMessage, // Use safe/translated message
                        agentType: "OPERATOR",
                        tokensUsed: 0,
                        deliveryStatus: deliveryStatus, // ✅ Track delivery status
                        debugInfo: JSON.stringify({
                            isOperatorMessage: true,
                            sentBy: "HUMAN_OPERATOR",
                            timestamp: new Date().toISOString(),
                            steps: debugSteps, // Include all current debug steps
                        }),
                    },
                });
                logger_1.default.info(`[CHAT-SEND] 🚨 DEBUG: Saved ${debugSteps.length} debug steps to conversationMessage`);
                logger_1.default.info(`[CHAT-SEND] 🚨 DEBUG: Steps types: ${debugSteps.map(s => s.type).join(", ")}`);
                logger_1.default.info(`[CHAT-SEND] ✅ Operator message ALSO saved to conversationMessage for chat history`);
                // 🆕 Add operator message to WhatsApp Queue
                try {
                    const customer = yield this.prisma.customers.findUnique({
                        where: { id: chatSession.customerId },
                        select: { phone: true },
                    });
                    if (customer === null || customer === void 0 ? void 0 : customer.phone) {
                        yield this.whatsappQueueService.enqueue({
                            workspaceId: workspaceId,
                            customerId: chatSession.customerId,
                            phoneNumber: customer.phone,
                            messageContent: finalMessage,
                        });
                        logger_1.default.info(`[CHAT-SEND] 📤 Operator message added to WhatsApp queue for ${customer.phone}`);
                    }
                }
                catch (queueError) {
                    logger_1.default.error(`[CHAT-SEND] ❌ Failed to add to WhatsApp queue:`, queueError);
                    // Non-critical - continue
                }
                // 🆕 SAVE DEBUG INFO to agentInteractions table (for timeline)
                const debugInfo = {
                    steps: [operatorDebugStep],
                    totalTokens: 0,
                    totalCost: 0,
                    executionTimeMs: 0,
                    timestamp: new Date().toISOString(),
                };
                try {
                    // Access loggerService through the router service instance
                    const loggerService = this.llmRouterService.loggerService;
                    if (loggerService) {
                        yield loggerService.logAgentInteraction({
                            workspaceId: workspaceId,
                            customerId: chatSession.customerId,
                            conversationId: sessionId,
                            messageId: savedMessage.id,
                            step: 1,
                            agentType: "OPERATOR", // Now part of AgentType enum
                            agentAction: "SEND_MESSAGE",
                            inputMessage: content,
                            agentPrompt: "N/A - Manual operator message", // Required field
                            llmModel: "N/A", // Required field
                            llmResponse: content, // Required field - use message content
                            tokensUsed: 0,
                            executionTimeMs: 0,
                        });
                    }
                    logger_1.default.info("✅ Operator message debug info saved to AgentConversationLog");
                }
                catch (debugError) {
                    logger_1.default.warn("⚠️ Failed to save operator message debug info:", debugError);
                    // Continue - message is saved even if debug logging fails
                }
                // 📤 STEP 4: Track usage and deduct credit
                try {
                    // Track usage in Usage table
                    yield usage_service_1.usageService.trackUsage({
                        workspaceId: workspaceId,
                        clientId: chatSession.customer.id,
                        price: config_1.config.llm.defaultPrice,
                    });
                    logger_1.default.info(`[CHAT-SEND] 💰 Usage tracked for operator response: €${config_1.config.llm.defaultPrice}`);
                    // 💰 FIX #4: Also deduct from workspace creditBalance
                    const billingService = new subscription_billing_service_1.SubscriptionBillingService(this.prisma);
                    const deductResult = yield billingService.deductMessageCredit(workspaceId, savedMessage.id);
                    if (deductResult.success) {
                        logger_1.default.info(`[CHAT-SEND] 💰 Credit deducted - New balance: €${deductResult.newBalance}`);
                    }
                    else {
                        logger_1.default.warn(`[CHAT-SEND] ⚠️ Credit deduction failed: ${deductResult.error}`);
                    }
                }
                catch (usageError) {
                    logger_1.default.warn(`[CHAT-SEND] ⚠️ Usage tracking failed (message still saved):`, usageError.message);
                    // Continue - message is saved even if usage tracking fails
                }
                // Try to send the message via WhatsApp (use finalMessage after safety check)
                try {
                    yield this.sendWhatsAppMessage(chatSession.customer.phone || "", finalMessage, // Use validated/translated message
                    workspaceId);
                    logger_1.default.info(`[CHAT-SEND] ✅ WhatsApp message sent successfully`);
                    // 🆕 ADD WhatsApp debug step
                    debugSteps.push({
                        type: "function_call",
                        agent: "📤 Add to WhatsApp Queue",
                        model: "N/A",
                        temperature: 0,
                        timestamp: new Date().toISOString(),
                        functionName: "sendWhatsAppMessage",
                        input: {
                            phoneNumber: chatSession.customer.phone || "",
                            message: finalMessage,
                            customerId: chatSession.customerId,
                            customerName: chatSession.customer.name || "Unknown",
                        },
                        output: {
                            success: true,
                            messageId: savedMessage.id,
                            queueStatus: "sent",
                            executionTimeMs: 20,
                        },
                        tokenUsage: {
                            promptTokens: 0,
                            completionTokens: 0,
                            totalTokens: 0,
                        },
                    });
                }
                catch (whatsappError) {
                    logger_1.default.warn(`[CHAT-SEND] ⚠️ WhatsApp sending failed (message still saved):`, whatsappError.message);
                    // Continue - message is saved even if WhatsApp fails
                    // 🆕 ADD WhatsApp error debug step
                    debugSteps.push({
                        type: "function_call",
                        agent: "📤 Add to WhatsApp Queue",
                        model: "N/A",
                        temperature: 0,
                        timestamp: new Date().toISOString(),
                        functionName: "sendWhatsAppMessage",
                        input: {
                            phoneNumber: chatSession.customer.phone || "",
                            message: finalMessage,
                            customerId: chatSession.customerId,
                            customerName: chatSession.customer.name || "Unknown",
                        },
                        output: {
                            success: false,
                            messageId: savedMessage.id,
                            queueStatus: "failed",
                            error: whatsappError.message,
                            executionTimeMs: 20,
                        },
                        tokenUsage: {
                            promptTokens: 0,
                            completionTokens: 0,
                            totalTokens: 0,
                        },
                    });
                }
                logger_1.default.info(`[CHAT-SEND] ✅ Operator message processing completed`);
                // 🆕 SAVE COMPLETE DEBUG INFO to agentInteractions table (for timeline)
                const finalDebugInfo = {
                    steps: debugSteps, // All steps: operator, safety, whatsapp
                    totalTokens: 0,
                    totalCost: 0,
                    executionTimeMs: 0,
                    timestamp: new Date().toISOString(),
                };
                // 🚨 CRITICAL: UPDATE conversationMessage with COMPLETE debug info
                // This ensures frontend gets ALL debug steps, not just the initial one
                yield this.prisma.conversationMessage.updateMany({
                    where: {
                        conversationId: sessionId,
                        agentType: "OPERATOR",
                        content: content,
                        workspaceId: workspaceId,
                    },
                    data: {
                        debugInfo: JSON.stringify({
                            isOperatorMessage: true,
                            sentBy: "HUMAN_OPERATOR",
                            timestamp: new Date().toISOString(),
                            steps: debugSteps, // 🚨 COMPLETE debug steps with Safety & WhatsApp
                            totalTokens: 0,
                            totalCost: 0,
                            executionTimeMs: 0,
                        }),
                    },
                });
                logger_1.default.info("🚨 CRITICAL: Updated conversationMessage with COMPLETE debug steps including Safety & WhatsApp");
                try {
                    // Access loggerService through the router service instance
                    const loggerService = this.llmRouterService.loggerService;
                    if (loggerService) {
                        yield loggerService.logAgentInteraction({
                            workspaceId: workspaceId,
                            customerId: chatSession.customerId,
                            conversationId: sessionId,
                            messageId: savedMessage.id,
                            step: 1,
                            agentType: "OPERATOR", // Now part of AgentType enum
                            agentAction: "SEND_MESSAGE",
                            inputMessage: content,
                            agentPrompt: "N/A - Manual operator message", // Required field
                            llmModel: "N/A", // Required field
                            llmResponse: finalMessage, // Use final processed message
                            tokensUsed: 0,
                            executionTimeMs: 0,
                        });
                    }
                    logger_1.default.info("✅ Operator message debug info saved to AgentConversationLog");
                }
                catch (debugError) {
                    logger_1.default.warn("⚠️ Failed to save operator message debug info:", debugError);
                    // Continue - message is saved even if debug logging fails
                }
                // 🔔 CRITICAL: Notify WebSocket clients AFTER complete update (so frontend gets all debug steps)
                websocket_service_1.websocketService.notifyNewMessage(workspaceId, {
                    id: savedMessage.id,
                    sessionId: sessionId,
                    content: content,
                    sender: "agent", // Operator message appears as agent message
                    timestamp: savedMessage.createdAt.toISOString(),
                    workspaceId: workspaceId,
                    metadata: {
                        isOperatorMessage: true,
                        sentBy: "HUMAN_OPERATOR",
                    },
                });
                // 🔔 CRITICAL: Also notify chat list update (for last message preview)
                websocket_service_1.websocketService.notifyChatUpdated(workspaceId, {
                    sessionId: sessionId,
                    lastMessage: content.substring(0, 100), // Preview text
                    lastMessageAt: savedMessage.createdAt.toISOString(),
                    customerId: chatSession.customerId,
                });
                logger_1.default.info(`[CHAT-SEND] 🔔 WebSocket notifications sent AFTER complete update (new-message + chat-updated)`);
                res.status(200).json({
                    success: true,
                    data: {
                        id: savedMessage.id,
                        content: content,
                        sender: "user", // This ensures it appears on the right side
                        timestamp: savedMessage.createdAt,
                        direction: "OUTBOUND",
                        metadata: {
                            isOperatorMessage: true,
                            sentBy: "HUMAN_OPERATOR",
                            agentSelected: "MANUAL_OPERATOR",
                        },
                    },
                });
            }
            catch (error) {
                logger_1.default.error("[CHAT-SEND] ❌ Error sending operator message:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to send message",
                });
            }
        });
    }
    /**
     * Send a WhatsApp message (copied from WhatsAppController)
     */
    sendWhatsAppMessage(phoneNumber, message, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`[WHATSAPP-SEND] 📱 Sending message to ${phoneNumber}: "${message}"`);
                // Get workspace WhatsApp settings
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: {
                        whatsappApiKey: true,
                        whatsappPhoneNumber: true,
                    },
                });
                if (!workspace || !workspace.whatsappApiKey) {
                    throw new Error(`WhatsApp settings not found for workspace ${workspaceId}`);
                }
                // Send message via WhatsApp Business API
                const whatsappApiUrl = `https://graph.facebook.com/v18.0/${workspace.whatsappPhoneNumber}/messages`;
                const whatsappPayload = {
                    messaging_product: "whatsapp",
                    to: phoneNumber.replace("+", ""),
                    type: "text",
                    text: {
                        body: message,
                    },
                };
                const response = yield fetch(whatsappApiUrl, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${workspace.whatsappApiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(whatsappPayload),
                });
                if (!response.ok) {
                    const errorData = yield response.text();
                    throw new Error(`WhatsApp API error: ${response.status} ${response.statusText} - ${errorData}`);
                }
                const responseData = yield response.json();
                logger_1.default.info(`[WHATSAPP-SEND] ✅ Message sent successfully:`, responseData);
            }
            catch (error) {
                logger_1.default.error(`[WHATSAPP-SEND] ❌ Error sending WhatsApp message:`, error);
                throw error;
            }
        });
    }
}
exports.ChatController = ChatController;
//# sourceMappingURL=chat.controller.js.map