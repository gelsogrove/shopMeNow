/**
 * 🚀 PLATFORM CONFIGURATION ROUTES
 *
 * Route definitions for platform configuration API.
 *
 * Public Routes (no auth):
 * - GET /api/platform-config - Get all config for frontend
 * - GET /api/platform-config/flags/check - Quick flag check for login/register
 *
 * Protected Routes (require auth):
 * - GET /api/platform-config/admin - Get detailed config for admin
 * - PUT /api/platform-config/:key - Update a config value
 * - POST /api/platform-config/flags/:key/toggle - Toggle a flag
 * - POST /api/platform-config/cache/invalidate - Force cache refresh
 *
 * @author Andrea Gelso - eChatbot Platform
 */

import { Router } from "express"
import { platformConfigController } from "../controllers/platform-config.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../middlewares/platform-admin.middleware"

const router = Router()

// ============================================================================
// PUBLIC ROUTES (no authentication required)
// ============================================================================

/**
 * @swagger
 * /api/platform-config:
 *   get:
 *     summary: Get platform configuration
 *     description: Returns all platform configuration for frontend consumption (prices, flags, limits)
 *     tags: [Platform Config]
 *     responses:
 *       200:
 *         description: Platform configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     prices:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           current:
 *                             type: number
 *                           original:
 *                             type: number
 *                             nullable: true
 *                     flags:
 *                       type: object
 *                       additionalProperties:
 *                         type: boolean
 *                     limits:
 *                       type: object
 *                       additionalProperties:
 *                         type: number
 */
router.get(
  "/",
  platformConfigController.getPublicConfig.bind(platformConfigController)
)

/**
 * @swagger
 * /api/platform-config/flags/check:
 *   get:
 *     summary: Check feature flags
 *     description: Quick check for key feature flags (canLogin, canRegister, etc.)
 *     tags: [Platform Config]
 *     responses:
 *       200:
 *         description: Feature flags status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     canLogin:
 *                       type: boolean
 *                     canRegister:
 *                       type: boolean
 */
router.get(
  "/flags/check",
  platformConfigController.checkFlags.bind(platformConfigController)
)

// ============================================================================
// PROTECTED ROUTES (require authentication)
// ============================================================================

/**
 * @swagger
 * /api/platform-config/admin:
 *   get:
 *     summary: Get admin configuration
 *     description: Returns detailed configuration with descriptions for admin panel
 *     tags: [Platform Config]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin configuration
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/admin",
  authMiddleware,
  platformAdminMiddleware,
  platformConfigController.getAdminConfig.bind(platformConfigController)
)

/**
 * @swagger
 * /api/platform-config/widget-code:
 *   get:
 *     summary: Get widget chatbot code
 *     description: Get the embed code for the chatbot widget (public)
 *     tags: [Platform Config]
 *     responses:
 *       200:
 *         description: Widget code retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       nullable: true
 */
router.get(
  "/widget-code",
  platformConfigController.getWidgetCode.bind(platformConfigController)
)

/**
 * @swagger
 * /api/platform-config/widget-code:
 *   put:
 *     summary: Save widget chatbot code
 *     description: Save the embed code for the chatbot widget (admin only)
 *     tags: [Platform Config]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 description: Widget embed code
 *     responses:
 *       200:
 *         description: Widget code saved
 *       401:
 *         description: Unauthorized
 */
router.put(
  "/widget-code",
  authMiddleware,
  platformAdminMiddleware,
  platformConfigController.saveWidgetCode.bind(platformConfigController)
)

/**
 * @swagger
 * /api/platform-config/{key}:
 *   put:
 *     summary: Update configuration value
 *     description: Update a specific configuration value by key
 *     tags: [Platform Config]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Configuration key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *             properties:
 *               value:
 *                 type: string
 *                 description: New value
 *               originalValue:
 *                 type: string
 *                 description: Original value for strikethrough display
 *     responses:
 *       200:
 *         description: Configuration updated
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Configuration key not found
 */
router.put(
  "/:key",
  authMiddleware,
  platformAdminMiddleware,
  platformConfigController.updateConfig.bind(platformConfigController)
)

/**
 * @swagger
 * /api/platform-config/flags/{key}/toggle:
 *   post:
 *     summary: Toggle feature flag
 *     description: Toggle a feature flag on/off
 *     tags: [Platform Config]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Flag key (e.g., canLogin, canRegister)
 *     responses:
 *       200:
 *         description: Flag toggled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                     value:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/flags/:key/toggle",
  authMiddleware,
  platformAdminMiddleware,
  platformConfigController.toggleFlag.bind(platformConfigController)
)

/**
 * @swagger
 * /api/platform-config/cache/invalidate:
 *   post:
 *     summary: Invalidate cache
 *     description: Force cache refresh for platform configuration
 *     tags: [Platform Config]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache invalidated
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/cache/invalidate",
  authMiddleware,
  platformAdminMiddleware,
  platformConfigController.invalidateCache.bind(platformConfigController)
)

export default router
