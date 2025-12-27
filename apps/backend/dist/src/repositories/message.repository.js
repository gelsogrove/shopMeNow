"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.MessageRepository = void 0;
const database_1 = require("@echatbot/database");
const dotenv = __importStar(require("dotenv"));
const openai_1 = __importDefault(require("openai"));
const websocket_service_1 = require("../services/websocket.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Apply Unicode strikethrough to text
 * Example: "€6.80" → "€̶6̶.̶8̶0̶"
 * Uses combining long stroke overlay (U+0336)
 */
function applyStrikethrough(text) {
    return text
        .split("")
        .map((char) => char + "\u0336")
        .join("");
}
// Load environment variables
dotenv.config();
// Log API key status (safely)
const apiKey = process.env.OPENAI_API_KEY || "";
logger_1.default.info(`OpenAI API key status: ${apiKey ? "Present (length: " + apiKey.length + ")" : "Missing"}`);
if (apiKey) {
    logger_1.default.info(`API key prefix: ${apiKey.substring(0, 10)}...`);
}
// OpenAI client instance
const openai = new openai_1.default({
    apiKey: apiKey, // No default 'your-api-key-here' value, just use the actual key
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "https://laltroitalia.shop",
        "X-Title": "L'Altra Italia Shop",
    },
});
// Helper function to check if OpenAI is properly configured
function isOpenAIConfigured() {
    // In test environment, always return true
    if (process.env.NODE_ENV === "test") {
        return true;
    }
    const apiKey = process.env.OPENAI_API_KEY;
    // Log for debugging
    logger_1.default.info(`API key check - key present: ${!!apiKey}, key length: ${apiKey ? apiKey.length : 0}`);
    if (apiKey) {
        logger_1.default.info(`API key prefix: ${apiKey.substring(0, 10)}...`);
    }
    return apiKey && apiKey.length > 10 && apiKey !== "your-api-key-here";
}
class MessageRepository {
    constructor() {
        this.prisma = database_1.prisma;
    }
    /**
     * Create a new chat session for a customer
     *
     * @param workspaceId The workspace ID
     * @param customerId The customer ID
     * @returns The created chat session
     */
    createChatSession(workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const session = yield this.prisma.chatSession.create({
                    data: {
                        workspaceId,
                        customerId,
                        status: "active",
                    },
                });
                logger_1.default.info(`Created new chat session: ${session.id}`);
                return session;
            }
            catch (error) {
                logger_1.default.error("Error creating chat session:", error);
                throw new Error("Failed to create chat session");
            }
        });
    }
    /**
     * Save a single message to the database
     *
     * @param chatSessionId The chat session ID
     * @param content The message content
     * @param direction The message direction (INBOUND or OUTBOUND)
     * @param type The message type
     * @param aiGenerated Whether the message was AI generated
     * @param metadata Additional metadata
     * @returns The created message
     */
    saveOriginalMessage(chatSessionId_1, content_1, direction_1) {
        return __awaiter(this, arguments, void 0, function* (chatSessionId, content, direction, type = database_1.MessageType.TEXT, aiGenerated = false, metadata = {}) {
            try {
                const message = yield this.prisma.message.create({
                    data: {
                        chatSessionId,
                        content,
                        direction,
                        type,
                        aiGenerated,
                        metadata,
                    },
                });
                logger_1.default.info(`Saved message: ${message.id}`);
                return message;
            }
            catch (error) {
                logger_1.default.error("Error saving message:", error);
                throw new Error("Failed to save message");
            }
        });
    }
    /**
     * Get chat session messages
     *
     * @param chatSessionId The chat session ID
     * @param workspaceId Optional workspace ID to filter
     * @param page Page number for pagination (1-based, default: 1)
     * @param limit Number of messages per page (default: 40)
     * @returns Paginated messages with metadata (hasMore, total, page, limit)
     */
    getChatSessionMessages(chatSessionId_1, workspaceId_1) {
        return __awaiter(this, arguments, void 0, function* (chatSessionId, workspaceId, page = 1, limit = 50) {
            var _a, _b;
            try {
                // 🔐 SECURITY: workspaceId is MANDATORY for proper isolation
                if (!workspaceId) {
                    logger_1.default.error("getChatSessionMessages: workspaceId is required");
                    throw new Error("workspaceId is mandatory for retrieving chat messages");
                }
                // First get the chat session to verify workspace
                const session = yield this.prisma.chatSession.findFirst({
                    where: {
                        id: chatSessionId,
                        workspaceId: workspaceId,
                    },
                    select: {
                        id: true,
                        customerId: true,
                        workspaceId: true, // ✅ Add workspaceId to select
                        customer: {
                            select: {
                                isBlacklisted: true,
                                phone: true,
                            },
                        },
                    },
                });
                if (!session) {
                    logger_1.default.warn(`getChatSessionMessages: Chat session ${chatSessionId} not found${workspaceId ? ` in workspace ${workspaceId}` : ""}`);
                    return {
                        data: [],
                        hasMore: false,
                        total: 0,
                        page,
                        limit,
                    };
                }
                // Log blacklist status but still return messages (blacklist only affects new message sending)
                if ((_a = session.customer) === null || _a === void 0 ? void 0 : _a.isBlacklisted) {
                    logger_1.default.info(`getChatSessionMessages: Customer ${session.customer.phone} (${session.customerId}) is blacklisted - showing existing messages but new messages will be blocked`);
                }
                // Check workspace blocklist if workspaceId is provided (for logging)
                if (workspaceId && ((_b = session.customer) === null || _b === void 0 ? void 0 : _b.phone)) {
                    const isBlacklisted = yield this.isCustomerBlacklisted(session.customer.phone, workspaceId);
                    if (isBlacklisted) {
                        logger_1.default.info(`getChatSessionMessages: Customer ${session.customer.phone} is in workspace blocklist - showing existing messages but new messages will be blocked`);
                    }
                }
                // ✅ FIXED: Query conversationMessage table (NEW) instead of message table (OLD)
                // This fixes the issue where messages saved by LLMRouter were not visible in frontend
                // 🚨 CRITICAL: Exclude "function" role messages - they are internal LLM context only!
                // 📋 PAGINATION: Calculate skip and get total count
                const skip = (page - 1) * limit;
                const total = yield this.prisma.conversationMessage.count({
                    where: {
                        conversationId: chatSessionId,
                        role: {
                            not: "function",
                        },
                    },
                });
                const messages = yield this.prisma.conversationMessage.findMany({
                    where: {
                        conversationId: chatSessionId,
                        role: {
                            not: "function", // ✅ Filter out function calls - users should never see these!
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                    skip,
                    take: limit,
                    select: {
                        id: true,
                        createdAt: true,
                        workspaceId: true,
                        customerId: true,
                        conversationId: true,
                        role: true,
                        content: true,
                        agentType: true,
                        tokensUsed: true,
                        functionName: true,
                        functionArguments: true,
                        debugInfo: true, // ✅ Explicitly select debugInfo
                    },
                });
                // Get billing records for this customer to attach to messages
                const billingRecords = yield this.prisma.billing.findMany({
                    where: {
                        customerId: session.customerId,
                        workspaceId: workspaceId,
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                });
                // 💰 NEW: Use the saved progressive totals from database
                const billingMap = new Map();
                billingRecords.forEach((record) => {
                    billingMap.set(record.id, {
                        currentTotal: Number(record.previousTotal),
                        messageCharge: record.type === "MESSAGE" ? Number(record.amount) : 0,
                        newTotal: Number(record.newTotal),
                        userQuery: record.userQuery,
                    });
                });
                // Get agent interactions (debug steps) for this conversation
                const agentInteractions = yield this.prisma.agentConversationLog.findMany({
                    where: {
                        conversationId: chatSessionId,
                        workspaceId: workspaceId || session.workspaceId,
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                });
                // Create a map of messageId -> agentInteractions for operator messages
                const operatorDebugMap = new Map();
                agentInteractions.forEach((interaction) => {
                    if (interaction.messageId && interaction.agentType === 'OPERATOR') {
                        operatorDebugMap.set(interaction.messageId, interaction);
                    }
                });
                // Parse debugInfo and attach billing data
                // ✅ Map conversationMessage format to frontend expected format
                // 🔄 Reverse messages so newest is at bottom (for chat UI)
                const reversedMessages = messages.reverse();
                const parsedMessages = reversedMessages.map((message) => {
                    // Convert role (user/assistant/function) to direction (INBOUND/OUTBOUND)
                    const direction = message.role === "user" ? "INBOUND" : "OUTBOUND";
                    let parsed = Object.assign(Object.assign({}, message), { direction, type: "TEXT", 
                        // ✅ CRITICAL: Add default metadata for bot messages to show as GREEN in frontend
                        metadata: {
                            agentSelected: direction === "OUTBOUND" ? "CHATBOT" : "CUSTOMER",
                            sentBy: direction === "OUTBOUND" ? "AI" : "CUSTOMER",
                            isOperatorMessage: false,
                            isOperatorControl: false,
                        } });
                    // 🆕 OPERATOR DEBUG: Check if this message has operator debug info
                    const operatorDebug = operatorDebugMap.get(message.id);
                    if (operatorDebug) {
                        // Recreate debug info from AgentConversationLog record
                        const operatorDebugInfo = {
                            steps: [{
                                    type: "operator_message",
                                    agent: "Human Operator",
                                    model: "N/A",
                                    temperature: 0,
                                    timestamp: operatorDebug.createdAt.toISOString(),
                                    input: {
                                        messageContent: operatorDebug.inputMessage,
                                        sessionId: chatSessionId,
                                        customerId: operatorDebug.customerId,
                                    },
                                    output: {
                                        message: operatorDebug.llmResponse || operatorDebug.inputMessage,
                                        messageId: message.id,
                                        safetyProcessed: true,
                                        whatsappSent: true,
                                        finalMessage: operatorDebug.llmResponse || operatorDebug.inputMessage,
                                        whatsappError: "",
                                    },
                                    tokenUsage: {
                                        promptTokens: 0,
                                        completionTokens: 0,
                                        totalTokens: operatorDebug.tokensUsed || 0,
                                    },
                                }],
                            totalTokens: operatorDebug.tokensUsed || 0,
                            totalCost: 0,
                            executionTimeMs: operatorDebug.executionTimeMs || 0,
                            timestamp: operatorDebug.createdAt.toISOString(),
                        };
                        // Update metadata for operator messages
                        parsed.metadata = Object.assign(Object.assign({}, parsed.metadata), { agentSelected: "MANUAL_OPERATOR", sentBy: "HUMAN_OPERATOR", isOperatorMessage: true, debugInfo: operatorDebugInfo });
                        logger_1.default.info(`Found operator debug info for message ${message.id}`);
                    }
                    // 🆕 DIRECT CHECK: If agentType is OPERATOR, mark as operator message
                    else if (message.agentType === "OPERATOR") {
                        // Parse existing debugInfo if available
                        let existingDebugInfo = null;
                        if (message.debugInfo) {
                            try {
                                existingDebugInfo = typeof message.debugInfo === "string"
                                    ? JSON.parse(message.debugInfo)
                                    : message.debugInfo;
                            }
                            catch (parseError) {
                                logger_1.default.warn(`Failed to parse debugInfo for operator message ${message.id}:`, parseError);
                            }
                        }
                        // Update metadata for operator messages
                        parsed.metadata = Object.assign(Object.assign({}, parsed.metadata), { agentSelected: "MANUAL_OPERATOR", sentBy: "HUMAN_OPERATOR", isOperatorMessage: true, debugInfo: existingDebugInfo });
                        logger_1.default.info(`Found OPERATOR agentType for message ${message.id}`);
                    }
                    // Parse regular debugInfo if exists (it's stored as JSON string in DB)
                    else if (message.debugInfo) {
                        try {
                            const debugInfoParsed = typeof message.debugInfo === "string"
                                ? JSON.parse(message.debugInfo)
                                : message.debugInfo;
                            // Merge with existing metadata
                            parsed.metadata = Object.assign(Object.assign({}, parsed.metadata), { debugInfo: debugInfoParsed });
                        }
                        catch (parseError) {
                            logger_1.default.warn(`Failed to parse debugInfo for message ${message.id}:`, parseError);
                        }
                    }
                    // Find matching billing record (within 5 seconds of message)
                    // 💰 IMPORTANT: Only match billing to the correct message direction:
                    // - MESSAGE (€0.15) → INBOUND (customer message)
                    // - PUSH_CAMPAIGN (€1.00) → OUTBOUND (bot message with push)
                    const matchingBilling = billingRecords.find((billing) => {
                        const timeDiff = Math.abs(new Date(billing.createdAt).getTime() -
                            new Date(message.createdAt).getTime());
                        // Check time proximity (5 seconds tolerance)
                        if (timeDiff >= 5000)
                            return false;
                        // Match billing type to message direction
                        const isInbound = direction === "INBOUND";
                        const isOutbound = direction === "OUTBOUND";
                        // MESSAGE billing should only attach to INBOUND messages
                        if (billing.type === "MESSAGE" && !isInbound)
                            return false;
                        // PUSH_CAMPAIGN should only attach to OUTBOUND messages
                        if (billing.type === "PUSH_CAMPAIGN" && !isOutbound)
                            return false;
                        return true;
                    });
                    // Attach billing data if found
                    if (matchingBilling && billingMap.has(matchingBilling.id)) {
                        return Object.assign(Object.assign({}, parsed), { billing: billingMap.get(matchingBilling.id), messageCost: Number(matchingBilling.amount), billingType: matchingBilling.type });
                    }
                    return parsed;
                });
                // 📋 Return paginated response with metadata
                const hasMore = skip + limit < total;
                return {
                    data: parsedMessages,
                    hasMore,
                    total,
                    page,
                    limit,
                };
            }
            catch (error) {
                logger_1.default.error("Error getting chat session messages:", error);
                throw new Error("Failed to get chat session messages");
            }
        });
    }
    /**
     * Find or create a customer by phone number
     *
     * @param workspaceId The workspace ID
     * @param phoneNumber The customer's phone number
     * @returns The customer
     */
    findCustomerByPhone(phoneNumber, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 🔒 SECURITY: Filter by workspace if provided (prevents cross-workspace customer mix)
                const where = {
                    phone: phoneNumber,
                };
                // Add workspace filter if provided
                if (workspaceId) {
                    where.workspaceId = workspaceId;
                }
                const customer = yield this.prisma.customers.findFirst({
                    where,
                    include: {
                        sales: true, // Include agent data
                    },
                });
                return customer;
            }
            catch (error) {
                logger_1.default.error("Error finding customer by phone:", error);
                throw new Error("Failed to find customer by phone");
            }
        });
    }
    /**
     * Find an active chat session or create a new one
     *
     * 🔒 CONCURRENCY SAFE: Uses Prisma transaction to prevent race conditions
     * when multiple messages arrive simultaneously for the same customer.
     *
     * Pattern: Transaction-based session creation with unique constraint retry
     * - Atomic findFirst + create operation within transaction
     * - Handles P2002 (unique constraint violation) with retry logic
     * - Ensures only ONE active session per customer
     *
     * @param workspaceId The workspace ID
     * @param customerId The customer ID
     * @returns The chat session
     */
    findOrCreateChatSession(workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let isNewSession = false;
                // 🔒 TRANSACTION: Atomic operation to prevent duplicate session creation
                const session = yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    // Try to find existing active session
                    let session = yield tx.chatSession.findFirst({
                        where: {
                            customerId: customerId,
                            status: "active",
                        },
                        orderBy: {
                            startedAt: "desc",
                        },
                    });
                    if (!session) {
                        try {
                            // Atomic create with unique constraint on (customerId, status="active")
                            session = yield tx.chatSession.create({
                                data: {
                                    workspaceId: workspaceId,
                                    customerId: customerId,
                                    status: "active",
                                },
                            });
                            isNewSession = true;
                            logger_1.default.info(`✅ Created new chat session: ${session.id} for customer ${customerId}`);
                        }
                        catch (error) {
                            // Handle race condition: another request created session simultaneously
                            if (error.code === "P2002") {
                                // Unique constraint violation - retry findFirst
                                logger_1.default.warn(`⚠️ Race condition detected for customer ${customerId} - retrying findFirst`);
                                session = yield tx.chatSession.findFirst({
                                    where: {
                                        customerId: customerId,
                                        status: "active",
                                    },
                                    orderBy: {
                                        startedAt: "desc",
                                    },
                                });
                                if (!session) {
                                    // Should never happen, but throw if still not found
                                    throw new Error(`Failed to find session after P2002 for customer ${customerId}`);
                                }
                                logger_1.default.info(`✅ Retrieved existing session after race: ${session.id}`);
                            }
                            else {
                                // Other error - rethrow
                                throw error;
                            }
                        }
                    }
                    else {
                        logger_1.default.info(`✅ Found existing active session: ${session.id} for customer ${customerId}`);
                    }
                    return session;
                }));
                // 🔔 CRITICAL: Emit WebSocket event AFTER transaction commit for new sessions
                if (isNewSession) {
                    // Fetch customer details for event payload
                    const customer = yield this.prisma.customers.findUnique({
                        where: { id: customerId },
                        select: { name: true, phone: true, language: true },
                    });
                    websocket_service_1.websocketService.notifyNewCustomer(workspaceId, {
                        customerId: customerId,
                        sessionId: session.id,
                        customerName: (customer === null || customer === void 0 ? void 0 : customer.name) || "Unknown",
                        customerPhone: (customer === null || customer === void 0 ? void 0 : customer.phone) || "",
                        language: (customer === null || customer === void 0 ? void 0 : customer.language) || undefined,
                        timestamp: new Date().toISOString(),
                    });
                    logger_1.default.info(`[NEW-SESSION] 🔔 WebSocket new-customer event sent for session ${session.id}`);
                }
                return session;
            }
            catch (error) {
                logger_1.default.error(`❌ Error in findOrCreateChatSession for customer ${customerId}:`, error);
                throw new Error("Failed to find or create chat session");
            }
        });
    }
    /**
     * Check if customer is in the blacklist
     *
     * @param phoneNumber The customer phone number to check
     * @param workspaceId The workspace ID to check blocklist
     * @returns True if customer is blacklisted, false otherwise
     */
    isCustomerBlacklisted(phoneNumber, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 🔐 SECURITY: workspaceId is MANDATORY for blacklist checks
                if (!workspaceId) {
                    logger_1.default.error("isCustomerBlacklisted: workspaceId is required");
                    throw new Error("workspaceId is mandatory for blacklist checks");
                }
                logger_1.default.info(`[BLACKLIST] Checking blacklist status for ${phoneNumber} in workspace ${workspaceId}`);
                // Check if customer has isBlacklisted flag
                const customer = yield this.prisma.customers.findFirst({
                    where: {
                        phone: phoneNumber,
                        workspaceId: workspaceId, // ← MANDATORY workspace isolation
                    },
                    select: {
                        isBlacklisted: true,
                        workspaceId: true,
                    },
                });
                // If customer is explicitly blacklisted, return true
                if ((customer === null || customer === void 0 ? void 0 : customer.isBlacklisted) === true) {
                    return true;
                }
                // Blocklist check is now done via customers.isBlacklisted field
                // (workspace-level blocklist removed during database cleanup)
                return false;
            }
            catch (error) {
                logger_1.default.error("Error checking customer blacklist status:", error);
                return false;
            }
        });
    }
    /**
     * Save a conversation message pair (user question and bot response)
     *
     * @param data Object containing message details
     * @returns The created message
     */
    saveMessage(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate required fields
                if (!data.phoneNumber) {
                    logger_1.default.error("saveMessage: Phone number is required");
                    throw new Error("Phone number is required");
                }
                if (!data.message) {
                    logger_1.default.error("saveMessage: Message content is required");
                    throw new Error("Message content is required");
                }
                // Check if customer is blacklisted before saving any message
                const existingCustomer = yield this.prisma.customers.findFirst({
                    where: {
                        phone: data.phoneNumber,
                        workspaceId: data.workspaceId,
                    },
                    select: {
                        id: true,
                        isBlacklisted: true,
                        name: true,
                    },
                });
                if (existingCustomer === null || existingCustomer === void 0 ? void 0 : existingCustomer.isBlacklisted) {
                    logger_1.default.warn(`saveMessage: Customer ${existingCustomer.name} (${data.phoneNumber}) is blacklisted - message blocked`);
                    throw new Error("Customer is blacklisted - messages are not allowed");
                }
                // Verify workspace ID
                // 🔐 SECURITY: workspaceId is MANDATORY
                if (!data.workspaceId) {
                    logger_1.default.error("saveMessage: workspaceId is required but not provided");
                    throw new Error("workspaceId is mandatory for message saving");
                }
                const workspaceId = data.workspaceId;
                // Validate that workspace exists and is active
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: { id: true, isActive: true },
                });
                if (!workspace) {
                    logger_1.default.error(`saveMessage: Workspace ${workspaceId} not found`);
                    throw new Error(`Workspace ${workspaceId} does not exist`);
                }
                if (!workspace.isActive) {
                    logger_1.default.warn(`saveMessage: Workspace ${workspaceId} is inactive`);
                    throw new Error(`Workspace ${workspaceId} is not active`);
                }
                // Find or create customer
                let customer = yield this.findCustomerByPhone(data.phoneNumber);
                // If no customer exists, create a temporary "Unknown User-XXX" for new users
                // This allows us to save messages in chat history even before registration
                if (!customer) {
                    logger_1.default.info(`saveMessage: No customer found for phone ${data.phoneNumber} - creating temporary customer for new user`);
                    // Generate random 3-digit number for temporary user
                    const randomNumber = Math.floor(Math.random() * 900) + 100; // 100-999
                    // Detect language from message content
                    let detectedLanguage = "IT"; // Default to Italian
                    if (data.message) {
                        const lowerMessage = data.message.toLowerCase();
                        // Italian detection
                        const italianWords = [
                            "ciao",
                            "buongiorno",
                            "buonasera",
                            "buonanotte",
                            "voglio",
                            "ho bisogno",
                            "vorrei",
                            "per favore",
                            "grazie",
                            "prego",
                            "sì",
                            "no",
                            "il",
                            "la",
                            "i",
                            "le",
                            "e",
                            "o",
                            "ma",
                            "con",
                            "per",
                            "da",
                            "in",
                            "su",
                            "a",
                            "di",
                        ];
                        // English detection
                        const englishWords = [
                            "hello",
                            "hi",
                            "good morning",
                            "good afternoon",
                            "good evening",
                            "i want",
                            "i need",
                            "i would like",
                            "please",
                            "thank you",
                            "thanks",
                            "yes",
                            "no",
                            "the",
                            "and",
                            "or",
                            "but",
                            "with",
                            "for",
                            "to",
                            "from",
                            "in",
                            "on",
                            "at",
                            "by",
                        ];
                        // Spanish detection
                        const spanishWords = [
                            "hola",
                            "buenos días",
                            "buenas tardes",
                            "buenas noches",
                            "quiero",
                            "necesito",
                            "me gustaría",
                            "por favor",
                            "gracias",
                            "sí",
                            "no",
                            "el",
                            "la",
                            "los",
                            "las",
                            "y",
                            "o",
                            "pero",
                            "con",
                            "para",
                            "de",
                            "en",
                            "por",
                        ];
                        // Portuguese detection
                        const portugueseWords = [
                            "olá",
                            "bom dia",
                            "boa tarde",
                            "boa noite",
                            "quero",
                            "preciso",
                            "gostaria",
                            "por favor",
                            "obrigado",
                            "obrigada",
                            "sim",
                            "não",
                            "o",
                            "a",
                            "os",
                            "as",
                            "e",
                            "ou",
                            "mas",
                            "com",
                            "para",
                            "de",
                            "em",
                            "por",
                        ];
                        // Count matches for each language
                        const italianMatches = italianWords.filter((word) => lowerMessage.includes(word)).length;
                        const englishMatches = englishWords.filter((word) => lowerMessage.includes(word)).length;
                        const spanishMatches = spanishWords.filter((word) => lowerMessage.includes(word)).length;
                        const portugueseMatches = portugueseWords.filter((word) => lowerMessage.includes(word)).length;
                        // Determine language based on highest match count
                        if (italianMatches > englishMatches &&
                            italianMatches > spanishMatches &&
                            italianMatches > portugueseMatches) {
                            detectedLanguage = "IT";
                        }
                        else if (englishMatches > italianMatches &&
                            englishMatches > spanishMatches &&
                            englishMatches > portugueseMatches) {
                            detectedLanguage = "ENG";
                        }
                        else if (spanishMatches > italianMatches &&
                            spanishMatches > englishMatches &&
                            spanishMatches > portugueseMatches) {
                            detectedLanguage = "ESP";
                        }
                        else if (portugueseMatches > italianMatches &&
                            portugueseMatches > englishMatches &&
                            portugueseMatches > spanishMatches) {
                            detectedLanguage = "PRT";
                        }
                    }
                    // Create a temporary customer for new users
                    try {
                        const newCustomer = yield this.prisma.customers.create({
                            data: {
                                name: `Unknown User-${randomNumber}`,
                                email: `${data.phoneNumber.replace(/[^0-9]/g, "")}@temp.com`,
                                phone: data.phoneNumber,
                                workspaceId: workspaceId,
                                isActive: false, // Mark as inactive until they register
                                isBlacklisted: true, // 🚨 NEW USERS ARE BLOCKED until admin approval!
                                activeChatbot: true, // Enable chatbot to handle registration requests
                                language: detectedLanguage,
                                currency: "EUR",
                            },
                        });
                        // Reload customer with sales relation
                        customer = yield this.prisma.customers.findUnique({
                            where: { id: newCustomer.id },
                            include: { sales: true },
                        });
                        logger_1.default.info(`saveMessage: Created temporary customer ${newCustomer.id} (Unknown User-${randomNumber}) for new user ${data.phoneNumber} with detected language: ${detectedLanguage}`);
                    }
                    catch (createError) {
                        // P2002: Unique constraint violation (phone already exists)
                        if (createError.code === "P2002") {
                            logger_1.default.warn(`saveMessage: Race condition - customer with phone ${data.phoneNumber} already created. Fetching existing customer.`);
                            // Fetch the existing customer (race condition: another webhook created it)
                            customer = yield this.prisma.customers.findFirst({
                                where: {
                                    phone: data.phoneNumber,
                                    workspaceId: workspaceId,
                                },
                                include: {
                                    sales: true, // Include agent data
                                },
                            });
                            if (!customer) {
                                logger_1.default.error(`saveMessage: CRITICAL - Customer not found after P2002 error for phone ${data.phoneNumber}`);
                                throw new Error("Customer not found after unique constraint violation");
                            }
                            // 🔐 SECURITY: Validate customer belongs to expected workspace
                            if (customer.workspaceId !== workspaceId) {
                                logger_1.default.error(`saveMessage: CRITICAL SECURITY BREACH - Customer ${customer.id} workspaceId ${customer.workspaceId} does NOT match expected ${workspaceId}`);
                                throw new Error("Customer workspace mismatch - potential data leakage");
                            }
                            logger_1.default.info(`saveMessage: ✅ Race condition handled - using existing customer ${customer.id}`);
                        }
                        else {
                            // Different error, rethrow
                            logger_1.default.error(`saveMessage: Error creating customer for phone ${data.phoneNumber}:`, createError);
                            throw createError;
                        }
                    }
                }
                // Update customer's lastContact field
                yield this.prisma.customers.update({
                    where: { id: customer.id },
                    data: { updatedAt: new Date() },
                });
                // 🔐 SECURITY: Final validation - customer must belong to expected workspace
                if (customer.workspaceId !== workspaceId) {
                    logger_1.default.error(`saveMessage: CRITICAL SECURITY BREACH - Customer ${customer.id} workspaceId ${customer.workspaceId} does NOT match expected ${workspaceId}`);
                    throw new Error("Customer workspace mismatch - potential data leakage");
                }
                // 🔒 USE TRANSACTIONAL findOrCreateChatSession to prevent race conditions
                const session = yield this.findOrCreateChatSession(workspaceId, customer.id);
                // Use INBOUND as default direction
                const direction = data.direction === "OUTBOUND"
                    ? database_1.MessageDirection.OUTBOUND
                    : database_1.MessageDirection.INBOUND;
                // Save both messages in the conversation
                const userMessage = direction === database_1.MessageDirection.INBOUND ? data.message : data.response;
                const botMessage = direction === database_1.MessageDirection.INBOUND ? data.response : data.message;
                // Prepare metadata for bot response with agent info
                const botMetadata = data.agentSelected
                    ? { agentName: data.agentSelected }
                    : {};
                // Save user message (ensure it's not empty)
                if (userMessage && userMessage.trim()) {
                    // 🚨 ANTI-DUPLICATE CHECK: Verify if similar message exists in same hour:minute
                    const now = new Date();
                    const currentHourMinute = `${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`;
                    // Search for messages in the last 2 minutes to catch duplicates across minute boundaries
                    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
                    const existingMessage = yield this.prisma.message.findFirst({
                        where: {
                            chatSessionId: session.id,
                            content: userMessage,
                            direction: database_1.MessageDirection.INBOUND,
                            createdAt: {
                                gte: twoMinutesAgo,
                            },
                        },
                        orderBy: {
                            createdAt: "desc",
                        },
                    });
                    if (existingMessage) {
                        const existingHourMinute = `${existingMessage.createdAt.getHours()}:${existingMessage.createdAt.getMinutes().toString().padStart(2, "0")}`;
                        logger_1.default.warn(`🚨 DUPLICATE DETECTED: Message "${userMessage.substring(0, 50)}..." already exists from ${existingHourMinute} (${existingMessage.createdAt.toISOString()}). Current time: ${currentHourMinute}. Skipping insert.`);
                    }
                    else {
                        const userMessageObj = yield this.prisma.message.create({
                            data: {
                                chatSessionId: session.id,
                                content: userMessage,
                                direction: database_1.MessageDirection.INBOUND,
                                type: database_1.MessageType.TEXT,
                                aiGenerated: false,
                            },
                        });
                        logger_1.default.info(`✅ SAVED USER MESSAGE: "${userMessage.substring(0, 50)}..." for session ${session.id}`);
                        // 🚀 WEBSOCKET: Notify real-time about new customer message
                        try {
                            const { websocketService } = yield Promise.resolve().then(() => __importStar(require("../services/websocket.service")));
                            websocketService.notifyNewMessage(workspaceId, {
                                id: userMessageObj.id,
                                sessionId: session.id,
                                content: userMessage,
                                sender: "customer",
                                timestamp: userMessageObj.createdAt.toISOString(),
                                workspaceId,
                            });
                        }
                        catch (wsError) {
                            logger_1.default.warn("[WebSocket] Failed to notify new customer message:", wsError.message);
                        }
                    }
                }
                // Save bot response (ensure it's not empty)
                let botResponse = null;
                // Fix: Ensure botMessage is a string before calling trim()
                const botMessageStr = typeof botMessage === "string" ? botMessage : String(botMessage || "");
                if (botMessageStr && botMessageStr.trim()) {
                    // 🚨 ANTI-DUPLICATE CHECK: Verify if similar bot response exists in same hour:minute
                    const now = new Date();
                    const currentHourMinute = `${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`;
                    // Search for messages in the last 2 minutes to catch duplicates across minute boundaries
                    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
                    const existingBotMessage = yield this.prisma.message.findFirst({
                        where: {
                            chatSessionId: session.id,
                            content: botMessageStr,
                            direction: database_1.MessageDirection.OUTBOUND,
                            createdAt: {
                                gte: twoMinutesAgo,
                            },
                        },
                        orderBy: {
                            createdAt: "desc",
                        },
                    });
                    if (existingBotMessage) {
                        const existingHourMinute = `${existingBotMessage.createdAt.getHours()}:${existingBotMessage.createdAt.getMinutes().toString().padStart(2, "0")}`;
                        logger_1.default.warn(`🚨 DUPLICATE BOT RESPONSE DETECTED: Response "${botMessageStr.substring(0, 50)}..." already exists from ${existingHourMinute} (${existingBotMessage.createdAt.toISOString()}). Current time: ${currentHourMinute}. Skipping insert.`);
                        botResponse = existingBotMessage; // Return existing response instead of creating new one
                    }
                    else {
                        // 💰 BILLING: Moved to WhatsApp Queue Service - tracks ONLY when message is successfully sent
                        // See whatsapp-queue.service.ts → processPendingMessages() → after successful WhatsApp delivery
                        botResponse = yield this.prisma.message.create({
                            data: {
                                chatSessionId: session.id,
                                content: botMessageStr,
                                direction: database_1.MessageDirection.OUTBOUND,
                                type: database_1.MessageType.TEXT,
                                aiGenerated: true,
                                metadata: botMetadata,
                                // 🔧 Debug fields
                                translatedQuery: data.translatedQuery,
                                processedPrompt: data.processedPrompt,
                                functionCallsDebug: data.functionCallsDebug
                                    ? JSON.stringify(data.functionCallsDebug)
                                    : null,
                                processingSource: data.processingSource,
                                debugInfo: data.debugInfo, // 🔧 NEW: Debug info (already JSON string)
                            },
                        });
                        logger_1.default.info(`✅ SAVED BOT RESPONSE: "${botMessageStr.substring(0, 50)}..." for session ${session.id}`);
                        // 🚀 WEBSOCKET: Notify real-time about new message
                        try {
                            const { websocketService } = yield Promise.resolve().then(() => __importStar(require("../services/websocket.service")));
                            websocketService.notifyNewMessage(workspaceId, {
                                id: botResponse.id,
                                sessionId: session.id,
                                content: botMessageStr,
                                sender: "agent",
                                timestamp: botResponse.createdAt.toISOString(),
                                workspaceId,
                            });
                        }
                        catch (wsError) {
                            logger_1.default.warn("[WebSocket] Failed to notify new message:", wsError.message);
                        }
                    }
                }
                // Also update the chat session's lastMessageAt
                yield this.prisma.chatSession.update({
                    where: { id: session.id },
                    data: { updatedAt: new Date() },
                });
                logger_1.default.info(`saveMessage: Saved conversation pair for phone number: ${data.phoneNumber}`);
                return botResponse;
            }
            catch (error) {
                logger_1.default.error("Error saving message pair:", error);
                throw new Error(`Failed to save message pair: ${error.message}`);
            }
        });
    }
    /**
     * Recupera le FAQ attive dal database.
     * @param workspaceId L'ID del workspace.
     * @returns Una stringa con le FAQ formattate.
     */
    getActiveFaqs(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const faqs = yield this.prisma.fAQ.findMany({
                    where: {
                        workspaceId: workspaceId,
                        isActive: true,
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                });
                if (faqs.length === 0) {
                    return ""; // Nessuna FAQ attiva
                }
                // Formatta le FAQ come stringa per il prompt
                const formattedFaqs = faqs
                    .map((faq) => `D: ${faq.question}\nR: ${faq.answer}`)
                    .join("\n\n");
                return `\n\n${formattedFaqs}`;
            }
            catch (error) {
                logger_1.default.error("Error fetching active FAQs:", error);
                return ""; // In caso di errore, restituisce una stringa vuota
            }
        });
    }
    /**
     * Recupera i servizi attivi dal database e li formatta per il prompt.
     * @param workspaceId L'ID del workspace.
     * @returns Una stringa con i servizi formattati in lista numerata.
     */
    getActiveServices(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🔍 getActiveServices called", { workspaceId });
                const services = yield this.prisma.services.findMany({
                    where: {
                        workspaceId: workspaceId,
                        isActive: true,
                    },
                    orderBy: {
                        name: "asc",
                    },
                });
                logger_1.default.info("🔍 getActiveServices result", {
                    workspaceId,
                    servicesFound: services.length,
                    serviceNames: services.map(s => s.name)
                });
                if (services.length === 0) {
                    return ""; // Nessun servizio attivo
                }
                // Formatta i servizi come lista numerata con tutti i dettagli
                // ✅ Feature 191: Include serviceCode for LLM internal use (not shown to user)
                // LLM uses getServiceDetails(serviceCode) to get internal code for cart operations
                const formattedServices = services
                    .map((service, index) => {
                    const price = service.price
                        ? `€${service.price.toFixed(2)}`
                        : "Prezzo da definire";
                    const description = service.description || "Servizio disponibile";
                    return [
                        `${index + 1}. [${service.code}] **${service.name}** - ${price}`,
                        `   📝 Descrizione: ${description}`,
                        `   ⏰ Disponibilità: Sempre disponibile`,
                    ].join("\n");
                })
                    .join("\n\n");
                return `\n\n${formattedServices}`;
            }
            catch (error) {
                logger_1.default.error("Error fetching active services:", error);
                return ""; // In caso di errore, restituisce una stringa vuota
            }
        });
    }
    /**
     * Recupera i prodotti attivi dal database e li formatta per il prompt.
     * @param workspaceId L'ID del workspace.
     * @param customerDiscount Sconto del customer (opzionale)
     * @returns Una stringa con i prodotti formattati.
     */
    getActiveProducts(workspaceId_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, customerDiscount = 0) {
            try {
                const products = yield this.prisma.products.findMany({
                    where: {
                        workspaceId: workspaceId,
                        isActive: true,
                    },
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        price: true,
                        description: true, // Aggiungi description per il prompt
                        formato: true, // Aggiungi formato per il prompt
                        stock: true, // Aggiungi stock per disponibilità
                        productCertifications: {
                            // ✅ Feature 178: Many-to-many certifications from database
                            select: {
                                certification: {
                                    select: {
                                        name: true,
                                    },
                                },
                            },
                        },
                        region: true, // ✅ Feature 123 - C2: Add region for single product details
                        transportType: true, // ✅ Bonus: Temperature info for product search
                        category: {
                            select: {
                                name: true,
                            },
                        },
                    },
                    orderBy: {
                        category: {
                            name: "asc",
                        },
                    },
                });
                if (products.length === 0) {
                    return "";
                }
                // Calcola i prezzi con sconti
                const { PriceCalculationService } = yield Promise.resolve().then(() => __importStar(require("../application/services/price-calculation.service")));
                const priceService = new PriceCalculationService(this.prisma);
                const productIds = products.map((p) => p.id);
                const priceResult = yield priceService.calculatePricesWithDiscounts(workspaceId, productIds, customerDiscount);
                const priceMap = new Map(priceResult.products.map((p) => [p.id, p]));
                // Raggruppa i prodotti per categoria con prezzi scontati
                const productsByCategory = products.reduce((acc, product) => {
                    var _a;
                    const categoryName = ((_a = product.category) === null || _a === void 0 ? void 0 : _a.name) || "Senza Categoria";
                    const priceData = priceMap.get(product.id);
                    if (!acc[categoryName]) {
                        acc[categoryName] = [];
                    }
                    acc[categoryName].push(Object.assign(Object.assign({}, product), { originalPrice: (priceData === null || priceData === void 0 ? void 0 : priceData.originalPrice) || product.price, finalPrice: (priceData === null || priceData === void 0 ? void 0 : priceData.finalPrice) || product.price, hasDiscount: ((priceData === null || priceData === void 0 ? void 0 : priceData.appliedDiscount) || 0) > 0, description: product.description }));
                    return acc;
                }, {});
                // Formatta l'output con prezzi scontati - versione compatta per evitare troncamento
                let formattedProducts = "";
                for (const categoryName in productsByCategory) {
                    const productList = productsByCategory[categoryName];
                    formattedProducts += `\n**${categoryName.toUpperCase()}** (${productList.length} prodotti)\n`;
                    // Mostra tutti i prodotti della categoria
                    const productsToShow = productList;
                    // Formato: ogni prodotto su una riga separata con description, stock, certifications
                    productsToShow.forEach((p) => {
                        var _a, _b;
                        const originalPrice = Number(p.originalPrice).toFixed(2);
                        const finalPrice = Number(p.finalPrice).toFixed(2);
                        const description = p.description ? ` - ${p.description}` : "";
                        const formatoStr = p.formato ? ` ${p.formato}` : "";
                        // Stock indicator
                        let stockIcon = "✅";
                        if (p.stock === 0)
                            stockIcon = "❌";
                        else if (p.stock < 5)
                            stockIcon = "⚠️";
                        const stockStr = ` | Stock: ${stockIcon} ${p.stock}`;
                        // ✅ Feature 178: Extract certification names from many-to-many relation
                        const certificationNames = ((_a = p.productCertifications) === null || _a === void 0 ? void 0 : _a.map((pc) => pc.certification.name)) || [];
                        // Display certifications directly from database (already in Italian)
                        const certBadges = certificationNames.filter(Boolean);
                        const certificationsStr = certBadges.length > 0 ? ` | 🔖 ${certBadges.join(", ")}` : "";
                        // ✅ Feature 123 - C2: Add supplier and region to formatted output
                        const supplierStr = ((_b = p.supplier) === null || _b === void 0 ? void 0 : _b.companyName)
                            ? ` | 🏷️ ${p.supplier.companyName}`
                            : "";
                        const regionStr = p.region ? ` | 🌍 ${p.region}` : "";
                        const transportStr = p.transportType
                            ? ` | ${p.transportType === "Trasporto refrigerato"
                                ? "❄️"
                                : p.transportType === "Trasporto congelato"
                                    ? "🧊"
                                    : "📦"} ${p.transportType}`
                            : "";
                        // ✅ Feature 191: Include sku for LLM internal use (not shown to user)
                        // Format: [CODE] NOME formato ~€originalPrice~ → €finalPrice - description | Stock: ✅ N | 🔖 Certifications | 🏷️ Supplier | 🌍 Region | ❄️ Transport
                        // LLM uses getProductDetails(sku) to get internal code for cart operations
                        formattedProducts += `• [${p.sku}] ${p.name}${formatoStr} ~€${originalPrice}~ → €${finalPrice}${description}${stockStr}${certificationsStr}${supplierStr}${regionStr}${transportStr}\n`;
                    });
                    formattedProducts += "\n";
                }
                // ✅ Feature 123 - C1: Token count monitoring
                // Estimate token count (rough approximation: 1 token ≈ 4 characters)
                const tokenCount = Math.ceil(formattedProducts.length / 4);
                const tokenLimit = 50000;
                logger_1.default.info(`📊 {{PRODUCTS}} token estimation`, {
                    workspaceId,
                    productsCount: products.length,
                    charactersCount: formattedProducts.length,
                    estimatedTokens: tokenCount,
                    tokenLimit,
                    utilizationPercent: ((tokenCount / tokenLimit) * 100).toFixed(1),
                });
                if (tokenCount > tokenLimit) {
                    logger_1.default.warn(`⚠️ {{PRODUCTS}} exceeds recommended token limit: ${tokenCount} tokens (limit: ${tokenLimit})`, {
                        workspaceId,
                        productsCount: products.length,
                        recommendation: "Consider implementing pagination or reducing product count",
                    });
                }
                else if (tokenCount > tokenLimit * 0.8) {
                    logger_1.default.info(`ℹ️ {{PRODUCTS}} approaching token limit: ${tokenCount} tokens (80%+ of ${tokenLimit})`, {
                        workspaceId,
                        productsCount: products.length,
                    });
                }
                return formattedProducts;
            }
            catch (error) {
                logger_1.default.error("Error fetching active products:", error);
                return "";
            }
        });
    }
    /**
     * Get all chat sessions with their most recent message, ordered by latest message
     *
     * @param limit Number of chat sessions to return
     * @returns Array of chat sessions with latest message info
     */
    getRecentChats() {
        return __awaiter(this, arguments, void 0, function* (limit = 20, workspaceId) {
            try {
                // Get all chat sessions
                const chatSessions = yield this.prisma.chatSession.findMany({
                    take: limit,
                    include: {
                        customer: true,
                    },
                    orderBy: {
                        updatedAt: "desc",
                    },
                    where: {
                        workspaceId: workspaceId,
                    },
                });
                // 🔥 FIX: Get last message from ConversationMessage table (not Message table)
                const sessionsWithMessages = yield Promise.all(chatSessions.map((session) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b;
                    // Get most recent conversation message (exclude function calls)
                    const lastMessage = yield this.prisma.conversationMessage.findFirst({
                        where: {
                            conversationId: session.id,
                            role: {
                                not: "function", // Exclude function calls
                            },
                        },
                        orderBy: {
                            createdAt: "desc",
                        },
                    });
                    return {
                        sessionId: session.id,
                        customerId: session.customerId,
                        customerName: session.customer.name,
                        customerPhone: session.customer.phone,
                        companyName: session.customer.company || null,
                        lastMessage: lastMessage ? lastMessage.content : null,
                        lastMessageTime: lastMessage
                            ? lastMessage.createdAt
                            : session.updatedAt,
                        status: session.status,
                        unreadCount: 0, // Will be updated later
                        workspaceId: session.workspaceId,
                        activeChatbot: (_b = (_a = session.customer) === null || _a === void 0 ? void 0 : _a.activeChatbot) !== null && _b !== void 0 ? _b : true,
                    };
                })));
                return sessionsWithMessages;
            }
            catch (error) {
                logger_1.default.error("Error getting recent chats:", error);
                throw new Error("Failed to get recent chats");
            }
        });
    }
    /**
     * Get unread message count for a specific chat session
     *
     * @param chatSessionId The chat session ID
     * @returns Number of unread messages
     */
    getUnreadCount(chatSessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const count = yield this.prisma.message.count({
                    where: {
                        chatSessionId,
                        direction: database_1.MessageDirection.INBOUND, // Solo messaggi in entrata (dal cliente)
                        read: false,
                    },
                });
                return count;
            }
            catch (error) {
                logger_1.default.error(`Error counting unread messages for session ${chatSessionId}:`, error);
                return 0;
            }
        });
    }
    /**
     * Mark all messages in a chat session as read
     *
     * @param chatSessionId The chat session ID
     * @param workspaceId Optional workspace ID to filter
     * @returns Success status
     */
    markMessagesAsRead(chatSessionId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 🔐 SECURITY: workspaceId is MANDATORY for proper isolation
                if (!workspaceId) {
                    logger_1.default.error("markMessagesAsRead: workspaceId is required");
                    throw new Error("workspaceId is mandatory for marking messages as read");
                }
                // First verify that the chat session belongs to the workspace
                const session = yield this.prisma.chatSession.findFirst({
                    where: {
                        id: chatSessionId,
                        workspaceId: workspaceId,
                    },
                    select: { id: true },
                });
                if (!session) {
                    logger_1.default.warn(`markMessagesAsRead: Chat session ${chatSessionId} not found in workspace ${workspaceId}`);
                    return false;
                }
                yield this.prisma.message.updateMany({
                    where: {
                        chatSessionId,
                        direction: database_1.MessageDirection.INBOUND,
                        read: false,
                    },
                    data: {
                        read: true,
                        updatedAt: new Date(),
                    },
                });
                return true;
            }
            catch (error) {
                logger_1.default.error(`Error marking messages as read for session ${chatSessionId}:`, error);
                return false;
            }
        });
    }
    /**
     * Get chat sessions with unread message counts
     *
     * @param limit Maximum number of sessions to return
     * @param workspaceId Optional workspace ID to filter sessions
     * @returns Array of chat sessions with unread counts
     */
    getChatSessionsWithUnreadCounts() {
        return __awaiter(this, arguments, void 0, function* (limit = 20, workspaceId) {
            try {
                // 🔐 SECURITY: workspaceId is MANDATORY for proper isolation
                if (!workspaceId) {
                    logger_1.default.error("getChatSessionsWithUnreadCounts: workspaceId is required");
                    throw new Error("workspaceId is mandatory for retrieving chat sessions");
                }
                logger_1.default.info(`[ChatSessions] 🔍 Fetching sessions for workspace: ${workspaceId}`);
                // Get all chat sessions, including those with blacklisted customers
                // We want to show all chats but mark blacklisted ones visually
                // @ts-ignore - Prisma types issue
                const chatSessions = yield this.prisma.chatSession.findMany({
                    where: {
                        workspaceId: workspaceId,
                        // Removed isBlacklisted filter - we want to show all chats
                    },
                    include: {
                        customer: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                                company: true, // Include company name for chat list display
                                activeChatbot: true, // Include activeChatbot for chat list icon
                                isBlacklisted: true, // Include to show blacklist status in UI
                                // Remove avatar as it doesn't exist in the schema
                            },
                        },
                        workspace: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                        // Include message count
                        messages: {
                            where: {
                                read: false, // Use 'read' instead of 'isRead'
                                direction: "INBOUND",
                            },
                            select: {
                                id: true,
                            },
                        },
                    },
                    orderBy: {
                        updatedAt: "desc",
                    },
                    take: limit,
                });
                logger_1.default.info(`[ChatSessions] ✅ Found ${chatSessions.length} sessions for workspace ${workspaceId}`);
                // Return all sessions - we'll show blacklisted status in UI instead of hiding
                // Map sessions to include unread count and activeChatbot
                return chatSessions.map((session) => {
                    var _a, _b;
                    return (Object.assign(Object.assign({}, session), { unreadCount: session.messages.length, activeChatbot: (_b = (_a = session.customer) === null || _a === void 0 ? void 0 : _a.activeChatbot) !== null && _b !== void 0 ? _b : true, messages: undefined }));
                });
            }
            catch (error) {
                logger_1.default.error("Error getting chat sessions with unread counts:", error);
                return [];
            }
        });
    }
    /**
     * Validate a workspace ID
     * @param workspaceId The workspace ID to validate
     * @returns True if valid, False otherwise
     */
    validateWorkspaceId(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!workspaceId || typeof workspaceId !== "string") {
                    logger_1.default.warn("Invalid workspace ID format");
                    return false;
                }
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                });
                return !!workspace;
            }
            catch (error) {
                logger_1.default.error("Error validating workspace ID:", error);
                return false;
            }
        });
    }
    /**
     * Get workspace settings for a workspace
     * @param workspaceId The workspace ID
     * @returns Workspace settings
     */
    getWorkspaceSettings(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`Getting workspace settings for workspace ${workspaceId}`);
                // Check if workspaceId is missing or empty
                if (!workspaceId || workspaceId.trim() === "") {
                    logger_1.default.warn("getWorkspaceSettings: No workspace ID provided, trying to find default workspace");
                    // Try to find any active workspace
                    const activeWorkspace = yield this.prisma.workspace.findFirst({
                        where: { isActive: true },
                    });
                    if (activeWorkspace) {
                        logger_1.default.info(`getWorkspaceSettings: Found active workspace ${activeWorkspace.id} to use as default`);
                        return activeWorkspace;
                    }
                    // If no active workspace, try any workspace
                    const anyWorkspace = yield this.prisma.workspace.findFirst();
                    if (anyWorkspace) {
                        logger_1.default.warn(`getWorkspaceSettings: No active workspaces found, using ${anyWorkspace.id} (inactive)`);
                        return anyWorkspace;
                    }
                    logger_1.default.error("getWorkspaceSettings: No workspaces found in the database");
                    return null;
                }
                // Try to find by exact ID first
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                });
                // If found, return it
                if (workspace) {
                    logger_1.default.info(`getWorkspaceSettings: Workspace ${workspaceId} found, isActive: ${workspace.isActive}`);
                    return workspace;
                }
                // If not found by ID, try searching by name or slug
                logger_1.default.warn(`getWorkspaceSettings: Workspace with ID ${workspaceId} not found, trying alternative searches`);
                // Try by name or slug
                const workspaceByName = yield this.prisma.workspace.findFirst({
                    where: {
                        OR: [
                            { name: { contains: workspaceId, mode: "insensitive" } },
                            { slug: { contains: workspaceId, mode: "insensitive" } },
                        ],
                    },
                });
                if (workspaceByName) {
                    logger_1.default.info(`getWorkspaceSettings: Found workspace by name/slug match: ${workspaceByName.id}`);
                    return workspaceByName;
                }
                // If still not found, try to get any active workspace
                logger_1.default.warn("getWorkspaceSettings: No matching workspace found, falling back to any active workspace");
                const fallbackWorkspace = yield this.prisma.workspace.findFirst({
                    where: { isActive: true },
                });
                if (fallbackWorkspace) {
                    logger_1.default.info(`getWorkspaceSettings: Using fallback active workspace: ${fallbackWorkspace.id}`);
                    return fallbackWorkspace;
                }
                logger_1.default.error("getWorkspaceSettings: No workspaces found after all fallback attempts");
                return null;
            }
            catch (error) {
                logger_1.default.error(`Error getting workspace settings for ${workspaceId}:`, error);
                return null;
            }
        });
    }
    /**
     * Get all products
     * @param workspaceId Workspace ID to filter by
     * @returns List of products
     */
    getProducts(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 🔐 SECURITY: workspaceId is MANDATORY for product retrieval
                if (!workspaceId) {
                    logger_1.default.error("getProducts: workspaceId is required");
                    throw new Error("workspaceId is mandatory for product retrieval");
                }
                const products = yield this.prisma.products.findMany({
                    where: { workspaceId },
                    orderBy: {
                        name: "asc",
                    },
                });
                return products;
            }
            catch (error) {
                logger_1.default.error("Error getting products:", error);
                return [];
            }
        });
    }
    /**
     * Get all services
     * @param workspaceId Workspace ID to filter by
     * @returns List of services
     */
    getServices(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 🔐 SECURITY: workspaceId is MANDATORY for service retrieval
                if (!workspaceId) {
                    logger_1.default.error("getServices: workspaceId is required");
                    throw new Error("workspaceId is mandatory for service retrieval");
                }
                const services = yield this.prisma.services.findMany({
                    where: { workspaceId },
                    orderBy: {
                        name: "asc",
                    },
                });
                return services;
            }
            catch (error) {
                logger_1.default.error("Error getting services:", error);
                return [];
            }
        });
    }
    /**
     * Get all events
     * @param workspaceId Workspace ID to filter by
     * @returns List of events
     */
    getEvents(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Events functionality has been removed from the system
                logger_1.default.info("Events functionality has been removed from the system");
                return [];
            }
            catch (error) {
                logger_1.default.error("Error getting events:", error);
                return [];
            }
        });
    }
    /**
     * Update a customer's language preference
     *
     * @param customerId The customer's ID
     * @param language The language code to set
     * @returns The updated customer
     */
    updateCustomerLanguage(customerId, language) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updatedCustomer = yield this.prisma.customers.update({
                    where: {
                        id: customerId,
                    },
                    data: {
                        language,
                    },
                });
                logger_1.default.info(`Updated language for customer ${customerId} to ${language}`);
                return updatedCustomer;
            }
            catch (error) {
                logger_1.default.error(`Error updating customer language:`, error);
                throw new Error("Failed to update customer language");
            }
        });
    }
    /**
     * Create a new customer
     *
     * @param data Customer data
     * @returns The created customer
     */
    createCustomer(_a) {
        return __awaiter(this, arguments, void 0, function* ({ name, email, phone, workspaceId, language = "ENG", // Add default language
         }) {
            try {
                const customer = yield this.prisma.customers.create({
                    data: {
                        name,
                        email,
                        phone,
                        workspaceId,
                        language,
                        isActive: true,
                        isBlacklisted: true, // 🚨 NEW USERS ARE BLOCKED until admin approval!
                        activeChatbot: true, // Enable chatbot to handle registration requests
                        currency: "EUR",
                    },
                });
                logger_1.default.info(`Created customer: ${customer.id} (blocked until admin approval)`);
                return customer;
            }
            catch (error) {
                // P2002: Unique constraint violation (phone or email already exists)
                if (error.code === "P2002") {
                    logger_1.default.warn(`createCustomer: Unique constraint violation for phone ${phone} or email ${email}. Fetching existing customer.`);
                    // Fetch the existing customer
                    const existingCustomer = yield this.prisma.customers.findFirst({
                        where: {
                            phone,
                            workspaceId,
                        },
                    });
                    if (existingCustomer) {
                        logger_1.default.info(`createCustomer: ✅ Returning existing customer ${existingCustomer.id}`);
                        return existingCustomer;
                    }
                    // If not found by phone, might be email duplicate
                    const existingByEmail = yield this.prisma.customers.findFirst({
                        where: {
                            email,
                            workspaceId,
                        },
                    });
                    if (existingByEmail) {
                        logger_1.default.info(`createCustomer: ✅ Returning existing customer by email ${existingByEmail.id}`);
                        return existingByEmail;
                    }
                    // Should never reach here, but handle gracefully
                    logger_1.default.error("createCustomer: CRITICAL - Customer not found after P2002 error");
                    throw new Error("Customer not found after unique constraint violation");
                }
                // Different error, rethrow
                logger_1.default.error("Error creating customer:", error);
                throw new Error("Failed to create customer");
            }
        });
    }
    /**
     * Chiama il function router di OpenAI per ottenere la funzione da chiamare
     * @param message Messaggio dell'utente
     * @param conversationContext Array di messaggi precedenti per contesto
     * @returns Risultato della chiamata al function router
     */
    callFunctionRouter(message_1) {
        return __awaiter(this, arguments, void 0, function* (message, conversationContext = []) {
            var _a, _b, _c, _d, _e;
            logger_1.default.info("🚨 DEBUG - callFunctionRouter CALLED with message:", message);
            try {
                // Check if OpenRouter is properly configured
                logger_1.default.info("🔍 DEBUG - OPENROUTER_API_KEY check:", {
                    present: !!process.env.OPENROUTER_API_KEY,
                    length: ((_a = process.env.OPENROUTER_API_KEY) === null || _a === void 0 ? void 0 : _a.length) || 0,
                    prefix: ((_b = process.env.OPENROUTER_API_KEY) === null || _b === void 0 ? void 0 : _b.substring(0, 15)) || "MISSING",
                });
                if (!process.env.OPENROUTER_API_KEY) {
                    logger_1.default.warn("OpenRouter API key not configured properly for function router");
                    return {
                        function_call: {
                            name: "get_generic_response",
                            arguments: {},
                        },
                    };
                }
                // Use a simple default prompt for function routing
                const functionRouterPrompt = "You are a function router for a WhatsApp chatbot. Analyze the user's message and select the most appropriate function to call.";
                // ANDREA DECISION: CF ATTIVE CON NOMI CORRETTI
                const availableFunctions = [
                    {
                        name: "contactOperator",
                        description: "Contact a human operator when: 1) User explicitly requests operator with phrases like 'voglio parlare con operatore', 'contatta operatore', 'mettimi in contatto con operatore'. 2) User responds 'si', 'yes', 'sì' after being asked if they want to contact an operator. Check conversation history to see if previous message offered operator contact. Do NOT trigger for product problems unless user confirms with 'si'/'yes'.",
                        parameters: {
                            type: "object",
                            properties: {
                                message: {
                                    type: "string",
                                    description: "The user's original message requesting operator contact",
                                },
                            },
                            required: ["message"],
                        },
                    },
                    {
                        name: "getLinkOrderByCode",
                        description: "Get a secure link to view a specific order (or the last order if omitted). Triggers when user asks for a specific order or invoice.",
                        parameters: {
                            type: "object",
                            properties: {
                                orderCode: {
                                    type: "string",
                                    description: "Order number or code to retrieve (optional, falls back to last order)",
                                },
                                documentType: {
                                    type: "string",
                                    description: "Type of document requested: invoice, ddt, order (optional)",
                                },
                                message: {
                                    type: "string",
                                    description: "User's original request",
                                },
                            },
                            required: ["message"],
                        },
                    },
                    {
                        name: "getShipmentTrackingLink",
                        description: "Get shipment tracking link when user asks about order status, delivery, where is my order, when will it arrive, tracking information, last order",
                        parameters: {
                            type: "object",
                            properties: {
                                orderCode: {
                                    type: "string",
                                    description: "Order number or code to track",
                                },
                                message: {
                                    type: "string",
                                    description: "User's original tracking request",
                                },
                            },
                            required: ["message"],
                        },
                    },
                ];
                logger_1.default.info(`Calling function router for message: "${message.substring(0, 30)}${message.length > 30 ? "..." : ""}"`);
                // Chiamata all'API OpenRouter con le funzioni definite
                const axios = require("axios");
                const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";
                const openRouterApiKey = process.env.OPENROUTER_API_KEY;
                // DEBUG: Log prompt e funzioni
                logger_1.default.info("🔍 DEBUG - Function Router Prompt:", functionRouterPrompt.substring(0, 200) + "...");
                logger_1.default.info("🔍 DEBUG - Available Functions:", availableFunctions.map((f) => f.name));
                logger_1.default.info("🔍 DEBUG - User Message:", message);
                logger_1.default.info("🔍 DEBUG - Conversation Context:", conversationContext.length, "messages");
                logger_1.default.info("🔍 DEBUG - OpenRouter API Key present:", !!openRouterApiKey);
                // Costruisci l'array di messaggi includendo il contesto della conversazione
                const messages = [{ role: "system", content: functionRouterPrompt }];
                // Aggiungi gli ultimi 3 messaggi della conversazione per contesto
                if (conversationContext && conversationContext.length > 0) {
                    const recentContext = conversationContext.slice(-3); // Ultimi 3 messaggi
                    for (const contextMsg of recentContext) {
                        messages.push({
                            role: contextMsg.direction === "INBOUND" ? "user" : "assistant",
                            content: contextMsg.content,
                        });
                    }
                    logger_1.default.info("🔍 DEBUG - Added", recentContext.length, "context messages");
                }
                // Aggiungi il messaggio corrente
                messages.push({ role: "user", content: message });
                const requestPayload = {
                    model: "openai/gpt-5-mini",
                    messages: messages,
                    tools: availableFunctions.map((func) => ({
                        type: "function",
                        function: func,
                    })),
                    tool_choice: "auto",
                };
                logger_1.default.info("🔍 DEBUG - Request payload:", JSON.stringify(requestPayload, null, 2));
                let response;
                try {
                    response = yield axios.post(openRouterUrl, requestPayload, {
                        headers: {
                            Authorization: `Bearer ${openRouterApiKey}`,
                            "Content-Type": "application/json",
                            "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
                            "X-Title": "eChatbot Function Router",
                        },
                    });
                    logger_1.default.info("🔍 DEBUG - Axios call successful");
                }
                catch (axiosError) {
                    logger_1.default.error("🔍 DEBUG - Axios error:", axiosError.message);
                    if (axiosError.response) {
                        logger_1.default.error("🔍 DEBUG - Axios response error:", axiosError.response.data);
                    }
                    throw axiosError;
                }
                // DEBUG: Log risposta OpenRouter
                logger_1.default.info("🔍 DEBUG - OpenRouter Response:", JSON.stringify((_c = response.data.choices[0]) === null || _c === void 0 ? void 0 : _c.message, null, 2));
                // Estrai la chiamata di tool dal risultato
                const toolCalls = (_e = (_d = response.data.choices[0]) === null || _d === void 0 ? void 0 : _d.message) === null || _e === void 0 ? void 0 : _e.tool_calls;
                const toolCall = toolCalls === null || toolCalls === void 0 ? void 0 : toolCalls[0];
                if (!toolCall || !toolCall.function) {
                    logger_1.default.warn("No tool call returned by OpenRouter");
                    return {
                        function_call: {
                            name: "get_generic_response",
                            arguments: {},
                        },
                    };
                }
                // Parsing degli argomenti della funzione
                let functionArgs = {};
                try {
                    if (toolCall.function.arguments) {
                        functionArgs = JSON.parse(toolCall.function.arguments);
                    }
                }
                catch (error) {
                    logger_1.default.error("Error parsing function arguments:", error);
                }
                logger_1.default.info(`Function router selected: ${toolCall.function.name}`);
                return {
                    function_call: {
                        name: toolCall.function.name,
                        arguments: functionArgs,
                    },
                    // Normalize for debug clients and downstream services
                    name: toolCall.function.name,
                    arguments: functionArgs,
                    functionCalls: [
                        {
                            name: toolCall.function.name,
                            arguments: functionArgs,
                            source: "function-router",
                        },
                    ],
                };
            }
            catch (error) {
                logger_1.default.error("Error calling function router:", error);
                return {
                    function_call: {
                        name: "get_generic_response",
                        arguments: {},
                    },
                };
            }
        });
    }
    /**
     * Delete a chat session and all its messages
     *
     * @param chatSessionId The chat session ID
     * @param workspaceId Optional workspace ID for filtering
     * @returns True if successful, false otherwise
     */
    deleteChat(chatSessionId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // First verify that the chat session belongs to the workspace if needed
                if (workspaceId) {
                    const session = yield this.prisma.chatSession.findFirst({
                        where: {
                            id: chatSessionId,
                            workspaceId,
                        },
                        select: { id: true },
                    });
                    if (!session) {
                        logger_1.default.warn(`deleteChat: Chat session ${chatSessionId} not found in workspace ${workspaceId}`);
                        return false;
                    }
                }
                // Delete all messages in the chat session
                yield this.prisma.message.deleteMany({
                    where: {
                        chatSessionId,
                    },
                });
                // Then delete the chat session itself
                yield this.prisma.chatSession.delete({
                    where: {
                        id: chatSessionId,
                    },
                });
                logger_1.default.info(`Deleted chat session: ${chatSessionId}`);
                return true;
            }
            catch (error) {
                logger_1.default.error(`Error deleting chat session ${chatSessionId}:`, error);
                return false;
            }
        });
    }
    /**
     * Get latest messages for a phone number
     * @param phoneNumber The phone number
     * @param limit Number of messages to return
     * @param workspaceId Workspace ID to filter by
     * @returns Recent chat messages
     */
    getLatesttMessages(phoneNumber_1) {
        return __awaiter(this, arguments, void 0, function* (phoneNumber, limit = 30, workspaceId) {
            try {
                logger_1.default.info(`[DB] Fetching messages from database for ${phoneNumber}`);
                // 🔐 SECURITY: workspaceId is MANDATORY
                if (!workspaceId) {
                    logger_1.default.error("getLatesttMessages: workspaceId is required");
                    throw new Error("workspaceId is mandatory for retrieving messages");
                }
                // Find customer by phone
                const customer = yield this.findCustomerByPhone(phoneNumber);
                if (!customer)
                    return [];
                // Find active chat session
                const session = yield this.prisma.chatSession.findFirst({
                    where: {
                        customerId: customer.id,
                        status: "active",
                        workspaceId: workspaceId,
                    },
                });
                if (!session)
                    return [];
                // Find messages for this session
                return yield this.prisma.message.findMany({
                    where: {
                        chatSessionId: session.id,
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                    take: limit,
                });
            }
            catch (error) {
                logger_1.default.error("Error getting latest messages:", error);
                return [];
            }
        });
    }
    /**
     * Get recent messages within a time window (for LLM context)
     * @param phoneNumber The phone number
     * @param minutesAgo How many minutes back to look
     * @param workspaceId Workspace ID to filter by (MANDATORY)
     * @returns Recent chat messages within time window
     */
    getRecentMessagesByTime(phoneNumber_1) {
        return __awaiter(this, arguments, void 0, function* (phoneNumber, minutesAgo = 5, workspaceId) {
            try {
                logger_1.default.info(`[HISTORY] Fetching messages from last ${minutesAgo} minutes for ${phoneNumber}`);
                // 🔐 SECURITY: workspaceId is MANDATORY
                if (!workspaceId) {
                    logger_1.default.error("getRecentMessagesByTime: workspaceId is required");
                    throw new Error("workspaceId is mandatory for retrieving messages");
                }
                // Find customer by phone
                const customer = yield this.findCustomerByPhone(phoneNumber);
                if (!customer) {
                    logger_1.default.warn(`[HISTORY] Customer not found for phone: ${phoneNumber}`);
                    return [];
                }
                // Find active chat session
                const session = yield this.prisma.chatSession.findFirst({
                    where: {
                        customerId: customer.id,
                        status: "active",
                        workspaceId: workspaceId,
                    },
                });
                if (!session) {
                    logger_1.default.warn(`[HISTORY] No active session for customer: ${customer.id}`);
                    return [];
                }
                // Calculate time threshold
                const timeThreshold = new Date(Date.now() - minutesAgo * 60 * 1000);
                // Find messages for this session within time window
                const messages = yield this.prisma.message.findMany({
                    where: {
                        chatSessionId: session.id,
                        createdAt: {
                            gte: timeThreshold, // Greater than or equal to threshold
                        },
                    },
                    orderBy: {
                        createdAt: "desc", // Most recent first
                    },
                    take: 20, // Max 20 messages even if more exist in time window
                });
                logger_1.default.info(`[HISTORY] Found ${messages.length} messages from last ${minutesAgo} minutes`);
                return messages;
            }
            catch (error) {
                logger_1.default.error("[HISTORY] Error getting recent messages by time:", error);
                return [];
            }
        });
    }
    /**
     * Get response from an agent
     * @param agent The agent to use
     * @param message The message to process
     * @returns The agent response
     */
    getResponseFromAgent(agent, message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // In a real implementation, this would call an LLM API
                // For now, we'll just return a mock response based on the message content
                const response = {
                    name: agent.name || "Unknown",
                    content: agent.content || "",
                    department: agent.department || null,
                };
                return response;
            }
            catch (error) {
                logger_1.default.error("Error getting response from agent:", error);
                return { name: "Error", content: "Failed to get agent response" };
            }
        });
    }
    /**
     * Get conversation response from LLM
     * @param chatHistory Previous messages
     * @param message Current user message
     * @param systemPrompt System prompt for the LLM
     * @returns LLM response
     */
    getConversationResponse(chatHistory, message, systemPrompt) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // In a real implementation, this would call an LLM API
                // For now, we'll just return a mock response
                return "This is a mock response from the LLM";
            }
            catch (error) {
                logger_1.default.error("Error getting conversation response:", error);
                return "Failed to generate response";
            }
        });
    }
    /**
     * Count recent messages from a phone number within a time window
     * @param phoneNumber Customer phone number
     * @param workspaceId Workspace ID
     * @param since Date to count messages from
     * @returns Number of messages
     */
    countRecentMessages(phoneNumber, workspaceId, since) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const count = yield this.prisma.message.count({
                    where: {
                        chatSession: {
                            workspaceId: workspaceId,
                            customer: {
                                phone: phoneNumber,
                            },
                        },
                        direction: database_1.MessageDirection.INBOUND,
                        createdAt: {
                            gte: since,
                        },
                    },
                });
                return count;
            }
            catch (error) {
                logger_1.default.error("Error counting recent messages:", error);
                return 0; // Return 0 on error to avoid false positives
            }
        });
    }
    /**
     * Update customer blacklist status
     * @param customerId Customer ID
     * @param workspaceId Workspace ID
     * @param isBlacklisted Blacklist status
     */
    updateCustomerBlacklist(customerId, workspaceId, isBlacklisted) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.prisma.customers.update({
                    where: {
                        id: customerId,
                        workspaceId,
                    },
                    data: {
                        isBlacklisted,
                    },
                });
                logger_1.default.info(`Customer ${customerId} blacklist status updated to: ${isBlacklisted}`);
            }
            catch (error) {
                logger_1.default.error("Error updating customer blacklist status:", error);
                throw error;
            }
        });
    }
    /**
     * Add phone number to blocklist
     * NOTE: Workspace-level blocklist was removed during database cleanup.
     * Now using customers.isBlacklisted field instead.
     * This method is kept for backward compatibility but does nothing.
     * @deprecated Use customer.isBlacklisted field directly
     * @param phoneNumber Phone number to add
     * @param workspaceId Workspace ID
     */
    addToWorkspaceBlocklist(phoneNumber, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.warn(`addToWorkspaceBlocklist is deprecated. Use customers.isBlacklisted field instead. Phone: ${phoneNumber}, Workspace: ${workspaceId}`);
            // Method kept for backward compatibility - workspace.blocklist field removed
            // To block a customer, update: customers.isBlacklisted = true
        });
    }
    /**
     * TASK 4: Check if customer has recent activity within specified hours
     * Used for "Bentornato {NOME}" functionality
     *
     * @param customerId The customer ID
     * @param hours Number of hours to check back (default: 2)
     * @param workspaceId The workspace ID for filtering
     * @returns true if customer has recent activity, false otherwise
     */
    hasRecentActivity(customerId_1) {
        return __awaiter(this, arguments, void 0, function* (customerId, hours = 2, workspaceId) {
            try {
                const hoursAgo = new Date();
                hoursAgo.setHours(hoursAgo.getHours() - hours);
                const recentMessage = yield this.prisma.message.findFirst({
                    where: {
                        chatSession: Object.assign({ customerId: customerId }, (workspaceId && { workspaceId: workspaceId })),
                        direction: database_1.MessageDirection.INBOUND, // Only check incoming messages from customer
                        createdAt: {
                            gte: hoursAgo,
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                });
                const hasActivity = !!recentMessage;
                logger_1.default.info(`[TASK4] hasRecentActivity for customer ${customerId}: ${hasActivity} (within ${hours} hours)`);
                return hasActivity;
            }
            catch (error) {
                logger_1.default.error(`[TASK4] Error checking recent activity for customer ${customerId}:`, error);
                return false; // Return false on error to trigger welcome back message (safer)
            }
        });
    }
    /**
     * Get WIP message from database - NO HARDCODE (English only)
     * @param workspaceId Workspace ID
     * @returns WIP message from database (will be translated by Safety & Translation layer)
     */
    getWipMessage(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: { wipMessage: true },
                });
                if (!(workspace === null || workspace === void 0 ? void 0 : workspace.wipMessage)) {
                    logger_1.default.error(`❌ NO WIP MESSAGE in database for workspace ${workspaceId} - THIS SHOULD NOT HAPPEN`);
                    throw new Error("WIP message not configured in database");
                }
                // wipMessage is Json (multilingual), extract English version
                const wipMessageObj = workspace.wipMessage;
                return wipMessageObj.en || JSON.stringify(workspace.wipMessage);
            }
            catch (error) {
                logger_1.default.error(`Error getting WIP message for workspace ${workspaceId}:`, error);
                throw error; // Don't use hardcoded fallback - throw to ensure proper configuration
            }
        });
    }
    /**
     * Get welcome message from database - NO HARDCODE (English only)
     * @param workspaceId Workspace ID
     * @returns Welcome message from database (will be translated by Safety & Translation layer)
     */
    getWelcomeMessage(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: { welcomeMessage: true },
                });
                if (!(workspace === null || workspace === void 0 ? void 0 : workspace.welcomeMessage)) {
                    logger_1.default.error(`❌ NO WELCOME MESSAGE in database for workspace ${workspaceId} - THIS SHOULD NOT HAPPEN`);
                    throw new Error("Welcome message not configured in database");
                }
                // welcomeMessage is Json (multilingual), extract English version
                const welcomeMessageObj = workspace.welcomeMessage;
                return welcomeMessageObj.en || JSON.stringify(workspace.welcomeMessage);
            }
            catch (error) {
                logger_1.default.error(`Error getting welcome message for workspace ${workspaceId}:`, error);
                throw error; // Don't use hardcoded fallback - throw to ensure proper configuration
            }
        });
    }
    /**
     * Get welcome back message from database - NO HARDCODE
     * Uses afterRegistrationMessages as welcome back messages
     * @param workspaceId Workspace ID
     * @param customerName Customer name
     * @param language Customer language
     * @returns Welcome back message from database
     */
    getWelcomeBackMessage(workspaceId, customerName, language) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: { afterRegistrationMessages: true },
                });
                if (!(workspace === null || workspace === void 0 ? void 0 : workspace.afterRegistrationMessages)) {
                    logger_1.default.warn(`No after registration messages found for workspace ${workspaceId}`);
                    return `Welcome back, ${customerName}! How can I help you today?`;
                }
                const afterRegMessages = workspace.afterRegistrationMessages;
                const template = afterRegMessages[language] ||
                    afterRegMessages["en"] ||
                    `Welcome back, {name}! How can I help you today?`;
                return template
                    .replace("{name}", customerName)
                    .replace("{customerName}", customerName)
                    .replace("[nome]", customerName);
            }
            catch (error) {
                logger_1.default.error(`Error getting welcome back message for workspace ${workspaceId}:`, error);
                return `Welcome back, ${customerName}! How can I help you today?`;
            }
        });
    }
    /**
     * Get error message from database - NO HARDCODE (English only)
     * Uses wipMessage as fallback for error messages
     * @param workspaceId Workspace ID
     * @returns Error message from database (will be translated by Safety & Translation layer)
     */
    getErrorMessage(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: { wipMessage: true },
                });
                if (!(workspace === null || workspace === void 0 ? void 0 : workspace.wipMessage)) {
                    logger_1.default.error(`❌ NO WIP MESSAGE in database for workspace ${workspaceId} - THIS SHOULD NOT HAPPEN`);
                    throw new Error("Error message not configured in database");
                }
                // wipMessage is Json (multilingual), extract English version
                const wipMessageObj = workspace.wipMessage;
                return wipMessageObj.en || JSON.stringify(workspace.wipMessage);
            }
            catch (error) {
                logger_1.default.error(`Error getting error message for workspace ${workspaceId}:`, error);
                throw error; // Don't use hardcoded fallback
            }
        });
    }
    /**
     * Get agent configuration from database - NO HARDCODE
     * @param workspaceId Workspace ID
     * @returns Agent configuration from database
     */
    getAgentConfig(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const agentConfig = yield this.prisma.agentConfig.findFirst({
                    where: {
                        workspaceId: workspaceId,
                        isActive: true,
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                });
                if (!agentConfig) {
                    return null;
                }
                return {
                    prompt: agentConfig.systemPrompt || "", // ✅ CORRECT: Field is 'systemPrompt' in schema
                    model: agentConfig.model || "openai/gpt-4o-mini",
                    temperature: agentConfig.temperature || 0.0, // Default to 0 temperature
                    maxTokens: agentConfig.maxTokens || 5000,
                };
            }
            catch (error) {
                logger_1.default.error(`Error getting agent config for workspace ${workspaceId}:`, error);
                return null;
            }
        });
    }
    /**
     * Get workspace URL for registration links
     */
    getWorkspaceUrl(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: { url: true },
                });
                if (!(workspace === null || workspace === void 0 ? void 0 : workspace.url)) {
                    logger_1.default.warn(`No URL found for workspace ${workspaceId}, using default`);
                    return "http://localhost:3000";
                }
                return workspace.url;
            }
            catch (error) {
                logger_1.default.error("Error getting workspace URL:", error);
                return "http://localhost:3000";
            }
        });
    }
    /**
     * Get Prisma client for direct database access (public method for services)
     */
    getPrismaClient() {
        return this.prisma;
    }
    /**
     * Find services with filtering (public method for LangChain)
     */
    findServices(workspaceId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const whereClause = {
                    workspaceId,
                    isActive: (_a = options === null || options === void 0 ? void 0 : options.isActive) !== null && _a !== void 0 ? _a : true,
                };
                if (options === null || options === void 0 ? void 0 : options.category) {
                    whereClause.category = options.category;
                }
                return yield this.prisma.services.findMany({
                    where: whereClause,
                    take: (options === null || options === void 0 ? void 0 : options.limit) || 10,
                    orderBy: { name: "asc" },
                });
            }
            catch (error) {
                logger_1.default.error("Error finding services:", error);
                return [];
            }
        });
    }
    /**
     * Find FAQs with filtering (public method for LangChain)
     */
    findFAQs(workspaceId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const whereClause = {
                    workspaceId,
                    isActive: (_a = options === null || options === void 0 ? void 0 : options.isActive) !== null && _a !== void 0 ? _a : true,
                };
                if (options === null || options === void 0 ? void 0 : options.topic) {
                    whereClause.OR = [
                        { question: { contains: options.topic, mode: "insensitive" } },
                        { answer: { contains: options.topic, mode: "insensitive" } },
                    ];
                }
                return yield this.prisma.fAQ.findMany({
                    where: whereClause,
                    take: (options === null || options === void 0 ? void 0 : options.limit) || 5,
                    orderBy: { createdAt: "desc" },
                });
            }
            catch (error) {
                logger_1.default.error("Error finding FAQs:", error);
                return [];
            }
        });
    }
    /**
     * Find offers with filtering (public method for LangChain)
     */
    findOffers(workspaceId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const now = new Date();
                const whereClause = {
                    workspaceId,
                    isActive: (_a = options === null || options === void 0 ? void 0 : options.isActive) !== null && _a !== void 0 ? _a : true,
                    startDate: { lte: now },
                    endDate: { gte: now },
                };
                if (options === null || options === void 0 ? void 0 : options.category) {
                    whereClause.category = { name: options.category };
                }
                return yield this.prisma.offers.findMany({
                    where: whereClause,
                    include: { category: true },
                    take: (options === null || options === void 0 ? void 0 : options.limit) || 10,
                    orderBy: { discountPercent: "desc" },
                });
            }
            catch (error) {
                logger_1.default.error("Error finding offers:", error);
                return [];
            }
        });
    }
    /**
     * Create order (public method for LangChain)
     */
    createOrder(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Generate unique order code - 5 uppercase letters
                const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                let orderCode = "";
                for (let i = 0; i < 5; i++) {
                    orderCode += letters.charAt(Math.floor(Math.random() * letters.length));
                }
                return yield this.prisma.orders.create({
                    data: {
                        orderCode: orderCode,
                        customerId: data.customerId,
                        workspaceId: data.workspaceId,
                        status: data.status || database_1.OrderStatus.PENDING,
                        totalAmount: data.totalAmount || 0,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error creating order:", error);
                throw new Error("Failed to create order");
            }
        });
    }
    /**
     * Recupera le categorie attive dal database e le formatta per il prompt.
     * Il Translation Layer tradurrà automaticamente nella lingua del cliente.
     * @param workspaceId L'ID del workspace.
     * @returns Una stringa con le categorie formattate in italiano (lingua base).
     */
    getActiveCategories(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Fetch categories with product count
                const categories = yield this.prisma.categories.findMany({
                    where: {
                        workspaceId,
                        isActive: true,
                    },
                    orderBy: {
                        name: "asc",
                    },
                    include: {
                        _count: {
                            select: {
                                products: {
                                    where: {
                                        isActive: true,
                                    },
                                },
                            },
                        },
                    },
                });
                if (categories.length === 0)
                    return "";
                // Feature 123: Format categories with numbers for easy selection
                // Format: 1. Category Name (X prodotti) - Description
                const formattedCategories = categories
                    .map((category, index) => {
                    const name = category.name || "Categoria";
                    const description = category.description || "";
                    const productCount = category._count.products;
                    // Prendi una descrizione breve (prima frase o primi 80 caratteri)
                    const shortDesc = description
                        .split(/[.,;]/)[0]
                        .substring(0, 80)
                        .trim();
                    return `${index + 1}. **${name}** (${productCount} prodotti) - ${shortDesc || "Prodotti disponibili"}`;
                })
                    .join("\n");
                return `\n${formattedCategories}\n`;
            }
            catch (error) {
                logger_1.default.error("Error fetching active categories:", error);
                return "";
            }
        });
    }
    /**
     * Recupera le offerte attive dal database e le formatta per il prompt.
     * Il Translation Layer tradurrà automaticamente nella lingua del cliente.
     * @param workspaceId L'ID del workspace.
     * @returns Una stringa con le offerte formattate in italiano (lingua base).
     */
    getActiveOffers(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const now = new Date();
                // Offers expire based on dates only - isActive flag is ignored
                const offers = yield this.prisma.offers.findMany({
                    where: {
                        workspaceId,
                        startDate: { lte: now },
                        endDate: { gte: now },
                    },
                    include: {
                        category: true,
                    },
                    orderBy: {
                        discountPercent: "desc",
                    },
                });
                if (offers.length === 0) {
                    return ""; // Nessuna offerta attiva
                }
                // Formatta le offerte dal database - SEMPRE in italiano (lingua base)
                // Il Translation Layer si occuperà della traduzione finale
                const formattedOffers = offers
                    .map((offer) => {
                    var _a;
                    const categoryName = ((_a = offer.category) === null || _a === void 0 ? void 0 : _a.name) || "Generale";
                    return `Sconto di questo mese: ${offer.discountPercent}% sulla categoria ${categoryName}`;
                })
                    .join(" • ");
                return `\n${formattedOffers}\n`;
            }
            catch (error) {
                logger_1.default.error("Error fetching active offers:", error);
                return ""; // In caso di errore, restituisce una stringa vuota
            }
        });
    }
    // 🔧 NEW: Debug function to count active and expired links
    getLinkCounts(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const now = new Date();
                // Count active links (not expired)
                const activeLinksCount = yield this.prisma.shortUrls.count({
                    where: {
                        workspaceId,
                        isActive: true,
                        OR: [
                            { expiresAt: null }, // Never expires
                            { expiresAt: { gt: now } }, // Not yet expired
                        ],
                    },
                });
                // Count expired links
                const expiredLinksCount = yield this.prisma.shortUrls.count({
                    where: {
                        workspaceId,
                        expiresAt: { lt: now }, // Expired
                    },
                });
                // Count secure tokens active
                const activeTokensCount = yield this.prisma.secureToken.count({
                    where: {
                        workspaceId,
                        expiresAt: { gt: now }, // Not yet expired
                    },
                });
                // Count secure tokens expired
                const expiredTokensCount = yield this.prisma.secureToken.count({
                    where: {
                        workspaceId,
                        expiresAt: { lt: now }, // Expired
                    },
                });
                return {
                    shortUrls: {
                        active: activeLinksCount,
                        expired: expiredLinksCount,
                    },
                    secureTokens: {
                        active: activeTokensCount,
                        expired: expiredTokensCount,
                    },
                };
            }
            catch (error) {
                logger_1.default.error("Error getting link counts:", error);
                return {
                    shortUrls: { active: 0, expired: 0 },
                    secureTokens: { active: 0, expired: 0 },
                };
            }
        });
    }
}
exports.MessageRepository = MessageRepository;
//# sourceMappingURL=message.repository.js.map