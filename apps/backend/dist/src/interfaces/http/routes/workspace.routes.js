"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceRoutes = exports.workspaceRouter = void 0;
const express_1 = require("express");
const logger_1 = __importDefault(require("../../../utils/logger"));
const workspace_controller_1 = require("../controllers/workspace.controller");
const async_middleware_1 = require("../middlewares/async.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const workspace_role_middleware_1 = require("../../../middlewares/workspace-role.middleware");
const workspace_validation_middleware_1 = require("../../../middlewares/workspace-validation.middleware");
const workspaceRouter = () => {
    const router = (0, express_1.Router)();
    const workspaceController = new workspace_controller_1.WorkspaceController();
    logger_1.default.info('Setting up workspace routes');
    // Apply auth middleware to all routes
    router.use(auth_middleware_1.authMiddleware);
    // Get badge stats for all user's workspaces (unread messages, pending orders, etc.)
    // MUST be before /:id to avoid matching "badge-stats" as an ID
    router.get('/badge-stats', (0, async_middleware_1.asyncHandler)(workspaceController.getWorkspaceBadgeStats));
    // Get all workspaces
    router.get('/', (0, async_middleware_1.asyncHandler)(workspaceController.getAllWorkspaces));
    // Get a specific workspace
    router.get('/:id', (0, async_middleware_1.asyncHandler)(workspaceController.getWorkspaceById));
    // Create a new workspace (protection in controller - checks canUserCreateWorkspace)
    router.post('/', (0, async_middleware_1.asyncHandler)(workspaceController.createWorkspace));
    // Upload workspace logo - ONLY SUPER_ADMIN (Owner)
    const { uploadImage } = require('../middlewares/uploadMiddleware');
    router.post('/:id/logo', workspace_validation_middleware_1.validateWorkspaceOperation, workspace_role_middleware_1.requireSuperAdmin, uploadImage.single('logo'), (0, async_middleware_1.asyncHandler)(workspaceController.uploadWorkspaceLogo));
    // Update a workspace - ONLY SUPER_ADMIN (Owner)
    router.put('/:id', workspace_validation_middleware_1.validateWorkspaceOperation, workspace_role_middleware_1.requireSuperAdmin, (0, async_middleware_1.asyncHandler)(workspaceController.updateWorkspace));
    // Delete a workspace - ONLY SUPER_ADMIN (Owner) (additional protection in controller)
    router.delete('/:id', workspace_validation_middleware_1.validateWorkspaceOperation, workspace_role_middleware_1.requireSuperAdmin, (0, async_middleware_1.asyncHandler)(workspaceController.deleteWorkspace));
    logger_1.default.info('Workspace routes setup complete');
    return router;
};
exports.workspaceRouter = workspaceRouter;
// Exporting for compatibility with existing code
exports.workspaceRoutes = (0, exports.workspaceRouter)();
//# sourceMappingURL=workspace.routes.js.map