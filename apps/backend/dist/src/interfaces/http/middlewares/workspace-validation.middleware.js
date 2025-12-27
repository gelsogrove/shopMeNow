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
exports.workspaceValidationMiddleware = void 0;
exports.validateWorkspaceId = validateWorkspaceId;
const prisma_1 = require("../../../lib/prisma");
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * Middleware to validate that a workspace ID is present in the request
 * This can be in the URL params, headers, or user context
 */
const workspaceValidationMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Extract workspace ID from various sources
        let workspaceIdFromParams = req.params.workspaceId;
        const workspaceIdFromQuery = req.query.workspaceId;
        const workspaceIdFromHeaders = req.headers["x-workspace-id"];
        // CRITICAL FIX: If workspaceId is not in params, extract it from URL manually
        if (!workspaceIdFromParams) {
            // Try to match /workspaces/{workspaceId} pattern
            let urlMatch = req.originalUrl.match(/\/workspaces\/([^\/\?]+)/);
            if (urlMatch && urlMatch[1]) {
                workspaceIdFromParams = urlMatch[1];
                // Also set it in params for downstream middleware
                req.params.workspaceId = workspaceIdFromParams;
            }
            else {
                // Try to match /settings/{workspaceId}/gdpr pattern (frontend uses this)
                urlMatch = req.originalUrl.match(/\/settings\/([^\/\?]+)\/gdpr/);
                if (urlMatch && urlMatch[1]) {
                    workspaceIdFromParams = urlMatch[1];
                    // Also set it in params for downstream middleware
                    req.params.workspaceId = workspaceIdFromParams;
                }
                else {
                    // Try to match /analytics/{workspaceId} pattern
                    urlMatch = req.originalUrl.match(/\/analytics\/([^\/\?]+)/);
                    if (urlMatch && urlMatch[1]) {
                        workspaceIdFromParams = urlMatch[1];
                        // Also set it in params for downstream middleware
                        req.params.workspaceId = workspaceIdFromParams;
                    }
                }
            }
        }
        let workspaceId = workspaceIdFromParams || workspaceIdFromQuery || workspaceIdFromHeaders;
        // 🆕 NEW: If still no workspaceId, try to extract from user's workspaces (JWT context)
        if (!workspaceId || workspaceId.trim() === "") {
            const user = req.user;
            const userWorkspaces = (user === null || user === void 0 ? void 0 : user.workspaces) || req.userWorkspaces; // 🔧 FIX: Check both locations
            logger_1.default.info(`🔍 No workspaceId in params/query/headers - checking user context`, {
                user: (user === null || user === void 0 ? void 0 : user.email) || "no user",
                workspacesCount: (userWorkspaces === null || userWorkspaces === void 0 ? void 0 : userWorkspaces.length) || 0,
            });
            // If user has only ONE workspace, use it automatically
            if (userWorkspaces && userWorkspaces.length === 1) {
                workspaceId = userWorkspaces[0].id;
                logger_1.default.info(`✅ Auto-selected single workspace for user: ${workspaceId}`);
            }
            else if (userWorkspaces && userWorkspaces.length > 1) {
                // Multiple workspaces - cannot auto-select
                logger_1.default.warn(`⚠️ User has ${userWorkspaces.length} workspaces - cannot auto-select`);
            }
        }
        if (!workspaceId || workspaceId.trim() === "") {
            // Create debug response with all the information
            const debugResponse = {
                message: "Workspace ID is required",
                debug: {
                    url: req.originalUrl,
                    method: req.method,
                    params: req.params,
                    query: req.query,
                    headers: {
                        "x-workspace-id": req.headers["x-workspace-id"],
                        "workspace-id": req.headers["workspace-id"],
                    },
                    workspaceIdSources: {
                        fromParams: workspaceIdFromParams,
                        fromQuery: workspaceIdFromQuery,
                        fromHeaders: workspaceIdFromHeaders,
                    },
                    finalWorkspaceId: workspaceId,
                },
                sqlQuery: "No SQL query executed - workspace ID missing",
            };
            res.status(400).json(debugResponse);
            return;
        }
        // Check if workspace exists in database
        const workspace = yield prisma_1.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { id: true, name: true, isActive: true, isDelete: true },
        });
        if (!workspace) {
            const debugResponse = {
                message: "Workspace not found",
                debug: {
                    workspaceId,
                    url: req.originalUrl,
                    method: req.method,
                },
            };
            res.status(404).json(debugResponse);
            return;
        }
        // ✅ CRITICAL: Solo workspace.isDelete blocca l'accesso admin
        // workspace.isActive blocca SOLO i messaggi WhatsApp (gestito in LLMService)
        if (workspace.isDelete) {
            logger_1.default.info("❌ Workspace is deleted - blocking access");
            const debugResponse = {
                message: "Workspace is not available",
                debug: {
                    workspaceId,
                    workspace,
                    url: req.originalUrl,
                    method: req.method,
                    reason: "Workspace is deleted",
                },
            };
            res.status(403).json(debugResponse);
            return;
        }
        // ⚠️ Se workspace.isActive = false, permetti comunque accesso admin
        // Il blocco dei messaggi WhatsApp è gestito in LLMService.handleMessage()
        if (!workspace.isActive) {
            logger_1.default.warn(`⚠️ Workspace ${workspaceId} is DISABLED - Admin access allowed, WhatsApp blocked`);
        }
        // Store workspace info in request
        ;
        req.workspace = workspace;
        req.workspaceId = workspaceId;
        next();
    }
    catch (error) {
        logger_1.default.error("Workspace validation error:", error);
        logger_1.default.error("Workspace validation middleware error:", error);
        const debugResponse = {
            message: "Workspace validation failed",
            debug: {
                error: error.message,
                stack: error.stack,
                url: req.originalUrl,
                method: req.method,
            },
            sqlQuery: "Error occurred before SQL execution",
        };
        res.status(500).json(debugResponse);
        return;
    }
});
exports.workspaceValidationMiddleware = workspaceValidationMiddleware;
/**
 * Helper function to validate if a workspace ID exists
 */
function validateWorkspaceId(workspaceId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const workspace = yield prisma_1.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { id: true },
            });
            return !!workspace;
        }
        catch (error) {
            logger_1.default.error(`Error validating workspace ID ${workspaceId}:`, error);
            throw error;
        }
    });
}
//# sourceMappingURL=workspace-validation.middleware.js.map