"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceContextMiddleware = void 0;
const workspace_context_dto_1 = require("../../../application/dtos/workspace-context.dto");
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * Middleware to extract and validate workspace context from request
 * This middleware checks for workspace ID in request parameters, query, body, or headers
 */
const workspaceContextMiddleware = (req, res, next) => {
    try {
        logger_1.default.info('Middleware - Before extracting workspace context');
        // Extract workspace context from request using the DTO factory method
        const workspaceContext = workspace_context_dto_1.WorkspaceContextDTO.fromRequest(req);
        logger_1.default.info('Middleware - After extracting workspace context:', workspaceContext);
        // Check if workspaceContext exists and is valid
        if (!workspaceContext) {
            logger_1.default.info('Middleware - workspaceContext is null');
            // Safely log parameters without accessing potentially undefined properties
            const paramsStr = req.params ? JSON.stringify(req.params) : 'undefined';
            const headerId = req.headers ? req.headers["x-workspace-id"] : 'undefined';
            logger_1.default.warn(`No workspace context found in request: ${paramsStr} or ${headerId}`);
            return res.status(400).json({ error: "Invalid workspace ID format" });
        }
        // Check if workspaceContext is valid
        if (!workspaceContext.isValid()) {
            logger_1.default.info('Middleware - workspaceContext is invalid');
            logger_1.default.warn(`Invalid workspace context: ${JSON.stringify(workspaceContext)}`);
            return res.status(400).json({ error: "Invalid workspace ID format" });
        }
        logger_1.default.info('Middleware - workspaceContext is valid');
        // Attach workspace context to request for downstream use
        req.workspaceContext = workspaceContext;
        next();
    }
    catch (error) {
        logger_1.default.info('Middleware - Error caught:', error);
        logger_1.default.error(`Error in workspace context middleware: ${error}`);
        return res.status(500).json({ error: "Internal server error" });
    }
};
exports.workspaceContextMiddleware = workspaceContextMiddleware;
//# sourceMappingURL=workspace-context.middleware.js.map