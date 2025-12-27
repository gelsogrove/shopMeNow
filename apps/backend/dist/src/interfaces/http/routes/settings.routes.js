"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsRouter = void 0;
exports.default = createSettingsRouter;
const express_1 = require("express");
const logger_1 = __importDefault(require("../../../utils/logger"));
const settings_controller_1 = require("../controllers/settings.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const workspace_auth_middleware_1 = require("../middlewares/workspace-auth.middleware");
const workspace_validation_middleware_1 = require("../middlewares/workspace-validation.middleware");
/**
 * Creates and configures routes for whatsapp settings
 */
const settingsRouter = (controller) => {
    const router = (0, express_1.Router)({ mergeParams: true });
    logger_1.default.info("Setting up settings routes");
    // Apply auth middleware first (but it will be skipped in test environment)
    // This ensures all routes have authentication in production
    if (process.env.NODE_ENV === 'production') {
        router.use(auth_middleware_1.authMiddleware);
    }
    else {
        // In non-production environments, still use auth but allow test bypasses
        router.use(auth_middleware_1.authMiddleware);
    }
    // CRITICAL FIX: Apply workspace validation middleware only to specific routes that need it
    // Don't apply it globally as it interferes with parameter extraction
    // Routes for GDPR content (simplified - no workspace validation middleware)
    router.get("/gdpr", auth_middleware_1.authMiddleware, controller.getGdprContent.bind(controller));
    router.put("/gdpr", auth_middleware_1.authMiddleware, controller.updateGdprContent.bind(controller));
    router.get("/default-gdpr", controller.getDefaultGdprContent.bind(controller));
    // Routes for general settings (with workspace validation)
    router.get("/", workspace_validation_middleware_1.workspaceValidationMiddleware, workspace_auth_middleware_1.workspaceAuthMiddleware, controller.getSettings.bind(controller));
    router.put("/", workspace_validation_middleware_1.workspaceValidationMiddleware, workspace_auth_middleware_1.workspaceAuthMiddleware, controller.updateSettings.bind(controller));
    router.delete("/", workspace_validation_middleware_1.workspaceValidationMiddleware, workspace_auth_middleware_1.workspaceAuthMiddleware, controller.deleteSettings.bind(controller));
    logger_1.default.info("Settings routes setup complete");
    return router;
};
exports.settingsRouter = settingsRouter;
/**
 * Creates a route instance with settings controller
 */
function createSettingsRouter() {
    return (0, exports.settingsRouter)(new settings_controller_1.SettingsController());
}
//# sourceMappingURL=settings.routes.js.map