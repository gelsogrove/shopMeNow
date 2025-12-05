/**
 * Pricing Repository
 *
 * Single Source of Truth for all pricing configuration.
 * All BE/FE pricing queries go through this repository.
 */

import { PricingType, PrismaClient } from "@echatbot/database"

export interface PricingConfigDTO {
  type: PricingType
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

export class PricingRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all active pricing configurations
   */
  async getAll(): Promise<PricingConfigDTO[]> {
    return this.prisma.pricingConfig.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { key: "asc" }],
    })
  }

  /**
   * Get all pricing configurations grouped by type
   * Returns: { plans: {...}, usage: {...}, thresholds: {...} }
   */
  async getAllGrouped(): Promise<GroupedPricing> {
    const all = await this.getAll()

    const grouped: GroupedPricing = {
      plans: {},
      usage: {},
      thresholds: {},
    }

    for (const config of all) {
      if (config.type === "PLAN") {
        grouped.plans[config.key] = config.value
      } else if (config.type === "USAGE") {
        grouped.usage[config.key] = config.value
      } else if (config.type === "THRESHOLD") {
        grouped.thresholds[config.key] = config.value
      }
    }

    return grouped
  }

  /**
   * Get pricing configurations by type
   */
  async getByType(type: PricingType): Promise<PricingConfigDTO[]> {
    return this.prisma.pricingConfig.findMany({
      where: { type, isActive: true },
      orderBy: { key: "asc" },
    })
  }

  /**
   * Get a single pricing configuration by key
   */
  async getByKey(key: string): Promise<PricingConfigDTO | null> {
    return this.prisma.pricingConfig.findUnique({
      where: { key },
    })
  }

  /**
   * Get pricing value by key (convenience method)
   * Returns the value or null if not found
   */
  async getValue(key: string): Promise<number | null> {
    const config = await this.getByKey(key)
    return config?.isActive ? config.value : null
  }

  /**
   * Update pricing value by key
   * Note: This updates the current price. Historical billing records are unchanged.
   */
  async updateValue(key: string, newValue: number): Promise<PricingConfigDTO> {
    return this.prisma.pricingConfig.update({
      where: { key },
      data: {
        value: newValue,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * Toggle active status of a pricing configuration
   */
  async toggleActive(
    key: string,
    isActive: boolean
  ): Promise<PricingConfigDTO> {
    return this.prisma.pricingConfig.update({
      where: { key },
      data: { isActive },
    })
  }

  /**
   * Create a new pricing configuration
   */
  async create(data: {
    type: PricingType
    key: string
    value: number
    description?: string
  }): Promise<PricingConfigDTO> {
    return this.prisma.pricingConfig.create({
      data: {
        type: data.type,
        key: data.key,
        value: data.value,
        description: data.description,
        isActive: true,
      },
    })
  }

  /**
   * Delete a pricing configuration
   */
  async delete(key: string): Promise<void> {
    await this.prisma.pricingConfig.delete({
      where: { key },
    })
  }
}
