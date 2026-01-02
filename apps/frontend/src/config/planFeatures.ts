/**
 * Plan Features Configuration
 * Feature 185: Subscription & Billing System
 * 
 * SINGLE SOURCE OF TRUTH for plan features.
 * Used by:
 * - PricingPlans.tsx (homepage)
 * - BillingSection.tsx (profile/billing dialog)
 * 
 * When you change a feature here, it updates everywhere!
 */

export interface PlanFeature {
  key: string
  included: boolean
}

export interface PlanConfig {
  name: string
  price: number
  priceLabel: string
  priceSuffix?: string
  description: string
  descriptionKey?: string  // Translation key for description
  features: PlanFeature[]
  limits: {
    channels: number | "unlimited"
    products: number | "unlimited"
    customers: number | "unlimited"
  }
  isPopular?: boolean
  buttonVariant?: "default" | "outline"
}

// Feature keys for translation
export const FEATURE_KEYS = {
  CHANNELS: "channels",
  PRODUCTS: "products", 
  CUSTOMERS: "customers",
  MULTI_LANGUAGE: "multiLanguage",
  ANALYTICS: "analytics",
  BRANDING: "branding",
  INTEGRATIONS: "integrations",
  DEDICATED_SERVER: "dedicatedServer",
} as const

// Plan configurations - SINGLE SOURCE OF TRUTH
export const PLAN_CONFIGS: Record<string, PlanConfig> = {
  FREE_TRIAL: {
    name: "Free Trial",
    price: 0,
    priceLabel: "$0",
    priceSuffix: "/14 days",
    description: "14-day free trial",
    descriptionKey: "pricing.free.creditDesc",
    isPopular: true,
    buttonVariant: "default",
    limits: {
      channels: 1,
      products: 50,
      customers: 50,
    },
    features: [
      { key: FEATURE_KEYS.CHANNELS, included: true },
      { key: FEATURE_KEYS.PRODUCTS, included: true },
      { key: FEATURE_KEYS.CUSTOMERS, included: true },
      { key: FEATURE_KEYS.MULTI_LANGUAGE, included: true },
      { key: FEATURE_KEYS.ANALYTICS, included: true },
      { key: FEATURE_KEYS.BRANDING, included: false },
      { key: FEATURE_KEYS.INTEGRATIONS, included: false },
      { key: FEATURE_KEYS.DEDICATED_SERVER, included: false },
    ],
  },
  BASIC: {
    name: "Basic",
    price: 23,
    priceLabel: "$23",
    description: "For growing businesses",
    descriptionKey: "pricing.basic.desc",
    buttonVariant: "default",
    limits: {
      channels: 1,
      products: 50,
      customers: 50,
    },
    features: [
      { key: FEATURE_KEYS.CHANNELS, included: true },
      { key: FEATURE_KEYS.PRODUCTS, included: true },
      { key: FEATURE_KEYS.CUSTOMERS, included: true },
      { key: FEATURE_KEYS.MULTI_LANGUAGE, included: true },
      { key: FEATURE_KEYS.ANALYTICS, included: true },
      { key: FEATURE_KEYS.BRANDING, included: false },
      { key: FEATURE_KEYS.INTEGRATIONS, included: false },
      { key: FEATURE_KEYS.DEDICATED_SERVER, included: false },
    ],
  },
  PREMIUM: {
    name: "Premium",
    price: 44,
    priceLabel: "$44",
    description: "For established businesses",
    descriptionKey: "pricing.premium.desc",
    buttonVariant: "default",
    limits: {
      channels: 2,
      products: 100,
      customers: 100,
    },
    features: [
      { key: FEATURE_KEYS.CHANNELS, included: true },
      { key: FEATURE_KEYS.PRODUCTS, included: true },
      { key: FEATURE_KEYS.CUSTOMERS, included: true },
      { key: FEATURE_KEYS.MULTI_LANGUAGE, included: true },
      { key: FEATURE_KEYS.ANALYTICS, included: true },
      { key: FEATURE_KEYS.BRANDING, included: true },
      { key: FEATURE_KEYS.INTEGRATIONS, included: false },
      { key: FEATURE_KEYS.DEDICATED_SERVER, included: false },
    ],
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: 139,
    priceLabel: "$139",
    priceSuffix: "/month",
    description: "For large-scale operations",
    descriptionKey: "pricing.enterprise.desc",
    buttonVariant: "outline",
    limits: {
      channels: "unlimited",
      products: "unlimited",
      customers: "unlimited",
    },
    features: [
      { key: FEATURE_KEYS.CHANNELS, included: true },
      { key: FEATURE_KEYS.PRODUCTS, included: true },
      { key: FEATURE_KEYS.CUSTOMERS, included: true },
      { key: FEATURE_KEYS.MULTI_LANGUAGE, included: true },
      { key: FEATURE_KEYS.ANALYTICS, included: true },
      { key: FEATURE_KEYS.BRANDING, included: true },
      { key: FEATURE_KEYS.INTEGRATIONS, included: true },
      { key: FEATURE_KEYS.DEDICATED_SERVER, included: true },
    ],
  },
}

// Helper to get feature display text (with optional translation)
export function getFeatureDisplayText(
  key: string,
  limits: PlanConfig["limits"],
  t?: (key: string) => string
): string {
  const translate = t || ((k: string) => k)
  
  switch (key) {
    case FEATURE_KEYS.CHANNELS:
      if (limits.channels === "unlimited") {
        return t ? `${translate("pricing.features.unlimited")} ${translate("pricing.features.channels")}` : "Unlimited WhatsApp channels"
      }
      return t 
        ? `${limits.channels} ${translate("pricing.features.channel")}${limits.channels > 1 ? "s" : ""}` 
        : `${limits.channels} WhatsApp channel${limits.channels > 1 ? "s" : ""}`
    case FEATURE_KEYS.PRODUCTS:
      if (limits.products === "unlimited") {
        return t ? `${translate("pricing.features.unlimited")} ${translate("pricing.features.products")}` : "Unlimited products"
      }
      return t 
        ? `${translate("pricing.features.upto")} ${limits.products} ${translate("pricing.features.products")}`
        : `${limits.products} products`
    case FEATURE_KEYS.CUSTOMERS:
      if (limits.customers === "unlimited") {
        return t ? `${translate("pricing.features.unlimited")} ${translate("pricing.features.clients")}` : "Unlimited customers/leads"
      }
      return t
        ? `${translate("pricing.features.upto")} ${limits.customers} ${translate("pricing.features.clients")}`
        : `${limits.customers} customers/leads`
    case FEATURE_KEYS.MULTI_LANGUAGE:
      return "Multi-language support"
    case FEATURE_KEYS.ANALYTICS:
      return t ? translate("pricing.features.analytics") : "Analytics dashboard"
    case FEATURE_KEYS.BRANDING:
      return t ? translate("pricing.features.branding") : "Brand customization"
    case FEATURE_KEYS.INTEGRATIONS:
      return t ? translate("pricing.features.integration") : "Custom integrations"
    case FEATURE_KEYS.DEDICATED_SERVER:
      return "Dedicated server"
    default:
      return key
  }
}

// Get features with display text for a plan (sorted: included first, then excluded)
export function getPlanFeaturesWithText(
  planType: keyof typeof PLAN_CONFIGS,
  t?: (key: string) => string
): Array<{ name: string; included: boolean }> {
  const plan = PLAN_CONFIGS[planType]
  if (!plan) return []
  
  const features = plan.features.map((feature) => ({
    name: getFeatureDisplayText(feature.key, plan.limits, t),
    included: feature.included,
  }))
  
  // Sort: included (true) first, then excluded (false)
  return features.sort((a, b) => {
    if (a.included === b.included) return 0
    return a.included ? -1 : 1
  })
}
