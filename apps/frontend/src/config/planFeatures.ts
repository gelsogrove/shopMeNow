/**
 * Plan Features Configuration
 * Feature 185: Subscription & Billing System
 * 
 * SINGLE SOURCE OF TRUTH for plan features.
 * Built from API data at runtime (no hardcoded values).
 * Used by:
 * - PricingPlans.tsx (homepage)
 * - BillingSection.tsx (profile/billing dialog)
 * 
 * When you change plan limits in database, it updates everywhere!
 */

import { PlanInfo } from "@/services/subscriptionBillingApi"

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
    customers: number | "unlimited"
    teamMembers: number | "unlimited"
  }
  isPopular?: boolean
  buttonVariant?: "default" | "outline"
}

// Feature keys for translation
export const FEATURE_KEYS = {
  CHANNELS: "channels",
  CUSTOMERS: "customers",
  TEAM_MEMBERS: "teamMembers",
  MULTI_LANGUAGE: "multiLanguage",
  ANALYTICS: "analytics",
  BRANDING: "branding",
  INTEGRATIONS: "integrations",
  DEDICATED_SERVER: "dedicatedServer",
} as const

// ============================================================================
// RUNTIME PLAN CONFIGURATION
// ============================================================================

/**
 * Convert API PlanInfo to PlanConfig (includes display metadata)
 * @param plans - Array of PlanInfo from API
 * @returns Record of PlanConfig by planType
 */
export function buildPlanConfigsFromApi(plans: PlanInfo[]): Record<string, PlanConfig> {
  const configs: Record<string, PlanConfig> = {}

  // Map of plan-specific metadata (not in API)
  const planMetadata: Record<string, {
    description: string
    descriptionKey: string
    isPopular?: boolean
    buttonVariant?: "default" | "outline"
    priceSuffix?: string
  }> = {
    FREE_TRIAL: {
      description: "14-day free trial",
      descriptionKey: "pricing.free.creditDesc",
      isPopular: true,
      buttonVariant: "default",
      priceSuffix: "/14 days",
    },
    BASIC: {
      description: "For growing businesses",
      descriptionKey: "pricing.basic.desc",
      buttonVariant: "default",
    },
    PREMIUM: {
      description: "For established businesses",
      descriptionKey: "pricing.premium.desc",
      buttonVariant: "default",
    },
    ENTERPRISE: {
      description: "For large-scale operations",
      descriptionKey: "pricing.enterprise.desc",
      buttonVariant: "outline",
      priceSuffix: "/month",
    },
  }

  for (const plan of plans) {
    const metadata = planMetadata[plan.planType]
    if (!metadata) continue

    // Determine feature inclusion based on plan
    const isBasic = plan.planType === "BASIC" || plan.planType === "FREE_TRIAL"
    const isPremium = plan.planType === "PREMIUM"
    const isEnterprise = plan.planType === "ENTERPRISE"

    // Helper to determine if limit is unlimited
    const isUnlimited = (limit: number | null): boolean => limit === null || limit === 999

    configs[plan.planType] = {
      name: plan.displayName,
      price: Math.floor(plan.monthlyFee),
      priceLabel: `$${Math.floor(plan.monthlyFee)}`,
      priceSuffix: metadata.priceSuffix,
      description: metadata.description,
      descriptionKey: metadata.descriptionKey,
      isPopular: metadata.isPopular,
      buttonVariant: metadata.buttonVariant,
      limits: {
        channels: isUnlimited(plan.maxChannels) ? "unlimited" : plan.maxChannels,
        customers: isUnlimited(plan.maxCustomers) ? "unlimited" : plan.maxCustomers,
        teamMembers: isUnlimited(plan.maxTeamMembers) ? "unlimited" : plan.maxTeamMembers,
      },
      features: [
        { key: FEATURE_KEYS.CHANNELS, included: true },
        { key: FEATURE_KEYS.CUSTOMERS, included: true },
        { key: FEATURE_KEYS.TEAM_MEMBERS, included: isPremium || isEnterprise },
        { key: FEATURE_KEYS.MULTI_LANGUAGE, included: true },
        { key: FEATURE_KEYS.ANALYTICS, included: true },
        { key: FEATURE_KEYS.BRANDING, included: isPremium || isEnterprise },
        { key: FEATURE_KEYS.INTEGRATIONS, included: isEnterprise },
        { key: FEATURE_KEYS.DEDICATED_SERVER, included: isEnterprise },
      ],
    }
  }

  return configs
}

/**
 * FALLBACK: Hardcoded defaults for initial render (before API data loads)
 * Used only when API is not yet available
 * @deprecated - Should only be used as fallback
 */
export const PLAN_CONFIGS_FALLBACK: Record<string, PlanConfig> = {
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
      customers: 50,
      teamMembers: 0,
    },
    features: [
      { key: FEATURE_KEYS.CHANNELS, included: true },
      { key: FEATURE_KEYS.CUSTOMERS, included: true },
      { key: FEATURE_KEYS.TEAM_MEMBERS, included: false },
      { key: FEATURE_KEYS.MULTI_LANGUAGE, included: true },
      { key: FEATURE_KEYS.ANALYTICS, included: true },
      { key: FEATURE_KEYS.BRANDING, included: false },
      { key: FEATURE_KEYS.INTEGRATIONS, included: false },
      { key: FEATURE_KEYS.DEDICATED_SERVER, included: false },
    ],
  },
  BASIC: {
    name: "Basic",
    price: 22,
    priceLabel: "$22",
    description: "For growing businesses",
    descriptionKey: "pricing.basic.desc",
    buttonVariant: "default",
    limits: {
      channels: 1,
      customers: 50,
      teamMembers: 0,
    },
    features: [
      { key: FEATURE_KEYS.CHANNELS, included: true },
      { key: FEATURE_KEYS.CUSTOMERS, included: true },
      { key: FEATURE_KEYS.TEAM_MEMBERS, included: false },
      { key: FEATURE_KEYS.MULTI_LANGUAGE, included: true },
      { key: FEATURE_KEYS.ANALYTICS, included: true },
      { key: FEATURE_KEYS.BRANDING, included: false },
      { key: FEATURE_KEYS.INTEGRATIONS, included: false },
      { key: FEATURE_KEYS.DEDICATED_SERVER, included: false },
    ],
  },
  PREMIUM: {
    name: "Premium",
    price: 45,
    priceLabel: "$45",
    description: "For established businesses",
    descriptionKey: "pricing.premium.desc",
    buttonVariant: "default",
    limits: {
      channels: 2,
      customers: 100,
      teamMembers: 3,
    },
    features: [
      { key: FEATURE_KEYS.CHANNELS, included: true },
      { key: FEATURE_KEYS.CUSTOMERS, included: true },
      { key: FEATURE_KEYS.TEAM_MEMBERS, included: true },
      { key: FEATURE_KEYS.MULTI_LANGUAGE, included: true },
      { key: FEATURE_KEYS.ANALYTICS, included: true },
      { key: FEATURE_KEYS.BRANDING, included: false },
      { key: FEATURE_KEYS.INTEGRATIONS, included: false },
      { key: FEATURE_KEYS.DEDICATED_SERVER, included: false },
    ],
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: 140,
    priceLabel: "$140",
    priceSuffix: "/month",
    description: "For large-scale operations",
    descriptionKey: "pricing.enterprise.desc",
    buttonVariant: "outline",
    limits: {
      channels: "unlimited",
      customers: "unlimited",
      teamMembers: "unlimited",
    },
    features: [
      { key: FEATURE_KEYS.CHANNELS, included: true },
      { key: FEATURE_KEYS.CUSTOMERS, included: true },
      { key: FEATURE_KEYS.TEAM_MEMBERS, included: true },
      { key: FEATURE_KEYS.MULTI_LANGUAGE, included: true },
      { key: FEATURE_KEYS.ANALYTICS, included: true },
      { key: FEATURE_KEYS.BRANDING, included: true },
      { key: FEATURE_KEYS.INTEGRATIONS, included: true },
      { key: FEATURE_KEYS.DEDICATED_SERVER, included: true },
    ],
  },
}

/**
 * Default PLAN_CONFIGS: Initially uses fallback, can be updated at runtime via buildPlanConfigsFromApi()
 * This ensures UI renders immediately even if API hasn't loaded yet
 */
export let PLAN_CONFIGS = { ...PLAN_CONFIGS_FALLBACK }

/**
 * Update PLAN_CONFIGS at runtime from API data
 * Call this when PlanInfo data is fetched from /subscription/plans
 * @param plans - Array of PlanInfo from API
 */
export function updatePlanConfigs(plans: PlanInfo[]): void {
  PLAN_CONFIGS = buildPlanConfigsFromApi(plans)
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
    case FEATURE_KEYS.CUSTOMERS:
      if (limits.customers === "unlimited") {
        return t ? `${translate("pricing.features.unlimited")} ${translate("pricing.features.clients")}` : "Unlimited leads"
      }
      return t
        ? `${translate("pricing.features.upto")} ${limits.customers} ${translate("pricing.features.clients")}`
        : `${limits.customers} leads`
    case FEATURE_KEYS.TEAM_MEMBERS:
      if (limits.teamMembers === "unlimited") {
        return t
          ? `${translate("pricing.features.unlimited")} ${translate("pricing.features.teamMembers")}`
          : "Unlimited team members"
      }
      return t
        ? `${translate("pricing.features.upto")} ${limits.teamMembers} ${translate("pricing.features.teamMembers")}`
        : `${limits.teamMembers} team members`
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

// Get features with display text for a plan (maintains consistent order across all plans)
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
  
  // Sort: included features first, disabled features at the bottom
  return features.sort((a, b) => {
    if (a.included === b.included) return 0
    return a.included ? -1 : 1
  })
}
