import { Router } from "express"
import { PushController } from "../controllers/push.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { sessionValidationMiddleware } from "../middlewares/session-validation.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

export const pushRoutes = (controller: PushController): Router => {
  const router = Router({ mergeParams: true }) // 🔧 FIX: Merge params from parent router

  // All routes require full authentication stack
  router.use(authMiddleware)
  router.use(sessionValidationMiddleware)
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /workspaces/{workspaceId}/push/chatbot-reactivated:
   *   post:
   *     summary: Send chatbot reactivation notification
   *     description: Send WhatsApp notification to customers when chatbot is re-enabled
   *     tags: [Push Notifications]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: Workspace UUID
   *       - in: header
   *         name: x-session-id
   *         required: true
   *         schema:
   *           type: string
   *         description: Session ID
   *       - in: header
   *         name: x-workspace-id
   *         required: true
   *         schema:
   *           type: string
   *         description: Workspace ID (must match path parameter)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - workspaceId
   *               - customerIds
   *             properties:
   *               workspaceId:
   *                 type: string
   *                 description: Workspace UUID (must match path parameter)
   *               customerIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of customer UUIDs to notify
   *     responses:
   *       200:
   *         description: Notifications sent (may include partial failures)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 sent:
   *                   type: number
   *                   description: Number of notifications sent successfully
   *                   example: 2
   *                 failed:
   *                   type: number
   *                   description: Number of failed notifications
   *                   example: 1
   *                 errors:
   *                   type: array
   *                   items:
   *                     type: string
   *                   description: Error messages for failed notifications
   *                   example: ["Customer John: Missing phone number"]
   *       400:
   *         description: Invalid request body
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Invalid request"
   *                 message:
   *                   type: string
   *                   example: "workspaceId and customerIds array are required"
   *       401:
   *         description: Unauthorized (missing or invalid JWT token)
   *       403:
   *         description: Forbidden (workspace access denied)
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Internal server error"
   *                 message:
   *                   type: string
   */
  router.post(
    "/chatbot-reactivated",
    controller.sendChatbotReactivated.bind(controller)
  )

  return router
}
