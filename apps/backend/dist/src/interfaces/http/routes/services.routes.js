"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.servicesRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const uploadMiddleware_1 = require("../middlewares/uploadMiddleware");
const workspace_context_middleware_1 = require("../middlewares/workspace-context.middleware");
const workspace_validation_middleware_1 = require("../middlewares/workspace-validation.middleware");
/**
 * @swagger
 * components:
 *   schemas:
 *     Service:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - price
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: ID of the service
 *         name:
 *           type: string
 *           description: Name of the service
 *         description:
 *           type: string
 *           description: Description of the service
 *         price:
 *           type: number
 *           description: Price of the service
 *         currency:
 *           type: string
 *           description: Currency for the price
 *         duration:
 *           type: integer
 *           description: Duration of the service in minutes
 *         isActive:
 *           type: boolean
 *           description: Whether the service is active
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace this service belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 */
const servicesRouter = (controller) => {
    const router = (0, express_1.Router)({ mergeParams: true });
    // PUBLIC ENDPOINT: Get services by workspace ID (no auth required for checkout page)
    // This must be BEFORE authMiddleware to remain public
    /**
     * @swagger
     * /api/services:
     *   get:
     *     summary: Get all services for a workspace (public endpoint)
     *     tags: [Services]
     *     parameters:
     *       - in: header
     *         name: x-workspace-id
     *         schema:
     *           type: string
     *         required: true
     *         description: ID of the workspace
     *     responses:
     *       200:
     *         description: List of services
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 data:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/Service'
     */
    router.get("/public", workspace_validation_middleware_1.workspaceValidationMiddleware, (req, res, next) => {
        controller.getServicesForWorkspace(req, res).catch(next);
    });
    // All other routes require authentication
    router.use(auth_middleware_1.authMiddleware);
    // All routes require workspace validation
    router.use(workspace_validation_middleware_1.workspaceValidationMiddleware);
    /**
     * @swagger
     * /api/workspaces/{workspaceId}/services:
     *   get:
     *     summary: Get all services for a workspace
     *     tags: [Services]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         schema:
     *           type: string
     *         required: true
     *         description: ID of the workspace
     *     responses:
     *       200:
     *         description: List of services
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Service'
     */
    // @ts-ignore
    router.get("/", workspace_context_middleware_1.workspaceContextMiddleware, (req, res, next) => {
        controller.getServicesForWorkspace(req, res).catch(next);
    });
    /**
     * @swagger
     * /api/workspaces/{workspaceId}/services:
     *   post:
     *     summary: Create a new service
     *     tags: [Services]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         schema:
     *           type: string
     *         required: true
     *         description: ID of the workspace
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - name
     *               - price
     *             properties:
     *               name:
     *                 type: string
     *                 description: Name of the service
     *               description:
     *                 type: string
     *                 description: Description of the service
     *               price:
     *                 type: number
     *                 description: Price of the service
     *               currency:
     *                 type: string
     *                 description: Currency for the price
     *                 default: EUR
     *               duration:
     *                 type: integer
     *                 description: Duration of the service in minutes
     *                 default: 60
     *               isActive:
     *                 type: boolean
     *                 description: Whether the service is active
     *     responses:
     *       201:
     *         description: Service created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Service'
     */
    // @ts-ignore
    router.post("/", uploadMiddleware_1.uploadImage.array("images", 10), // Support up to 10 images
    uploadMiddleware_1.handleUploadError, workspace_context_middleware_1.workspaceContextMiddleware, (req, res, next) => {
        controller.createService(req, res).catch(next);
    });
    /**
     * @swagger
     * /api/workspaces/{workspaceId}/services/{id}:
     *   get:
     *     summary: Get a specific service
     *     tags: [Services]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         schema:
     *           type: string
     *         required: true
     *         description: ID of the workspace
     *       - in: path
     *         name: id
     *         schema:
     *           type: string
     *         required: true
     *         description: ID of the service
     *     responses:
     *       200:
     *         description: Service details
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Service'
     *       404:
     *         description: Service not found
     */
    // @ts-ignore
    router.get("/:id", workspace_context_middleware_1.workspaceContextMiddleware, (req, res, next) => {
        controller.getServiceById(req, res).catch(next);
    });
    /**
     * @swagger
     * /api/workspaces/{workspaceId}/services/{id}:
     *   put:
     *     summary: Update an existing service
     *     tags: [Services]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         schema:
     *           type: string
     *         required: true
     *         description: ID of the workspace
     *       - in: path
     *         name: id
     *         schema:
     *           type: string
     *         required: true
     *         description: ID of the service
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *                 description: Name of the service
     *               description:
     *                 type: string
     *                 description: Description of the service
     *               price:
     *                 type: number
     *                 description: Price of the service
     *               currency:
     *                 type: string
     *                 description: Currency for the price
     *               duration:
     *                 type: integer
     *                 description: Duration of the service in minutes
     *               isActive:
     *                 type: boolean
     *                 description: Whether the service is active
     *     responses:
     *       200:
     *         description: Service updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Service'
     *       404:
     *         description: Service not found
     */
    // @ts-ignore
    router.put("/:id", uploadMiddleware_1.uploadImage.array("images", 10), // Support up to 10 images
    uploadMiddleware_1.handleUploadError, workspace_context_middleware_1.workspaceContextMiddleware, (req, res, next) => {
        controller.updateService(req, res).catch(next);
    });
    /**
     * @swagger
     * /api/workspaces/{workspaceId}/services/{id}:
     *   delete:
     *     summary: Delete a service
     *     tags: [Services]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         schema:
     *           type: string
     *         required: true
     *         description: ID of the workspace
     *       - in: path
     *         name: id
     *         schema:
     *           type: string
     *         required: true
     *         description: ID of the service
     *     responses:
     *       204:
     *         description: Service deleted successfully
     *       404:
     *         description: Service not found
     */
    // @ts-ignore
    router.delete("/:id", workspace_context_middleware_1.workspaceContextMiddleware, (req, res, next) => {
        controller.deleteService(req, res).catch(next);
    });
    return router;
};
exports.servicesRouter = servicesRouter;
//# sourceMappingURL=services.routes.js.map