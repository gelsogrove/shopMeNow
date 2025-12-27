"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityAgentService = void 0;
const database_1 = require("../config/database");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Security Agent Service for Scheduler
 *
 * Validates outgoing messages before they are sent via WhatsApp.
 * Uses pattern-based detection for common threats:
 * - SQL Injection
 * - XSS attacks
 * - Command injection
 * - Sensitive data exposure
 * - Spam/abuse patterns
 */
class SecurityAgentService {
    constructor() {
        // Dangerous patterns to detect
        this.dangerousPatterns = [
            // SQL Injection patterns
            { pattern: /(\bSELECT\b.*\bFROM\b|\bDROP\b.*\bTABLE\b|\bUNION\b.*\bSELECT\b)/i, reason: 'SQL injection detected' },
            { pattern: /(\bINSERT\b.*\bINTO\b|\bUPDATE\b.*\bSET\b|\bDELETE\b.*\bFROM\b)/i, reason: 'SQL modification attempt' },
            // XSS patterns  
            { pattern: /<script[\s\S]*?>[\s\S]*?<\/script>/i, reason: 'Script injection detected' },
            { pattern: /javascript:/i, reason: 'JavaScript protocol detected' },
            { pattern: /on(load|error|click|mouse|focus|blur|submit|change)=/i, reason: 'Event handler injection' },
            { pattern: /<iframe[\s\S]*?>/i, reason: 'Iframe injection detected' },
            // Command injection
            { pattern: /[;&|`$].*?(rm|cat|wget|curl|chmod|chown|sudo|bash|sh|nc|netcat)\b/i, reason: 'Command injection detected' },
            // Command substitution - only match actual shell patterns, not markdown backticks
            // $(command) or `command` with actual command-like content inside
            { pattern: /\$\([^)]*[a-z_][a-z0-9_]*\s/i, reason: 'Command substitution detected' },
            // Path traversal
            { pattern: /\.\.\/|\.\.\\|%2e%2e%2f/i, reason: 'Path traversal detected' },
            { pattern: /\/etc\/passwd|\/etc\/shadow/i, reason: 'Sensitive file access attempt' },
            // Sensitive data patterns (prevent accidental exposure)
            { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, reason: 'Credit card number detected' },
            { pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/i, reason: 'IBAN detected' },
            // Spam/abuse patterns
            { pattern: /(viagra|cialis|casino|lottery|winner|congratulations.*won|claim.*prize)/i, reason: 'Spam content detected' },
        ];
    }
    /**
     * Validate a message before sending
     */
    async validateMessage(params) {
        const { workspaceId, messageContent, customerId } = params;
        // 1. Check for empty message
        if (!messageContent || messageContent.trim().length === 0) {
            return { isSafe: false, reason: 'Empty message' };
        }
        // 2. Check customer is not blacklisted
        try {
            const customer = await database_1.prisma.customers.findUnique({
                where: {
                    id: customerId,
                    workspaceId, // Workspace isolation
                },
                select: { isBlacklisted: true },
            });
            if (customer?.isBlacklisted) {
                logger_1.default.warn(`🚫 Message blocked: Customer ${customerId} is blacklisted`);
                return { isSafe: false, reason: 'Customer is blacklisted' };
            }
        }
        catch (error) {
            logger_1.default.error('Failed to check customer blacklist status:', error);
            // Don't block on error - proceed with pattern check
        }
        // 3. Check for dangerous patterns
        for (const { pattern, reason } of this.dangerousPatterns) {
            if (pattern.test(messageContent)) {
                logger_1.default.warn(`🚫 Message blocked: ${reason}`, {
                    workspaceId,
                    customerId,
                    pattern: pattern.source,
                });
                return { isSafe: false, reason };
            }
        }
        // 4. Check message length (prevent extremely long messages)
        if (messageContent.length > 10000) {
            return { isSafe: false, reason: 'Message too long (max 10000 chars)' };
        }
        // Message passed all checks
        return { isSafe: true };
    }
}
exports.SecurityAgentService = SecurityAgentService;
//# sourceMappingURL=security-agent.service.js.map