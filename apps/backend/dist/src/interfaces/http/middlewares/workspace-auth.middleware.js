"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceAuthMiddleware = void 0;
const logger_1 = __importDefault(require("../../../utils/logger"));
const error_middleware_1 = require("./error.middleware");
/**
 * Middleware to check if user has access to the requested workspace
 * This middleware should be used after the authMiddleware
 */
const workspaceAuthMiddleware = (req, _res, next) => {
    try {
        // Get workspace ID from URL params
        const workspaceId = req.params.workspaceId;
        // Check if workspaceId is empty or just whitespace
        if (!workspaceId || workspaceId.trim() === '') {
            logger_1.default.debug('Workspace ID is empty or missing');
            throw new error_middleware_1.AppError(400, "Workspace ID is required");
        }
        // Skip in test environment if test auth is enabled
        if (process.env.NODE_ENV === 'test' &&
            process.env.INTEGRATION_TEST === 'true' &&
            req.headers['x-test-auth'] === 'true') {
            // For test auth, we need to check if the workspace ID in the URL matches the one in the headers
            const headerWorkspaceId = req.headers['x-workspace-id'];
            if (headerWorkspaceId && workspaceId !== headerWorkspaceId) {
                logger_1.default.debug(`Test environment: Unauthorized workspace access. URL: ${workspaceId}, Header: ${headerWorkspaceId}`);
                throw new error_middleware_1.AppError(403, "You don't have access to this workspace");
            }
            return next();
        }
        // Ensure user is authenticated
        if (!req.user) {
            throw new error_middleware_1.AppError(401, "Authentication required");
        }
        // Check if user has access to the workspace
        const hasAccess = req.user.workspaces &&
            Array.isArray(req.user.workspaces) &&
            req.user.workspaces.some(ws => ws.id === workspaceId);
        if (!hasAccess) {
            logger_1.default.debug(`User ${req.user.id} attempted to access unauthorized workspace ${workspaceId}`);
            throw new error_middleware_1.AppError(403, "You don't have access to this workspace");
        }
        next();
    }
    catch (error) {
        if (error instanceof error_middleware_1.AppError) {
            throw error;
        }
        throw new error_middleware_1.AppError(403, "Workspace authorization failed");
    }
};
exports.workspaceAuthMiddleware = workspaceAuthMiddleware;
//# sourceMappingURL=workspace-auth.middleware.js.map