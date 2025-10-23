/**
 * Billing prices for the ShopME platform.
 * All prices are in EUR (€).
 *
 * PRICING STRUCTURE:
 * - Monthly subscription: €59.00
 * - New customer: €1.50
 * - New order: €1.50
 * - Push notification: €1.00 (advertising campaigns)
 * - Message: €0.15 (per LLM message/interaction)
 *
 * NOTE: Human Support is FREE - messages during support conversations
 * are already charged at €0.15 per message, so no separate fee needed.
 */
export enum BillingPrices {
  // Monthly fixed costs
  MONTHLY_CHANNEL_COST = 59.0, // Monthly subscription

  // Per-action costs
  MESSAGE = 0.15, // Cost per message/interaction (LLM responses)
  NEW_CUSTOMER = 1.5, // Cost for new customer registration
  NEW_ORDER = 1.5, // Cost for new order placement
  PUSH_CAMPAIGN = 1.0, // Cost for push notification (advertising campaigns)
}
