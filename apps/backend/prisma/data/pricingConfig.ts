/**
 * Pricing Configuration Data
 *
 * Seed data for PlatformConfig pricing.
 * Runtime pricing must be read from the database via PlatformConfigService.
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
      "Free plan - $0/month for 14 days trial with $22 credit included",
    isActive: true,
  },
  {
    type: "PLAN" as const,
    key: "BASIC_MONTHLY",
    value: 22,
    description: "Basic plan - $22/month for growing businesses",
    isActive: true,
  },
  {
    type: "PLAN" as const,
    key: "PREMIUM_MONTHLY",
    value: 45,
    description: "Premium plan - $45/month for established businesses",
    isActive: true,
  },
  {
    type: "PLAN" as const,
    key: "ENTERPRISE_MONTHLY",
    value: 140,
    description: "Enterprise plan - $140/month for large scale operations",
    isActive: true,
  },
  {
    type: "PLAN" as const,
    key: "MONTHLY_CHANNEL_COST",
    value: 45,
    description: "Monthly WhatsApp channel cost (included in all paid plans)",
    isActive: true,
  },

  // ============================================================================
  // USAGE-BASED PRICING (Pay-per-use)
  // ============================================================================
  {
    type: "USAGE" as const,
    key: "MESSAGE",
    value: 0.1,
    description:
      "Cost per message (AI-powered responses, including support conversations)",
    isActive: true,
  },
  {
    type: "USAGE" as const,
    key: "WIDGET_MESSAGE",
    value: 0.005,
    description: "Cost per web widget message (site chat)",
    isActive: true,
  },
  {
    type: "USAGE" as const,
    key: "WELCOME_MESSAGE",
    value: 1.18,
    description: "Cost per new customer registration (welcome message)",
    isActive: true,
  },
  {
    type: "USAGE" as const,
    key: "PUSH_CAMPAIGN",
    value: 1,
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
    description: "Free messages included in trial (after this, $0.10/message)",
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
    key: "BASIC_CLIENTS",
    value: 50,
    description: "Maximum clients for Basic plan",
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
    key: "ENTERPRISE_CLIENTS",
    value: 999999,
    description: "Unlimited clients for Enterprise plan",
    isActive: true,
  },
]
