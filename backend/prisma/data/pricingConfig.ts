/**
 * Pricing Configuration Data
 *
 * SINGLE SOURCE OF TRUTH for all pricing in the application.
 * Change values here and both BE + FE will update automatically.
 *
 * Historical billing records preserve the price at transaction time.
 */

export const pricingConfigData = [
  // ============================================================================
  // MONTHLY SUBSCRIPTION PLANS
  // ============================================================================
  {
    type: "PLAN" as const,
    key: "FREE_MONTHLY",
    value: 0,
    description:
      "Free plan - €0/month for 14 days trial with €29 credit included",
    isActive: true,
  },
  {
    type: "PLAN" as const,
    key: "BASIC_MONTHLY",
    value: 29,
    description: "Basic plan - €29/month for growing businesses",
    isActive: true,
  },
  {
    type: "PLAN" as const,
    key: "PREMIUM_MONTHLY",
    value: 59,
    description: "Premium plan - €59/month for established businesses",
    isActive: true,
  },
  {
    type: "PLAN" as const,
    key: "ENTERPRISE_MONTHLY",
    value: 149,
    description: "Enterprise plan - €149/month for large scale operations",
    isActive: true,
  },
  {
    type: "PLAN" as const,
    key: "MONTHLY_CHANNEL_COST",
    value: 59,
    description: "Monthly WhatsApp channel cost (included in all paid plans)",
    isActive: true,
  },

  // ============================================================================
  // USAGE-BASED PRICING (Pay-per-use)
  // ============================================================================
  {
    type: "USAGE" as const,
    key: "MESSAGE",
    value: 0.15,
    description:
      "Cost per message (AI-powered responses, including support conversations)",
    isActive: true,
  },
  {
    type: "USAGE" as const,
    key: "NEW_CUSTOMER",
    value: 1.0,
    description: "Cost per new customer registration",
    isActive: true,
  },
  {
    type: "USAGE" as const,
    key: "NEW_ORDER",
    value: 1.5,
    description: "Cost per new order completed",
    isActive: true,
  },
  {
    type: "USAGE" as const,
    key: "PUSH_CAMPAIGN",
    value: 0.5,
    description: "Cost per push notification sent (promotional messages)",
    isActive: true,
  },

  // ============================================================================
  // FREE TIER THRESHOLDS (Limits)
  // ============================================================================
  {
    type: "THRESHOLD" as const,
    key: "FREE_MESSAGES",
    value: 200,
    description: "Free messages included in trial (after this, €0.15/message)",
    isActive: true,
  },
  {
    type: "THRESHOLD" as const,
    key: "FREE_PRODUCTS",
    value: 50,
    description: "Maximum products for Free plan",
    isActive: true,
  },
  {
    type: "THRESHOLD" as const,
    key: "FREE_CLIENTS",
    value: 50,
    description: "Maximum clients for Free plan",
    isActive: true,
  },
  {
    type: "THRESHOLD" as const,
    key: "BASIC_PRODUCTS",
    value: 50,
    description: "Maximum products for Basic plan",
    isActive: true,
  },
  {
    type: "THRESHOLD" as const,
    key: "BASIC_CLIENTS",
    value: 50,
    description: "Maximum clients for Basic plan",
    isActive: true,
  },
  {
    type: "THRESHOLD" as const,
    key: "PREMIUM_PRODUCTS",
    value: 100,
    description: "Maximum products for Premium plan",
    isActive: true,
  },
  {
    type: "THRESHOLD" as const,
    key: "PREMIUM_CLIENTS",
    value: 100,
    description: "Maximum clients for Premium plan",
    isActive: true,
  },
  {
    type: "THRESHOLD" as const,
    key: "ENTERPRISE_PRODUCTS",
    value: 999999,
    description: "Unlimited products for Enterprise plan",
    isActive: true,
  },
  {
    type: "THRESHOLD" as const,
    key: "ENTERPRISE_CLIENTS",
    value: 999999,
    description: "Unlimited clients for Enterprise plan",
    isActive: true,
  },
]
