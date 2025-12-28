"use strict";
/**
 * SecurityAgent
 *
 * Security validation layer that runs BEFORE Translation Agent.
 * Detects dangerous content: SQL injection, XSS, offensive language, data breach attempts.
 * If blocked: message is NOT sent, deliveryStatus='blocked', shows 🚫 icon to customer.
 *
 * Uses SECURITY agent config from database (order: 98)
 *
 * @architecture Clean Architecture - Uses AgentConfigRepository
 * @critical ALWAYS call this BEFORE Translation Agent
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
exports.SecurityAgent = void 0;
const axios_1 = __importDefault(require("axios"));
const agent_config_repository_1 = require("../../repositories/agent-config.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
class SecurityAgent {
    constructor(prisma) {
        this.prisma = prisma;
        this.openRouterBaseUrl = "https://openrouter.ai/api/v1";
        this.agentConfigRepo = new agent_config_repository_1.AgentConfigRepository(prisma);
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
        if (!this.openRouterApiKey) {
            logger_1.default.warn("⚠️ OPENROUTER_API_KEY not found - Security layer will allow all messages");
        }
        else {
            logger_1.default.info("✅ SecurityAgent initialized with OpenRouter API key");
        }
    }
    /**
     * Process message through security layer
     *
     * @param options - Processing options
     * @returns SecurityResult with safe flag and optional blocked reason
     */
    process(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const startTime = Date.now();
            try {
                // 1. Load SECURITY agent config from database
                const securityAgent = yield this.agentConfigRepo.findByType(options.workspaceId, "SECURITY");
                if (!securityAgent) {
                    logger_1.default.warn(`⚠️ SECURITY agent not configured for workspace ${options.workspaceId}`);
                    // Fallback: allow message if no security agent configured
                    return {
                        safe: true,
                        message: options.message,
                        blockedReason: undefined,
                        tokensUsed: 0,
                        executionTimeMs: Date.now() - startTime,
                    };
                }
                if (!securityAgent.isActive) {
                    logger_1.default.warn(`⚠️ SECURITY agent is INACTIVE for workspace ${options.workspaceId}`);
                    // Allow message if security agent disabled
                    return {
                        safe: true,
                        message: options.message,
                        tokensUsed: 0,
                        executionTimeMs: Date.now() - startTime,
                    };
                }
                // 🛡️ Load workspace to get allowedExternalLinks
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: options.workspaceId },
                    select: { allowedExternalLinks: true },
                });
                // 🛡️ Build allowed links string (comma-separated)
                const allowedLinks = ((_a = workspace === null || workspace === void 0 ? void 0 : workspace.allowedExternalLinks) === null || _a === void 0 ? void 0 : _a.length)
                    ? workspace.allowedExternalLinks.join(", ")
                    : ""; // Empty = no external links allowed
                // 2. Build system prompt with dynamic variables
                const systemPrompt = this.buildSystemPrompt(securityAgent.systemPrompt, {
                    nameUser: options.customerName || "Customer",
                    workspaceId: options.workspaceId,
                    ALLOWED_EXTERNAL_LINKS: allowedLinks, // 🛡️ Pass to prompt
                });
                // 3. Build user message
                const userMessage = `Check if this message is safe:\n\n"${options.message}"\n\nRespond with JSON: {"safe": true/false, "message": "...", "reason": "..."}`;
                // 4. Call OpenRouter LLM
                logger_1.default.info("🛡️ Calling SecurityAgent LLM", {
                    workspaceId: options.workspaceId,
                    model: securityAgent.model,
                });
                const response = yield axios_1.default.post(`${this.openRouterBaseUrl}/chat/completions`, {
                    model: securityAgent.model,
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt,
                        },
                        {
                            role: "user",
                            content: userMessage,
                        },
                    ],
                    temperature: securityAgent.temperature,
                    max_tokens: securityAgent.maxTokens,
                    response_format: { type: "json_object" }, // Force JSON response
                }, {
                    headers: {
                        Authorization: `Bearer ${this.openRouterApiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": process.env.FRONTEND_URL || "https://echatbot.ai",
                        "X-Title": "eChatbot Security Layer",
                    },
                    timeout: 30000, // 30 second timeout
                });
                const llmResponse = response.data.choices[0].message.content;
                const tokensUsed = ((_b = response.data.usage) === null || _b === void 0 ? void 0 : _b.total_tokens) || 0;
                const executionTimeMs = Date.now() - startTime;
                // 5. Parse JSON response
                let parsed;
                try {
                    parsed = JSON.parse(llmResponse);
                }
                catch (error) {
                    logger_1.default.error("❌ Failed to parse SecurityAgent JSON response", {
                        llmResponse,
                        error,
                    });
                    // Fallback: allow message if parsing fails
                    return {
                        safe: true,
                        message: options.message,
                        blockedReason: "JSON parse error",
                        tokensUsed,
                        executionTimeMs,
                    };
                }
                // 6. Extract result
                const safe = parsed.safe !== false;
                const userMessage2 = parsed.message || parsed.userMessage || options.message;
                const blockedReason = parsed.blockedReason || parsed.reason;
                // 7. If BLOCKED, call sendAlertEmail to notify admin
                if (!safe && blockedReason) {
                    logger_1.default.warn("🚫 SecurityAgent BLOCKED message", {
                        reason: blockedReason,
                        customerId: options.customerId,
                        workspaceId: options.workspaceId,
                    });
                    // Call sendAlertEmail to notify admin
                    try {
                        logger_1.default.warn("🚨 Security Alert - Message Blocked", {
                            reason: blockedReason,
                            customerId: options.customerId,
                            workspaceId: options.workspaceId,
                            message: options.message.substring(0, 200),
                        });
                        // TODO: Integrate with notification service to send actual email alerts
                    }
                    catch (alertError) {
                        logger_1.default.error("❌ Failed to log security alert", alertError);
                        // Don't fail the security check if alert logging fails
                    }
                }
                logger_1.default.info("✅ SecurityAgent completed", {
                    safe,
                    blocked: !safe,
                    blockedReason,
                    tokensUsed,
                    executionTimeMs,
                });
                return {
                    safe,
                    message: userMessage2,
                    blockedReason,
                    tokensUsed,
                    executionTimeMs,
                    systemPrompt: securityAgent.systemPrompt,
                };
            }
            catch (error) {
                logger_1.default.error("❌ SecurityAgent error", error);
                // On error, allow message (fail-open for availability)
                return {
                    safe: true,
                    message: options.message,
                    blockedReason: `Security check error: ${error instanceof Error ? error.message : "Unknown error"}`,
                    tokensUsed: 0,
                    executionTimeMs: Date.now() - startTime,
                };
            }
        });
    }
    /**
     * Build system prompt with template variable replacement
     *
     * @param basePrompt - Base prompt from database
     * @param variables - Template variables for replacement
     * @returns Processed system prompt
     */
    buildSystemPrompt(basePrompt, variables) {
        let prompt = basePrompt;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, "g");
            prompt = prompt.replace(regex, value);
        }
        return prompt;
    }
}
exports.SecurityAgent = SecurityAgent;
//# sourceMappingURL=SecurityAgent.js.map