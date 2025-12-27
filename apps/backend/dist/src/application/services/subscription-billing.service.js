"use strict";
/**
 * Subscription Billing Service
 * Feature 185: Subscription & Billing System
 * Feature 198: Owner-based billing (credit shared across all workspaces)
 *
 * Business logic for:
 * - Credit management (check, deduct, recharge)
 * - Plan management (upgrade, limits)
 * - Trial validation
 * - Usage tracking
 *
 * CRITICAL (Feature 198): Billing is per OWNER (User), NOT per Workspace
 * - creditBalance, planType, subscriptionStatus are on User model
 * - workspaceId is optional in operations (for tracking which channel)
 *
 * Methods with "workspaceId" parameter are for backward compatibility.
 * New code should use methods with "userId" parameter when possible.
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
exports.SubscriptionBillingService = void 0;
const database_1 = require("@echatbot/database");
const subscription_billing_repository_1 = require("../../repositories/subscription-billing.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
class SubscriptionBillingService {
    constructor(prisma) {
        this.prisma = prisma;
        this.repository = new subscription_billing_repository_1.SubscriptionBillingRepository(prisma);
    }
    // ============================================================================
    // OWNER-BASED BILLING INFO (Feature 198)
    // ============================================================================
    /**
     * Get complete billing overview for owner (user)
     * Feature 198: Primary method - billing is per owner
     */
    getOwnerBillingOverview(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const [billing, usage] = yield Promise.all([
                this.repository.getOwnerBilling(userId),
                this.repository.getOwnerUsage(userId),
            ]);
            if (!billing) {
                throw new Error("User not found");
            }
            const limits = yield this.repository.getPlanConfiguration(billing.planType);
            if (!limits) {
                throw new Error(`Plan configuration not found for ${billing.planType}`);
            }
            // Get plan display info
            const planConfig = yield this.prisma.planConfiguration.findUnique({
                where: { planType: billing.planType },
                select: { displayName: true, monthlyFee: true, features: true },
            });
            return {
                billing,
                limits,
                usage: Object.assign(Object.assign({}, usage), { productsPercentage: Math.round((usage.productsCount / limits.maxProducts) * 100), customersPercentage: Math.round((usage.customersCount / limits.maxCustomers) * 100), channelsPercentage: Math.round((usage.channelsCount / limits.maxChannels) * 100) }),
                planConfig: {
                    displayName: (planConfig === null || planConfig === void 0 ? void 0 : planConfig.displayName) || billing.planType,
                    monthlyFee: Number((planConfig === null || planConfig === void 0 ? void 0 : planConfig.monthlyFee) || 0),
                    features: (planConfig === null || planConfig === void 0 ? void 0 : planConfig.features)
                        ? JSON.parse(planConfig.features)
                        : [],
                },
            };
        });
    }
    /**
     * Get billing overview from workspaceId (backward compatibility)
     * @deprecated Use getOwnerBillingOverview(userId) directly when possible
     */
    getBillingOverview(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get workspace owner
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { ownerId: true },
            });
            if (!(workspace === null || workspace === void 0 ? void 0 : workspace.ownerId)) {
                throw new Error("Workspace not found or has no owner");
            }
            return this.getOwnerBillingOverview(workspace.ownerId);
        });
    }
    /**
     * Get owner credit balance
     * Feature 198: Primary method
     */
    getOwnerCreditBalance(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.repository.getOwnerCreditBalance(userId);
        });
    }
    /**
     * Get credit balance from workspaceId (backward compatibility)
     * @deprecated Use getOwnerCreditBalance(userId) directly when possible
     */
    getCreditBalance(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.repository.getCreditBalance(workspaceId);
        });
    }
    /**
     * Get all available plans for upgrade comparison
     */
    getAvailablePlans() {
        return __awaiter(this, void 0, void 0, function* () {
            const plans = yield this.repository.getAllPlanConfigurations();
            return plans.map((plan) => ({
                planType: plan.planType,
                displayName: plan.displayName,
                monthlyFee: Number(plan.monthlyFee),
                maxChannels: plan.maxChannels,
                maxProducts: plan.maxProducts,
                maxCustomers: plan.maxCustomers,
                messageCost: Number(plan.messageCost),
                orderCost: Number(plan.orderCost),
                pushCost: Number(plan.pushCost),
                features: plan.features ? JSON.parse(plan.features) : [],
            }));
        });
    }
    // ============================================================================
    // OWNER-BASED CREDIT CHECKS (Feature 198)
    // ============================================================================
    /**
     * Check if owner has sufficient credit for an operation
     * Feature 198: Primary method
     */
    checkOwnerCredit(userId, requiredAmount) {
        return __awaiter(this, void 0, void 0, function* () {
            const CREDIT_MIN_THRESHOLD = -10;
            const currentBalance = yield this.repository.getOwnerCreditBalance(userId);
            const balanceAfterDeduction = currentBalance - requiredAmount;
            return {
                hasSufficientCredit: balanceAfterDeduction >= CREDIT_MIN_THRESHOLD,
                currentBalance,
                requiredAmount,
                deficit: balanceAfterDeduction < CREDIT_MIN_THRESHOLD
                    ? Math.abs(balanceAfterDeduction - CREDIT_MIN_THRESHOLD)
                    : undefined,
            };
        });
    }
    /**
     * Check credit from workspaceId (backward compatibility)
     * @deprecated Use checkOwnerCredit(userId) directly when possible
     */
    checkCredit(workspaceId, requiredAmount) {
        return __awaiter(this, void 0, void 0, function* () {
            const CREDIT_MIN_THRESHOLD = -10;
            const currentBalance = yield this.repository.getCreditBalance(workspaceId);
            const balanceAfterDeduction = currentBalance - requiredAmount;
            return {
                hasSufficientCredit: balanceAfterDeduction >= CREDIT_MIN_THRESHOLD,
                currentBalance,
                requiredAmount,
                deficit: balanceAfterDeduction < CREDIT_MIN_THRESHOLD
                    ? Math.abs(balanceAfterDeduction - CREDIT_MIN_THRESHOLD)
                    : undefined,
            };
        });
    }
    /**
     * Check if owner's trial is valid (not expired)
     * Feature 198: Primary method
     */
    isOwnerTrialValid(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const billing = yield this.repository.getOwnerBilling(userId);
            if (!billing) {
                return {
                    isValid: false,
                    isTrialPlan: false,
                    daysRemaining: null,
                    expiredAt: null,
                };
            }
            if (billing.planType !== "FREE_TRIAL") {
                return {
                    isValid: true,
                    isTrialPlan: false,
                    daysRemaining: null,
                    expiredAt: null,
                };
            }
            return {
                isValid: !billing.isTrialExpired,
                isTrialPlan: true,
                daysRemaining: billing.daysUntilTrialExpires,
                expiredAt: billing.trialEndsAt,
            };
        });
    }
    /**
     * Check trial validity from workspaceId (backward compatibility)
     * @deprecated Use isOwnerTrialValid(userId) directly when possible
     */
    isTrialValid(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const billing = yield this.repository.getWorkspaceBilling(workspaceId);
            if (!billing) {
                return {
                    isValid: false,
                    isTrialPlan: false,
                    daysRemaining: null,
                    expiredAt: null,
                };
            }
            if (billing.planType !== "FREE_TRIAL") {
                return {
                    isValid: true,
                    isTrialPlan: false,
                    daysRemaining: null,
                    expiredAt: null,
                };
            }
            return {
                isValid: !billing.isTrialExpired,
                isTrialPlan: true,
                daysRemaining: billing.daysUntilTrialExpires,
                expiredAt: billing.trialEndsAt,
            };
        });
    }
    /**
     * Check if owner is within plan limits
     * Feature 198: Primary method - limits are aggregated across all owner's workspaces
     */
    checkOwnerPlanLimits(userId, limitType) {
        return __awaiter(this, void 0, void 0, function* () {
            const billing = yield this.repository.getOwnerBilling(userId);
            if (!billing) {
                throw new Error("User not found");
            }
            const limits = yield this.repository.getPlanConfiguration(billing.planType);
            if (!limits) {
                throw new Error(`Plan configuration not found for ${billing.planType}`);
            }
            const usage = yield this.repository.getOwnerUsage(userId);
            let current;
            let max;
            switch (limitType) {
                case "products":
                    current = usage.productsCount;
                    max = limits.maxProducts;
                    break;
                case "customers":
                    current = usage.customersCount;
                    max = limits.maxCustomers;
                    break;
                case "channels":
                    current = usage.channelsCount;
                    max = limits.maxChannels;
                    break;
            }
            return {
                withinLimits: current < max,
                current,
                max,
                limitType,
            };
        });
    }
    /**
     * Check plan limits from workspaceId (backward compatibility)
     * @deprecated Use checkOwnerPlanLimits(userId) directly when possible
     */
    checkPlanLimits(workspaceId, limitType) {
        return __awaiter(this, void 0, void 0, function* () {
            const billing = yield this.repository.getWorkspaceBilling(workspaceId);
            if (!billing) {
                throw new Error("Workspace not found");
            }
            const limits = yield this.repository.getPlanConfiguration(billing.planType);
            if (!limits) {
                throw new Error(`Plan configuration not found for ${billing.planType}`);
            }
            const usage = yield this.repository.getWorkspaceUsage(workspaceId);
            let current;
            let max;
            switch (limitType) {
                case "products":
                    current = usage.productsCount;
                    max = limits.maxProducts;
                    break;
                case "customers":
                    current = usage.customersCount;
                    max = limits.maxCustomers;
                    break;
                case "channels":
                    current = usage.channelsCount;
                    max = limits.maxChannels;
                    break;
            }
            return {
                withinLimits: current < max,
                current,
                max,
                limitType,
            };
        });
    }
    // ============================================================================
    // OWNER-BASED CREDIT OPERATIONS (Feature 198)
    // ============================================================================
    /**
     * Deduct credit for a message from owner
     * Feature 198: Primary method - credit is deducted from owner, channel is tracked
     *
     * @param userId - Owner's user ID
     * @param workspaceId - Optional: which channel sent the message
     * @param messageId - Optional: reference to the message
     */
    deductOwnerMessageCredit(userId, workspaceId, messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            const billing = yield this.repository.getOwnerBilling(userId);
            if (!billing) {
                return { success: false, newBalance: 0, error: "User not found" };
            }
            const limits = yield this.repository.getPlanConfiguration(billing.planType);
            if (!limits) {
                return {
                    success: false,
                    newBalance: 0,
                    error: "Plan configuration not found",
                };
            }
            const result = yield this.repository.deductCredit(userId, limits.messageCost, database_1.TransactionType.MESSAGE, "WhatsApp Message", workspaceId, messageId, "message");
            if (result.success) {
                yield this.checkAndNotifyOwnerLowBalance(userId, result.newBalance, limits.lowBalanceThreshold);
            }
            return result;
        });
    }
    /**
     * Deduct message credit from workspaceId (backward compatibility)
     * @deprecated Use deductOwnerMessageCredit(userId) directly when possible
     */
    deductMessageCredit(workspaceId, messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get workspace owner
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { ownerId: true },
            });
            if (!(workspace === null || workspace === void 0 ? void 0 : workspace.ownerId)) {
                return { success: false, newBalance: 0, error: "Workspace not found" };
            }
            return this.deductOwnerMessageCredit(workspace.ownerId, workspaceId, messageId);
        });
    }
    /**
     * Deduct credit for a push notification from owner
     * Feature 198: Primary method
     */
    deductOwnerPushCredit(userId, workspaceId, campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            const billing = yield this.repository.getOwnerBilling(userId);
            if (!billing) {
                return { success: false, newBalance: 0, error: "User not found" };
            }
            const limits = yield this.repository.getPlanConfiguration(billing.planType);
            if (!limits) {
                return {
                    success: false,
                    newBalance: 0,
                    error: "Plan configuration not found",
                };
            }
            const result = yield this.repository.deductCredit(userId, limits.pushCost, database_1.TransactionType.PUSH_NOTIFICATION, "Push notification", workspaceId, campaignId, "campaign");
            if (result.success) {
                yield this.checkAndNotifyOwnerLowBalance(userId, result.newBalance, limits.lowBalanceThreshold);
            }
            return result;
        });
    }
    /**
     * Deduct push credit from workspaceId (backward compatibility)
     * @deprecated Use deductOwnerPushCredit(userId) directly when possible
     */
    deductPushCredit(workspaceId, campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { ownerId: true },
            });
            if (!(workspace === null || workspace === void 0 ? void 0 : workspace.ownerId)) {
                return { success: false, newBalance: 0, error: "Workspace not found" };
            }
            return this.deductOwnerPushCredit(workspace.ownerId, workspaceId, campaignId);
        });
    }
    /**
     * Recharge credit for owner (manual top-up)
     * Feature 198: Primary method - OWNER-ONLY operation
     *
     * If owner is on FREE_TRIAL, automatically upgrades to BASIC
     */
    rechargeOwnerCredit(userId, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            if (amount <= 0) {
                throw new Error("Amount must be positive");
            }
            if (amount > 1000) {
                throw new Error("Maximum recharge amount is €1000");
            }
            const billing = yield this.repository.getOwnerBilling(userId);
            let upgradedToPlan;
            if ((billing === null || billing === void 0 ? void 0 : billing.planType) === "FREE_TRIAL") {
                yield this.repository.upgradeOwnerPlan(userId, "BASIC");
                upgradedToPlan = "BASIC";
                logger_1.default.info(`[BILLING] 🎉 User ${userId} auto-upgraded from FREE_TRIAL to BASIC on first recharge`);
            }
            // Create RECHARGE transaction
            const result = yield this.repository.addCredit(userId, amount, database_1.TransactionType.RECHARGE, `Credit recharge: €${amount.toFixed(2)}`);
            // If upgraded, create UPGRADE_FEE transaction to document the plan change
            if (upgradedToPlan === "BASIC") {
                const basicPlanConfig = yield this.repository.getPlanConfiguration("BASIC");
                const monthlyFeeStr = basicPlanConfig ? `€${basicPlanConfig.monthlyFee.toFixed(2)}/month` : "";
                yield this.repository.addCredit(userId, 0, database_1.TransactionType.UPGRADE_FEE, `Upgrade from Free Trial to ${upgradedToPlan} plan${monthlyFeeStr ? ` (${monthlyFeeStr})` : ""}`);
            }
            return Object.assign(Object.assign({}, result), { upgradedToPlan });
        });
    }
    /**
     * Recharge credit from workspaceId (backward compatibility)
     * @deprecated Use rechargeOwnerCredit(userId) directly when possible
     */
    rechargeCredit(workspaceId, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { ownerId: true },
            });
            if (!(workspace === null || workspace === void 0 ? void 0 : workspace.ownerId)) {
                throw new Error("Workspace not found");
            }
            return this.rechargeOwnerCredit(workspace.ownerId, amount);
        });
    }
    // ============================================================================
    // OWNER-BASED PLAN MANAGEMENT (Feature 198)
    // ============================================================================
    /**
     * Upgrade owner plan
     * Feature 198: Primary method - OWNER-ONLY operation
     */
    upgradeOwnerPlan(userId, newPlanType) {
        return __awaiter(this, void 0, void 0, function* () {
            if (newPlanType === "FREE_TRIAL") {
                throw new Error("Cannot upgrade to Free Trial");
            }
            const billing = yield this.repository.getOwnerBilling(userId);
            if (!billing) {
                throw new Error("User not found");
            }
            const planOrder = {
                FREE_TRIAL: 0,
                BASIC: 1,
                PREMIUM: 2,
                ENTERPRISE: 3,
            };
            if (planOrder[newPlanType] <= planOrder[billing.planType]) {
                throw new Error(`Cannot downgrade or stay on same plan. Current: ${billing.planType}, Requested: ${newPlanType}`);
            }
            const newPlanConfig = yield this.prisma.planConfiguration.findUnique({
                where: { planType: newPlanType },
                select: { displayName: true, monthlyFee: true },
            });
            if (!newPlanConfig) {
                throw new Error(`Plan configuration not found for ${newPlanType}`);
            }
            const result = yield this.repository.upgradeOwnerPlan(userId, newPlanType);
            // Log the upgrade transaction
            const monthlyFeeStr = newPlanConfig.monthlyFee ? `€${Number(newPlanConfig.monthlyFee).toFixed(2)}/month` : "";
            yield this.prisma.billingTransaction.create({
                data: {
                    userId,
                    type: database_1.TransactionType.UPGRADE_FEE,
                    amount: 0,
                    balanceAfter: billing.creditBalance,
                    description: `Upgrade to ${newPlanConfig.displayName}${monthlyFeeStr ? ` (${monthlyFeeStr})` : ""}`,
                },
            });
            logger_1.default.info(`[BILLING] 📈 User ${userId} upgraded from ${billing.planType} to ${newPlanType}`);
            return {
                success: true,
                nextBillingDate: result.nextBillingDate,
                newPlan: {
                    displayName: newPlanConfig.displayName,
                    monthlyFee: Number(newPlanConfig.monthlyFee),
                },
            };
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
                throw new Error("Workspace not found");
            }
            return this.upgradeOwnerPlan(workspace.ownerId, newPlanType);
        });
    }
    /**
     * Change owner plan (upgrade or downgrade)
     * Feature 198: Primary method - OWNER-ONLY operation
     */
    changeOwnerPlan(userId, newPlanType) {
        return __awaiter(this, void 0, void 0, function* () {
            if (newPlanType === "FREE_TRIAL") {
                throw new Error("Cannot change to Free Trial");
            }
            const billing = yield this.repository.getOwnerBilling(userId);
            if (!billing) {
                throw new Error("User not found");
            }
            const planOrder = {
                FREE_TRIAL: 0,
                BASIC: 1,
                PREMIUM: 2,
                ENTERPRISE: 3,
            };
            if (planOrder[newPlanType] === planOrder[billing.planType]) {
                throw new Error(`Already on ${billing.planType} plan`);
            }
            const isDowngrade = planOrder[newPlanType] < planOrder[billing.planType];
            if (isDowngrade) {
                const usage = yield this.repository.getOwnerUsage(userId);
                const targetPlanConfig = yield this.prisma.planConfiguration.findUnique({
                    where: { planType: newPlanType },
                    select: { maxChannels: true, maxProducts: true, maxCustomers: true },
                });
                if (!targetPlanConfig) {
                    throw new Error(`Plan configuration not found for ${newPlanType}`);
                }
                const violations = [];
                if (usage.productsCount > targetPlanConfig.maxProducts) {
                    violations.push(`Too many products: ${usage.productsCount}/${targetPlanConfig.maxProducts}`);
                }
                if (usage.customersCount > targetPlanConfig.maxCustomers) {
                    violations.push(`Too many customers: ${usage.customersCount}/${targetPlanConfig.maxCustomers}`);
                }
                if (usage.channelsCount > targetPlanConfig.maxChannels) {
                    violations.push(`Too many channels: ${usage.channelsCount}/${targetPlanConfig.maxChannels}`);
                }
                if (violations.length > 0) {
                    throw new Error(`Cannot downgrade to ${newPlanType}: ${violations.join(", ")}. Please reduce usage first.`);
                }
            }
            const newPlanConfig = yield this.prisma.planConfiguration.findUnique({
                where: { planType: newPlanType },
                select: { displayName: true, monthlyFee: true },
            });
            if (!newPlanConfig) {
                throw new Error(`Plan configuration not found for ${newPlanType}`);
            }
            const result = yield this.repository.upgradeOwnerPlan(userId, newPlanType);
            // Delete previous plan change transactions
            yield this.prisma.billingTransaction.deleteMany({
                where: {
                    userId,
                    type: database_1.TransactionType.UPGRADE_FEE,
                },
            });
            const action = isDowngrade ? "Downgrade" : "Upgrade";
            const monthlyFeeStr = newPlanConfig.monthlyFee ? `€${Number(newPlanConfig.monthlyFee).toFixed(2)}/month` : "";
            yield this.prisma.billingTransaction.create({
                data: {
                    userId,
                    type: database_1.TransactionType.UPGRADE_FEE,
                    amount: 0,
                    balanceAfter: billing.creditBalance,
                    description: `${action} to ${newPlanConfig.displayName}${monthlyFeeStr ? ` (${monthlyFeeStr})` : ""}`,
                },
            });
            const logEmoji = isDowngrade ? "📉" : "📈";
            logger_1.default.info(`[BILLING] ${logEmoji} User ${userId} ${action.toLowerCase()}d from ${billing.planType} to ${newPlanType}`);
            return {
                success: true,
                nextBillingDate: result.nextBillingDate,
                newPlan: {
                    displayName: newPlanConfig.displayName,
                    monthlyFee: Number(newPlanConfig.monthlyFee),
                },
                isDowngrade,
            };
        });
    }
    /**
     * Schedule a plan downgrade for the next billing cycle
     * Feature 198: Primary method for owner-based billing
     */
    scheduleOwnerDowngrade(userId, newPlanType) {
        return __awaiter(this, void 0, void 0, function* () {
            const billing = yield this.repository.getOwnerBilling(userId);
            if (!billing) {
                throw new Error("User not found");
            }
            const planOrder = {
                FREE_TRIAL: 0,
                BASIC: 1,
                PREMIUM: 2,
                ENTERPRISE: 3,
            };
            // Verify it's actually a downgrade
            if (planOrder[newPlanType] >= planOrder[billing.planType]) {
                throw new Error(`${newPlanType} is not a downgrade from ${billing.planType}`);
            }
            // Validate usage limits for target plan
            const usage = yield this.repository.getOwnerUsage(userId);
            const targetPlanConfig = yield this.prisma.planConfiguration.findUnique({
                where: { planType: newPlanType },
                select: { maxChannels: true, maxProducts: true, maxCustomers: true },
            });
            if (!targetPlanConfig) {
                throw new Error(`Plan configuration not found for ${newPlanType}`);
            }
            const violations = [];
            if (usage.productsCount > targetPlanConfig.maxProducts) {
                violations.push(`Prodotti: ${usage.productsCount}/${targetPlanConfig.maxProducts}`);
            }
            if (usage.customersCount > targetPlanConfig.maxCustomers) {
                violations.push(`Clienti: ${usage.customersCount}/${targetPlanConfig.maxCustomers}`);
            }
            if (usage.channelsCount > targetPlanConfig.maxChannels) {
                violations.push(`Canali: ${usage.channelsCount}/${targetPlanConfig.maxChannels}`);
            }
            if (violations.length > 0) {
                throw new Error(`Non puoi passare a ${newPlanType}: superi i limiti del piano (${violations.join(", ")}). Riduci prima l'utilizzo.`);
            }
            // Calculate effective date (1st of next month)
            const now = new Date();
            const effectiveDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            effectiveDate.setHours(0, 0, 0, 0);
            // Schedule the downgrade
            yield this.prisma.user.update({
                where: { id: userId },
                data: {
                    pendingPlanType: newPlanType,
                    pendingPlanEffectiveDate: effectiveDate,
                },
            });
            logger_1.default.info(`[BILLING] ⬇️ User ${userId} scheduled downgrade from ${billing.planType} to ${newPlanType}, effective: ${effectiveDate.toISOString()}`);
            return {
                success: true,
                effectiveDate,
                currentPlan: billing.planType,
                pendingPlan: newPlanType,
            };
        });
    }
    /**
     * Change plan from workspaceId (backward compatibility)
     * @deprecated Use changeOwnerPlan(userId) directly when possible
     */
    changePlan(workspaceId, newPlanType) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { ownerId: true },
            });
            if (!(workspace === null || workspace === void 0 ? void 0 : workspace.ownerId)) {
                throw new Error("Workspace not found");
            }
            return this.changeOwnerPlan(workspace.ownerId, newPlanType);
        });
    }
    // ============================================================================
    // OWNER-BASED TRANSACTION HISTORY (Feature 198)
    // ============================================================================
    /**
     * Get owner transaction history with pagination
     * Feature 198: Primary method
     */
    getOwnerTransactionHistory(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
            const { page = 1, limit = 20, type, startDate, endDate } = options;
            const offset = (page - 1) * limit;
            const result = yield this.repository.getOwnerTransactionHistory(userId, {
                limit,
                offset,
                type,
                startDate,
                endDate,
            });
            return {
                transactions: result.transactions,
                total: result.total,
                page,
                totalPages: Math.ceil(result.total / limit),
            };
        });
    }
    /**
     * Get transaction history from workspaceId (backward compatibility)
     * @deprecated Use getOwnerTransactionHistory(userId) directly when possible
     */
    getTransactionHistory(workspaceId_1) {
        return __awaiter(this, arguments, void 0, function* (workspaceId, options = {}) {
            const { page = 1, limit = 20, type, startDate, endDate } = options;
            const offset = (page - 1) * limit;
            const result = yield this.repository.getTransactionHistory(workspaceId, {
                limit,
                offset,
                type,
                startDate,
                endDate,
            });
            return {
                transactions: result.transactions,
                total: result.total,
                page,
                totalPages: Math.ceil(result.total / limit),
            };
        });
    }
    // ============================================================================
    // SUBSCRIPTION STATUS (Feature 197 + 198)
    // ============================================================================
    /**
     * Pause subscription for owner - IMMEDIATE effect
     * Feature 198: Primary method - affects ALL owner's workspaces
     *
     * Business logic:
     * - Pausa IMMEDIATA: chatbot smette di rispondere subito
     * - A fine mese si paga solo il consumo effettivo fino alla pausa
     * - Niente abbonamento per mesi in pausa
     */
    requestOwnerPause(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const billing = yield this.repository.getOwnerBilling(userId);
            if (!billing) {
                throw new Error("User not found");
            }
            if (billing.subscriptionStatus === "PAUSED") {
                throw new Error("Subscription is already paused");
            }
            // IMMEDIATE pause - no more PAUSE_PENDING
            const now = new Date();
            yield this.repository.updateOwnerSubscriptionStatus(userId, {
                subscriptionStatus: "PAUSED",
                pausedAt: now,
                pauseRequestedAt: now,
            });
            logger_1.default.info(`[BILLING] ⏸️ User ${userId} paused subscription IMMEDIATELY at ${now.toISOString()}`);
            return {
                success: true,
                effectiveDate: now, // Immediate effect
            };
        });
    }
    /**
     * Resume owner subscription - FREE, no charges
     * Feature 198: Primary method - resumes ALL owner's workspaces
     *
     * Business logic:
     * - Riattivazione IMMEDIATA e GRATUITA
     * - Riprende a consumare credito normalmente
     * - Pagamento abbonamento dal 1° del mese successivo
     */
    resumeOwnerSubscription(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const billing = yield this.repository.getOwnerBilling(userId);
            if (!billing) {
                throw new Error("User not found");
            }
            if (billing.subscriptionStatus === "ACTIVE") {
                throw new Error("Subscription is already active");
            }
            // Calculate next billing date (1st of next month)
            const now = new Date();
            const nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            nextBillingDate.setHours(0, 0, 0, 0);
            yield this.repository.updateOwnerSubscriptionStatus(userId, {
                subscriptionStatus: "ACTIVE",
                pausedAt: null,
                pauseRequestedAt: null,
            });
            logger_1.default.info(`[BILLING] ▶️ User ${userId} resumed subscription - FREE, next billing: ${nextBillingDate.toISOString()}`);
            return {
                success: true,
                nextBillingDate,
            };
        });
    }
    /**
     * Get owner subscription status
     * Feature 198: Primary method
     */
    getOwnerSubscriptionStatus(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const status = yield this.repository.getOwnerSubscriptionStatus(userId);
            if (!status) {
                throw new Error("User not found");
            }
            // No more PAUSE_PENDING - pause is immediate
            // Keep this for backward compatibility
            let pauseEffectiveDate = null;
            if (status.status === "PAUSED" && status.pausedAt) {
                pauseEffectiveDate = status.pausedAt;
            }
            return {
                status: status.status,
                pausedAt: status.pausedAt,
                pauseRequestedAt: status.pauseRequestedAt,
                pauseEffectiveDate,
            };
        });
    }
    // ============================================================================
    // INTERNAL HELPERS
    // ============================================================================
    /**
     * Check and send low balance notification for owner if needed
     */
    checkAndNotifyOwnerLowBalance(userId, currentBalance, threshold) {
        return __awaiter(this, void 0, void 0, function* () {
            if (currentBalance <= threshold) {
                const shouldNotify = yield this.repository.shouldSendOwnerLowBalanceNotification(userId);
                if (shouldNotify) {
                    yield this.repository.updateOwnerLowBalanceNotification(userId);
                    logger_1.default.warn(`[BILLING] ⚠️ Low balance alert: €${currentBalance.toFixed(2)} (threshold: €${threshold.toFixed(2)}, user: ${userId})`);
                    // TODO: Send email notification
                    // await emailService.sendLowBalanceAlert(userId, currentBalance)
                }
            }
        });
    }
    /**
     * @deprecated Use checkAndNotifyOwnerLowBalance
     */
    checkAndNotifyLowBalance(workspaceId, currentBalance, threshold) {
        return __awaiter(this, void 0, void 0, function* () {
            if (currentBalance <= threshold) {
                const shouldNotify = yield this.repository.shouldSendLowBalanceNotification(workspaceId);
                if (shouldNotify) {
                    yield this.repository.updateLowBalanceNotification(workspaceId);
                    logger_1.default.warn(`[BILLING] ⚠️ Low balance alert: €${currentBalance.toFixed(2)} (threshold: €${threshold.toFixed(2)}, workspace: ${workspaceId})`);
                }
            }
        });
    }
    /**
     * Get cost for a specific operation type
     */
    getOperationCost(workspaceId, operation) {
        return __awaiter(this, void 0, void 0, function* () {
            const billing = yield this.repository.getWorkspaceBilling(workspaceId);
            if (!billing) {
                throw new Error("Workspace not found");
            }
            const limits = yield this.repository.getPlanConfiguration(billing.planType);
            if (!limits) {
                throw new Error("Plan configuration not found");
            }
            switch (operation) {
                case "message":
                    return limits.messageCost;
                case "order":
                    return limits.orderCost;
                case "push":
                    return limits.pushCost;
            }
        });
    }
    /**
     * Get owner's cost for a specific operation type
     * Feature 198: Primary method
     */
    getOwnerOperationCost(userId, operation) {
        return __awaiter(this, void 0, void 0, function* () {
            const billing = yield this.repository.getOwnerBilling(userId);
            if (!billing) {
                throw new Error("User not found");
            }
            const limits = yield this.repository.getPlanConfiguration(billing.planType);
            if (!limits) {
                throw new Error("Plan configuration not found");
            }
            switch (operation) {
                case "message":
                    return limits.messageCost;
                case "order":
                    return limits.orderCost;
                case "push":
                    return limits.pushCost;
            }
        });
    }
}
exports.SubscriptionBillingService = SubscriptionBillingService;
//# sourceMappingURL=subscription-billing.service.js.map