/**
 * PayPal anchor-price neutralizer.
 *
 * The billing mandate is opened through a €1/month "anchor" subscription:
 * PayPal refuses zero-priced plans at signup, so €1 is the minimum ticket
 * to open the variable-charge channel. Once the owner has approved the
 * mandate that price has no job left — every real collection goes through
 * outstanding_balance captures (paypal-invoice-charge.service.ts) — so this
 * service revises the SINGLE subscription price down to €0.00 and the
 * recurring €1 stops (Andrea, 2026-08-12: the owner pays the €1 once, at
 * signature, never again).
 *
 * Per-subscription revision only: the shared anchor PLAN must keep its €1
 * price, or PayPal would refuse to open mandates for new owners.
 *
 * Best-effort by design: a failed revision never blocks the approval
 * callback — the outcome is logged and can be retried through the admin
 * zero-anchors endpoint (admin-invoice-paypal.routes.ts).
 */

import logger from "../utils/logger"
import {
  getPayPalAccessToken,
  loadPayPalConfigForEnv,
} from "../utils/paypal-config"

export const ANCHOR_ZERO_PRICE = "0.00"

export interface AnchorRevisionResult {
  ok: boolean
  alreadyZero: boolean
  /** PayPal returned an approve link: the revision needs subscriber consent */
  approvalRequired: boolean
  error?: string
}

type PayPalConfig = ReturnType<typeof loadPayPalConfigForEnv>

/**
 * Read the REGULAR-cycle price currently active on the subscription.
 * Returns null when PayPal exposes no per-subscription override (the
 * subscription then follows the plan price, i.e. the €1 anchor).
 */
export const extractRegularCyclePrice = (subscriptionJson: any): string | null => {
  const cycles = subscriptionJson?.plan?.billing_cycles
  if (!Array.isArray(cycles)) return null
  const regular = cycles.find((c: any) => c.tenure_type === "REGULAR")
  return regular?.pricing_scheme?.fixed_price?.value ?? null
}

export const buildZeroPricingRevision = () => ({
  plan: {
    billing_cycles: [
      {
        sequence: 1,
        pricing_scheme: {
          fixed_price: { value: ANCHOR_ZERO_PRICE, currency_code: "EUR" },
        },
      },
    ],
  },
})

export class PayPalAnchorService {
  /**
   * Revise one subscription's anchor price to €0.00.
   * Idempotent: if the price is already zero nothing is sent to PayPal.
   */
  async zeroAnchorPricing(
    paypalConfig: PayPalConfig,
    subscriptionId: string
  ): Promise<AnchorRevisionResult> {
    if (!paypalConfig.configured) {
      return {
        ok: false,
        alreadyZero: false,
        approvalRequired: false,
        error: `PayPal not configured for ${paypalConfig.environment} environment`,
      }
    }

    const accessToken = await getPayPalAccessToken(paypalConfig)

    const getResponse = await fetch(
      `${paypalConfig.apiBaseUrl}/v1/billing/subscriptions/${subscriptionId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!getResponse.ok) {
      const error = await getResponse.text()
      return { ok: false, alreadyZero: false, approvalRequired: false, error }
    }

    const subscription = await getResponse.json()
    const currentPrice = extractRegularCyclePrice(subscription)
    if (currentPrice !== null && Number(currentPrice) === 0) {
      return { ok: true, alreadyZero: true, approvalRequired: false }
    }

    const reviseResponse = await fetch(
      `${paypalConfig.apiBaseUrl}/v1/billing/subscriptions/${subscriptionId}/revise`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildZeroPricingRevision()),
      }
    )

    if (!reviseResponse.ok) {
      const error = await reviseResponse.text()
      logger.warn(
        `[PAYPAL-ANCHOR] Revision to €0 REFUSED for ${subscriptionId}: ${error}`
      )
      return { ok: false, alreadyZero: false, approvalRequired: false, error }
    }

    const revision = await reviseResponse.json()
    const approvalRequired = Boolean(
      (revision?.links || []).find((l: any) => l.rel === "approve")
    )

    logger.info(
      `[PAYPAL-ANCHOR] ✅ Subscription ${subscriptionId} anchor price revised to €0.00` +
        (approvalRequired ? " (PayPal asks for subscriber approval)" : "")
    )

    return { ok: true, alreadyZero: false, approvalRequired }
  }
}

export const paypalAnchorService = new PayPalAnchorService()
