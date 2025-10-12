import { Router } from "express"
import logger from "../../utils/logger"

// ========================================
// 🏢 BACKOFFICE ROUTES
// ========================================
// Purpose: Admin panel routes (Chat, Clients, Products, Orders, Settings)
// Authentication: JWT + SessionID + x-workspace-id required
// Middleware: authMiddleware + sessionValidationMiddleware
// ========================================

/**
 * Creates and configures all backoffice routes
 * These routes require authentication (JWT + SessionID)
 */
export function createBackofficeRouter(): Router {
  const router = Router()

  logger.info("🏢 Setting up backoffice routes...")

  // Import route modules from interfaces/http/routes
  // We'll import them as we move them

  // TODO: Import and mount backoffice routes here
  // Example:
  // import { workspaceRouter } from "../../interfaces/http/routes/workspace.routes"
  // router.use("/workspaces", workspaceRouter)

  logger.info("✅ Backoffice routes setup complete")

  return router
}
