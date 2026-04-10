import { Router } from "express"
import { authMiddleware } from "../middlewares/auth.middleware"
import { sessionValidationMiddleware } from "../middlewares/session-validation.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"
import { simulateController } from "../controllers/simulate.controller"

const router = Router({ mergeParams: true })

/**
 * Simulate routes - for MCP-based automated scenario testing
 * All routes require full 3-layer auth (JWT + session + workspace)
 */

router.post(
  "/",
  authMiddleware,
  sessionValidationMiddleware,
  workspaceValidationMiddleware,
  (req, res) => simulateController.simulateTurn(req, res)
)

router.delete(
  "/customers/phone/:phone",
  authMiddleware,
  sessionValidationMiddleware,
  workspaceValidationMiddleware,
  (req, res) => simulateController.deleteTestCustomer(req, res)
)

export default router
