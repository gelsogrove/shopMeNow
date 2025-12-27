"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.monthlyBillingJob = monthlyBillingJob;
const database_1 = require("../config/database");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MONTHLY BILLING JOB - Feature 198: Billing Owner Refactor
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Runs on the 1st of each month at 00:05
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ BILLING LOGIC                                                               │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │                                                                             │
 * │ 1. OWNER-BASED BILLING (Feature 198)                                        │
 * │    - Billing is per OWNER (User), not per Workspace                         │
 * │    - Credit balance is SHARED across all owner's workspaces                 │
 * │    - One subscription covers ALL workspaces owned by a user                 │
 * │                                                                             │
 * │ 2. SUBSCRIPTION STATUSES                                                    │
 * │    - ACTIVE: Normal operation, chatbots respond, billing active             │
 * │    - PAUSED: Chatbots blocked, NO billing (skip this owner)                 │
 * │    - PAYMENT_FAILED: Payment failed, access blocked until resolved          │
 * │    - FREE_TRIAL: Free plan, no billing until upgrade or trial expires       │
 * │    - CANCELLED: User cancelled, no billing, access blocked                  │
 * │                                                                             │
 * │ 3. PAUSE/RESUME FLOW                                                        │
 * │    ┌─────────────────────────────────────────────────────────────────┐      │
 * │    │ USER CLICKS "PAUSE" → IMMEDIATE:                                │      │
 * │    │   • subscriptionStatus = 'PAUSED'                               │      │
 * │    │   • pausedAt = NOW                                              │      │
 * │    │   • Chatbots stop responding IMMEDIATELY                        │      │
 * │    │   • NEXT MONTH: No billing (this job skips PAUSED users)        │      │
 * │    └─────────────────────────────────────────────────────────────────┘      │
 * │    ┌─────────────────────────────────────────────────────────────────┐      │
 * │    │ USER CLICKS "RESUME" → IMMEDIATE:                               │      │
 * │    │   • subscriptionStatus = 'ACTIVE'                               │      │
 * │    │   • pausedAt = NULL                                             │      │
 * │    │   • Chatbots start responding IMMEDIATELY                       │      │
 * │    │   • NEXT 1st OF MONTH: Billing resumes (this job processes)     │      │
 * │    └─────────────────────────────────────────────────────────────────┘      │
 * │                                                                             │
 * │ 4. MONTHLY BILLING STEPS (this job)                                         │
 * │    Step 1: Apply pending plan changes (downgrades)                          │
 * │    Step 2: SKIP PAUSED users (no billing, no chatbot)                       │
 * │    Step 3: SKIP FREE_TRIAL users (no billing)                               │
 * │    Step 4: Calculate charge: subscription + credit debt                     │
 * │    Step 5: Process payment                                                  │
 * │    Step 6: On success → reset credit, create transaction                    │
 * │    Step 7: On failure → set PAYMENT_FAILED status                           │
 * │                                                                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * SECURITY: All operations are user-isolated
 * ATOMIC: Each user processed in a transaction
 */
/**
 * MOCK: Payment processing
 * TODO: Replace with real PayPal/Stripe integration
 */
async function processPayment(userId, amount, description) {
    logger_1.default.info(`[PAYMENT MOCK] 💳 Processing €${amount.toFixed(2)} for user ${userId}`);
    logger_1.default.info(`[PAYMENT MOCK] Description: ${description}`);
    // TODO: Implement real payment processing
    // const paymentResult = await paypalService.charge(userId, amount)
    // return paymentResult
    // For now, always succeed
    return {
        success: true,
        transactionId: `MOCK_${Date.now()}_${userId.substring(0, 8)}`,
    };
}
/**
 * Get first day of current month
 */
function getFirstOfCurrentMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
}
/**
 * Get month name for logging
 */
function getCurrentMonthName() {
    return new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}
async function monthlyBillingJob() {
    const startTime = Date.now();
    const monthName = getCurrentMonthName();
    logger_1.default.info(`[BILLING] 🗓️ Starting monthly billing for ${monthName}`);
    logger_1.default.info(`[BILLING] 📢 Feature 198: Processing billing per OWNER (User), not per Workspace`);
    // ═══════════════════════════════════════════════════════════════════════════
    // FETCH ALL WORKSPACE OWNERS
    // We bill users who own workspaces, not individual workspaces
    // ═══════════════════════════════════════════════════════════════════════════
    const owners = await database_1.prisma.user.findMany({
        where: {
            status: 'ACTIVE',
            ownedWorkspaces: {
                some: {
                    isActive: true,
                    isDelete: false,
                    deletedAt: null,
                },
            },
        },
        include: {
            ownedWorkspaces: {
                where: {
                    isActive: true,
                    isDelete: false,
                    deletedAt: null,
                },
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });
    if (owners.length === 0) {
        logger_1.default.info('[BILLING] No active workspace owners found');
        return;
    }
    logger_1.default.info(`[BILLING] Processing ${owners.length} workspace owners`);
    // Get all plan configurations (cached once)
    const planConfigs = await database_1.prisma.planConfiguration.findMany({
        where: { isActive: true },
    });
    const planConfigMap = new Map(planConfigs.map(c => [c.planType, c]));
    const stats = {
        processed: 0,
        skippedPaused: 0,
        skippedFreeTrial: 0,
        pendingPlanApplied: 0,
        paymentSuccess: 0,
        paymentFailed: 0,
        errors: 0,
    };
    const today = getFirstOfCurrentMonth();
    for (const owner of owners) {
        const ownerName = `${owner.firstName} ${owner.lastName}`.trim() || owner.email;
        const workspaceCount = owner.ownedWorkspaces.length;
        try {
            // ═══════════════════════════════════════════════════════════════════
            // STEP 1: Apply pending plan change (downgrades) on User
            // ═══════════════════════════════════════════════════════════════════
            if (owner.pendingPlanType &&
                owner.pendingPlanEffectiveDate &&
                new Date(owner.pendingPlanEffectiveDate) <= today) {
                logger_1.default.info(`[BILLING] 📋 Applying pending plan change for ${ownerName}: ${owner.planType} → ${owner.pendingPlanType}`);
                await database_1.prisma.user.update({
                    where: { id: owner.id },
                    data: {
                        planType: owner.pendingPlanType,
                        pendingPlanType: null,
                        pendingPlanEffectiveDate: null,
                        planStartedAt: new Date(),
                    },
                });
                // Update local reference for billing calculation
                owner.planType = owner.pendingPlanType;
                stats.pendingPlanApplied++;
            }
            // ═══════════════════════════════════════════════════════════════════
            // STEP 2: SKIP PAUSED USERS - No billing, no chatbot
            // ═══════════════════════════════════════════════════════════════════
            // PAUSE FLOW:
            // - User clicks "Pause" → subscriptionStatus = 'PAUSED', pausedAt = NOW
            // - Chatbots stop responding IMMEDIATELY
            // - This job SKIPS paused users → NO MONTHLY CHARGE
            // - User clicks "Resume" → subscriptionStatus = 'ACTIVE', pausedAt = NULL
            // - Chatbots resume responding, next 1st of month billing resumes
            // ═══════════════════════════════════════════════════════════════════
            if (owner.subscriptionStatus === 'PAUSED') {
                const pausedDate = owner.pausedAt
                    ? new Date(owner.pausedAt).toLocaleDateString('it-IT')
                    : 'unknown';
                logger_1.default.info(`[BILLING] ⏸️ SKIPPING PAUSED owner: ${ownerName} (paused on ${pausedDate}, ${workspaceCount} workspaces)`);
                stats.skippedPaused++;
                continue; // NO BILLING for paused users
            }
            // NOTE: CANCELLED status not in current schema. When added:
            // if (owner.subscriptionStatus === 'CANCELLED') {
            //   stats.skippedCancelled++
            //   continue
            // }
            // ═══════════════════════════════════════════════════════════════════
            // STEP 3: SKIP FREE_TRIAL USERS (no subscription fee)
            // ═══════════════════════════════════════════════════════════════════
            if (owner.planType === 'FREE_TRIAL') {
                // Check if trial has expired
                if (owner.trialEndsAt && new Date(owner.trialEndsAt) < today) {
                    logger_1.default.info(`[BILLING] ⚠️ Trial expired for ${ownerName}, blocking access`);
                    await database_1.prisma.user.update({
                        where: { id: owner.id },
                        data: {
                            subscriptionStatus: 'PAUSED', // Trial expired = paused until upgrade
                        },
                    });
                }
                else {
                    logger_1.default.info(`[BILLING] 🆓 Skipping FREE_TRIAL owner: ${ownerName}`);
                }
                stats.skippedFreeTrial++;
                continue;
            }
            // ═══════════════════════════════════════════════════════════════════
            // STEP 5: Calculate total charge (subscription + credit debt)
            // Credit is now on User, shared across all workspaces
            // ═══════════════════════════════════════════════════════════════════
            const planConfig = planConfigMap.get(owner.planType);
            if (!planConfig) {
                logger_1.default.error(`[BILLING] ❌ No plan config for ${owner.planType}`);
                stats.errors++;
                continue;
            }
            const subscriptionFee = Number(planConfig.monthlyFee);
            const currentBalance = Number(owner.creditBalance);
            // If credit is negative, add the debt to the charge
            const creditDebt = currentBalance < 0 ? Math.abs(currentBalance) : 0;
            const totalCharge = subscriptionFee + creditDebt;
            logger_1.default.info(`[BILLING] 💰 Owner ${ownerName} (${workspaceCount} workspaces): Subscription €${subscriptionFee} + Debt €${creditDebt.toFixed(2)} = Total €${totalCharge.toFixed(2)}`);
            // ═══════════════════════════════════════════════════════════════════
            // STEP 6: Process payment
            // ═══════════════════════════════════════════════════════════════════
            const paymentResult = await processPayment(owner.id, totalCharge, `Monthly billing ${monthName} - ${planConfig.displayName}`);
            if (paymentResult.success) {
                // ═══════════════════════════════════════════════════════════════
                // PAYMENT SUCCESS - Update User billing fields
                // ═══════════════════════════════════════════════════════════════
                await database_1.prisma.$transaction([
                    // Reset credit balance to €0 on User
                    database_1.prisma.user.update({
                        where: { id: owner.id },
                        data: {
                            creditBalance: new database_1.Prisma.Decimal(0),
                            subscriptionStatus: 'ACTIVE',
                            paymentFailureCount: 0,
                            lastPaymentFailedAt: null,
                            nextBillingDate: new Date(today.getFullYear(), today.getMonth() + 1, 1),
                        },
                    }),
                    // Create transaction record with userId (required)
                    // workspaceId is optional (null for owner-level billing)
                    database_1.prisma.billingTransaction.create({
                        data: {
                            userId: owner.id, // Feature 198: Required field
                            workspaceId: null, // Owner-level billing, not workspace-specific
                            type: 'MONTHLY_FEE',
                            amount: new database_1.Prisma.Decimal((-totalCharge).toFixed(2)),
                            balanceAfter: new database_1.Prisma.Decimal(0),
                            description: `Monthly billing ${monthName} - ${planConfig.displayName} (€${subscriptionFee}) + Credit debt (€${creditDebt.toFixed(2)})`,
                            referenceId: paymentResult.transactionId,
                            referenceType: 'payment',
                        },
                    }),
                ]);
                logger_1.default.info(`[BILLING] ✅ Payment success for ${ownerName}: €${totalCharge.toFixed(2)} (Tx: ${paymentResult.transactionId})`);
                stats.paymentSuccess++;
            }
            else {
                // ═══════════════════════════════════════════════════════════════
                // PAYMENT FAILED - Update User status (affects all workspaces)
                // ═══════════════════════════════════════════════════════════════
                await database_1.prisma.user.update({
                    where: { id: owner.id },
                    data: {
                        subscriptionStatus: 'PAYMENT_FAILED',
                        lastPaymentFailedAt: new Date(),
                        paymentFailureCount: { increment: 1 },
                    },
                });
                // Create failed transaction record
                await database_1.prisma.billingTransaction.create({
                    data: {
                        userId: owner.id, // Feature 198: Required field
                        workspaceId: null, // Owner-level billing
                        type: 'MONTHLY_FEE',
                        amount: new database_1.Prisma.Decimal(0), // No charge
                        balanceAfter: new database_1.Prisma.Decimal(currentBalance.toFixed(2)),
                        description: `Monthly billing ${monthName} - PAYMENT FAILED: ${paymentResult.error || 'Unknown error'}`,
                    },
                });
                logger_1.default.warn(`[BILLING] ❌ Payment failed for ${ownerName} (${workspaceCount} workspaces blocked): ${paymentResult.error || 'Unknown error'}`);
                stats.paymentFailed++;
                // TODO: Send payment failed notification email
                // await emailService.sendPaymentFailedNotification(owner)
            }
            stats.processed++;
        }
        catch (error) {
            logger_1.default.error(`[BILLING] ❌ Error processing owner ${ownerName}:`, error);
            stats.errors++;
        }
    }
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger_1.default.info(`[BILLING] 🏁 Monthly billing completed in ${duration}s`);
    logger_1.default.info(`[BILLING] 📊 Stats:`);
    logger_1.default.info(`   - Owners Processed: ${stats.processed}`);
    logger_1.default.info(`   - Payment Success: ${stats.paymentSuccess}`);
    logger_1.default.info(`   - Payment Failed: ${stats.paymentFailed}`);
    logger_1.default.info(`   - Pending Plans Applied: ${stats.pendingPlanApplied}`);
    logger_1.default.info(`   - Skipped (Paused): ${stats.skippedPaused}`);
    logger_1.default.info(`   - Skipped (Free Trial): ${stats.skippedFreeTrial}`);
    logger_1.default.info(`   - Errors: ${stats.errors}`);
}
//# sourceMappingURL=monthly-billing.job.js.map