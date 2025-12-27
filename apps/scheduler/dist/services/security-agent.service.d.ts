interface SecurityCheckResult {
    isSafe: boolean;
    reason?: string;
}
interface SecurityCheckParams {
    workspaceId: string;
    messageContent: string;
    customerId: string;
}
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
export declare class SecurityAgentService {
    private readonly dangerousPatterns;
    /**
     * Validate a message before sending
     */
    validateMessage(params: SecurityCheckParams): Promise<SecurityCheckResult>;
}
export {};
//# sourceMappingURL=security-agent.service.d.ts.map