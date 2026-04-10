import { Router } from "express"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"
import { simulateController } from "../controllers/simulate.controller"

const router = Router({ mergeParams: true })

/**
 * Simulate routes - for MCP-based automated scenario testing
 * Routes require authMiddleware + workspaceValidationMiddleware
 * Note: sessionValidationMiddleware is NOT used here since first message (__init__)
 * doesn't have a sessionId yet. The simulateController handles session creation internally.
 */

router.post(
  "/",
  authMiddleware,
  workspaceValidationMiddleware,
  (req, res) => simulateController.simulateTurn(req, res)
)

router.delete(
  "/customers/phone/:phone",
  authMiddleware,
  workspaceValidationMiddleware,
  (req, res) => simulateController.deleteTestCustomer(req, res)
)

export default router
