"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("@echatbot/database");
const certification_controller_1 = require("../controllers/certification.controller");
const auth_middleware_1 = require("../../../middlewares/auth.middleware");
const workspace_validation_middleware_1 = require("../../../middlewares/workspace-validation.middleware");
const router = (0, express_1.Router)();
// prisma imported
const certificationController = new certification_controller_1.CertificationController(database_1.prisma);
/**
 * All certification routes require 2-layer security:
 * 1. authMiddleware - JWT validation
 * 2. validateWorkspaceOperation - workspace ownership validation
 */
// GET /api/workspaces/:workspaceId/certifications
router.get("/", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, certificationController.getAll.bind(certificationController));
// GET /api/workspaces/:workspaceId/certifications/:id
router.get("/:id", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, certificationController.getById.bind(certificationController));
// POST /api/workspaces/:workspaceId/certifications
router.post("/", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, certificationController.create.bind(certificationController));
// PUT /api/workspaces/:workspaceId/certifications/:id
router.put("/:id", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, certificationController.update.bind(certificationController));
// DELETE /api/workspaces/:workspaceId/certifications/:id
router.delete("/:id", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.validateWorkspaceOperation, certificationController.delete.bind(certificationController));
exports.default = router;
//# sourceMappingURL=certification.routes.js.map