/**
 * Month-end billing run.
 *
 * Contract (Andrea, 2026-08-11):
 * - Runs on the 1st of each month and ALWAYS bills the PREVIOUS month.
 * - One invoice per owner: subscription fee + recharges of the period
 *   (consumption is informational only — it was already paid from credit).
 * - The invoice is generated and numbered REGARDLESS of the payment outcome:
 *   if the PayPal transaction fails the invoice stays FAILED and surfaces in
 *   the backoffice Collections page, where the operator retries manually
 *   (soft block — the operator decides, nothing is blocked automatically).
 * - First partial month: no subscription fee. The fee comes from the plan
 *   snapshotted on the invoice (invoice.planType), so an owner upgraded
 *   mid-month starts paying the fee from the first FULL month.
 *
 * Idempotent & re-runnable: invoices are unique per (userId, year, month),
 * finalize skips non-DRAFT invoices, the charge claims attempts atomically
 * and PAID invoices are skipped — a crashed run can simply be re-launched.
 */

import { prisma } from "@echatbot/database"
import logger from "../utils/logger"
import { InvoiceService } from "../application/services/invoice.service"
import {
  paypalInvoiceChargeService,
  MAX_PAYMENT_ATTEMPTS,
} from "./paypal-invoice-charge.service"

export interface MonthEndBillingSummary {
  periodYear: number
  periodMonth: number
  ownersProcessed: number
  invoicesPaid: number
  invoicesFailed: number
  invoicesSkipped: number
  errors: number
}

const invoiceService = new InvoiceService()

/**
 * Resolve the period to bill: the month BEFORE the reference date.
 */
export const resolvePreviousPeriod = (
  reference: Date = new Date()
): { periodYear: number; periodMonth: number } => {
  const previous = new Date(reference.getFullYear(), reference.getMonth() - 1, 1)
  return { periodYear: previous.getFullYear(), periodMonth: previous.getMonth() + 1 }
}

/**
 * Maintenance steps ported from the retired apps/scheduler monthly-billing
 * job (wallet-deduction model, removed 2026-08-11 when billing moved to
 * PayPal collection):
 * 1. Apply pending plan changes (downgrades scheduled for this cycle) —
 *    BEFORE invoicing, so the change affects the NEW month while the closed
 *    month keeps its invoice.planType snapshot.
 * 2. Pause owners whose FREE_TRIAL expired before the month started.
 */
async function applyPendingPlansAndExpireTrials(reference: Date): Promise<void> {
  const firstOfCurrentMonth = new Date(reference.getFullYear(), reference.getMonth(), 1)

  const pendingOwners = await prisma.user.findMany({
    where: {
      deletedAt: null,
      pendingPlanType: { not: null },
      pendingPlanEffectiveDate: { lte: firstOfCurrentMonth },
    },
    select: { id: true, email: true, planType: true, pendingPlanType: true },
  })

  for (const owner of pendingOwners) {
    await prisma.user.update({
      where: { id: owner.id },
      data: {
        planType: owner.pendingPlanType!,
        pendingPlanType: null,
        pendingPlanEffectiveDate: null,
        planStartedAt: new Date(),
      },
    })
    logger.info(
      `[MONTH-END] 📋 Applied pending plan change for ${owner.email}: ${owner.planType} → ${owner.pendingPlanType}`
    )
  }

  const expiredTrials = await prisma.user.updateMany({
    where: {
      deletedAt: null,
      planType: "FREE_TRIAL",
      subscriptionStatus: { not: "PAUSED" },
      trialEndsAt: { lt: firstOfCurrentMonth },
    },
    data: { subscriptionStatus: "PAUSED", pausedAt: new Date() },
  })

  if (expiredTrials.count > 0) {
    logger.info(`[MONTH-END] ⏸️ Paused ${expiredTrials.count} owners with expired free trials`)
  }
}

export async function runMonthEndBilling(
  reference: Date = new Date()
): Promise<MonthEndBillingSummary> {
  const { periodYear, periodMonth } = resolvePreviousPeriod(reference)

  await applyPendingPlansAndExpireTrials(reference)

  const summary: MonthEndBillingSummary = {
    periodYear,
    periodMonth,
    ownersProcessed: 0,
    invoicesPaid: 0,
    invoicesFailed: 0,
    invoicesSkipped: 0,
    errors: 0,
  }

  logger.info(
    `[MONTH-END] 🧾 Billing run started for ${String(periodMonth).padStart(2, "0")}/${periodYear}`
  )

  // Owners on a paying plan, plus owners that already have an invoice for the
  // period (covers plan changes after the period ended).
  const [payingOwners, ownersWithInvoice] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null, planType: { not: "FREE_TRIAL" } },
      select: { id: true, email: true },
    }),
    prisma.monthlyInvoice.findMany({
      where: { periodYear, periodMonth },
      select: { userId: true, user: { select: { email: true } } },
    }),
  ])

  const owners = new Map<string, string>()
  for (const owner of payingOwners) owners.set(owner.id, owner.email)
  for (const row of ownersWithInvoice) owners.set(row.userId, row.user.email)

  for (const [userId, email] of owners) {
    summary.ownersProcessed++
    try {
      const invoiceData = await invoiceService.getOrCreateInvoiceForPeriod(
        userId,
        periodYear,
        periodMonth
      )

      if (invoiceData.status === "PAID" || invoiceData.status === "CANCELLED") {
        summary.invoicesSkipped++
        continue
      }

      // DRAFT → PENDING (recalculates totals; no-op when already finalized)
      await invoiceService.finalizeInvoice(invoiceData.id)

      // The invoice is ISSUED now, whatever happens to the payment
      await invoiceService.ensureInvoiceNumber(invoiceData.id, reference)

      const result = await paypalInvoiceChargeService.chargeInvoice(
        invoiceData.id,
        "SCHEDULER"
      )

      if (result.status === "PAID") {
        summary.invoicesPaid++
      } else if (result.status === "FAILED") {
        summary.invoicesFailed++
        logger.warn(
          `[MONTH-END] Invoice for ${email} FAILED (${result.reason}) — visible in Collections for operator retry (max ${MAX_PAYMENT_ATTEMPTS} attempts)`
        )
      } else {
        summary.invoicesSkipped++
      }
    } catch (error) {
      summary.errors++
      logger.error(`[MONTH-END] ❌ Error billing owner ${email}:`, error)
    }
  }

  logger.info(
    `[MONTH-END] ✅ Billing run finished for ${String(periodMonth).padStart(2, "0")}/${periodYear}: ` +
      `${summary.ownersProcessed} owners — ${summary.invoicesPaid} paid, ` +
      `${summary.invoicesFailed} failed (→ Collections), ${summary.invoicesSkipped} skipped, ${summary.errors} errors`
  )

  return summary
}
