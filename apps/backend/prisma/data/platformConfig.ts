/**
 * Platform Configuration Data - SINGLE SOURCE OF TRUTH
 *
 * This file contains ALL platform configuration:
 * - PRICE: Monetary values (subscription plans, message costs, etc.)
 * - FLAG: Feature toggles (canLogin, canRegister, maintenance mode)
 * - LIMIT: Numeric thresholds (max products, max clients per plan)
 *
 * ⚠️ CRITICAL NOTES:
 * 1. NO hardcoded prices anywhere else in the codebase
 * 2. originalValue is for strikethrough display (marketing - "was $29, now $22")
 * 3. Historical billing records preserve the price at transaction time
 * 4. Feature flags control platform access (WIP mode, maintenance, etc.)
 *
 * @author Andrea Gelso - eChatbot Platform
 */

export type PlatformConfigData = {
  type: "PRICE" | "FLAG" | "LIMIT"
  key: string
  value: string // All values stored as strings, parsed at runtime
  originalValue?: string // For strikethrough display
  description: string
  isActive: boolean
}

export const platformConfigData: PlatformConfigData[] = [
  // ============================================================================
  // 💰 SUBSCRIPTION PLANS (Monthly) - NEW PRICES WITH STRIKETHROUGH
  // ============================================================================
  {
    type: "PRICE" as const,
    key: "FREE_MONTHLY",
    value: "0",
    description:
      "Free plan - $0/month for 14 days trial with $22 credit included",
    isActive: true,
  },
  {
    type: "PRICE" as const,
    key: "BASIC_MONTHLY",
    value: "22", // NEW PRICE: $22
    originalValue: "34", // OLD PRICE: $34 (strikethrough)
    description: "Basic plan - $22/month for growing businesses (was $34)",
    isActive: true,
  },
  {
    type: "PRICE" as const,
    key: "PREMIUM_MONTHLY",
    value: "45", // NEW PRICE: $45
    originalValue: "58", // OLD PRICE: $58 (strikethrough)
    description:
      "Premium plan - $45/month for established businesses (was $58)",
    isActive: true,
  },
  {
    type: "PRICE" as const,
    key: "ENTERPRISE_MONTHLY",
    value: "140", // NEW PRICE: $140
    originalValue: "175", // OLD PRICE: $175 (strikethrough)
    description:
      "Enterprise plan - $140/month for large scale operations (was $175)",
    isActive: true,
  },
  {
    type: "PRICE" as const,
    key: "MONTHLY_CHANNEL_COST",
    value: "45",
    description: "Monthly WhatsApp channel cost (included in all paid plans)",
    isActive: true,
  },

  // ============================================================================
  // 📱 USAGE COSTS - Only 2 types!
  // ============================================================================
  {
    type: "PRICE" as const,
    key: "MESSAGE",
    value: "0.10",
    description:
      "Cost per message (AI-powered responses, including support conversations)",
    isActive: true,
  },
  {
    type: "PRICE" as const,
    key: "WIDGET_MESSAGE",
    value: "0.05",
    description: "Cost per web widget message (site chat)",
    isActive: true,
  },
  {
    type: "PRICE" as const,
    key: "PUSH_CAMPAIGN",
    value: "1.00",
    description: "Cost per push notification sent (all types)",
    isActive: true,
  },

  // ============================================================================
  // 🚩 FEATURE FLAGS (Platform access control)
  // ============================================================================
  {
    type: "FLAG" as const,
    key: "canLogin",
    value: "true",
    description:
      "Allow users to login. When false: show WIP popup, disable login button",
    isActive: true,
  },
  {
    type: "FLAG" as const,
    key: "canRegister",
    value: "true",
    description:
      "Allow new user registration. When false: show WIP popup, disable register button",
    isActive: true,
  },
  {
    type: "FLAG" as const,
    key: "workingInProgress",
    value: "false",
    description:
      "Show Work in Progress badge to communicate service is under maintenance",
    isActive: true,
  },
  {
    type: "FLAG" as const,
    key: "registerFirst",
    value: "false",
    description:
      "When true, default auth view is registration instead of login",
    isActive: true,
  },

  // ============================================================================
  // 📊 LIMITS (Plan-based thresholds)
  // ============================================================================
  {
    type: "LIMIT" as const,
    key: "FREE_MESSAGES",
    value: "200",
    description: "Free messages included in trial (after this, $0.10/message)",
    isActive: true,
  },
  {
    type: "LIMIT" as const,
    key: "FREE_CLIENTS",
    value: "50",
    description: "Maximum clients for Free plan",
    isActive: true,
  },
  {
    type: "LIMIT" as const,
    key: "BASIC_CLIENTS",
    value: "50",
    description: "Maximum clients for Basic plan",
    isActive: true,
  },
  {
    type: "LIMIT" as const,
    key: "PREMIUM_CLIENTS",
    value: "100",
    description: "Maximum clients for Premium plan",
    isActive: true,
  },
  {
    type: "LIMIT" as const,
    key: "ENTERPRISE_CLIENTS",
    value: "999999",
    description: "Unlimited clients for Enterprise plan",
    isActive: true,
  },
]

/**
 * Helper to get price value as number
 */
export function getConfigPrice(data: PlatformConfigData): number {
  return parseFloat(data.value)
}

/**
 * Helper to get flag value as boolean
 */
export function getConfigFlag(data: PlatformConfigData): boolean {
  return data.value === "true"
}

/**
 * Helper to get limit value as number
 */
export function getConfigLimit(data: PlatformConfigData): number {
  return parseInt(data.value, 10)
}
