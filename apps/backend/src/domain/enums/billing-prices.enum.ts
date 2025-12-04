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
  // 📱 MESSAGE COSTS - Only 2 types!
  MESSAGE = 0.1, // €0.10 - LLM chatbot message (all conversations)
  PUSH_CAMPAIGN = 1.0, // €1.00 - Any push notification (campaigns, reactivation, etc.)

  // 🏢 SUBSCRIPTION PLANS (Monthly)
  MONTHLY_CHANNEL_COST = 49.0, // €49.00 - Per WhatsApp channel/month (same as Premium)
  FREE_MONTHLY = 0.0, // €0.00 - Free plan
  BASIC_MONTHLY = 19.0, // €19.00 - Basic plan
  PREMIUM_MONTHLY = 49.0, // €49.00 - Premium plan
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
  // Only 2 usage-based prices!
  MESSAGE: {
    name: "Message",
    description: "Cost per message (AI-powered responses)",
    category: "Usage",
  },
  PUSH_CAMPAIGN: {
    name: "Push Notification",
    description: "Cost per push notification sent (all types)",
    category: "Usage",
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
