"use strict";
/**
 * Workspace Access Service
 * Feature 197: Billing Subscription Separation
 * Feature 198: Owner-based billing (billing checks on User, not Workspace)
 *
 * Centralized service for checking if a workspace can process messages.
 * Called BEFORE any chatbot processing (WhatsApp webhook, LLM router, push notifications).
 *
 * Blocking conditions (checked on OWNER, not workspace):
 * 1. owner.subscriptionStatus === 'PAUSED' → User paused subscription
 * 2. owner.subscriptionStatus === 'PAYMENT_FAILED' → Payment failed, service blocked
 * 3. owner.creditBalance < -10 → Credit exhausted below threshold
 * 4. workspace.channelStatus === false → WIP mode (handled separately with WIP message)
 *
 * CRITICAL (Feature 198): Billing fields are on User (Owner), NOT Workspace
 * - subscriptionStatus, creditBalance → checked from workspace.owner (User)
 * - channelStatus → still on Workspace (per-channel setting)
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
exports.WorkspaceAccessService = exports.CREDIT_MIN_THRESHOLD = void 0;
const logger_1 = __importDefault(require("../../utils/logger"));
/** Credit minimum threshold - allow negative up to -€10 */
exports.CREDIT_MIN_THRESHOLD = -10;
class WorkspaceAccessService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Check if workspace can process messages
     * Feature 198: Billing checks (subscriptionStatus, creditBalance) are on Owner (User)
     *
     * Priority order:
     * 1. Workspace inactive (soft deleted) → block
     * 2. No owner → block (shouldn't happen, but safety)
     * 3. Owner subscription paused → block ALL owner's workspaces
     * 4. Owner payment failed → block ALL owner's workspaces
     * 5. Owner credit exhausted (< -€10) → block ALL owner's workspaces
     * 6. Channel disabled → WIP mode (separate handling)
     *
     * @param workspaceId - Workspace to check
     * @param skipChannelCheck - Skip channel status check (for internal operations)
     * @returns AccessCheckResult with canProcess and blockReason
     */
    canProcessMessages(workspaceId_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, skipChannelCheck = false) {
            try {
                // Feature 198: Get workspace WITH owner billing info
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: {
                        id: true,
                        name: true,
                        isActive: true,
                        deletedAt: true,
                        channelStatus: true,
                        ownerId: true,
                        owner: {
                            select: {
                                id: true,
                                deletedAt: true,
                                subscriptionStatus: true,
                                creditBalance: true,
                            },
                        },
                    },
                });
                if (!workspace) {
                    logger_1.default.warn(`[ACCESS] Workspace not found: ${workspaceId}`);
                    return {
                        canProcess: false,
                        blockReason: "WORKSPACE_INACTIVE",
                        message: "Workspace not found",
                    };
                }
                // 1. Check if workspace is active (not soft deleted)
                if (!workspace.isActive || workspace.deletedAt) {
                    logger_1.default.info(`[ACCESS] 🚫 Workspace inactive: ${workspace.name}`);
                    return {
                        canProcess: false,
                        blockReason: "WORKSPACE_INACTIVE",
                        message: "Workspace is not active",
                        details: {
                            channelStatus: workspace.channelStatus,
                            ownerId: workspace.ownerId || undefined,
                        },
                    };
                }
                // 2. Check if workspace has owner
                if (!workspace.owner || !workspace.ownerId) {
                    logger_1.default.warn(`[ACCESS] ⚠️ Workspace has no owner: ${workspace.name}`);
                    return {
                        canProcess: false,
                        blockReason: "NO_OWNER",
                        message: "Workspace has no owner",
                        details: {
                            channelStatus: workspace.channelStatus,
                        },
                    };
                }
                const owner = workspace.owner;
                const creditBalance = Number(owner.creditBalance);
                // 2b. Check if owner is soft-deleted (deletedAt not null)
                if (owner.deletedAt) {
                    logger_1.default.warn(`[ACCESS] 🚨 Owner soft-deleted for workspace: ${workspace.name} (owner: ${workspace.ownerId})`);
                    return {
                        canProcess: false,
                        blockReason: "OWNER_DELETED",
                        message: "Account owner has been deleted. Contact support.",
                        details: {
                            subscriptionStatus: owner.subscriptionStatus,
                            creditBalance,
                            channelStatus: workspace.channelStatus,
                            ownerId: workspace.ownerId,
                        },
                    };
                }
                // 3. Check owner subscription status - PAUSED
                if (owner.subscriptionStatus === "PAUSED") {
                    logger_1.default.info(`[ACCESS] ⏸️ Owner subscription paused for workspace: ${workspace.name} (owner: ${workspace.ownerId})`);
                    return {
                        canProcess: false,
                        blockReason: "PAUSED",
                        message: "Subscription is paused. Resume to continue using the service.",
                        details: {
                            subscriptionStatus: owner.subscriptionStatus,
                            creditBalance,
                            channelStatus: workspace.channelStatus,
                            ownerId: workspace.ownerId,
                        },
                    };
                }
                // NOTE: CANCELLED status not in current schema. When added, uncomment:
                // if (owner.subscriptionStatus === "CANCELLED") {
                //   return { canProcess: false, blockReason: "CANCELLED", ... }
                // }
                // 4. Check owner subscription status - PAYMENT_FAILED
                if (owner.subscriptionStatus === "PAYMENT_FAILED") {
                    logger_1.default.info(`[ACCESS] 💳 Owner payment failed for workspace: ${workspace.name} (owner: ${workspace.ownerId})`);
                    return {
                        canProcess: false,
                        blockReason: "PAYMENT_FAILED",
                        message: "Payment failed. Please update your payment method to continue.",
                        details: {
                            subscriptionStatus: owner.subscriptionStatus,
                            creditBalance,
                            channelStatus: workspace.channelStatus,
                            ownerId: workspace.ownerId,
                        },
                    };
                }
                // 5. Check owner credit balance (allow negative up to -€10)
                if (creditBalance < exports.CREDIT_MIN_THRESHOLD) {
                    logger_1.default.info(`[ACCESS] 💰 Owner credit exhausted for workspace: ${workspace.name} (€${creditBalance.toFixed(2)} < €${exports.CREDIT_MIN_THRESHOLD}, owner: ${workspace.ownerId})`);
                    return {
                        canProcess: false,
                        blockReason: "CREDIT_EXHAUSTED",
                        message: `Credit exhausted. Balance: €${creditBalance.toFixed(2)}. Please recharge.`,
                        details: {
                            subscriptionStatus: owner.subscriptionStatus,
                            creditBalance,
                            channelStatus: workspace.channelStatus,
                            ownerId: workspace.ownerId,
                        },
                    };
                }
                // 6. Check channel status (WIP mode) - optional, still per-workspace
                if (!skipChannelCheck && workspace.channelStatus === false) {
                    logger_1.default.info(`[ACCESS] 🚧 Channel disabled (WIP mode) for workspace: ${workspace.name}`);
                    return {
                        canProcess: false,
                        blockReason: "CHANNEL_DISABLED",
                        message: "Channel is in maintenance mode",
                        details: {
                            subscriptionStatus: owner.subscriptionStatus,
                            creditBalance,
                            channelStatus: workspace.channelStatus,
                            ownerId: workspace.ownerId,
                        },
                    };
                }
                // All checks passed
                return {
                    canProcess: true,
                    details: {
                        subscriptionStatus: owner.subscriptionStatus,
                        creditBalance,
                        channelStatus: workspace.channelStatus,
                        ownerId: workspace.ownerId,
                    },
                };
            }
            catch (error) {
                logger_1.default.error("[ACCESS] Error checking workspace access:", error);
                // On error, allow processing (fail open) to not block legitimate traffic
                // The actual operation will fail if there's a real issue
                return {
                    canProcess: true,
                    message: "Access check failed, proceeding with caution",
                };
            }
        });
    }
    /**
     * Check if workspace should show WIP message
     * Used specifically for channel disabled state
     *
     * @param workspaceId - Workspace to check
     * @returns true if should show WIP message
     */
    shouldShowWIPMessage(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.canProcessMessages(workspaceId);
            return result.blockReason === "CHANNEL_DISABLED";
        });
    }
    /**
     * Check if workspace is blocked due to billing issues
     * (PAUSED, CANCELLED, PAYMENT_FAILED, or CREDIT_EXHAUSTED)
     * Feature 198: These are checked on Owner (User), affecting ALL their workspaces
     *
     * @param workspaceId - Workspace to check
     * @returns true if blocked due to billing
     */
    isBlockedDueToBilling(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.canProcessMessages(workspaceId, true); // skip channel check
            return (result.blockReason === "PAUSED" ||
                result.blockReason === "PAYMENT_FAILED" ||
                result.blockReason === "CREDIT_EXHAUSTED"
            // || result.blockReason === "CANCELLED" // TODO: Add when schema supports it
            );
        });
    }
    /**
     * Get detailed workspace access status
     * For display in admin/dashboard
     * Feature 198: Returns owner's billing status
     *
     * @param workspaceId - Workspace to check
     * @returns Detailed access status
     */
    getAccessStatus(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Feature 198: Get owner billing info
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: {
                    channelStatus: true,
                    ownerId: true,
                    owner: {
                        select: {
                            subscriptionStatus: true,
                            creditBalance: true,
                        },
                    },
                },
            });
            if (!workspace) {
                throw new Error(`Workspace not found: ${workspaceId}`);
            }
            const accessResult = yield this.canProcessMessages(workspaceId);
            const creditBalance = workspace.owner ? Number(workspace.owner.creditBalance) : 0;
            const subscriptionStatus = ((_a = workspace.owner) === null || _a === void 0 ? void 0 : _a.subscriptionStatus) || null;
            let status = "active";
            if (accessResult.blockReason === "NO_OWNER") {
                status = "no_owner";
            }
            else if (accessResult.blockReason === "PAUSED") {
                status = "paused";
            }
            else if (accessResult.blockReason === "PAYMENT_FAILED") {
                status = "payment_failed";
            }
            else if (accessResult.blockReason === "CREDIT_EXHAUSTED") {
                status = "credit_exhausted";
            }
            else if (accessResult.blockReason === "CHANNEL_DISABLED") {
                status = "wip";
            }
            return {
                status,
                canProcessMessages: accessResult.canProcess,
                creditBalance,
                subscriptionStatus,
                channelStatus: workspace.channelStatus,
                blockReason: accessResult.blockReason,
                ownerId: workspace.ownerId || undefined,
            };
        });
    }
    /**
     * Check access by owner ID (for owner-level operations)
     * Feature 198: Direct owner check without going through workspace
     *
     * @param userId - Owner's user ID
     * @returns AccessCheckResult with canProcess and blockReason
     */
    canOwnerProcess(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const owner = yield this.prisma.user.findUnique({
                    where: { id: userId },
                    select: {
                        id: true,
                        subscriptionStatus: true,
                        creditBalance: true,
                    },
                });
                if (!owner) {
                    return {
                        canProcess: false,
                        blockReason: "NO_OWNER",
                        message: "User not found",
                    };
                }
                const creditBalance = Number(owner.creditBalance);
                if (owner.subscriptionStatus === "PAUSED") {
                    return {
                        canProcess: false,
                        blockReason: "PAUSED",
                        message: "Subscription is paused. Resume to continue using the service.",
                        details: {
                            subscriptionStatus: owner.subscriptionStatus,
                            creditBalance,
                            ownerId: owner.id,
                        },
                    };
                }
                if (owner.subscriptionStatus === "PAYMENT_FAILED") {
                    return {
                        canProcess: false,
                        blockReason: "PAYMENT_FAILED",
                        message: "Payment failed. Please update your payment method to continue.",
                        details: {
                            subscriptionStatus: owner.subscriptionStatus,
                            creditBalance,
                            ownerId: owner.id,
                        },
                    };
                }
                if (creditBalance < exports.CREDIT_MIN_THRESHOLD) {
                    return {
                        canProcess: false,
                        blockReason: "CREDIT_EXHAUSTED",
                        message: `Credit exhausted. Balance: €${creditBalance.toFixed(2)}. Please recharge.`,
                        details: {
                            subscriptionStatus: owner.subscriptionStatus,
                            creditBalance,
                            ownerId: owner.id,
                        },
                    };
                }
                return {
                    canProcess: true,
                    details: {
                        subscriptionStatus: owner.subscriptionStatus,
                        creditBalance,
                        ownerId: owner.id,
                    },
                };
            }
            catch (error) {
                logger_1.default.error("[ACCESS] Error checking owner access:", error);
                return {
                    canProcess: true,
                    message: "Access check failed, proceeding with caution",
                };
            }
        });
    }
    /**
     * Alias for canOwnerProcess - more descriptive name
     * Feature 198: Direct owner check for message processing
     *
     * @param userId - Owner's user ID
     * @returns AccessCheckResult with canProcess and blockReason
     */
    canOwnerProcessMessages(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.canOwnerProcess(userId);
            // Map NO_OWNER to OWNER_NOT_FOUND for clearer API
            if (result.blockReason === "NO_OWNER") {
                return Object.assign(Object.assign({}, result), { blockReason: "OWNER_NOT_FOUND" });
            }
            return result;
        });
    }
    /**
     * Get owner access status for dashboard/admin display
     * Feature 198: Direct owner status without workspace context
     *
     * @param userId - Owner's user ID
     * @returns Detailed owner access status
     */
    getOwnerAccessStatus(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const owner = yield this.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    subscriptionStatus: true,
                    creditBalance: true,
                },
            });
            if (!owner) {
                throw new Error(`Owner not found: ${userId}`);
            }
            const accessResult = yield this.canOwnerProcess(userId);
            const creditBalance = Number(owner.creditBalance);
            let status = "active";
            if (accessResult.blockReason === "PAUSED") {
                status = "paused";
            }
            else if (accessResult.blockReason === "PAYMENT_FAILED") {
                status = "payment_failed";
            }
            else if (accessResult.blockReason === "CREDIT_EXHAUSTED") {
                status = "credit_exhausted";
            }
            return {
                status,
                canProcessMessages: accessResult.canProcess,
                creditBalance,
                subscriptionStatus: owner.subscriptionStatus,
                blockReason: accessResult.blockReason,
            };
        });
    }
}
exports.WorkspaceAccessService = WorkspaceAccessService;
//# sourceMappingURL=workspace-access.service.js.map