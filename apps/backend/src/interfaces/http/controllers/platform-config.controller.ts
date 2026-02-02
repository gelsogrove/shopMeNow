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
import { prisma } from "@echatbot/database"
import { platformConfigService } from "../../../services/platform-config.service"
import logger from "../../../utils/logger"

const WIDGET_WORKSPACE_ID_REGEX = /"workspaceId"\s*:\s*["']([^"']+)["']|workspaceId\s*:\s*["']([^"']+)["']/

const extractWidgetWorkspaceId = (code: string): string | null => {
  const match = code.match(WIDGET_WORKSPACE_ID_REGEX)
  return match?.[1] ?? match?.[2] ?? null
}

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
      const [canLogin, canRegister, workingInProgress, registerFirst, cantryDemo, showWidgetChatbot] =
        await Promise.all([
        platformConfigService.canLogin(),
        platformConfigService.canRegister(),
        platformConfigService.isWorkingInProgress(),
        platformConfigService.getFlag("registerFirst"),
        platformConfigService.getFlag("cantryDemo"),
        platformConfigService.getFlag("showWidgetChatbot"),
      ])

      return res.status(200).json({
        success: true,
        data: {
          canLogin,
          canRegister,
          workingInProgress,
          registerFirst,
          cantryDemo,
          showWidgetChatbot,
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

  /**
   * GET /api/platform-config/widget-code
   * Get widget chatbot embed code (public - for login page)
   */
  async getWidgetCode(_req: Request, res: Response): Promise<Response> {
    try {
      const [code, showWidgetChatbot] = await Promise.all([
        platformConfigService.getWidgetChatbotCode(),
        platformConfigService.getFlag("showWidgetChatbot"),
      ])
      const workspaceId = code ? extractWidgetWorkspaceId(code) : null
      let isValid = true
      let validationError: string | null = null

      if (code && !workspaceId) {
        isValid = false
        validationError = "Widget code must include a workspaceId"
      }

      if (code && workspaceId) {
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: {
            id: true,
            deletedAt: true,
            sellsProductsAndServices: true,
            debugMode: true,
          },
        })

        if (!workspace || workspace.deletedAt !== null) {
          isValid = false
          validationError = "Widget workspace not found or deleted"
        } else if (workspace.debugMode) {
          isValid = false
          validationError = "Widget disabled for debug workspaces"
        } else if (workspace.sellsProductsAndServices) {
          isValid = false
          validationError = "Widget must target an informational workspace"
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          code,
          isValid,
          workspaceId,
          showWidgetChatbot,
          error: validationError,
        },
      })
    } catch (error) {
      logger.error("[PlatformConfigController] Error getting widget code:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch widget code",
      })
    }
  }

  /**
   * GET /api/platform-config/widget-config
   * Get widget configuration directly from workspace (public - for login page)
   * Returns workspace config without needing to parse embed code
   */
  async getWidgetConfig(_req: Request, res: Response): Promise<Response> {
    try {
      const [code, showWidgetChatbot] = await Promise.all([
        platformConfigService.getWidgetChatbotCode(),
        platformConfigService.getFlag("showWidgetChatbot"),
      ])

      if (!code) {
        return res.status(200).json({
          success: true,
          data: {
            config: null,
            showWidgetChatbot,
            error: "No widget configured",
          },
        })
      }

      const workspaceId = extractWidgetWorkspaceId(code)
      
      if (!workspaceId) {
        return res.status(200).json({
          success: true,
          data: {
            config: null,
            showWidgetChatbot,
            error: "Widget code invalid - no workspaceId",
          },
        })
      }

      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          widgetTitle: true,
          widgetLanguage: true,
          widgetPrimaryColor: true,
          widgetIcon: true,
          widgetUseChannelLogo: true,
          deletedAt: true,
          sellsProductsAndServices: true,
          debugMode: true,
          channelStatus: true,
        },
      })

      if (!workspace || workspace.deletedAt !== null) {
        return res.status(200).json({
          success: true,
          data: {
            config: null,
            showWidgetChatbot,
            error: "Widget workspace not found or deleted",
          },
        })
      }

      if (!workspace.channelStatus) {
        return res.status(200).json({
          success: true,
          data: {
            config: null,
            showWidgetChatbot,
            error: "Widget channel is disabled",
          },
        })
      }

      // Allow widget on debug workspaces when running locally/non-production to ease testing
      const isProd = process.env.NODE_ENV === "production"
      if (workspace.debugMode && isProd) {
        return res.status(200).json({
          success: true,
          data: {
            config: null,
            showWidgetChatbot,
            error: "Widget disabled for debug workspaces",
          },
        })
      }

      if (workspace.sellsProductsAndServices) {
        return res.status(200).json({
          success: true,
          data: {
            config: null,
            showWidgetChatbot,
            error: "Widget must target an informational workspace",
          },
        })
      }

      return res.status(200).json({
        success: true,
        data: {
          config: {
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            logoUrl: workspace.widgetUseChannelLogo ? workspace.logoUrl : null,
            title: workspace.widgetTitle || "Chat with us 💬",
            language: workspace.widgetLanguage || "it",
            primaryColor: workspace.widgetPrimaryColor || "#22c55e",
            icon: workspace.widgetIcon || "chat",
            useChannelLogo: workspace.widgetUseChannelLogo ?? false,
          },
          showWidgetChatbot,
          error: null,
        },
      })
    } catch (error) {
      logger.error("[PlatformConfigController] Error getting widget config:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch widget config",
      })
    }
  }

  /**
   * PUT /api/platform-config/widget-code
   * Save widget chatbot embed code (admin only)
   */
  async saveWidgetCode(req: Request, res: Response): Promise<Response> {
    try {
      const { code } = req.body

      if (code === undefined) {
        return res.status(400).json({
          success: false,
          error: "Widget code is required",
        })
      }

      if (code !== "") {
        const workspaceId = extractWidgetWorkspaceId(code)
        if (!workspaceId) {
          return res.status(400).json({
            success: false,
            error: "Widget code must include a workspaceId",
          })
        }

        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { id: true, deletedAt: true, sellsProductsAndServices: true },
        })

        if (!workspace || workspace.deletedAt !== null) {
          return res.status(400).json({
            success: false,
            error: "Widget workspace not found or deleted",
          })
        }

        if (workspace.sellsProductsAndServices) {
          return res.status(400).json({
            success: false,
            error: "Widget must target an informational workspace",
          })
        }
      }

      await platformConfigService.saveWidgetChatbotCode(code)

      logger.info("[PlatformConfigController] Widget code saved")

      return res.status(200).json({
        success: true,
        message: "Widget code saved successfully",
      })
    } catch (error) {
      logger.error("[PlatformConfigController] Error saving widget code:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to save widget code",
      })
    }
  }

  // ============================================================================
  // PLAN CONFIGURATION ENDPOINTS
  // ============================================================================

  /**
   * GET /api/platform-config/plans
   * Get all plan configurations for admin
   */
  async getPlanConfigurations(_req: Request, res: Response): Promise<Response> {
    try {
      const plans = await platformConfigService.getAllPlanConfigurations()

      return res.status(200).json({
        success: true,
        data: plans,
      })
    } catch (error) {
      logger.error("[PlatformConfigController] Error getting plan configurations:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch plan configurations",
      })
    }
  }

  /**
   * PUT /api/platform-config/plans/:planType
   * Update a plan configuration field
   */
  async updatePlanConfiguration(req: Request, res: Response): Promise<Response> {
    try {
      const { planType } = req.params
      const { field, value } = req.body

      if (!planType) {
        return res.status(400).json({
          success: false,
          error: "Plan type is required",
        })
      }

      if (!field) {
        return res.status(400).json({
          success: false,
          error: "Field is required",
        })
      }

      if (value === undefined) {
        return res.status(400).json({
          success: false,
          error: "Value is required",
        })
      }

      const updated = await platformConfigService.updatePlanConfiguration(
        planType,
        field,
        value
      )

      return res.status(200).json({
        success: true,
        data: updated,
      })
    } catch (error) {
      logger.error("[PlatformConfigController] Error updating plan configuration:", error)
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to update plan configuration",
      })
    }
  }
}

// Export singleton instance
export const platformConfigController = new PlatformConfigController()
