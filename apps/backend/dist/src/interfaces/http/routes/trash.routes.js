"use strict";
/**
 * Trash Management Routes
 * All routes require: authMiddleware → requirePlatformAdmin (Platform Admin only)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTrashRoutes = void 0;
const express_1 = require("express");
const trash_controller_1 = require("../controllers/trash.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const soft_delete_middleware_1 = require("../middlewares/soft-delete.middleware");
const createTrashRoutes = (prisma) => {
    const router = (0, express_1.Router)();
    const controller = new trash_controller_1.TrashController(prisma);
    // Apply 3-layer middleware stack to all routes
    router.use(auth_middleware_1.authMiddleware);
    router.use(soft_delete_middleware_1.loginBlockingMiddleware);
    router.use(soft_delete_middleware_1.requirePlatformAdmin);
    /**
     * @swagger
     * /admin/users/{id}/unsubscribe:
     *   post:
     *     summary: Initiate user account deletion (soft-delete)
     *     tags: [Trash]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               reason:
     *                 type: string
     *     responses:
     *       200:
     *         description: User deleted successfully
     */
    router.post("/users/:id/unsubscribe", (req, res) => controller.unsubscribeUser(req, res));
    /**
     * @swagger
     * /admin/trash/customers:
     *   get:
     *     summary: List soft-deleted customers
     *     tags: [Trash]
     *     parameters:
     *       - in: query
     *         name: workspaceId
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 50
     *     responses:
     *       200:
     *         description: List of deleted customers
     */
    router.get("/customers", (req, res) => controller.listDeletedCustomers(req, res));
    /**
     * @swagger
     * /admin/trash/workspaces:
     *   get:
     *     summary: List soft-deleted workspaces
     *     tags: [Trash]
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 50
     *     responses:
     *       200:
     *         description: List of deleted workspaces
     */
    router.get("/workspaces", (req, res) => controller.listDeletedWorkspaces(req, res));
    /**
     * @swagger
     * /admin/trash/users:
     *   get:
     *     summary: List soft-deleted users (agents/operators)
     *     tags: [Trash]
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 50
     *     responses:
     *       200:
     *         description: List of deleted users
     */
    router.get("/users", (req, res) => controller.listDeletedUsers(req, res));
    /**
     * @swagger
     * /admin/trash/{id}/restore:
     *   post:
     *     summary: Restore soft-deleted item (customer, workspace, or user)
     *     tags: [Trash]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               workspaceId:
     *                 type: string
     *               entityType:
     *                 type: string
     *                 enum: [CUSTOMER, WORKSPACE]
     *     responses:
     *       200:
     *         description: Item restored successfully
     */
    // No validateWorkspaceOperation - Platform Admin can restore any workspace
    router.post("/:id/restore", (req, res) => controller.restoreItem(req, res));
    /**
     * @swagger
     * /admin/trash/{id}/permanently-delete:
     *   post:
     *     summary: Permanently hard-delete soft-deleted item
     *     tags: [Trash]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               workspaceId:
     *                 type: string
     *               confirmationText:
     *                 type: string
     *                 description: Must be exactly "PERMANENTLY DELETE"
     *               entityType:
     *                 type: string
     *                 enum: [CUSTOMER, WORKSPACE]
     *     responses:
     *       200:
     *         description: Item permanently deleted
     */
    // No validateWorkspaceOperation - Platform Admin can delete any workspace
    router.post("/:id/permanently-delete", (req, res) => controller.permanentlyDeleteItem(req, res));
    /**
     * @swagger
     * /admin/trash/audit-log:
     *   get:
     *     summary: Get deletion audit trail
     *     tags: [Trash]
     *     parameters:
     *       - in: query
     *         name: workspaceId
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: days
     *         schema:
     *           type: integer
     *           default: 30
     *     responses:
     *       200:
     *         description: Audit log entries
     */
    router.get("/audit-log", (req, res) => controller.getAuditLog(req, res));
    return router;
};
exports.createTrashRoutes = createTrashRoutes;
//# sourceMappingURL=trash.routes.js.map