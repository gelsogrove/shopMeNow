"use strict";
/**
 * Billing Middleware
 * Feature 185: Subscription & Billing System
 *
 * Middleware for:
 * - checkCredit: Verify sufficient credit before operations
 * - checkPlanLimits: Verify workspace is within plan limits
 * - checkTrialValid: Verify trial is not expired
 *
 * SECURITY: All middleware validate workspaceId from authenticated request
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
exports.requireOwnerForBilling = exports.checkBillingRequirements = exports.checkTrialValid = exports.checkPlanLimits = exports.checkCredit = void 0;
const database_1 = require("@echatbot/database");
const subscription_billing_service_1 = require("../../../application/services/subscription-billing.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
// prisma imported
const billingService = new subscription_billing_service_1.SubscriptionBillingService(database_1.prisma);
/**
 * Factory function to create credit check middleware
 * @param operation - Type of operation to check credit for
 */
const checkCredit = (operation) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const workspaceId = req.workspaceId || req.params.workspaceId;
            if (!workspaceId) {
                res.status(400).json({
                    error: "Workspace ID required",
                    code: "WORKSPACE_REQUIRED",
                });
                return;
            }
            // Get operation cost
            const cost = yield billingService.getOperationCost(workspaceId, operation);
            // Check credit
            const creditCheck = yield billingService.checkCredit(workspaceId, cost);
            if (!creditCheck.hasSufficientCredit) {
                logger_1.default.warn(`[BILLING] ⚠️ Credit check failed for ${operation}: €${creditCheck.currentBalance.toFixed(2)} < €${cost.toFixed(2)} (workspace: ${workspaceId})`);
                res.status(402).json({
                    error: "Credito insufficiente",
                    code: "INSUFFICIENT_CREDIT",
                    details: {
                        currentBalance: creditCheck.currentBalance,
                        requiredAmount: creditCheck.requiredAmount,
                        deficit: creditCheck.deficit,
                        operation,
                    },
                    message: `Credito insufficiente. Saldo attuale: €${creditCheck.currentBalance.toFixed(2)}, Richiesto: €${cost.toFixed(2)}. Ricarica il tuo credito per continuare.`,
                });
                return;
            }
            // Store cost in request for later deduction
            ;
            req.operationCost = cost;
            req.operationType = operation;
            next();
        }
        catch (error) {
            logger_1.default.error("[BILLING] Error in checkCredit middleware:", error);
            res.status(500).json({
                error: "Errore verifica credito",
                code: "CREDIT_CHECK_ERROR",
            });
        }
    });
};
exports.checkCredit = checkCredit;
/**
 * Factory function to create plan limits check middleware
 * @param limitType - Type of limit to check
 */
const checkPlanLimits = (limitType) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const workspaceId = req.workspaceId || req.params.workspaceId;
            if (!workspaceId) {
                res.status(400).json({
                    error: "Workspace ID required",
                    code: "WORKSPACE_REQUIRED",
                });
                return;
            }
            const limitCheck = yield billingService.checkPlanLimits(workspaceId, limitType);
            if (!limitCheck.withinLimits) {
                const limitMessages = {
                    products: "prodotti",
                    customers: "clienti",
                    channels: "canali",
                };
                logger_1.default.warn(`[BILLING] ⚠️ Plan limit reached for ${limitType}: ${limitCheck.current}/${limitCheck.max} (workspace: ${workspaceId})`);
                res.status(403).json({
                    error: "Limite piano raggiunto",
                    code: "PLAN_LIMIT_REACHED",
                    details: {
                        limitType,
                        current: limitCheck.current,
                        max: limitCheck.max,
                    },
                    message: `Hai raggiunto il limite massimo di ${limitMessages[limitType]} per il tuo piano (${limitCheck.current}/${limitCheck.max}). Passa a un piano superiore per aumentare i limiti.`,
                });
                return;
            }
            next();
        }
        catch (error) {
            logger_1.default.error("[BILLING] Error in checkPlanLimits middleware:", error);
            res.status(500).json({
                error: "Errore verifica limiti piano",
                code: "PLAN_LIMITS_CHECK_ERROR",
            });
        }
    });
};
exports.checkPlanLimits = checkPlanLimits;
/**
 * Middleware to check if trial is valid (not expired)
 * Blocks access for FREE_TRIAL users with expired trial
 */
const checkTrialValid = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const workspaceId = req.workspaceId || req.params.workspaceId;
        if (!workspaceId) {
            res.status(400).json({
                error: "Workspace ID required",
                code: "WORKSPACE_REQUIRED",
            });
            return;
        }
        const trialStatus = yield billingService.isTrialValid(workspaceId);
        if (trialStatus.isTrialPlan && !trialStatus.isValid) {
            logger_1.default.warn(`[BILLING] ⚠️ Trial expired for workspace: ${workspaceId} (expired: ${(_a = trialStatus.expiredAt) === null || _a === void 0 ? void 0 : _a.toISOString()})`);
            res.status(403).json({
                error: "Trial scaduto",
                code: "TRIAL_EXPIRED",
                details: {
                    expiredAt: trialStatus.expiredAt,
                },
                message: "Il tuo periodo di prova è scaduto. Scegli un piano per continuare ad usare eChatbot.",
            });
            return;
        }
        // Add trial info to request for potential UI hints
        ;
        req.trialInfo = trialStatus;
        next();
    }
    catch (error) {
        logger_1.default.error("[BILLING] Error in checkTrialValid middleware:", error);
        res.status(500).json({
            error: "Errore verifica trial",
            code: "TRIAL_CHECK_ERROR",
        });
    }
});
exports.checkTrialValid = checkTrialValid;
/**
 * Middleware to check both trial validity AND credit before an operation
 * Combines checkTrialValid + checkCredit for protected operations
 */
const checkBillingRequirements = (operation) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const workspaceId = req.workspaceId || req.params.workspaceId;
            if (!workspaceId) {
                res.status(400).json({
                    error: "Workspace ID required",
                    code: "WORKSPACE_REQUIRED",
                });
                return;
            }
            // 1. Check trial validity
            const trialStatus = yield billingService.isTrialValid(workspaceId);
            if (trialStatus.isTrialPlan && !trialStatus.isValid) {
                res.status(403).json({
                    error: "Trial scaduto",
                    code: "TRIAL_EXPIRED",
                    message: "Il tuo periodo di prova è scaduto. Scegli un piano per continuare.",
                });
                return;
            }
            // 2. Check credit
            const cost = yield billingService.getOperationCost(workspaceId, operation);
            const creditCheck = yield billingService.checkCredit(workspaceId, cost);
            if (!creditCheck.hasSufficientCredit) {
                res.status(402).json({
                    error: "Credito insufficiente",
                    code: "INSUFFICIENT_CREDIT",
                    details: {
                        currentBalance: creditCheck.currentBalance,
                        requiredAmount: creditCheck.requiredAmount,
                        deficit: creditCheck.deficit,
                    },
                    message: `Credito insufficiente. Ricarica per continuare.`,
                });
                return;
            }
            // Store for later use
            ;
            req.operationCost = cost;
            req.operationType = operation;
            req.trialInfo = trialStatus;
            next();
        }
        catch (error) {
            logger_1.default.error("[BILLING] Error in checkBillingRequirements middleware:", error);
            res.status(500).json({
                error: "Errore verifica billing",
                code: "BILLING_CHECK_ERROR",
            });
        }
    });
};
exports.checkBillingRequirements = checkBillingRequirements;
/**
 * Middleware to require Owner role for billing operations
 * Uses the existing workspace-auth middleware pattern
 */
const requireOwnerForBilling = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const workspaceId = req.workspaceId || req.params.workspaceId;
        if (!user || !workspaceId) {
            res.status(401).json({
                error: "Authentication required",
                code: "AUTH_REQUIRED",
            });
            return;
        }
        // Check user role in workspace
        const userWorkspace = yield database_1.prisma.userWorkspace.findFirst({
            where: {
                userId: user.id,
                workspaceId,
            },
            select: {
                role: true,
            },
        });
        if (!userWorkspace) {
            res.status(403).json({
                error: "Non hai accesso a questo workspace",
                code: "NO_WORKSPACE_ACCESS",
            });
            return;
        }
        // Only SUPER_ADMIN (Owner) can modify billing
        if (userWorkspace.role !== "SUPER_ADMIN") {
            logger_1.default.warn(`[BILLING] ⚠️ Non-owner attempted billing operation: user ${user.id}, role ${userWorkspace.role}, workspace ${workspaceId}`);
            res.status(403).json({
                error: "Solo il proprietario può modificare le impostazioni di billing",
                code: "OWNER_REQUIRED",
                message: "Questa operazione richiede i permessi di proprietario del canale.",
            });
            return;
        }
        next();
    }
    catch (error) {
        logger_1.default.error("[BILLING] Error in requireOwnerForBilling middleware:", error);
        res.status(500).json({
            error: "Errore verifica permessi",
            code: "PERMISSION_CHECK_ERROR",
        });
    }
});
exports.requireOwnerForBilling = requireOwnerForBilling;
//# sourceMappingURL=billing.middleware.js.map