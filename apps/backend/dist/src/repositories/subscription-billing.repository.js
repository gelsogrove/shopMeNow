"use strict";
/**
 * Subscription Billing Repository
 * Feature 185: Subscription & Billing System
 * Feature 198: Owner-based billing (credit shared across all workspaces)
 *
 * Handles all database operations for:
 * - User (Owner) billing (credit balance, plan type)
 * - Billing transactions history
 * - Plan configurations
 *
 * CRITICAL (Feature 198): Billing is per OWNER (User), NOT per Workspace
 * - creditBalance, planType, subscriptionStatus are on User model
 * - workspaceId is optional in transactions (for tracking which channel)
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
exports.SubscriptionBillingRepository = void 0;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../utils/logger"));
class SubscriptionBillingRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    // ============================================================================
    // OWNER (USER) BILLING - Feature 198
    // ============================================================================
    /**
     * Get owner billing information by userId
     * Feature 198: Billing is on User (Owner) level
     */
    getOwnerBilling(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    creditBalance: true,
                    planType: true,
                    trialEndsAt: true,
                    planStartedAt: true,
                    nextBillingDate: true,
                    subscriptionStatus: true,
                },
            });
            if (!user) {
                return null;
            }
            const creditBalance = Number(user.creditBalance);
            // Calculate recharges for CURRENT month (from 1st of current month to now)
            const now = new Date();
            const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const rechargeSum = yield this.prisma.billingTransaction.aggregate({
                where: {
                    userId,
                    type: 'RECHARGE',
                    amount: { gt: 0 },
                    createdAt: {
                        gte: currentMonthStart,
                        lte: now,
                    },
                },
                _sum: { amount: true },
            });
            const totalRecharges = Number(rechargeSum._sum.amount || 0);
            const isTrialExpired = user.planType === "FREE_TRIAL" &&
                user.trialEndsAt !== null &&
                user.trialEndsAt < now;
            let daysUntilTrialExpires = null;
            if (user.planType === "FREE_TRIAL" &&
                user.trialEndsAt &&
                !isTrialExpired) {
                const diffTime = user.trialEndsAt.getTime() - now.getTime();
                daysUntilTrialExpires = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
            return {
                planType: user.planType,
                creditBalance,
                trialEndsAt: user.trialEndsAt,
                planStartedAt: user.planStartedAt,
                nextBillingDate: user.nextBillingDate,
                isTrialExpired,
                daysUntilTrialExpires,
                totalRecharges,
                subscriptionStatus: user.subscriptionStatus,
            };
        });
    }
    /**
     * Get owner billing from workspaceId (for backward compatibility)
     * Looks up the workspace owner and gets their billing
     * @deprecated Use getOwnerBilling(userId) directly when possible
     */
    getWorkspaceBilling(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { ownerId: true },
            });
            if (!(workspace === null || workspace === void 0 ? void 0 : workspace.ownerId)) {
                return null;
            }
            return this.getOwnerBilling(workspace.ownerId);
        });
    }
    /**
     * Get plan configuration/limits from database
     * NO user/workspace needed - plans are global
     */
    getPlanConfiguration(planType) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = yield this.prisma.planConfiguration.findUnique({
                where: { planType },
            });
            if (!config) {
                return null;
            }
            return {
                maxChannels: config.maxChannels,
                maxProducts: config.maxProducts,
                maxCustomers: config.maxCustomers,
                messageCost: Number(config.messageCost),
                orderCost: Number(config.orderCost),
                pushCost: Number(config.pushCost),
                lowBalanceThreshold: Number(config.lowBalanceThreshold),
                monthlyFee: Number(config.monthlyFee),
            };
        });
    }
    /**
     * Get all plan configurations for comparison
     */
    getAllPlanConfigurations() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.prisma.planConfiguration.findMany({
                where: { isActive: true },
                orderBy: { monthlyFee: "asc" },
            });
        });
    }
    /**
     * Get current credit balance for owner (user)
     * Feature 198: Credit is on User level
     */
    getOwnerCreditBalance(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.prisma.user.findUnique({
                where: { id: userId },
                select: { creditBalance: true },
            });
            return user ? Number(user.creditBalance) : 0;
        });
    }
    /**
     * Get credit balance from workspaceId (backward compatibility)
     * @deprecated Use getOwnerCreditBalance(userId) directly when possible
     */
    getCreditBalance(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { ownerId: true },
            });
            if (!(workspace === null || workspace === void 0 ? void 0 : workspace.ownerId)) {
                return 0;
            }
            return this.getOwnerCreditBalance(workspace.ownerId);
        });
    }
    // ============================================================================
    // CREDIT OPERATIONS - Feature 198 (Owner-based)
    // ============================================================================
    /**
     * Deduct credit from owner balance
     * ATOMIC TRANSACTION: Updates user balance and creates transaction record
     * Feature 198: Credit is on User level, workspaceId is optional for tracking
     *
     * @param userId - Owner's user ID
     * @param amount - Amount to deduct (positive number)
     * @param type - Transaction type
     * @param description - Human-readable description
     * @param workspaceId - Optional: which workspace/channel originated the charge
     * @param referenceId - Optional: reference to order, message, etc.
     * @param referenceType - Optional: type of reference
     * @returns New balance after deduction, or error if would go below -€10
     */
    deductCredit(userId, amount, type, description, workspaceId, referenceId, referenceType) {
        return __awaiter(this, void 0, void 0, function* () {
            // Feature 197: Credit can go negative up to -€10
            const CREDIT_MIN_THRESHOLD = -10;
            try {
                return yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    // Get current balance with lock
                    const user = yield tx.user.findUnique({
                        where: { id: userId },
                        select: { creditBalance: true, planType: true },
                    });
                    if (!user) {
                        return { success: false, newBalance: 0, error: "User not found" };
                    }
                    const currentBalance = Number(user.creditBalance);
                    const newBalance = currentBalance - amount;
                    // Feature 197: Allow negative balance up to -€10
                    if (newBalance < CREDIT_MIN_THRESHOLD) {
                        logger_1.default.warn(`[BILLING] ⚠️ Credit exhausted: €${currentBalance.toFixed(2)} - €${amount.toFixed(2)} = €${newBalance.toFixed(2)} < €${CREDIT_MIN_THRESHOLD} (user: ${userId})`);
                        return {
                            success: false,
                            newBalance: currentBalance,
                            error: `Credito esaurito. Saldo: €${currentBalance.toFixed(2)}. Il saldo non può scendere sotto €${CREDIT_MIN_THRESHOLD}.`,
                        };
                    }
                    // Update user balance (can be negative)
                    yield tx.user.update({
                        where: { id: userId },
                        data: { creditBalance: new database_1.Prisma.Decimal(newBalance.toFixed(2)) },
                    });
                    // Create transaction record
                    yield tx.billingTransaction.create({
                        data: {
                            userId,
                            workspaceId: workspaceId || null, // Optional: track which channel
                            type,
                            amount: new database_1.Prisma.Decimal((-amount).toFixed(2)), // Negative for deductions
                            balanceAfter: new database_1.Prisma.Decimal(newBalance.toFixed(2)),
                            description,
                            referenceId,
                            referenceType,
                        },
                    });
                    const channelInfo = workspaceId ? `, channel: ${workspaceId}` : '';
                    logger_1.default.info(`[BILLING] 💰 Deducted €${amount.toFixed(2)}: €${currentBalance.toFixed(2)} → €${newBalance.toFixed(2)} (${type}, user: ${userId}${channelInfo})`);
                    return { success: true, newBalance };
                }));
            }
            catch (error) {
                logger_1.default.error(`[BILLING] ❌ Failed to deduct credit:`, error);
                throw error;
            }
        });
    }
    /**
     * Add credit to owner balance (recharge)
     * ATOMIC TRANSACTION: Updates user balance and creates transaction record
     * Feature 198: Credit is on User level
     */
    addCredit(userId, amount, type, description, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    // Get current balance
                    const user = yield tx.user.findUnique({
                        where: { id: userId },
                        select: { creditBalance: true },
                    });
                    if (!user) {
                        throw new Error("User not found");
                    }
                    const currentBalance = Number(user.creditBalance);
                    const newBalance = currentBalance + amount;
                    // Update user balance
                    yield tx.user.update({
                        where: { id: userId },
                        data: { creditBalance: new database_1.Prisma.Decimal(newBalance.toFixed(2)) },
                    });
                    // Create transaction record
                    yield tx.billingTransaction.create({
                        data: {
                            userId,
                            workspaceId: workspaceId || null, // Optional: track which channel
                            type,
                            amount: new database_1.Prisma.Decimal(amount.toFixed(2)), // Positive for credits
                            balanceAfter: new database_1.Prisma.Decimal(newBalance.toFixed(2)),
                            description,
                        },
                    });
                    logger_1.default.info(`[BILLING] 💰 Added €${amount.toFixed(2)}: €${currentBalance.toFixed(2)} → €${newBalance.toFixed(2)} (${type}, user: ${userId})`);
                    return { success: true, newBalance };
                }));
            }
            catch (error) {
                logger_1.default.error(`[BILLING] ❌ Failed to add credit:`, error);
                throw error;
            }
        });
    }
    // ============================================================================
    // TRANSACTION HISTORY - Feature 198 (Owner-based)
    // ============================================================================
    /**
     * Get transaction history for owner
     * Feature 198: Transactions are per User (Owner)
     */
    getOwnerTransactionHistory(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
            const { limit = 20, offset = 0, type, startDate, endDate } = options;
            // Get owner's workspaces for workspace name lookup
            const ownerWorkspaces = yield this.prisma.workspace.findMany({
                where: { ownerId: userId, isActive: true, deletedAt: null },
                select: { id: true, name: true },
            });
            const workspaceNameMap = new Map(ownerWorkspaces.map(w => [w.id, w.name]));
            // Build where clause for owner's transactions
            const where = { userId };
            if (type) {
                where.type = type;
            }
            if (startDate || endDate) {
                where.createdAt = {};
                if (startDate)
                    where.createdAt.gte = startDate;
                if (endDate)
                    where.createdAt.lte = endDate;
            }
            const [transactions, total] = yield Promise.all([
                this.prisma.billingTransaction.findMany({
                    where,
                    orderBy: { createdAt: "desc" },
                    take: limit,
                    skip: offset,
                    select: {
                        id: true,
                        type: true,
                        amount: true,
                        balanceAfter: true,
                        description: true,
                        referenceId: true,
                        createdAt: true,
                        workspaceId: true,
                    },
                }),
                this.prisma.billingTransaction.count({ where }),
            ]);
            return {
                transactions: transactions.map((t) => (Object.assign(Object.assign({}, t), { amount: Number(t.amount), balanceAfter: Number(t.balanceAfter), workspaceName: t.workspaceId ? workspaceNameMap.get(t.workspaceId) || null : null }))),
                total,
            };
        });
    }
    /**
     * Get transaction history from workspaceId (backward compatibility)
     * @deprecated Use getOwnerTransactionHistory(userId) directly when possible
     */
    getTransactionHistory(workspaceId_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, options = {}) {
            // Get workspace owner
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { ownerId: true },
            });
            if (!(workspace === null || workspace === void 0 ? void 0 : workspace.ownerId)) {
                return { transactions: [], total: 0 };
            }
            return this.getOwnerTransactionHistory(workspace.ownerId, options);
        });
    }
    // ============================================================================
    // PLAN MANAGEMENT - Feature 198 (Owner-based)
    // ============================================================================
    /**
     * Calculate next billing date: always the 1st of next month
     */
    getFirstOfNextMonth() {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        nextMonth.setHours(0, 0, 0, 0);
        return nextMonth;
    }
    /**
     * Upgrade owner plan
     * Feature 198: Plan is on User level
     */
    upgradeOwnerPlan(userId, newPlanType) {
        return __awaiter(this, void 0, void 0, function* () {
            const nextBillingDate = this.getFirstOfNextMonth();
            yield this.prisma.user.update({
                where: { id: userId },
                data: {
                    planType: newPlanType,
                    planStartedAt: new Date(),
                    nextBillingDate,
                    trialEndsAt: null, // Clear trial when upgrading
                },
            });
            logger_1.default.info(`[BILLING] 📈 Plan upgraded to ${newPlanType} (user: ${userId}, next billing: ${nextBillingDate.toISOString()})`);
            return { success: true, nextBillingDate };
        });
    }
    /**
     * Upgrade plan from workspaceId (backward compatibility)
     * @deprecated Use upgradeOwnerPlan(userId) directly when possible
     */
    upgradePlan(workspaceId, newPlanType) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { ownerId: true },
            });
            if (!(workspace === null || workspace === void 0 ? void 0 : workspace.ownerId)) {
                throw new Error("Workspace owner not found");
            }
            return this.upgradeOwnerPlan(workspace.ownerId, newPlanType);
        });
    }
    // ============================================================================
    // USAGE TRACKING - Feature 198 (Aggregated across owner's workspaces)
    // ============================================================================
    /**
     * Get owner usage counts (aggregated across ALL owned workspaces)
     * Feature 198: Products/Customers are aggregated per Owner
     */
    getOwnerUsage(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get all workspaces owned by this user (exclude soft-deleted)
            const ownerWorkspaces = yield this.prisma.workspace.findMany({
                where: { ownerId: userId, isActive: true, deletedAt: null },
                select: { id: true },
            });
            const ownerWorkspaceIds = ownerWorkspaces.map(w => w.id);
            if (ownerWorkspaceIds.length === 0) {
                return { productsCount: 0, customersCount: 0, channelsCount: 0 };
            }
            // Aggregate counts across ALL owner's workspaces
            const [productsCount, customersCount] = yield Promise.all([
                this.prisma.products.count({
                    where: { workspaceId: { in: ownerWorkspaceIds }, isActive: true },
                }),
                this.prisma.customers.count({
                    where: { workspaceId: { in: ownerWorkspaceIds }, isActive: true },
                }),
            ]);
            return {
                productsCount,
                customersCount,
                channelsCount: ownerWorkspaces.length,
            };
        });
    }
    /**
     * Get workspace usage from workspaceId (backward compatibility)
     * @deprecated Use getOwnerUsage(userId) directly when possible
     */
    getWorkspaceUsage(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { ownerId: true },
            });
            if (!(workspace === null || workspace === void 0 ? void 0 : workspace.ownerId)) {
                // Fallback: count only for this workspace
                const [productsCount, customersCount] = yield Promise.all([
                    this.prisma.products.count({
                        where: { workspaceId, isActive: true },
                    }),
                    this.prisma.customers.count({
                        where: { workspaceId, isActive: true },
                    }),
                ]);
                return { productsCount, customersCount, channelsCount: 1 };
            }
            return this.getOwnerUsage(workspace.ownerId);
        });
    }
    // ============================================================================
    // LOW BALANCE NOTIFICATIONS - Feature 198 (Owner-based)
    // ============================================================================
    /**
     * Update low balance notification timestamp for owner
     */
    updateOwnerLowBalanceNotification(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.prisma.user.update({
                where: { id: userId },
                data: { lowBalanceNotifiedAt: new Date() },
            });
        });
    }
    /**
     * Update low balance notification from workspaceId (backward compatibility)
     * @deprecated Use updateOwnerLowBalanceNotification(userId) directly
     */
    updateLowBalanceNotification(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { ownerId: true },
            });
            if (workspace === null || workspace === void 0 ? void 0 : workspace.ownerId) {
                yield this.updateOwnerLowBalanceNotification(workspace.ownerId);
            }
        });
    }
    /**
     * Check if low balance notification was sent recently (within 24h) for owner
     */
    shouldSendOwnerLowBalanceNotification(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.prisma.user.findUnique({
                where: { id: userId },
                select: { lowBalanceNotifiedAt: true },
            });
            if (!(user === null || user === void 0 ? void 0 : user.lowBalanceNotifiedAt)) {
                return true;
            }
            const hoursSinceLastNotification = (Date.now() - user.lowBalanceNotifiedAt.getTime()) / (1000 * 60 * 60);
            return hoursSinceLastNotification >= 24;
        });
    }
    /**
     * Check low balance notification from workspaceId (backward compatibility)
     * @deprecated Use shouldSendOwnerLowBalanceNotification(userId) directly
     */
    shouldSendLowBalanceNotification(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { ownerId: true },
            });
            if (!(workspace === null || workspace === void 0 ? void 0 : workspace.ownerId)) {
                return true;
            }
            return this.shouldSendOwnerLowBalanceNotification(workspace.ownerId);
        });
    }
    // ============================================================================
    // SUBSCRIPTION STATUS - Feature 198 (Owner-based)
    // ============================================================================
    /**
     * Get owner subscription status
     */
    getOwnerSubscriptionStatus(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    subscriptionStatus: true,
                    pausedAt: true,
                    pauseRequestedAt: true,
                    pendingPlanType: true,
                    pendingPlanEffectiveDate: true,
                },
            });
            if (!user) {
                return null;
            }
            return {
                status: user.subscriptionStatus,
                pausedAt: user.pausedAt,
                pauseRequestedAt: user.pauseRequestedAt,
                pendingPlanType: user.pendingPlanType,
                pendingPlanEffectiveDate: user.pendingPlanEffectiveDate,
            };
        });
    }
    /**
     * Update owner subscription status
     */
    updateOwnerSubscriptionStatus(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.prisma.user.update({
                where: { id: userId },
                data,
            });
        });
    }
}
exports.SubscriptionBillingRepository = SubscriptionBillingRepository;
//# sourceMappingURL=subscription-billing.repository.js.map