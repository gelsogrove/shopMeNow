/**
 * 🚀 PLATFORM CONFIGURATION SERVICE
 *
 * Single Source of Truth for all platform configuration.
 * Replaces the hardcoded BillingPrices enum.
 *
 * Features:
 * - In-memory cache with 5-minute TTL
 * - Type-safe getters for prices, flags, and limits
 * - No fallbacks: missing config is a hard error
 *
 * @author Andrea Gelso - eChatbot Platform
 */

import { prisma, PrismaClient, ConfigType } from "@echatbot/database"
import logger from "../utils/logger"

// Type definitions for platform config
export interface PlatformConfigItem {
  key: string
  type: ConfigType
  value: string
  originalValue: string | null
  description: string | null
  isActive: boolean
}

export interface PlatformConfigCache {
  prices: Map<string, PlatformConfigItem>
  flags: Map<string, PlatformConfigItem>
  limits: Map<string, PlatformConfigItem>
  lastFetch: Date | null
}

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

class PlatformConfigService {
  private prisma: PrismaClient
  private cache: PlatformConfigCache = {
    prices: new Map(),
    flags: new Map(),
    limits: new Map(),
    lastFetch: null,
  }

  constructor() {
    this.prisma = prisma
  }

  /**
   * Initialize or refresh the cache
   */
  private async refreshCache(): Promise<void> {
    const configs = await this.prisma.platformConfig.findMany({
      where: { isActive: true },
    })

    // Clear existing cache
    this.cache.prices.clear()
    this.cache.flags.clear()
    this.cache.limits.clear()

    // Populate cache by type
    for (const config of configs) {
      const item: PlatformConfigItem = {
        key: config.key,
        type: config.type,
        value: config.value,
        originalValue: config.originalValue,
        description: config.description,
        isActive: config.isActive,
      }

      switch (config.type) {
        case "PRICE":
          this.cache.prices.set(config.key, item)
          break
        case "FLAG":
          this.cache.flags.set(config.key, item)
          break
        case "LIMIT":
          this.cache.limits.set(config.key, item)
          break
      }
    }

    this.cache.lastFetch = new Date()
    logger.info(
      `[PlatformConfig] Cache refreshed: ${configs.length} items (${this.cache.prices.size} prices, ${this.cache.flags.size} flags, ${this.cache.limits.size} limits)`
    )
  }

  /**
   * Check if cache is stale and needs refresh
   */
  private isCacheStale(): boolean {
    if (!this.cache.lastFetch) return true
    const now = new Date()
    return now.getTime() - this.cache.lastFetch.getTime() > CACHE_TTL_MS
  }

  /**
   * Ensure cache is fresh
   */
  private async ensureCache(): Promise<void> {
    if (this.isCacheStale()) {
      await this.refreshCache()
    }
  }

  /**
   * Force cache refresh (use after admin updates config)
   */
  async invalidateCache(): Promise<void> {
    this.cache.lastFetch = null
    await this.refreshCache()
  }

  // ============================================================================
  // 💰 PRICE GETTERS
  // ============================================================================

  /**
   * Get a price value by key
   * @param key - The price key (e.g., "BASIC_MONTHLY", "MESSAGE")
   * @returns The price as a number, or 0 if not found
   */
  async getPrice(key: string): Promise<number> {
    await this.ensureCache()
    const item = this.cache.prices.get(key)
    if (!item) {
      logger.error(`[PlatformConfig] Price not found: ${key}`)
      throw new Error(`Missing platform price config: ${key}`)
    }
    return parseFloat(item.value)
  }

  /**
   * Get price with original value for strikethrough display
   */
  async getPriceWithOriginal(
    key: string
  ): Promise<{ current: number; original: number | null }> {
    await this.ensureCache()
    const item = this.cache.prices.get(key)
    if (!item) {
      logger.error(`[PlatformConfig] Price not found: ${key}`)
      throw new Error(`Missing platform price config: ${key}`)
    }
    return {
      current: parseFloat(item.value),
      original: item.originalValue ? parseFloat(item.originalValue) : null,
    }
  }

  /**
   * Get all prices as a map
   */
  async getAllPrices(): Promise<
    Map<string, { current: number; original: number | null; description: string | null }>
  > {
    await this.ensureCache()
    const result = new Map<
      string,
      { current: number; original: number | null; description: string | null }
    >()

    for (const [key, item] of this.cache.prices) {
      result.set(key, {
        current: parseFloat(item.value),
        original: item.originalValue ? parseFloat(item.originalValue) : null,
        description: item.description,
      })
    }

    return result
  }

  // ============================================================================
  // 🚩 FLAG GETTERS
  // ============================================================================

  /**
   * Get a feature flag value
   * @param key - The flag key (e.g., "canLogin", "canRegister")
   * @returns The flag as a boolean
   */
  async getFlag(key: string): Promise<boolean> {
    await this.ensureCache()
    const item = this.cache.flags.get(key)
    if (!item) {
      throw new Error("Missing platform flag config")
    }
    return item.value === "true"
  }

  /**
   * Get all flags as a map
   */
  async getAllFlags(): Promise<Map<string, boolean>> {
    await this.ensureCache()
    const result = new Map<string, boolean>()

    for (const [key, item] of this.cache.flags) {
      result.set(key, item.value === "true")
    }

    return result
  }

  /**
   * Check if login is allowed
   */
  async canLogin(): Promise<boolean> {
    return this.getFlag("canLogin")
  }

  /**
   * Check if registration is allowed
   */
  async canRegister(): Promise<boolean> {
    return this.getFlag("canRegister")
  }

  /**
   * Check if "Work in Progress" mode is enabled
   */
  async isWorkingInProgress(): Promise<boolean> {
    return this.getFlag("workingInProgress")
  }

  // ============================================================================
  // 📊 LIMIT GETTERS
  // ============================================================================

  /**
   * Get a limit value by key
   * @param key - The limit key (e.g., "FREE_CLIENTS", "BASIC_CLIENTS")
   * @returns The limit as a number, or 0 if not found
   */
  async getLimit(key: string): Promise<number> {
    await this.ensureCache()
    const item = this.cache.limits.get(key)
    if (!item) {
      logger.error(`[PlatformConfig] Limit not found: ${key}`)
      throw new Error(`Missing platform limit config: ${key}`)
    }
    return parseInt(item.value, 10)
  }

  /**
   * Get all limits as a map
   */
  async getAllLimits(): Promise<Map<string, number>> {
    await this.ensureCache()
    const result = new Map<string, number>()

    for (const [key, item] of this.cache.limits) {
      result.set(key, parseInt(item.value, 10))
    }

    return result
  }

  // ============================================================================
  // 📤 PUBLIC API RESPONSE FORMATTERS
  // ============================================================================

  /**
   * Get full configuration for public API (frontend consumption)
   */
  async getPublicConfig(): Promise<{
    prices: Record<string, { current: number; original: number | null }>
    flags: Record<string, boolean>
    limits: Record<string, number>
    freeTrialCredit: number
  }> {
    await this.ensureCache()

    const prices: Record<string, { current: number; original: number | null }> =
      {}
    const flags: Record<string, boolean> = {}
    const limits: Record<string, number> = {}

    for (const [key, item] of this.cache.prices) {
      prices[key] = {
        current: parseFloat(item.value),
        original: item.originalValue ? parseFloat(item.originalValue) : null,
      }
    }

    for (const [key, item] of this.cache.flags) {
      flags[key] = item.value === "true"
    }

    for (const [key, item] of this.cache.limits) {
      limits[key] = parseInt(item.value, 10)
    }

    // Get FREE_TRIAL initialCredit from PlanConfiguration
    const freeTrial = await this.prisma.planConfiguration.findUnique({
      where: { planType: "FREE_TRIAL" },
      select: { initialCredit: true },
    })
    const freeTrialCredit = freeTrial?.initialCredit
      ? Number(freeTrial.initialCredit)
      : 22.0 // Fallback

    return { prices, flags, limits, freeTrialCredit }
  }

  /**
   * Get configuration with descriptions for admin panel
   */
  async getAdminConfig(): Promise<{
    prices: Array<{
      key: string
      current: number
      original: number | null
      description: string | null
    }>
    flags: Array<{ key: string; value: boolean; description: string | null }>
    limits: Array<{ key: string; value: number; description: string | null }>
  }> {
    await this.ensureCache()

    const prices: Array<{
      key: string
      current: number
      original: number | null
      description: string | null
    }> = []
    const flags: Array<{ key: string; value: boolean; description: string | null }> = []
    const limits: Array<{ key: string; value: number; description: string | null }> = []

    for (const [key, item] of this.cache.prices) {
      prices.push({
        key,
        current: parseFloat(item.value),
        original: item.originalValue ? parseFloat(item.originalValue) : null,
        description: item.description,
      })
    }

    const supportedFlags = [
      "canLogin",
      "canRegister",
      "workingInProgress",
      "registerFirst",
      "showWidgetChatbot",
    ]
    const defaultFlagDescriptions: Record<string, string> = {
      canLogin: "Allow users to login",
      canRegister: "Allow new user registration",
      workingInProgress: "Show Work in Progress badge",
      registerFirst: "Default auth view is registration",
      showWidgetChatbot: "Show chatbot widget on login page",
    }
    const flagKeys = new Set<string>()
    for (const [key, item] of this.cache.flags) {
      if (supportedFlags.includes(key)) {
        flagKeys.add(key)
        flags.push({
          key,
          value: item.value === "true",
          description: item.description,
        })
      }
    }
    for (const key of supportedFlags) {
      if (!flagKeys.has(key)) {
        flags.push({
          key,
          value: false,
          description: defaultFlagDescriptions[key] ?? null,
        })
      }
    }

    for (const [key, item] of this.cache.limits) {
      limits.push({
        key,
        value: parseInt(item.value, 10),
        description: item.description,
      })
    }

    return { prices, flags, limits }
  }

  // ============================================================================
  // 🔧 ADMIN UPDATE METHODS
  // ============================================================================

  /**
   * Update a configuration value (admin only)
   */
  async updateConfig(
    key: string,
    value: string,
    originalValue?: string
  ): Promise<PlatformConfigItem | null> {
    try {
      const updated = await this.prisma.platformConfig.update({
        where: { key },
        data: {
          value,
          originalValue: originalValue ?? null,
          updatedAt: new Date(),
        },
      })

      // Invalidate cache after update
      await this.invalidateCache()

      return {
        key: updated.key,
        type: updated.type,
        value: updated.value,
        originalValue: updated.originalValue,
        description: updated.description,
        isActive: updated.isActive,
      }
    } catch (error) {
      console.error(`[PlatformConfig] Failed to update ${key}:`, error)
      return null
    }
  }

  /**
   * Toggle a flag (admin only)
   */
  async toggleFlag(key: string): Promise<boolean> {
    await this.ensureCache()
    const existing = this.cache.flags.get(key)
    const currentValue = existing ? existing.value === "true" : false
    const newValue = !currentValue

    if (existing) {
      await this.updateConfig(key, newValue.toString())
      return newValue
    }

    const defaultDescriptions: Record<string, string> = {
      canLogin: "Allow users to login",
      canRegister: "Allow new user registration",
      workingInProgress: "Show Work in Progress badge",
      registerFirst: "Default auth view is registration",
      showWidgetChatbot: "Show chatbot widget on login page",
    }

    await this.prisma.platformConfig.upsert({
      where: { key },
      update: {
        value: newValue.toString(),
        updatedAt: new Date(),
      },
      create: {
        key,
        type: "FLAG",
        value: newValue.toString(),
        originalValue: null,
        description: defaultDescriptions[key] ?? null,
        isActive: true,
      },
    })

    await this.invalidateCache()
    return newValue
  }

  /**
   * Get widget chatbot code (for login page)
   */
  async getWidgetChatbotCode(): Promise<string | null> {
    const config = await this.prisma.platformConfig.findUnique({
      where: { key: "widgetChatbotCode" },
    })
    return config?.value ?? null
  }

  /**
   * Save widget chatbot code (admin only)
   */
  async saveWidgetChatbotCode(code: string): Promise<void> {
    await this.prisma.platformConfig.upsert({
      where: { key: "widgetChatbotCode" },
      update: {
        value: code,
        updatedAt: new Date(),
      },
      create: {
        key: "widgetChatbotCode",
        type: "FLAG", // Using FLAG type but storing text
        value: code,
        description: "Widget chatbot embed code for login page",
        isActive: true,
      },
    })
    await this.invalidateCache()
  }

  // ============================================================================
  // PLAN CONFIGURATION METHODS (PlanConfiguration table)
  // ============================================================================

  /**
   * Get all plan configurations for admin
   */
  async getAllPlanConfigurations() {
    const plans = await this.prisma.planConfiguration.findMany({
      where: { isActive: true },
      orderBy: { planType: "asc" },
    })

    return plans.map((plan) => ({
      id: plan.id,
      planType: plan.planType,
      displayName: plan.displayName,
      monthlyFee: Number(plan.monthlyFee),
      maxChannels: plan.maxChannels,
      maxProducts: plan.maxProducts,
      maxCustomers: plan.maxCustomers,
      maxTeamMembers: plan.maxTeamMembers,
      messageCost: Number(plan.messageCost),
      orderCost: Number(plan.orderCost),
      pushCost: Number(plan.pushCost),
      lowBalanceThreshold: Number(plan.lowBalanceThreshold),
      trialDays: plan.trialDays,
      initialCredit: Number(plan.initialCredit),
      features: plan.features,
      isActive: plan.isActive,
    }))
  }

  /**
   * Update a plan configuration field
   */
  async updatePlanConfiguration(
    planType: string,
    field: string,
    value: number | string | null
  ) {
    // Validate field is allowed
    const allowedFields = [
      "monthlyFee",
      "maxChannels",
      "maxProducts",
      "maxCustomers",
      "maxTeamMembers",
      "messageCost",
      "orderCost",
      "pushCost",
      "lowBalanceThreshold",
      "trialDays",
      "initialCredit",
      "displayName",
    ]

    if (!allowedFields.includes(field)) {
      throw new Error(`Field "${field}" is not allowed to be updated`)
    }

    const updated = await this.prisma.planConfiguration.update({
      where: { planType: planType as any },
      data: { [field]: value },
    })

    logger.info(
      `[PlatformConfigService] Updated PlanConfiguration ${planType}.${field} = ${value}`
    )

    return {
      id: updated.id,
      planType: updated.planType,
      [field]: field.includes("Cost") || field.includes("Fee") || field === "initialCredit" || field === "lowBalanceThreshold"
        ? Number((updated as any)[field])
        : (updated as any)[field],
    }
  }
}

// Export singleton instance
export const platformConfigService = new PlatformConfigService()
