/**
 * PayPal one-off checkout for CREDIT RECHARGES (credit-wallet model).
 *
 * The ONLY way money enters the platform: the owner pays a PayPal order,
 * the backend captures it server-side and only then credits the wallet.
 * The old direct-credit endpoint (credited without collecting money) was
 * removed on 2026-08-11 together with the recurring-subscription machinery.
 *
 * Idempotency: paypal_transactions.paypalOrderId is UNIQUE. A capture that
 * already has a SUCCESS row returns without crediting again.
 */

import { prisma } from "@echatbot/database"
import logger from "../utils/logger"
import {
  getPayPalAccessToken,
  loadPayPalConfigForEnv,
  resolvePayPalEnvironment,
  PayPalUserFlags,
} from "../utils/paypal-config"
import { SubscriptionBillingService } from "../application/services/subscription-billing.service"

export const RECHARGE_MIN_EUR = 10
export const RECHARGE_MAX_EUR = 1000

export interface CheckoutUser extends PayPalUserFlags {
  id: string
  email: string
}

export const isValidRechargeAmount = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= RECHARGE_MIN_EUR &&
  value <= RECHARGE_MAX_EUR

export const buildRechargeOrderPayload = (
  userId: string,
  amount: number,
  frontendUrl: string
) => ({
  intent: "CAPTURE",
  purchase_units: [
    {
      custom_id: userId,
      description: "eChatbot credit recharge",
      amount: {
        currency_code: "EUR",
        value: amount.toFixed(2),
      },
    },
  ],
  application_context: {
    brand_name: "eChatbot",
    user_action: "PAY_NOW",
    shipping_preference: "NO_SHIPPING",
    return_url: `${frontendUrl}/billing?recharge=return`,
    cancel_url: `${frontendUrl}/billing?recharge=cancelled`,
  },
})

/**
 * Pull the fields that matter out of a PayPal capture response.
 * Exported for unit tests — the security checks in captureRechargeOrder
 * (owner match, COMPLETED status) build on exactly these values.
 */
export const extractCaptureResult = (
  captureJson: any
): { completed: boolean; customId: string | null; amount: number | null; captureId: string | null } => {
  const unit = captureJson?.purchase_units?.[0]
  const capture = unit?.payments?.captures?.[0]
  return {
    completed: captureJson?.status === "COMPLETED" && capture?.status === "COMPLETED",
    customId: capture?.custom_id ?? unit?.custom_id ?? null,
    amount: capture?.amount?.value != null ? Number(capture.amount.value) : null,
    captureId: capture?.id ?? null,
  }
}

const resolveFrontendUrl = (): string =>
  process.env.FRONTEND_URL || "http://localhost:3000"

export class PayPalCheckoutService {
  private billingService = new SubscriptionBillingService(prisma)

  async createRechargeOrder(
    user: CheckoutUser,
    amount: number
  ): Promise<{ orderId: string; approveUrl: string; environment: string }> {
    if (!isValidRechargeAmount(amount)) {
      throw Object.assign(
        new Error(`Amount must be between €${RECHARGE_MIN_EUR} and €${RECHARGE_MAX_EUR}`),
        { statusCode: 400 }
      )
    }

    const environment = resolvePayPalEnvironment(user)
    const paypalConfig = loadPayPalConfigForEnv(environment)
    if (!paypalConfig.configured) {
      throw Object.assign(
        new Error(`PayPal is not configured for ${environment} environment`),
        { statusCode: 503 }
      )
    }

    const accessToken = await getPayPalAccessToken(paypalConfig)
    const response = await fetch(`${paypalConfig.apiBaseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(
        buildRechargeOrderPayload(user.id, amount, resolveFrontendUrl())
      ),
    })

    const json: any = await response.json()
    if (!response.ok || !json?.id) {
      logger.error("[PAYPAL-CHECKOUT] Order creation failed", { status: response.status, json })
      throw new Error("Failed to create PayPal order")
    }

    const approveUrl = (json.links || []).find((l: any) => l.rel === "approve")?.href
    if (!approveUrl) {
      throw new Error("PayPal order has no approval link")
    }

    logger.info(
      `[PAYPAL-CHECKOUT] 🛒 Order ${json.id} created (${environment}) for ${user.email}: €${amount.toFixed(2)}`
    )

    return { orderId: json.id, approveUrl, environment }
  }

  async captureRechargeOrder(
    user: CheckoutUser,
    orderId: string
  ): Promise<{
    amount: number
    newBalance: number
    upgradedToPlan?: string
    alreadyCaptured: boolean
  }> {
    const existing = await prisma.payPalTransaction.findUnique({
      where: { paypalOrderId: orderId },
      select: { status: true, amount: true, userId: true },
    })

    if (existing?.status === "SUCCESS") {
      if (existing.userId !== user.id) {
        throw Object.assign(new Error("Order belongs to another user"), { statusCode: 403 })
      }
      const balance = await this.billingService.getOwnerCreditBalance(user.id)
      return {
        amount: Number(existing.amount),
        newBalance: balance,
        alreadyCaptured: true,
      }
    }

    const environment = resolvePayPalEnvironment(user)
    const paypalConfig = loadPayPalConfigForEnv(environment)
    const accessToken = await getPayPalAccessToken(paypalConfig)

    const response = await fetch(
      `${paypalConfig.apiBaseUrl}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const json: any = await response.json()
    const result = extractCaptureResult(json)

    if (!response.ok || !result.completed || result.amount === null) {
      logger.error("[PAYPAL-CHECKOUT] Capture failed", { orderId, status: response.status, json })
      await prisma.payPalTransaction.create({
        data: {
          userId: user.id,
          paypalOrderId: orderId,
          amount: result.amount ?? 0,
          status: "FAILED",
          notes: `Recharge capture failed (order ${orderId})`,
        },
      })
      throw Object.assign(new Error("PayPal payment was not completed"), { statusCode: 402 })
    }

    if (result.customId && result.customId !== user.id) {
      logger.error(
        `[PAYPAL-CHECKOUT] 🚨 Order ${orderId} custom_id ${result.customId} does not match caller ${user.id}`
      )
      throw Object.assign(new Error("Order belongs to another user"), { statusCode: 403 })
    }

    await prisma.payPalTransaction.create({
      data: {
        userId: user.id,
        paypalOrderId: orderId,
        amount: result.amount,
        status: "SUCCESS",
        notes: `Credit recharge via PayPal checkout (capture ${result.captureId})`,
      },
    })

    const credited = await this.billingService.rechargeOwnerCredit(user.id, result.amount)

    logger.info(
      `[PAYPAL-CHECKOUT] ✅ Captured €${result.amount.toFixed(2)} for ${user.email} ` +
        `(order ${orderId}). New balance: €${credited.newBalance.toFixed(2)}`
    )

    return {
      amount: result.amount,
      newBalance: credited.newBalance,
      upgradedToPlan: credited.upgradedToPlan,
      alreadyCaptured: false,
    }
  }
}

export const paypalCheckoutService = new PayPalCheckoutService()
