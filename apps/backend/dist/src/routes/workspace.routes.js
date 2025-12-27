"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const workspace_service_1 = require("../application/services/workspace.service");
const workspace_controller_1 = require("../interfaces/http/controllers/workspace.controller");
const workspace_validation_middleware_1 = require("../middlewares/workspace-validation.middleware");
const controller_wrapper_1 = require("../utils/controller-wrapper");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
const workspaceController = new workspace_controller_1.WorkspaceController();
const workspaceService = new workspace_service_1.WorkspaceService();
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
const getCurrentWorkspace = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get all workspaces using the service
        const workspaces = yield workspaceService.getAll();
        // ✅ CRITICAL: Admin può accedere anche a workspace disabilitati
        // Solo workspace.isDelete blocca l'accesso (cancellati definitivamente)
        // workspace.isActive blocca SOLO messaggi WhatsApp (gestito in LLMService)
        const workspace = workspaces.find((w) => !w.isDelete);
        if (!workspace) {
            res.status(404).json({ error: "No workspace found (all deleted)" });
            return;
        }
        // Return workspace with all fields including debugMode
        res.json({
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            description: workspace.description,
            whatsappPhoneNumber: workspace.whatsappPhoneNumber,
            whatsappApiKey: workspace.whatsappApiKey, // ✅ FIXED: Use whatsappApiKey
            webhookUrl: workspace.webhookUrl,
            notificationEmail: workspace.notificationEmail,
            adminEmail: workspace.adminEmail,
            language: workspace.language,
            currency: workspace.currency,
            messageLimit: workspace.messageLimit,
            blocklist: workspace.blocklist,
            welcomeMessage: workspace.welcomeMessage,
            wipMessage: workspace.wipMessage,
            channelStatus: workspace.channelStatus,
            isActive: workspace.isActive,
            isDelete: workspace.isDelete,
            url: workspace.url,
            debugMode: workspace.debugMode,
            createdAt: workspace.createdAt,
            updatedAt: workspace.updatedAt,
        });
        return;
    }
    catch (error) {
        logger_1.default.error("Error fetching current workspace:", error);
        res.status(500).json({ error: "Failed to fetch current workspace" });
        return;
    }
});
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
router.get("/", (0, controller_wrapper_1.wrapController)(workspaceController.getAllWorkspaces));
// IMPORTANT: /current must come BEFORE /:id to avoid conflict
router.get("/current", getCurrentWorkspace);
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
router.get("/:id", workspace_validation_middleware_1.validateWorkspaceOperation, (0, controller_wrapper_1.wrapController)(workspaceController.getWorkspaceById));
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
router.post("/", (0, controller_wrapper_1.wrapController)(workspaceController.createWorkspace));
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
router.put("/:id", workspace_validation_middleware_1.validateWorkspaceOperation, workspace_validation_middleware_1.validateWorkspaceUpdateData, (0, controller_wrapper_1.wrapController)(workspaceController.updateWorkspace));
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
router.delete("/:id", (0, controller_wrapper_1.wrapController)(workspaceController.deleteWorkspace));
exports.default = router;
//# sourceMappingURL=workspace.routes.js.map