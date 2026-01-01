/**
 * 🚀 PLATFORM CONFIGURATION CONTROLLER
 *
 * Exposes platform configuration via REST API.
 *
 * Endpoints:
 * - GET /api/platform-config (public) - Get all config for frontend
 * - GET /api/platform-config/admin (auth required) - Get detailed config for admin
 * - PUT /api/platform-config/:key (auth required) - Update a config value
 * - POST /api/platform-config/flags/:key/toggle (auth required) - Toggle a flag
 * - POST /api/platform-config/cache/invalidate (auth required) - Force cache refresh
 *
 * @author Andrea Gelso - eChatbot Platform
 */

import { Request, Response } from "express"
import { platformConfigService } from "../../../services/platform-config.service"
import logger from "../../../utils/logger"

export class PlatformConfigController {
  /**
   * GET /api/platform-config
   * Public endpoint - returns all configuration for frontend
   */
  async getPublicConfig(_req: Request, res: Response): Promise<Response> {
    try {
      const config = await platformConfigService.getPublicConfig()

      return res.status(200).json({
        success: true,
        data: config,
      })
    } catch (error) {
      logger.error("[PlatformConfigController] Error getting public config:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch platform configuration",
      })
    }
  }

  /**
   * GET /api/platform-config/admin
   * Admin endpoint - returns detailed configuration with descriptions
   */
  async getAdminConfig(_req: Request, res: Response): Promise<Response> {
    try {
      const config = await platformConfigService.getAdminConfig()

      return res.status(200).json({
        success: true,
        data: config,
      })
    } catch (error) {
      logger.error("[PlatformConfigController] Error getting admin config:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch admin configuration",
      })
    }
  }

  /**
   * PUT /api/platform-config/:key
   * Update a configuration value
   */
  async updateConfig(req: Request, res: Response): Promise<Response> {
    try {
      const { key } = req.params
      const { value, originalValue } = req.body

      if (!key) {
        return res.status(400).json({
          success: false,
          error: "Configuration key is required",
        })
      }

      if (value === undefined || value === null) {
        return res.status(400).json({
          success: false,
          error: "Value is required",
        })
      }

      const updated = await platformConfigService.updateConfig(
        key,
        String(value),
        originalValue ? String(originalValue) : undefined
      )

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: `Configuration key not found: ${key}`,
        })
      }

      logger.info(`[PlatformConfigController] Updated config: ${key} = ${value}`)

      return res.status(200).json({
        success: true,
        data: updated,
      })
    } catch (error) {
      logger.error("[PlatformConfigController] Error updating config:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to update configuration",
      })
    }
  }

  /**
   * POST /api/platform-config/flags/:key/toggle
   * Toggle a feature flag
   */
  async toggleFlag(req: Request, res: Response): Promise<Response> {
    try {
      const { key } = req.params

      if (!key) {
        return res.status(400).json({
          success: false,
          error: "Flag key is required",
        })
      }

      const newValue = await platformConfigService.toggleFlag(key)

      logger.info(`[PlatformConfigController] Toggled flag: ${key} = ${newValue}`)

      return res.status(200).json({
        success: true,
        data: {
          key,
          value: newValue,
        },
      })
    } catch (error) {
      logger.error("[PlatformConfigController] Error toggling flag:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to toggle flag",
      })
    }
  }

  /**
   * POST /api/platform-config/cache/invalidate
   * Force cache invalidation
   */
  async invalidateCache(_req: Request, res: Response): Promise<Response> {
    try {
      await platformConfigService.invalidateCache()

      logger.info("[PlatformConfigController] Cache invalidated manually")

      return res.status(200).json({
        success: true,
        message: "Cache invalidated successfully",
      })
    } catch (error) {
      logger.error("[PlatformConfigController] Error invalidating cache:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to invalidate cache",
      })
    }
  }

  /**
   * GET /api/platform-config/flags/check
   * Quick check for feature flags (used by login/register forms)
   */
  async checkFlags(_req: Request, res: Response): Promise<Response> {
    try {
      const [canLogin, canRegister] = await Promise.all([
        platformConfigService.canLogin(),
        platformConfigService.canRegister(),
      ])

      return res.status(200).json({
        success: true,
        data: {
          canLogin,
          canRegister,
        },
      })
    } catch (error) {
      logger.error("[PlatformConfigController] Error checking flags:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to check feature flags",
      })
    }
  }
}

// Export singleton instance
export const platformConfigController = new PlatformConfigController()
