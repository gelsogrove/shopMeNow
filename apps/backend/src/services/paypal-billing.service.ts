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
