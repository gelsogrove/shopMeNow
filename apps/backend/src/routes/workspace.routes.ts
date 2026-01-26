import { RequestHandler, Router } from "express"
import { WorkspaceService } from "../application/services/workspace.service"
import { WorkspaceController } from "../interfaces/http/controllers/workspace.controller"
import {
  validateWorkspaceOperation,
  validateWorkspaceUpdateData,
} from "../middlewares/workspace-validation.middleware"
import { authMiddleware } from "../interfaces/http/middlewares/auth.middleware"
import { wrapController } from "../utils/controller-wrapper"
import logger from "../utils/logger"

const router = Router()
const workspaceController = new WorkspaceController()
const workspaceService = new WorkspaceService()

// 🔒 CRITICAL SECURITY: Apply auth to ALL routes
router.use(authMiddleware)

/**
 * @swagger
 * components:
 *   schemas:
 *     Workspace:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - slug
 *         - isActive
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the workspace
 *         name:
 *           type: string
 *           description: The name of the workspace
 *         slug:
 *           type: string
 *           description: URL-friendly version of the name
 *         description:
 *           type: string
 *           nullable: true
 *           description: Optional description of the workspace
 *         whatsappPhoneNumber:
 *           type: string
 *           nullable: true
 *           description: WhatsApp phone number for the workspace
 *         whatsappApiKey:
 *           type: string
 *           nullable: true
 *           description: WhatsApp API key for authentication
 *         whatsappWebhookUrl:
 *           type: string
 *           nullable: true
 *           description: WhatsApp webhook URL
 *         isActive:
 *           type: boolean
 *           description: Whether the workspace is active
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the workspace was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the workspace was last updated
 */

/**
 * @swagger
 * /workspaces/current:
 *   get:
 *     summary: Get the current active workspace
 *     tags: [Workspaces]
 *     responses:
 *       200:
 *         description: The current active workspace
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workspace'
 *       404:
 *         description: No active workspace found
 *       500:
 *         description: Server error
 */
const getCurrentWorkspace: RequestHandler = async (req, res): Promise<void> => {
  try {
    // Get all workspaces using the service
    const workspaces = await workspaceService.getAll()

    // ✅ CRITICAL: Admin può accedere anche a workspace disabilitati
    // Solo deletedAt blocca l'accesso (cancellati definitivamente)
    const workspace = workspaces.find((w) => w.deletedAt === null)

    if (!workspace) {
      res.status(404).json({ error: "No workspace found (all deleted)" })
      return
    }

    // Return workspace with all fields including debugMode
    res.json({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      whatsappPhoneNumber: workspace.whatsappPhoneNumber,
      whatsappApiKey: workspace.whatsappApiKey,
      webhookUrl: workspace.webhookUrl,
      whatsappWebhookId: undefined, // Removed deprecated webhookSettings
      whatsappWebhookToken: undefined, // Removed deprecated webhookSettings
      whatsappWebhookUrl: undefined, // Removed deprecated webhookSettings
      notificationEmail: workspace.notificationEmail,
      adminEmail: workspace.adminEmail,
      language: workspace.language,
      currency: workspace.currency,
      messageLimit: workspace.messageLimit,
      blocklist: workspace.blocklist,
      welcomeMessage: workspace.welcomeMessage,
      wipMessage: workspace.wipMessage,
      channelStatus: workspace.channelStatus,
      deletedAt: workspace.deletedAt ?? null,
      url: workspace.url,
      debugMode: workspace.debugMode,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    })
    return
  } catch (error) {
    logger.error("Error fetching current workspace:", error)
    res.status(500).json({ error: "Failed to fetch current workspace" })
    return
  }
}

/**
 * @swagger
 * /workspaces:
 *   get:
 *     summary: Get all workspaces
 *     tags: [Workspaces]
 *     responses:
 *       200:
 *         description: The list of workspaces
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Workspace'
 */
router.get(
  "/",
  wrapController(workspaceController.getAllWorkspaces)
)

// IMPORTANT: /current must come BEFORE /:id to avoid conflict
router.get("/current", getCurrentWorkspace)

/**
 * @swagger
 * /workspaces/{id}:
 *   get:
 *     summary: Get a workspace by ID
 *     tags: [Workspaces]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The workspace ID
 *     responses:
 *       200:
 *         description: The workspace
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workspace'
 *       404:
 *         description: Workspace not found
 */
router.get(
  "/:id",
  validateWorkspaceOperation,
  wrapController(workspaceController.getWorkspaceById)
)

/**
 * @swagger
 * /workspaces:
 *   post:
 *     summary: Create a new workspace
 *     tags: [Workspaces]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               whatsappPhoneNumber:
 *                 type: string
 *               whatsappApiKey:
 *                 type: string
 *               whatsappWebhookUrl:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: The created workspace
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workspace'
 */
router.post("/", wrapController(workspaceController.createWorkspace))

/**
 * @swagger
 * /workspaces/{id}:
 *   put:
 *     summary: Update a workspace
 *     tags: [Workspaces]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The workspace ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               whatsappPhoneNumber:
 *                 type: string
 *               whatsappApiKey:
 *                 type: string
 *               whatsappWebhookUrl:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: The updated workspace
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workspace'
 *       404:
 *         description: Workspace not found
 */
router.put(
  "/:id",
  validateWorkspaceOperation,
  validateWorkspaceUpdateData,
  wrapController(workspaceController.updateWorkspace)
)

/**
 * @swagger
 * /workspaces/{id}:
 *   delete:
 *     summary: Soft-delete a workspace
 *     description: |
 *       Marks a workspace as deleted (soft-delete). The workspace and all related data
 *       will be retained for 90 days and can be restored by contacting support.
 *       
 *       After 90 days, the scheduler will permanently delete all data including:
 *       - Products and categories
 *       - Customers and chat sessions
 *       - Services and offers
 *       - Documents and FAQ chunks
 *       - Agent configurations and prompts
 *       - User-workspace relationships
 *       - WhatsApp settings
 *
 *       **NOTE**: This operation is reversible within 90 days.
 *       Contact support to restore a deleted workspace.
 *     tags: [Workspaces]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The workspace ID to delete
 *     responses:
 *       204:
 *         description: Workspace soft-deleted successfully
 *       404:
 *         description: Workspace not found
 *       500:
 *         description: Error during deletion process
 */
router.delete(
  "/:id",
  wrapController(workspaceController.deleteWorkspace)
)

export default router
