import { Router } from "express"
import { WidgetEmbedController } from "../controllers/widget-embed.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

const router = Router()
const controller = new WidgetEmbedController()

/**
 * @swagger
 * /api/v1/workspaces/{workspaceId}/widget/embed-code:
 *   get:
 *     summary: Get embed code snippet for website
 *     description: Generate HTML/JS snippet that customers can copy/paste into their websites
 *     tags: [Widget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Embed code generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 embedCode:
 *                   type: string
 *                   description: HTML/JS snippet ready to paste
 *                 workspaceId:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request context
 *       401:
 *         description: Unauthorized - token required
 *       500:
 *         description: Failed to generate embed code
 */
router.get(
  "/embed-code",
  authMiddleware,
  workspaceValidationMiddleware,
  controller.getEmbedCode.bind(controller)
)

/**
 * @swagger
 * /api/v1/workspaces/{workspaceId}/widget/embed-code/text:
 *   get:
 *     summary: Get embed code as plain text file
 *     description: Download embed code as plain JavaScript file
 *     tags: [Widget]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Embed code file
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to generate embed code
 */
router.get(
  "/embed-code/text",
  authMiddleware,
  workspaceValidationMiddleware,
  controller.getEmbedCodeText.bind(controller)
)

export { router as widgetEmbedRoutes }
