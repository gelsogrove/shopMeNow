/**
 * Billing prices for the ShopME platform.
 * All prices are in EUR (€).
 * 
 * PRICING STRUCTURE:
 * - Monthly subscription: €19.00
 * - New customer: €1.50
 * - New order: €1.50
 * - Push notification: €1.00 (advertising campaigns)
 * - Human support: €0.50
 * - Message: €0.15 (per LLM message/interaction)
 */
export enum BillingPrices {
  // Monthly fixed costs
  MONTHLY_CHANNEL_COST = 19.0, // Monthly subscription

  // Per-action costs
  MESSAGE = 0.15,        // Cost per message/interaction (LLM responses)
  NEW_CUSTOMER = 1.5,    // Cost for new customer registration
  NEW_ORDER = 1.5,       // Cost for new order placement
  PUSH_CAMPAIGN = 1.0,   // Cost for push notification (advertising campaigns)
  HUMAN_SUPPORT = 0.5,   // Cost for human support escalation
}

