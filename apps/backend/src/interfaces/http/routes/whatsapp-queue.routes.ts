// External dependencies
import { Router } from "express"
import { prisma } from "@echatbot/database"

// Middleware
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"
import { ownerOnlyMiddleware } from "../middlewares/owner-only.middleware"

// Controllers
import { WhatsAppQueueController } from "../controllers/whatsapp-queue.controller"

const router = Router()
// prisma imported
const controller = new WhatsAppQueueController(prisma)

/**
 * WhatsApp Queue Routes
 * All routes require authentication and workspace validation
 * 
 * ⚠️ ORDER MATTERS: Specific routes MUST come before generic :id route
 * Otherwise /:id will intercept /statistics and /status
 */

// ✅ SPECIFIC ROUTES FIRST (before generic :id)

// Delete single message by ID (must come before GET /:id)
router.delete(
  "/workspaces/:workspaceId/whatsapp-queue/:id",
  authMiddleware,
  workspaceValidationMiddleware,
  controller.deleteQueueMessage.bind(controller)
)

// Get queue status (enabled/disabled)
router.get(
  "/workspaces/:workspaceId/whatsapp-queue/status",
  authMiddleware,
  workspaceValidationMiddleware,
  controller.getQueueStatus.bind(controller)
)

// Update queue status (enable/disable)
router.put(
  "/workspaces/:workspaceId/whatsapp-queue/status",
  authMiddleware,
  workspaceValidationMiddleware,
  controller.updateQueueStatus.bind(controller)
)

// Update debug mode (OWNER ONLY)
router.put(
  "/workspaces/:workspaceId/whatsapp-queue/debug-mode",
  authMiddleware,
  workspaceValidationMiddleware,
  ownerOnlyMiddleware,  // 🔒 Only workspace owner can toggle debug mode
  controller.updateDebugMode.bind(controller)
)

// Get queue statistics
router.get(
  "/workspaces/:workspaceId/whatsapp-queue/statistics",
  authMiddleware,
  workspaceValidationMiddleware,
  controller.getStatistics.bind(controller)
)

// ✅ GENERIC ROUTES LAST

// Get all queue messages for workspace
router.get(
  "/workspaces/:workspaceId/whatsapp-queue",
  authMiddleware,
  workspaceValidationMiddleware,
  controller.getQueueMessages.bind(controller)
)

// Get single queue message (MUST be last - most generic route)
router.get(
  "/workspaces/:workspaceId/whatsapp-queue/:id",
  authMiddleware,
  workspaceValidationMiddleware,
  controller.getQueueMessage.bind(controller)
)

export { router as whatsappQueueRoutes }
