"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappQueueRoutes = void 0;
// External dependencies
const express_1 = require("express");
const database_1 = require("@echatbot/database");
// Middleware
const auth_middleware_1 = require("../middlewares/auth.middleware");
const workspace_validation_middleware_1 = require("../middlewares/workspace-validation.middleware");
// Controllers
const whatsapp_queue_controller_1 = require("../controllers/whatsapp-queue.controller");
const router = (0, express_1.Router)();
exports.whatsappQueueRoutes = router;
// prisma imported
const controller = new whatsapp_queue_controller_1.WhatsAppQueueController(database_1.prisma);
/**
 * WhatsApp Queue Routes
 * All routes require authentication and workspace validation
 *
 * ⚠️ ORDER MATTERS: Specific routes MUST come before generic :id route
 * Otherwise /:id will intercept /statistics and /status
 */
// ✅ SPECIFIC ROUTES FIRST (before generic :id)
// Clear entire queue (delete all messages)
router.delete("/workspaces/:workspaceId/whatsapp-queue", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, controller.clearQueue.bind(controller));
// Delete single message by ID (must come before GET /:id)
router.delete("/workspaces/:workspaceId/whatsapp-queue/:id", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, controller.deleteQueueMessage.bind(controller));
// Get queue status (enabled/disabled)
router.get("/workspaces/:workspaceId/whatsapp-queue/status", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, controller.getQueueStatus.bind(controller));
// Update queue status (enable/disable)
router.put("/workspaces/:workspaceId/whatsapp-queue/status", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, controller.updateQueueStatus.bind(controller));
// Update debug mode
router.put("/workspaces/:workspaceId/whatsapp-queue/debug-mode", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, controller.updateDebugMode.bind(controller));
// Get queue statistics
router.get("/workspaces/:workspaceId/whatsapp-queue/statistics", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, controller.getStatistics.bind(controller));
// ✅ GENERIC ROUTES LAST
// Get all queue messages for workspace
router.get("/workspaces/:workspaceId/whatsapp-queue", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, controller.getQueueMessages.bind(controller));
// Get single queue message (MUST be last - most generic route)
router.get("/workspaces/:workspaceId/whatsapp-queue/:id", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, controller.getQueueMessage.bind(controller));
//# sourceMappingURL=whatsapp-queue.routes.js.map