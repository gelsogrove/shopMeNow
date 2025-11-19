/**
 * 💰 BILLING PRICES - SINGLE SOURCE OF TRUTH
 *
 * ⚠️ CRITICAL: This is the ONLY place where pricing is defined
 * All backend services and frontend components MUST use these values
 *
 * To change pricing: Update values here, restart backend, frontend will auto-sync via API
 *
 * @author Andrea Gelso
 */

export enum BillingPrices {
  // 📱 MESSAGE COSTS
  MESSAGE = 0.1, // €0.10 - LLM chatbot message (conversational)
  WELCOME_MESSAGE = 1.0, // €1.00 - First message to new user (includes registration)

  // 📤 PUSH MESSAGING COSTS
  PUSH_CHATBOT_REACTIVATED = 0.2, // €0.20 - When admin enables chatbot for customer
  PUSH_DISCOUNT_NOTIFICATION = 0.2, // €0.00 - FREE - Discount update notification
  PUSH_ORDER_CONFIRMED = 1.0, // €0.00 - FREE - Order confirmation (already in NEW_ORDER cost)
  PUSH_CAMPAIGN = 1.0, // €1.00 - Marketing campaign message
  PUSH_DEFAULT = 0.2, // €0.20 - Default for other push notifications

  //  ORDER EVENTS
  NEW_ORDER = 1.0, // €1.00 - Order confirmation (includes order + push notification)

  // 🏢 SUBSCRIPTION PLANS (Monthly)
  MONTHLY_CHANNEL_COST = 59.0, // €59.00 - Per WhatsApp channel/month
  FREE_MONTHLY = 0.0, // €0.00 - Free plan
  BASIC_MONTHLY = 29.0, // €29.00 - Basic plan
  PREMIUM_MONTHLY = 59.0, // €59.00 - Premium plan
  ENTERPRISE_MONTHLY = 149.0, // €149.00 - Enterprise plan
}

/**
 * 📊 BILLING PRICES METADATA
 * Human-readable descriptions for each price type
 */
export const BillingPricesMetadata: Record<
  keyof typeof BillingPrices,
  { name: string; description: string; category: string }
> = {
  // Messages
  MESSAGE: {
    name: "LLM Message",
    description: "AI chatbot conversational response",
    category: "Messages",
  },
  WELCOME_MESSAGE: {
    name: "Welcome Message",
    description: "First message to new user (includes registration)",
    category: "Messages",
  },

  // Push Messaging
  PUSH_CHATBOT_REACTIVATED: {
    name: "Chatbot Reactivated",
    description: "Notification when admin enables chatbot",
    category: "Push Messaging",
  },
  PUSH_DISCOUNT_NOTIFICATION: {
    name: "Discount Notification",
    description: "Customer discount update (FREE)",
    category: "Push Messaging",
  },
  PUSH_ORDER_CONFIRMED: {
    name: "Order Confirmed",
    description: "Order confirmation push (FREE - included in NEW_ORDER)",
    category: "Push Messaging",
  },
  PUSH_CAMPAIGN: {
    name: "Campaign Message",
    description: "Marketing campaign push message",
    category: "Push Messaging",
  },
  PUSH_DEFAULT: {
    name: "Default Push",
    description: "Default push notification cost",
    category: "Push Messaging",
  },

  // Order Events
  NEW_ORDER: {
    name: "New Order",
    description: "Order confirmation (includes push notification)",
    category: "Order Events",
  },

  // Subscription Plans
  MONTHLY_CHANNEL_COST: {
    name: "Monthly Channel",
    description: "Per WhatsApp channel monthly cost",
    category: "Subscription",
  },
  FREE_MONTHLY: {
    name: "Free Plan",
    description: "Free tier monthly cost",
    category: "Subscription",
  },
  BASIC_MONTHLY: {
    name: "Basic Plan",
    description: "Basic tier monthly cost",
    category: "Subscription",
  },
  PREMIUM_MONTHLY: {
    name: "Premium Plan",
    description: "Premium tier monthly cost",
    category: "Subscription",
  },
  ENTERPRISE_MONTHLY: {
    name: "Enterprise Plan",
    description: "Enterprise tier monthly cost",
    category: "Subscription",
  },
}

/**
 * 🔍 Helper function to get price by key
 */
export function getBillingPrice(key: keyof typeof BillingPrices): number {
  return BillingPrices[key]
}

/**
 * 📋 Get all prices as object (for API response)
 */
export function getAllBillingPrices(): Record<string, number> {
  const prices: Record<string, number> = {}

  for (const key in BillingPrices) {
    if (typeof BillingPrices[key as keyof typeof BillingPrices] === "number") {
      prices[key] = BillingPrices[key as keyof typeof BillingPrices] as number
    }
  }

  return prices
}

/**
 * 📊 Get all prices with metadata (for admin UI)
 */
export function getAllBillingPricesWithMetadata() {
  const pricesWithMeta: Array<{
    key: string
    value: number
    name: string
    description: string
    category: string
  }> = []

  for (const key in BillingPrices) {
    if (typeof BillingPrices[key as keyof typeof BillingPrices] === "number") {
      const metadata = BillingPricesMetadata[key as keyof typeof BillingPrices]
      pricesWithMeta.push({
        key,
        value: BillingPrices[key as keyof typeof BillingPrices] as number,
        name: metadata.name,
        description: metadata.description,
        category: metadata.category,
      })
    }
  }

  return pricesWithMeta
}
