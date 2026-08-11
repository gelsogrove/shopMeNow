/**
 * PayPal monthly-invoice charge executor.
 *
 * The ONLY component that collects a MonthlyInvoice via PayPal.
 * Flow per invoice: set the outstanding balance on the owner's billing
 * subscription (the mandate approved at PayPal-connect time), then capture it.
 *
 * Attempt policy (Andrea, 2026-08-11): 1 automatic attempt by the month-end
 * scheduler + up to 3 manual retries by the operator from the Collections
 * page = MAX_PAYMENT_ATTEMPTS 4. After that the operator decides: block,
 * cancel, or grant credit — nothing is blocked automatically (soft block).
 *
 * Concurrency: an attempt is CLAIMED atomically (updateMany guarded on
 * status + paymentRetryCount), so a double-fired cron or a double-clicked
 * Retry button can never produce two captures for the same attempt.
 * PayPal-side idempotency: PayPal-Request-Id = `<invoiceId>:attempt-<n>`.
 */

import { prisma } from "@echatbot/database"
import logger from "../utils/logger"
import {
  getPayPalAccessToken,
  loadPayPalConfigForEnv,
  resolvePayPalEnvironment,
  PayPalEnvironment,
} from "../utils/paypal-config"
import { InvoiceService } from "../application/services/invoice.service"

export const MAX_PAYMENT_ATTEMPTS = 4 // 1 scheduler attempt + 3 operator retries

export type ChargeTrigger = "SCHEDULER" | "ADMIN_RETRY"

export interface ChargeResult {
  success: boolean
  status: "PAID" | "FAILED" | "SKIPPED"
  reason?: string
  transactionId?: string
  attempt?: number
}

const invoiceService = new InvoiceService()

const setOutstandingBalance = async (
  paypalConfig: ReturnType<typeof loadPayPalConfigForEnv>,
  accessToken: string,
  subscriptionId: string,
  amount: number
): Promise<{ ok: boolean; error?: string }> => {
  const response = await fetch(
    `${paypalConfig.apiBaseUrl}/v1/billing/subscriptions/${subscriptionId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          op: "replace",
          path: "/billing_info/outstanding_balance",
          value: { currency_code: "EUR", value: amount.toFixed(2) },
        },
      ]),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    return { ok: false, error }
  }
  return { ok: true }
}

const captureOutstandingBalance = async (
  paypalConfig: ReturnType<typeof loadPayPalConfigForEnv>,
  accessToken: string,
  subscriptionId: string,
  amount: number,
  requestId: string,
  note: string
): Promise<{ success: boolean; transactionId?: string; status?: string; error?: string }> => {
  const response = await fetch(
    `${paypalConfig.apiBaseUrl}/v1/billing/subscriptions/${subscriptionId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": requestId,
      },
      body: JSON.stringify({
        note,
        capture_type: "OUTSTANDING_BALANCE",
        amount: { currency_code: "EUR", value: amount.toFixed(2) },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    return { success: false, error }
  }

  const capture = await response.json()
  const status = capture.status || capture.capture_status || "UNKNOWN"
  const transactionId = capture.id || capture.capture_id
  const success = status === "COMPLETED" || status === "COMPLETED_WITH_PAYMENT"
  return { success, transactionId, status, error: success ? undefined : `Capture status: ${status}` }
}

export class PayPalInvoiceChargeService {
  /**
   * Charge one PENDING/FAILED invoice through the owner's PayPal mandate.
   * Safe to call concurrently — only one caller wins the attempt claim.
   */
  async chargeInvoice(
    invoiceId: string,
    trigger: ChargeTrigger,
    adminUserId?: string
  ): Promise<ChargeResult> {
    const invoice = await prisma.monthlyInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            creditBalance: true,
            paypalSubscriptionId: true,
            paypalEnvironment: true,
            isPlatformAdmin: true,
            isDeveloperUser: true,
          },
        },
      },
    })

    if (!invoice) {
      return { success: false, status: "SKIPPED", reason: "Invoice not found" }
    }

    if (invoice.status !== "PENDING" && invoice.status !== "FAILED") {
      return {
        success: false,
        status: "SKIPPED",
        reason: `Invoice is ${invoice.status}, not chargeable`,
      }
    }

    if (invoice.paymentRetryCount >= MAX_PAYMENT_ATTEMPTS) {
      return {
        success: false,
        status: "SKIPPED",
        reason: `Attempt limit reached (${MAX_PAYMENT_ATTEMPTS}). Operator must decide: block, cancel, or grant credit.`,
      }
    }

    const totalAmount = Number(invoice.totalAmount)

    // Nothing to collect → close the invoice without touching PayPal
    if (totalAmount <= 0) {
      await invoiceService.markInvoicePaid(invoiceId)
      await prisma.monthlyInvoice.update({
        where: { id: invoiceId },
        data: { adminNotes: "Nothing to charge (total €0.00)" },
      })
      return { success: true, status: "PAID", reason: "Nothing to charge" }
    }

    if (!invoice.user.paypalSubscriptionId) {
      await this.recordFailure(invoice.id, invoice.userId, totalAmount, trigger, adminUserId,
        "No active PayPal mandate (owner never connected PayPal)")
      return { success: false, status: "FAILED", reason: "No active PayPal mandate" }
    }

    // Claim this attempt atomically: whoever increments paymentRetryCount from
    // the value we read owns the attempt. A concurrent claim finds count moved
    // and touches nothing.
    const claimed = await prisma.monthlyInvoice.updateMany({
      where: {
        id: invoiceId,
        status: { in: ["PENDING", "FAILED"] },
        paymentRetryCount: invoice.paymentRetryCount,
      },
      data: { paymentRetryCount: { increment: 1 } },
    })

    if (claimed.count === 0) {
      return {
        success: false,
        status: "SKIPPED",
        reason: "Another charge attempt for this invoice is already in progress",
      }
    }

    const attempt = invoice.paymentRetryCount + 1
    const environment = (invoice.user.paypalEnvironment as PayPalEnvironment | null)
      ?? resolvePayPalEnvironment(invoice.user)
    const paypalConfig = loadPayPalConfigForEnv(environment)

    if (!paypalConfig.configured) {
      await this.recordFailure(invoice.id, invoice.userId, totalAmount, trigger, adminUserId,
        `PayPal not configured for ${environment} environment`)
      return { success: false, status: "FAILED", reason: "PayPal not configured", attempt }
    }

    const periodLabel = `${String(invoice.periodMonth).padStart(2, "0")}/${invoice.periodYear}`

    try {
      const accessToken = await getPayPalAccessToken(paypalConfig)

      const outstanding = await setOutstandingBalance(
        paypalConfig,
        accessToken,
        invoice.user.paypalSubscriptionId,
        totalAmount
      )
      if (!outstanding.ok) {
        await this.recordFailure(invoice.id, invoice.userId, totalAmount, trigger, adminUserId,
          `Set outstanding balance failed: ${outstanding.error}`)
        return { success: false, status: "FAILED", reason: outstanding.error, attempt }
      }

      const capture = await captureOutstandingBalance(
        paypalConfig,
        accessToken,
        invoice.user.paypalSubscriptionId,
        totalAmount,
        `${invoiceId}:attempt-${attempt}`,
        `eChatbot invoice ${periodLabel}`
      )

      if (!capture.success) {
        await this.recordFailure(invoice.id, invoice.userId, totalAmount, trigger, adminUserId,
          `Capture failed: ${capture.error}`)
        return { success: false, status: "FAILED", reason: capture.error, attempt }
      }

      await prisma.payPalTransaction.create({
        data: {
          userId: invoice.userId,
          invoiceId: invoice.id,
          amount: totalAmount,
          status: "SUCCESS",
          notes: `Invoice ${periodLabel} charged via ${trigger} (attempt ${attempt}, capture ${capture.transactionId})`,
          adminUserId: adminUserId ?? null,
        },
      })

      await invoiceService.markInvoicePaid(invoice.id, capture.transactionId)

      await prisma.billingTransaction.create({
        data: {
          userId: invoice.userId,
          workspaceId: null,
          type: "INVOICE_PAID",
          amount: totalAmount,
          balanceAfter: invoice.user.creditBalance,
          description: `Invoice ${periodLabel} paid via PayPal (${trigger})`,
          referenceId: invoice.id,
          referenceType: "invoice",
        },
      })

      logger.info(
        `[INVOICE-CHARGE] ✅ Invoice ${invoice.id} (${periodLabel}) charged €${totalAmount.toFixed(2)} ` +
          `for ${invoice.user.email} — attempt ${attempt}/${MAX_PAYMENT_ATTEMPTS}, trigger ${trigger}`
      )

      return { success: true, status: "PAID", transactionId: capture.transactionId, attempt }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      await this.recordFailure(invoice.id, invoice.userId, totalAmount, trigger, adminUserId, reason)
      return { success: false, status: "FAILED", reason, attempt }
    }
  }

  private async recordFailure(
    invoiceId: string,
    userId: string,
    amount: number,
    trigger: ChargeTrigger,
    adminUserId: string | undefined,
    reason: string
  ): Promise<void> {
    logger.warn(`[INVOICE-CHARGE] ❌ Invoice ${invoiceId} charge failed (${trigger}): ${reason}`)

    await prisma.payPalTransaction.create({
      data: {
        userId,
        invoiceId,
        amount,
        status: "FAILED",
        notes: `Charge failed via ${trigger}: ${reason}`.slice(0, 500),
        adminUserId: adminUserId ?? null,
      },
    })

    await prisma.monthlyInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "FAILED",
        adminNotes: `[${new Date().toISOString()}] ${trigger}: ${reason}`.slice(0, 500),
      },
    })
  }
}

export const paypalInvoiceChargeService = new PayPalInvoiceChargeService()
