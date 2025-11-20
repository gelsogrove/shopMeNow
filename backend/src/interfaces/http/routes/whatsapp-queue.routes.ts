// External dependencies
import { Router } from "express"
import { PrismaClient } from "@prisma/client"

// Middleware
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

// Controllers
import { WhatsAppQueueController } from "../controllers/whatsapp-queue.controller"

const router = Router()
const prisma = new PrismaClient()
const controller = new WhatsAppQueueController(prisma)

/**
 * WhatsApp Queue Routes
 * All routes require authentication and workspace validation
 */

// Get all queue messages for workspace
router.get(
  "/workspaces/:workspaceId/whatsapp-queue",
  authMiddleware,
  workspaceValidationMiddleware,
  controller.getQueueMessages.bind(controller)
)

// Get queue statistics
router.get(
  "/workspaces/:workspaceId/whatsapp-queue/statistics",
  authMiddleware,
  workspaceValidationMiddleware,
  controller.getStatistics.bind(controller)
)

// Get single queue message
router.get(
  "/workspaces/:workspaceId/whatsapp-queue/:id",
  authMiddleware,
  workspaceValidationMiddleware,
  controller.getQueueMessage.bind(controller)
)

export { router as whatsappQueueRoutes }
