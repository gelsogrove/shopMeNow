import { prisma, Prisma, PlanType, SubscriptionStatus } from '../config/database'
import logger from '../utils/logger'

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
 * │ 2. TWO SEPARATE BILLING SYSTEMS (CRITICAL)                                  │
 * │    A) SUBSCRIPTION FEE (Monthly Payment)                                    │
 * │       • Fixed monthly cost: $22 Basic, $45 Premium, $140 Enterprise         │
 * │       • Paid EXTERNALLY via PayPal/Stripe on 1st of month                   │
 * │       • Covers platform access, features, and limits                        │
 * │       • ❌ DOES NOT TOUCH user.creditBalance field                          │
 * │                                                                             │
 * │    B) CREDIT BALANCE (Pay-as-you-go)                                        │
 * │       • Prepaid credits for WhatsApp operations ONLY                        │
 * │       • Used for: Messages ($0.10), Orders ($1.50), Pushes ($1.00)         │
 * │       • Recharged manually via "Ricarica" button ($10-$1000)                │
 * │       • ✅ STAYS UNCHANGED during monthly billing                           │
 * │                                                                             │
 * │ 3. SUBSCRIPTION STATUSES                                                    │
 * │    - ACTIVE: Normal operation, chatbots respond, billing active             │
 * │    - PAUSED: Chatbots blocked, NO billing (skip this owner)                 │
 * │    - PAYMENT_FAILED: Payment failed, access blocked until resolved          │
 * │    - FREE_TRIAL: Free plan, no billing until upgrade or trial expires       │
 * │    - CANCELLED: User cancelled, no billing, access blocked                  │
 * │                                                                             │
 * │ 4. PAUSE/RESUME FLOW                                                        │
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
 * │ 5. MONTHLY BILLING STEPS (this job)                                         │
 * │    Step 1: Apply pending plan changes (downgrades)                          │
 * │    Step 2: SKIP PAUSED users (no billing, no chatbot)                       │
 * │    Step 3: SKIP FREE_TRIAL users (no billing)                               │
 * │    Step 4: Calculate charge: subscription + credit debt (if negative)       │
 * │    Step 5: Process payment (external PayPal/Stripe)                         │
 * │    Step 6: On success → update status, create transaction                   │
 * │             ❌ Credit balance NOT touched (stays unchanged)                 │
 * │    Step 7: On failure → set PAYMENT_FAILED status                           │
 * │                                                                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * SECURITY: All operations are user-isolated
 * ATOMIC: Each user processed in a transaction
 */

/**
 * REAL: Payment processing via PayPal Outstanding Balance
 * When admin clicks "Process Payment", we update the subscription's outstanding balance
 * PayPal then charges the customer automatically and sends webhook PAYMENT.SUCCESS
 * 
 * This scheduler now only creates PENDING invoices - actual payment is handled manually
 * 
 * 🔧 FIX: Now accepts transaction parameter for atomic operations
 */
async function createPendingInvoice(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  subscriptionFee: number,
  creditDebt: number,
  planType: string,
  planDisplayName: string,
  periodMonth: number,
  periodYear: number
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  logger.info(`[BILLING] 📋 Creating PENDING invoice: $${amount.toFixed(2)} for user ${userId}`)
  
  try {
    const periodStart = new Date(periodYear, periodMonth - 1, 1, 0, 0, 0)
    const periodEnd = new Date(periodYear, periodMonth, 0, 23, 59, 59)
    
    // Create invoice with PENDING status - awaiting manual payment processing
    const invoice = await tx.monthlyInvoice.upsert({
      where: {
        userId_periodYear_periodMonth: {
          userId,
          periodYear,
          periodMonth,
        },
      },
      create: {
        userId,
        periodStart,
        periodEnd,
        periodMonth,
        periodYear,
        subscriptionAmount: subscriptionFee,
        creditUsage: 0,
        creditDebt: creditDebt,
        creditNotesTotal: 0,
        subtotalAmount: subscriptionFee,
        taxRate: 0,
        taxAmount: 0,
        totalAmount: amount,
        status: 'PENDING', // Ready for admin to process payment
        planType: planType as any,
        itemsBreakdown: {
          messages: { count: 0, amount: 0 },
          orders: { count: 0, amount: 0 },
          pushNotifications: { count: 0, amount: 0 },
          adjustments: { count: 0, amount: 0 },
          totalConsumption: 0,
          creditDebt: creditDebt,
          subscriptionFee: subscriptionFee,
        },
      },
      update: {
        // If already exists (e.g., was DRAFT), update to PENDING
        status: 'PENDING',
        totalAmount: amount,
        subscriptionAmount: subscriptionFee,
        creditDebt: creditDebt,
        itemsBreakdown: {
          messages: { count: 0, amount: 0 },
          orders: { count: 0, amount: 0 },
          pushNotifications: { count: 0, amount: 0 },
          adjustments: { count: 0, amount: 0 },
          totalConsumption: 0,
          creditDebt: creditDebt,
          subscriptionFee: subscriptionFee,
        },
      },
    })
    
    return {
      success: true,
      invoiceId: invoice.id,
    }
  } catch (error) {
    logger.error(`[BILLING] ❌ Failed to create invoice for user ${userId}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get first day of current month
 */
function getFirstOfCurrentMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

/**
 * Get month name for logging
 */
function getCurrentMonthName(): string {
  return new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
}

export async function monthlyBillingJob(): Promise<void> {
  const startTime = Date.now()
  const monthName = getCurrentMonthName()

  logger.info(`[BILLING] 🗓️ Starting monthly billing for ${monthName}`)
  logger.info(`[BILLING] 📢 Feature 198: Processing billing per OWNER (User), not per Workspace`)

  // ═══════════════════════════════════════════════════════════════════════════
  // FETCH ALL WORKSPACE OWNERS
  // We bill users who own workspaces, not individual workspaces
  // ═══════════════════════════════════════════════════════════════════════════
  const owners = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      ownedWorkspaces: {
        some: {
          channelStatus: true,
          deletedAt: null,
        },
      },
    },
  })

  if (owners.length === 0) {
    logger.info('[BILLING] No active workspace owners found')
    return
  }

  logger.info(`[BILLING] Processing ${owners.length} workspace owners`)

  // Get all plan configurations (cached once)
  const planConfigs = await prisma.planConfiguration.findMany({
    where: { isActive: true },
  })
  const planConfigMap = new Map(planConfigs.map(c => [c.planType, c]))

  const stats = {
    processed: 0,
    skippedPaused: 0,
    skippedFreeTrial: 0,
    pendingPlanApplied: 0,
    paymentSuccess: 0,
    paymentFailed: 0,
    errors: 0,
  }

  const today = getFirstOfCurrentMonth()

  for (const owner of owners) {
    const ownerName = `${owner.firstName} ${owner.lastName}`.trim() || owner.email
    const workspaceCount = await prisma.workspace.count({
      where: {
        ownerId: owner.id,
        channelStatus: true,
        deletedAt: null,
      },
    })

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: SKIP PAUSED USERS - No billing, no chatbot (check BEFORE transaction)
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
          : 'unknown'
        logger.info(`[BILLING] ⏸️ SKIPPING PAUSED owner: ${ownerName} (paused on ${pausedDate}, ${workspaceCount} workspaces)`)
        stats.skippedPaused++
        continue // NO BILLING for paused users
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
          logger.info(`[BILLING] ⚠️ Trial expired for ${ownerName}, blocking access`)
          await prisma.user.update({
            where: { id: owner.id },
            data: {
              subscriptionStatus: 'PAUSED', // Trial expired = paused until upgrade
            },
          })
        } else {
          logger.info(`[BILLING] 🆓 Skipping FREE_TRIAL owner: ${ownerName}`)
        }
        stats.skippedFreeTrial++
        continue
      }

      // 🔧 CRITICAL FIX: Wrap entire owner processing in transaction
      // Prevents race conditions: plan update + invoice + nextBillingDate are atomic
      // If crash mid-processing, entire owner is rolled back (no partial state)
      try {
        await prisma.$transaction(async (tx) => {
          // ═══════════════════════════════════════════════════════════════════
          // STEP 1: Apply pending plan change (downgrades) on User
          // ═══════════════════════════════════════════════════════════════════
          if (
            owner.pendingPlanType &&
            owner.pendingPlanEffectiveDate &&
            new Date(owner.pendingPlanEffectiveDate) <= today
          ) {
            logger.info(
              `[BILLING] 📋 Applying pending plan change for ${ownerName}: ${owner.planType} → ${owner.pendingPlanType}`
            )

            await tx.user.update({
              where: { id: owner.id },
              data: {
                planType: owner.pendingPlanType,
                pendingPlanType: null,
                pendingPlanEffectiveDate: null,
                planStartedAt: new Date(),
              },
            })

            // Update local reference for billing calculation
            owner.planType = owner.pendingPlanType
            stats.pendingPlanApplied++
          }

          // ═══════════════════════════════════════════════════════════════════
          // STEP 4: Calculate total charge (subscription + credit debt)
          // Credit is now on User, shared across all workspaces
          // ═══════════════════════════════════════════════════════════════════
          const planConfig = planConfigMap.get(owner.planType as PlanType)

          if (!planConfig) {
            throw new Error(`No plan config for ${owner.planType}`)
          }

          const subscriptionFee = Number((planConfig as any).monthlyFee)
          const currentBalance = Number(owner.creditBalance)

          // If credit is negative, add the debt to the charge
          const creditDebt = currentBalance < 0 ? Math.abs(currentBalance) : 0
          const totalCharge = subscriptionFee + creditDebt
          
          // Get billing month (previous month since we bill for completed month)
          const now = new Date()
          const billingMonth = now.getMonth() // 0-indexed (January = 0)
          const billingYear = billingMonth === 0 ? now.getFullYear() - 1 : now.getFullYear()
          const actualBillingMonth = billingMonth === 0 ? 12 : billingMonth // 1-indexed for display

          logger.info(
            `[BILLING] 💰 Owner ${ownerName} (${workspaceCount} workspaces): Subscription €${subscriptionFee} + Debt €${creditDebt.toFixed(2)} = Total €${totalCharge.toFixed(2)}`
          )

          // ═══════════════════════════════════════════════════════════════════
          // STEP 5: Create PENDING invoice (payment processed manually by admin)
          // ═══════════════════════════════════════════════════════════════════
          const invoiceResult = await createPendingInvoice(
            tx, // ✅ Pass transaction - atomic with plan update
            owner.id,
            totalCharge,
            subscriptionFee,
            creditDebt,
            owner.planType as string,
            (planConfig as any).displayName,
            actualBillingMonth,
            billingYear
          )

          if (!invoiceResult.success) {
            throw new Error(`Invoice creation failed: ${invoiceResult.error}`)
          }

          // ═══════════════════════════════════════════════════════════════════
          // STEP 6: Update nextBillingDate (atomic with invoice)
          // ═══════════════════════════════════════════════════════════════════
          await tx.user.update({
            where: { id: owner.id },
            data: {
              nextBillingDate: new Date(today.getFullYear(), today.getMonth() + 1, 1),
            },
          })

          logger.info(
            `[BILLING] ✅ Invoice PENDING created for ${ownerName}: €${totalCharge.toFixed(2)} (Invoice: ${invoiceResult.invoiceId})`
          )
        })

        // Transaction committed successfully
        stats.paymentSuccess++
        stats.processed++
      } catch (error) {
        // Transaction rolled back - no partial state
        logger.error(`[BILLING] ❌ Error processing owner ${ownerName}:`, error)
        stats.errors++
      }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  logger.info(`[BILLING] 🏁 Monthly billing completed in ${duration}s`)
  logger.info(`[BILLING] 📊 Stats:`)
  logger.info(`   - Owners Processed: ${stats.processed}`)
  logger.info(`   - Invoices Created: ${stats.paymentSuccess}`)
  logger.info(`   - Invoices Failed: ${stats.paymentFailed}`)
  logger.info(`   - Pending Plans Applied: ${stats.pendingPlanApplied}`)
  logger.info(`   - Skipped (Paused): ${stats.skippedPaused}`)
  logger.info(`   - Skipped (Free Trial): ${stats.skippedFreeTrial}`)
  logger.info(`   - Errors: ${stats.errors}`)
}
