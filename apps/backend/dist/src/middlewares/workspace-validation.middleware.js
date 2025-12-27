"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWorkspaceUpdateData = exports.validateWorkspaceOperation = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Middleware to validate workspace operations
 * Ensures workspaceId is present and valid (JWT-only authentication)
 */
const validateWorkspaceOperation = (req, res, next) => {
    try {
        // Validate workspaceId (prioritize header, then route params, then body)
        const workspaceId = req.headers["x-workspace-id"] ||
            req.params.id ||
            req.params.workspaceId ||
            req.body.id;
        if (!workspaceId || workspaceId.trim() === "") {
            logger_1.default.warn("Workspace operation rejected: missing workspaceId");
            res.status(400).json({
                error: "Bad Request",
                message: "Workspace ID is required",
            });
            return;
        }
        // Attach workspaceId to request for downstream use
        ;
        req.workspaceId = workspaceId;
        logger_1.default.info(`✅ Workspace validation passed - workspaceId: ${workspaceId.substring(0, 8)}...`);
        next();
    }
    catch (error) {
        logger_1.default.error("Error in workspace validation middleware:", error);
        res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to validate workspace operation",
        });
        return;
    }
};
exports.validateWorkspaceOperation = validateWorkspaceOperation;
/**
 * Middleware to validate workspace update data
 * Validates email format, phone number format, and required fields
 */
const validateWorkspaceUpdateData = (req, res, next) => {
    try {
        const { adminEmail, whatsappPhoneNumber, name, url } = req.body;
        const errors = [];
        // 1. Validate adminEmail format (if provided)
        if (adminEmail !== undefined && adminEmail !== null) {
            if (typeof adminEmail !== "string" || adminEmail.trim() === "") {
                errors.push("Admin email cannot be empty");
            }
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
                errors.push("Admin email must be a valid email address");
            }
        }
        // 2. Validate whatsappPhoneNumber format (if provided)
        if (whatsappPhoneNumber !== undefined &&
            whatsappPhoneNumber !== null &&
            whatsappPhoneNumber !== "") {
            // Remove spaces and check format: should start with + and contain only digits
            const cleanPhone = whatsappPhoneNumber.replace(/\s/g, "");
            if (!/^\+?\d{10,15}$/.test(cleanPhone)) {
                errors.push("WhatsApp phone number must be in international format (e.g., +1234567890) with 10-15 digits");
            }
        }
        // 3. Validate name (if provided)
        if (name !== undefined && name !== null) {
            if (typeof name !== "string" || name.trim() === "") {
                errors.push("Workspace name cannot be empty");
            }
            else if (name.length < 2 || name.length > 100) {
                errors.push("Workspace name must be between 2 and 100 characters");
            }
        }
        // 4. Validate URL format (if provided)
        if (url !== undefined && url !== null && url !== "") {
            try {
                new URL(url);
            }
            catch (_a) {
                errors.push("Workspace URL must be a valid URL (e.g., http://localhost:3000)");
            }
        }
        // 5. Validate boolean fields (if provided)
        if (req.body.isActive !== undefined &&
            typeof req.body.isActive !== "boolean") {
            errors.push("isActive must be a boolean value");
        }
        if (req.body.debugMode !== undefined &&
            typeof req.body.debugMode !== "boolean") {
            errors.push("debugMode must be a boolean value");
        }
        // 6. If errors found, return bad request
        if (errors.length > 0) {
            logger_1.default.warn(`Workspace update validation failed: ${errors.join(", ")}`);
            res.status(400).json({
                error: "Validation Error",
                message: "Invalid workspace data",
                details: errors,
            });
            return;
        }
        logger_1.default.info("✅ Workspace update data validation passed");
        next();
    }
    catch (error) {
        logger_1.default.error("Error in workspace update validation middleware:", error);
        res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to validate workspace update data",
        });
        return;
    }
};
exports.validateWorkspaceUpdateData = validateWorkspaceUpdateData;
//# sourceMappingURL=workspace-validation.middleware.js.map