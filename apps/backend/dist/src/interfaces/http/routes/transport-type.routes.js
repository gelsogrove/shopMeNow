"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("@echatbot/database");
const transport_type_controller_1 = require("../controllers/transport-type.controller");
const auth_middleware_1 = require("../../../middlewares/auth.middleware");
const workspace_validation_middleware_1 = require("../../../middlewares/workspace-validation.middleware");
const router = (0, express_1.Router)();
// prisma imported
const transportTypeController = new transport_type_controller_1.TransportTypeController(database_1.prisma);
/**
 * All transport type routes require 2-layer security:
 * 1. authMiddleware - JWT validation
 * 2. validateWorkspaceOperation - workspace ownership validation
 */
// GET /api/workspaces/:workspaceId/transport-types
router.get("/", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, transportTypeController.getAll.bind(transportTypeController));
// GET /api/workspaces/:workspaceId/transport-types/:id
router.get("/:id", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, transportTypeController.getById.bind(transportTypeController));
// POST /api/workspaces/:workspaceId/transport-types
router.post("/", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, transportTypeController.create.bind(transportTypeController));
// PUT /api/workspaces/:workspaceId/transport-types/:id
router.put("/:id", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, transportTypeController.update.bind(transportTypeController));
// DELETE /api/workspaces/:workspaceId/transport-types/:id
router.delete("/:id", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, transportTypeController.delete.bind(transportTypeController));
exports.default = router;
//# sourceMappingURL=transport-type.routes.js.map