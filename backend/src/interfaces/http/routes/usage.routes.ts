import { Router } from "express"
import { usageController } from "../../../controllers/usage.controller"
import { authMiddleware } from "../middlewares/auth.middleware"

const router = Router()

/**
 * Usage Dashboard Routes (Read-Only)
 * Andrea's Logic: No public tracking endpoints - usage tracked directly in saveMessage
 * Only dashboard/analytics endpoints for viewing data
 *
 * 🔒 SECURITY: All routes require JWT authentication
 */
router.use(authMiddleware)

// GET /api/usage/dashboard/:workspaceId - Get comprehensive dashboard data
router.get("/dashboard/:workspaceId", usageController.getDashboardData)

// GET /api/usage/stats/:workspaceId - Get usage statistics for dashboard
router.get("/stats/:workspaceId", usageController.getStats)

// GET /api/usage/export/:workspaceId - Export usage data (CSV/JSON)
router.get("/export/:workspaceId", usageController.exportData)

export default router
