"use strict";
/**
 * Platform Admin Middleware
 *
 * Verifies that the authenticated user has isPlatformAdmin = true
 * This middleware MUST be used AFTER authMiddleware
 *
 * Usage:
 *   router.get('/admin-route', authMiddleware, platformAdminMiddleware, controller.method)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformAdminMiddleware = void 0;
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * Middleware to verify platform admin access
 * Returns 403 Forbidden if user is not a platform admin
 */
const platformAdminMiddleware = (req, res, next) => {
    try {
        // Ensure user is authenticated (authMiddleware should have run first)
        // Using type assertion since authMiddleware adds user to request
        const user = req.user;
        if (!user) {
            logger_1.default.warn("platformAdminMiddleware: No user in request - authMiddleware may not have run");
            res.status(401).json({
                success: false,
                error: "Authentication required",
            });
            return;
        }
        // Check if user is platform admin
        if (!user.isPlatformAdmin) {
            logger_1.default.warn(`Platform admin access denied for user: ${user.email}`);
            res.status(403).json({
                success: false,
                error: "Platform admin access required",
                message: "You do not have permission to access this resource",
            });
            return;
        }
        logger_1.default.info(`Platform admin access granted for user: ${user.email}`);
        next();
    }
    catch (error) {
        logger_1.default.error("platformAdminMiddleware error:", error);
        res.status(500).json({
            success: false,
            error: "Internal server error",
        });
    }
};
exports.platformAdminMiddleware = platformAdminMiddleware;
//# sourceMappingURL=platform-admin.middleware.js.map