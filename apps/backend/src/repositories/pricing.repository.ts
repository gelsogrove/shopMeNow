/**
 * Pricing Repository
 *
 * Single Source of Truth for all pricing configuration.
 * Reads from PlatformConfig (PRICE/LIMIT types) — PricingConfig was removed.
 * All BE/FE pricing queries go through this repository.
 */

import { PrismaClient } from "@echatbot/database"

export interface PricingConfigDTO {
  type: string
  key: string
  value: number
  description: string | null
  isActive: boolean
}

export interface GroupedPricing {
  plans: Record<string, number>
  usage: Record<string, number>
  thresholds: Record<string, number>
}

// Keys that map to "plans" in the grouped response (monthly subscription prices)
const PLAN_KEYS = new Set([
  "FREE_MONTHLY",
  "BASIC_MONTHLY",
  "PREMIUM_MONTHLY",
  "ENTERPRISE_MONTHLY",
])

export class PricingRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all active pricing configurations (PRICE + LIMIT types from PlatformConfig)
   */
  async getAll(): Promise<PricingConfigDTO[]> {
    const configs = await this.prisma.platformConfig.findMany({
      where: {
        isActive: true,
        type: { in: ["PRICE", "LIMIT"] },
      },
      orderBy: [{ type: "asc" }, { key: "asc" }],
    })

    return configs.map((c) => ({
      type: c.type,
      key: c.key,
      value: parseFloat(c.value),
      description: c.description ?? null,
      isActive: c.isActive,
    }))
  }

  /**
   * Get all pricing configurations grouped by type:
   *   plans     → PRICE with plan keys (FREE_MONTHLY, BASIC_MONTHLY, ...)
   *   usage     → PRICE with cost keys (MESSAGE, PUSH_CAMPAIGN, ...)
   *   thresholds → LIMIT keys
   */
  async getAllGrouped(): Promise<GroupedPricing> {
    const all = await this.getAll()

    const grouped: GroupedPricing = {
      plans: {},
      usage: {},
      thresholds: {},
    }

    for (const config of all) {
      if (config.type === "PRICE") {
        if (PLAN_KEYS.has(config.key)) {
          grouped.plans[config.key] = config.value
        } else {
          grouped.usage[config.key] = config.value
        }
      } else if (config.type === "LIMIT") {
        grouped.thresholds[config.key] = config.value
      }
    }

    return grouped
  }

  /**
   * Get a single pricing configuration by key
   */
  async getByKey(key: string): Promise<PricingConfigDTO | null> {
    const config = await this.prisma.platformConfig.findUnique({
      where: { key },
    })

    if (!config) return null

    return {
      type: config.type,
      key: config.key,
      value: parseFloat(config.value),
      description: config.description ?? null,
      isActive: config.isActive,
    }
  }

  /**
   * Get pricing value by key (convenience method)
   */
  async getValue(key: string): Promise<number | null> {
    const config = await this.getByKey(key)
    return config?.isActive ? config.value : null
  }

  /**
   * Update pricing value by key
   */
  async updateValue(key: string, newValue: number): Promise<PricingConfigDTO> {
    const updated = await this.prisma.platformConfig.update({
      where: { key },
      data: {
        value: String(newValue),
        updatedAt: new Date(),
      },
    })

    return {
      type: updated.type,
      key: updated.key,
      value: parseFloat(updated.value),
      description: updated.description ?? null,
      isActive: updated.isActive,
    }
  }

  /**
   * Toggle active status of a pricing configuration
   */
  async toggleActive(
    key: string,
    isActive: boolean
  ): Promise<PricingConfigDTO> {
    const updated = await this.prisma.platformConfig.update({
      where: { key },
      data: { isActive },
    })

    return {
      type: updated.type,
      key: updated.key,
      value: parseFloat(updated.value),
      description: updated.description ?? null,
      isActive: updated.isActive,
    }
  }
}
