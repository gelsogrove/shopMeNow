/**
 * Billing Service for Scheduler
 * Feature 198: Billing Owner Refactor
 *
 * CRITICAL CHANGE (Feature 198):
 * - Credit is now deducted from OWNER (User), not Workspace
 * - workspaceId is kept in transaction for channel tracking
 * - userId is REQUIRED in all BillingTransaction records
 *
 * SECURITY: All operations are atomic (using Prisma transactions)
 * SECURITY: Always validates workspaceId and finds owner
 */
export declare class BillingService {
    /**
     * Deduct credit for a sent message
     *
     * Feature 198: Now deducts from Owner's creditBalance (shared across all workspaces)
     *
     * @param workspaceId - The workspace where message was sent (for tracking)
     * @param messageId - Optional message ID for transaction reference
     * @returns Result with success status and new balance
     */
    deductMessageCredit(workspaceId: string, messageId?: string): Promise<{
        success: boolean;
        newBalance?: number;
        amountDeducted?: number;
        error?: string;
    }>;
    /**
     * Check if owner has sufficient credit for a message
     *
     * Feature 198: Checks owner's balance, not workspace's
     *
     * @param workspaceId - The workspace to check
     * @returns true if owner has enough credit
     */
    hasOwnerCredit(workspaceId: string): Promise<boolean>;
    /**
     * Get owner's current credit balance for a workspace
     *
     * Feature 198: Returns owner's balance
     *
     * @param workspaceId - The workspace
     * @returns Owner's credit balance
     */
    getOwnerBalance(workspaceId: string): Promise<number | null>;
}
//# sourceMappingURL=billing.service.d.ts.map