import { prisma, Prisma, PlanType, computeMonthlyCharge, computeInvoiceTotals, calculateConsumptionBreakdown, getRechargesTotal } from '../config/database'
import logger from '../utils/logger'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MONTHLY BILLING JOB — credit-wallet model (single money source)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Runs on the 1st of each month at 00:05. Bills the month that just ended.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ ONE SOURCE OF MONEY: user.creditBalance (owner-level, Feature 198)          │
 * │                                                                             │
 * │  • CONSUMPTION (messages, orders, pushes, reminders) is deducted from       │
 * │    credit LIVE, operation by operation — nothing to do here.                │
 * │  • SUBSCRIPTION FEE (plan_configurations.monthlyFee + VAT at the owner's    │
 * │    users.taxRate) is deducted from credit HERE, once a month.               │
 * │  • The balance MAY go negative: the deduction always happens. Below        │
 * │    CREDIT_MIN_THRESHOLD (-€10, workspace-access.service) the chatbots       │
 * │    stop responding until the owner recharges.                               │
 * │                                                                             │
 * │ ONE FORMULA: computeMonthlyCharge / computeInvoiceTotals from               │
 * │ @echatbot/database — the same functions the backend uses for the live       │
 * │ DRAFT invoice, so month-end numbers can never diverge from the UI.          │
 * │                                                                             │
 * │ STEPS PER OWNER (atomic transaction):                                       │
 * │   1. Apply pending plan change (downgrades scheduled for this cycle)        │
 * │   2. Deduct fee+VAT from creditBalance, write a MONTHLY_FEE transaction     │
 * │      (visible in the owner's Transaction History)                           │
 * │   3. Finalize the closed month's invoice as PAID: subscription,             │
 * │      consumption breakdown, recharges, VAT — viewable and downloadable      │
 * │      as PDF from the app (invoice number is assigned at first download)     │
 * │   4. Set nextBillingDate                                                    │
 * │                                                                             │
 * │ SKIPPED: PAUSED owners (no fee, chatbots already stopped) and FREE_TRIAL    │
 * │ owners (no fee; expired trials get paused here).                            │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

interface ClosedPeriod {
  periodMonth: number
  periodYear: number
  periodStart: Date
  periodEnd: Date
}

export function getClosedPeriod(now: Date): ClosedPeriod {
  const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(firstOfCurrentMonth.getTime() - 1)
  const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1, 0, 0, 0)
  return {
    periodMonth: periodStart.getMonth() + 1,
    periodYear: periodStart.getFullYear(),
    periodStart,
    periodEnd,
  }
}

async function chargeOwnerAndFinalizeInvoice(
  tx: Prisma.TransactionClient,
  owner: {
    id: string
    email: string
    creditBalance: Prisma.Decimal | number
    taxRate: Prisma.Decimal | number
    planType: string
  },
  monthlyFee: number,
  planDisplayName: string,
  period: ClosedPeriod
): Promise<{ chargeAmount: number; newBalance: number; invoiceId: string }> {
  const taxRate = Number(owner.taxRate)
  const { chargeAmount } = computeMonthlyCharge(monthlyFee, taxRate)
  const newBalance = Number(owner.creditBalance) - chargeAmount

  await tx.user.update({
    where: { id: owner.id },
    data: { creditBalance: newBalance },
  })

  await tx.billingTransaction.create({
    data: {
      userId: owner.id,
      type: 'MONTHLY_FEE',
      amount: -chargeAmount,
      balanceAfter: newBalance,
      description: `Monthly subscription ${planDisplayName} ${period.periodMonth}/${period.periodYear} (incl. VAT ${(taxRate * 100).toFixed(0)}%)`,
      referenceType: 'monthly_billing',
    },
  })

  const [consumption, rechargesAmount] = await Promise.all([
    calculateConsumptionBreakdown(tx as any, owner.id, period.periodStart, period.periodEnd),
    getRechargesTotal(tx as any, owner.id, period.periodStart, period.periodEnd),
  ])

  const existingInvoice = await tx.monthlyInvoice.findUnique({
    where: {
      userId_periodYear_periodMonth: {
        userId: owner.id,
        periodYear: period.periodYear,
        periodMonth: period.periodMonth,
      },
    },
    select: { id: true },
  })

  const adjustmentsAggregate = existingInvoice
    ? await tx.invoiceAdjustment.aggregate({
        where: { invoiceId: existingInvoice.id },
        _sum: { amount: true },
      })
    : { _sum: { amount: 0 } }
  const adjustmentsAmount = Number(adjustmentsAggregate._sum.amount || 0)

  const { subtotalAmount, taxAmount, totalAmount } = computeInvoiceTotals(
    monthlyFee,
    adjustmentsAmount,
    rechargesAmount,
    taxRate
  )

  const creditDebt = newBalance < 0 ? Math.abs(newBalance) : 0
  const paidAt = new Date()

  const invoice = await tx.monthlyInvoice.upsert({
    where: {
      userId_periodYear_periodMonth: {
        userId: owner.id,
        periodYear: period.periodYear,
        periodMonth: period.periodMonth,
      },
    },
    create: {
      userId: owner.id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      periodMonth: period.periodMonth,
      periodYear: period.periodYear,
      subscriptionAmount: monthlyFee,
      creditUsage: consumption.totalConsumption,
      creditDebt,
      creditNotesTotal: 0,
      subtotalAmount,
      taxRate,
      taxAmount,
      totalAmount,
      status: 'PAID',
      paidAt,
      planType: owner.planType as any,
      itemsBreakdown: consumption as any,
    },
    update: {
      subscriptionAmount: monthlyFee,
      creditUsage: consumption.totalConsumption,
      creditDebt,
      subtotalAmount,
      taxRate,
      taxAmount,
      totalAmount,
      status: 'PAID',
      paidAt,
      planType: owner.planType as any,
      itemsBreakdown: consumption as any,
    },
  })

  return { chargeAmount, newBalance, invoiceId: invoice.id }
}

export async function monthlyBillingJob(): Promise<void> {
  const startTime = Date.now()
  const now = new Date()
  const period = getClosedPeriod(now)

  logger.info(`[BILLING] 🗓️ Starting monthly billing for ${period.periodMonth}/${period.periodYear}`)

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

  const planConfigs = await prisma.planConfiguration.findMany({
    where: { isActive: true },
  })
  const planConfigMap = new Map(planConfigs.map(c => [c.planType, c]))

  const stats = {
    charged: 0,
    skippedPaused: 0,
    skippedFreeTrial: 0,
    pendingPlanApplied: 0,
    wentNegative: 0,
    errors: 0,
  }

  const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  for (const owner of owners) {
    const ownerName = `${owner.firstName} ${owner.lastName}`.trim() || owner.email

    if (owner.subscriptionStatus === 'PAUSED') {
      logger.info(`[BILLING] ⏸️ SKIPPING PAUSED owner: ${ownerName}`)
      stats.skippedPaused++
      continue
    }

    if (owner.planType === 'FREE_TRIAL') {
      if (owner.trialEndsAt && new Date(owner.trialEndsAt) < firstOfCurrentMonth) {
        logger.info(`[BILLING] ⚠️ Trial expired for ${ownerName}, blocking access`)
        await prisma.user.update({
          where: { id: owner.id },
          data: {
            subscriptionStatus: 'PAUSED',
            pausedAt: new Date(),
          },
        })
      } else {
        logger.info(`[BILLING] 🆓 Skipping FREE_TRIAL owner: ${ownerName}`)
      }
      stats.skippedFreeTrial++
      continue
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (
          owner.pendingPlanType &&
          owner.pendingPlanEffectiveDate &&
          new Date(owner.pendingPlanEffectiveDate) <= firstOfCurrentMonth
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

          owner.planType = owner.pendingPlanType
          stats.pendingPlanApplied++
        }

        const planConfig = planConfigMap.get(owner.planType as PlanType)
        if (!planConfig) {
          throw new Error(`No plan config for ${owner.planType}`)
        }

        const monthlyFee = Number(planConfig.monthlyFee)

        const { chargeAmount, newBalance, invoiceId } = await chargeOwnerAndFinalizeInvoice(
          tx,
          owner,
          monthlyFee,
          planConfig.displayName,
          period
        )

        await tx.user.update({
          where: { id: owner.id },
          data: {
            nextBillingDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
          },
        })

        if (newBalance < 0) {
          stats.wentNegative++
        }

        logger.info(
          `[BILLING] ✅ Charged ${ownerName}: €${chargeAmount.toFixed(2)} deducted from credit ` +
            `(new balance: €${newBalance.toFixed(2)}${newBalance < 0 ? ' — IN ROSSO' : ''}). Invoice PAID: ${invoiceId}`
        )
      })

      stats.charged++
    } catch (error) {
      logger.error(`[BILLING] ❌ Error processing owner ${ownerName}:`, error)
      stats.errors++
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  logger.info(`[BILLING] 🏁 Monthly billing completed in ${duration}s`)
  logger.info(`[BILLING] 📊 Stats:`)
  logger.info(`   - Owners Charged: ${stats.charged}`)
  logger.info(`   - Went Negative: ${stats.wentNegative}`)
  logger.info(`   - Pending Plans Applied: ${stats.pendingPlanApplied}`)
  logger.info(`   - Skipped (Paused): ${stats.skippedPaused}`)
  logger.info(`   - Skipped (Free Trial): ${stats.skippedFreeTrial}`)
  logger.info(`   - Errors: ${stats.errors}`)
}
