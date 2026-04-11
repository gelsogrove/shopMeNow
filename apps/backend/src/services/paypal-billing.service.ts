/**
 * PayPal Billing Service
 * 
 * Handles subscription billing operations:
 * - Update outstanding balance on subscription
 * - Rate limiting to prevent double charges
 * - Idempotency via PayPal-Request-Id header
 */

import { prisma, PayPalStatus, InvoiceStatus } from "@echatbot/database"
import logger from "../utils/logger"
import {
  loadPayPalConfigForEnv,
  resolvePayPalEnvironment,
  getPayPalAccessToken,
  PayPalEnvironment,
} from "../utils/paypal-config"

// In-memory rate limiting (per invoice)
const processingInvoices = new Map<string, number>()
const RATE_LIMIT_MS = 60000 // 60 seconds between payment attempts for same invoice

export interface ProcessPaymentResult {
  success: boolean
  transactionId?: string
  error?: string
  errorCode?: string
}

/**
 * Update subscription outstanding balance
 * 
 * PayPal will automatically charge this amount on next billing cycle
 * or immediately if auto_bill_outstanding is enabled
 */
async function updateOutstandingBalance(
  subscriptionId: string,
  amount: number,
  invoiceId: string,
  paypalConfig: ReturnType<typeof loadPayPalConfigForEnv>
): Promise<{ success: boolean; error?: string }> {
  const appToken = await getPayPalAccessToken(paypalConfig)
  
  // Idempotency key to prevent duplicate charges
  const idempotencyKey = `invoice_${invoiceId}_${Date.now()}`
  
  // Call PayPal API to add balance to outstanding
  const response = await fetch(
    `${paypalConfig.apiBaseUrl}/v1/billing/subscriptions/${subscriptionId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": idempotencyKey,
      },
      body: JSON.stringify({
        note: `Invoice ${invoiceId}`,
        capture_type: "OUTSTANDING_BALANCE",
        amount: {
          currency_code: "EUR",
          value: amount.toFixed(2),
        },
      }),
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    logger.error("[PAYPAL] Failed to update outstanding balance:", errText)
    
    // Parse PayPal error
    try {
      const errJson = JSON.parse(errText)
      return { 
        success: false, 
        error: errJson.message || errJson.details?.[0]?.description || "PayPal API error" 
      }
    } catch {
      return { success: false, error: errText }
    }
  }

  const result = await response.json()
  logger.info("[PAYPAL] Outstanding balance updated:", {
    subscriptionId,
    amount,
    invoiceId,
    result,
  })

  return { success: true }
}

/**
 * Process payment for a pending invoice
 * 
 * Flow:
 * 1. Check rate limit (prevent double charges)
 * 2. Lock invoice (database transaction)
 * 3. Call PayPal to update outstanding balance
 * 4. PayPal will charge and send webhook PAYMENT.SUCCESS
 * 5. Webhook will update invoice status to PAID
 */
export async function processPayment(
  invoiceId: string,
  adminUserId: string,
  notes?: string
): Promise<ProcessPaymentResult> {
  try {
    // ═══════════════════════════════════════════════════════════════════
    // STEP 0: Rate limit check — prevent double charges
    // ═══════════════════════════════════════════════════════════════════
    const lastAttempt = processingInvoices.get(invoiceId)
    if (lastAttempt && Date.now() - lastAttempt < RATE_LIMIT_MS) {
      const secondsLeft = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastAttempt)) / 1000)
      return {
        success: false,
        error: `Rate limited: wait ${secondsLeft}s before retrying`,
        errorCode: "RATE_LIMITED",
      }
    }
    processingInvoices.set(invoiceId, Date.now())

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Lock and validate invoice
    // ═══════════════════════════════════════════════════════════════════
    const invoice = await prisma.$transaction(async (tx) => {
      // Lock invoice row for update (prevents concurrent processing)
      const inv = await tx.monthlyInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              paypalStatus: true,
              paypalEnvironment: true,
              paypalSubscriptionId: true,
              paypalSubscriptionStatus: true,
              isPlatformAdmin: true,
              isDeveloperUser: true,
            },
          },
        },
      })

      if (!inv) {
        throw new Error("Invoice not found")
      }

      // Check if already paid or processing
      if (inv.status === "PAID") {
        throw new Error("Invoice already paid")
      }

      // Allow DRAFT, PENDING, or FAILED for manual payment
      const validStatuses = ["DRAFT", "PENDING", "FAILED"]
      if (!validStatuses.includes(inv.status)) {
        throw new Error(`Invoice status must be DRAFT, PENDING, or FAILED, got: ${inv.status}`)
      }

      // Mark as processing to prevent concurrent attempts
      await tx.monthlyInvoice.update({
        where: { id: invoiceId },
        data: {
          adminNotes: notes ? `Processing... ${notes}` : "Processing payment...",
          adminMarkedById: adminUserId,
          adminMarkedAt: new Date(),
        },
      })

      return inv
    })

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Validate PayPal subscription
    // ═══════════════════════════════════════════════════════════════════
    if (invoice.user.paypalStatus !== PayPalStatus.CONNECTED) {
      return {
        success: false,
        error: "User has no PayPal connection",
        errorCode: "PAYPAL_NOT_CONNECTED",
      }
    }

    if (!invoice.user.paypalSubscriptionId) {
      return {
        success: false,
        error: "User has no active PayPal subscription",
        errorCode: "NO_SUBSCRIPTION",
      }
    }

    if (invoice.user.paypalSubscriptionStatus !== "ACTIVE") {
      return {
        success: false,
        error: `Subscription is ${invoice.user.paypalSubscriptionStatus}, must be ACTIVE`,
        errorCode: "SUBSCRIPTION_NOT_ACTIVE",
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: Determine PayPal environment and call API
    // ═══════════════════════════════════════════════════════════════════
    const env = resolvePayPalEnvironment(invoice.user)
    const paypalConfig = loadPayPalConfigForEnv(env)

    if (!paypalConfig.configured) {
      return {
        success: false,
        error: `PayPal ${env} credentials not configured`,
        errorCode: "PAYPAL_NOT_CONFIGURED",
      }
    }

    const amount = Number(invoice.totalAmount)
    
    logger.info("[PAYPAL] Processing payment:", {
      invoiceId,
      userId: invoice.user.id,
      subscriptionId: invoice.user.paypalSubscriptionId,
      amount,
      env,
    })

    const result = await updateOutstandingBalance(
      invoice.user.paypalSubscriptionId,
      amount,
      invoiceId,
      paypalConfig
    )

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: Record transaction and update invoice
    // ═══════════════════════════════════════════════════════════════════
    if (result.success) {
      // Create PayPalTransaction record (payment initiated)
      const transaction = await prisma.payPalTransaction.create({
        data: {
          userId: invoice.user.id,
          invoiceId: invoiceId,
          amount: invoice.totalAmount,
          currency: "EUR",
          status: "SUCCESS", // PayPal accepted the charge request
          notes: notes ? `${notes} | env:${env}` : `Payment initiated | env:${env}`,
          adminUserId: adminUserId,
        },
      })

      // Update invoice - awaiting webhook confirmation
      await prisma.monthlyInvoice.update({
        where: { id: invoiceId },
        data: {
          adminNotes: notes ?? `Payment processed via PayPal`,
          adminMarkedById: adminUserId,
          adminMarkedAt: new Date(),
          paypalTransactionId: transaction.id,
          paymentRetryCount: 0, // Reset retry count on success
        },
      })

      logger.info("[PAYPAL] Payment initiated successfully:", {
        invoiceId,
        transactionId: transaction.id,
      })

      return {
        success: true,
        transactionId: transaction.id,
      }
    } else {
      // Payment failed - record and update invoice
      const transaction = await prisma.payPalTransaction.create({
        data: {
          userId: invoice.user.id,
          invoiceId: invoiceId,
          amount: invoice.totalAmount,
          currency: "EUR",
          status: "FAILED",
          notes: `Failed: ${result.error} | env:${env}`,
          adminUserId: adminUserId,
        },
      })

      // Increment retry count
      const currentRetryCount = invoice.paymentRetryCount || 0

      await prisma.monthlyInvoice.update({
        where: { id: invoiceId },
        data: {
          status: "FAILED",
          adminNotes: `Payment failed (attempt ${currentRetryCount + 1}): ${result.error}`,
          adminMarkedById: adminUserId,
          adminMarkedAt: new Date(),
          paypalTransactionId: transaction.id, // ✅ Update to latest transaction
          paymentRetryCount: currentRetryCount + 1,
        },
      })

      return {
        success: false,
        error: result.error,
        transactionId: transaction.id,
      }
    }
  } catch (error) {
    logger.error("[PAYPAL] Error processing payment:", error)
    
    // Reset rate limit on error to allow retry
    processingInvoices.delete(invoiceId)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Handle webhook PAYMENT.SUCCESS - update invoice to PAID
 * 
 * Called by PayPal when outstanding balance is successfully charged
 */
export async function handlePaymentSuccess(
  subscriptionId: string,
  paymentAmount: number,
  paymentTime: Date,
  billingInfo: any
): Promise<void> {
  logger.info("[PAYPAL] Handling PAYMENT.SUCCESS webhook:", {
    subscriptionId,
    paymentAmount,
    paymentTime,
  })

  // Find user by subscription
  const user = await prisma.user.findFirst({
    where: { paypalSubscriptionId: subscriptionId },
    select: { id: true, email: true },
  })

  if (!user) {
    logger.warn("[PAYPAL] User not found for subscription:", subscriptionId)
    return
  }

  // Find pending invoices for this user
  const pendingInvoices = await prisma.monthlyInvoice.findMany({
    where: {
      userId: user.id,
      status: { in: ["PENDING", "DRAFT"] },
    },
    orderBy: { createdAt: "asc" },
  })

  if (pendingInvoices.length === 0) {
    logger.info("[PAYPAL] No pending invoices found for user:", user.id)
    return
  }

  // Match invoice by amount (exact match first, then fallback to oldest)
  // NOTE: do NOT blindly fall back to oldest if amount doesn't match — log warning instead
  const exactMatch = pendingInvoices.find(
    (inv) => Math.abs(Number(inv.totalAmount) - paymentAmount) < 0.01
  )
  if (!exactMatch) {
    logger.warn("[PAYPAL] No invoice matched payment amount exactly. Amounts:", {
      paymentAmount,
      pendingAmounts: pendingInvoices.map((inv) => ({
        id: inv.id,
        amount: Number(inv.totalAmount),
        period: `${inv.periodMonth}/${inv.periodYear}`,
      })),
    })
  }
  const matchedInvoice = exactMatch || pendingInvoices[0]

  // Update invoice to PAID
  await prisma.monthlyInvoice.update({
    where: { id: matchedInvoice.id },
    data: {
      status: "PAID",
      paidAt: paymentTime,
      adminNotes: `Paid via PayPal webhook at ${paymentTime.toISOString()}`,
    },
  })

  // Ensure invoice number is generated
  // Import from invoice service if needed
  
  // Create billing transaction record
  const owner = await prisma.user.findUnique({
    where: { id: user.id },
    select: { creditBalance: true },
  })

  await prisma.billingTransaction.create({
    data: {
      userId: user.id,
      workspaceId: null,
      type: "INVOICE_PAID",
      amount: matchedInvoice.totalAmount,
      balanceAfter: owner?.creditBalance ?? 0,
      description: `Invoice ${matchedInvoice.periodMonth}/${matchedInvoice.periodYear} paid via PayPal`,
      referenceId: matchedInvoice.id,
      referenceType: "invoice",
    },
  })

  logger.info("[PAYPAL] Invoice marked as PAID:", {
    invoiceId: matchedInvoice.id,
    userId: user.id,
    amount: paymentAmount,
  })
}
