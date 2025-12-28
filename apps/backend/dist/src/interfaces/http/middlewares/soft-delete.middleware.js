"use strict";
/**
 * Login Blocking Middleware - Prevents deleted accounts from accessing the system
 * Checks user.deletedAt in database (NOT from JWT - deletedAt is not in token)
 */
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
exports.requirePlatformAdmin = exports.loginBlockingMiddleware = void 0;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * Middleware to check if user account is deleted
 * Must run AFTER authMiddleware (which sets req.user)
 * IMPORTANT: Queries database because deletedAt is NOT in JWT token
 * Call: router.use(loginBlockingMiddleware)
 */
const loginBlockingMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Skip if no user (unauthenticated routes)
        if (!req.user) {
            return next();
        }
        // Get user ID from JWT (cast to any to access id)
        const jwtUser = req.user;
        if (!jwtUser.id) {
            return next();
        }
        // Query database to check deletedAt (not stored in JWT)
        // Cast to any because Prisma types may be cached without deletedAt field
        const dbUser = yield database_1.prisma.user.findUnique({
            where: { id: jwtUser.id },
            select: { deletedAt: true, email: true },
        });
        // If user not found in DB, allow request (will fail elsewhere)
        if (!dbUser) {
            return next();
        }
        // Check if user is soft-deleted
        if (dbUser.deletedAt !== null) {
            const daysRemaining = calculateDaysRemaining(dbUser.deletedAt);
            logger_1.default.warn(`Deleted user attempted login: ${dbUser.email}`, {
                deletedAt: dbUser.deletedAt,
                daysRemaining,
            });
            return res.status(403).json({
                error: "Account deleted",
                message: "Your account has been deleted and cannot be accessed",
                daysUntilPermanentDelete: daysRemaining,
                deletedAt: dbUser.deletedAt,
            });
        }
        next();
    }
    catch (error) {
        logger_1.default.error("Login blocking middleware error", error);
        next(); // Allow request to continue on error (fail-open for safety)
    }
});
exports.loginBlockingMiddleware = loginBlockingMiddleware;
/**
 * Calculate days remaining until permanent hard-delete
 */
function calculateDaysRemaining(deletedAt, retentionDays = 90) {
    const deleted = new Date(deletedAt);
    const expiryDate = new Date(deleted);
    expiryDate.setDate(expiryDate.getDate() + retentionDays);
    const now = new Date();
    const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysRemaining);
}
/**
 * Middleware to require platform admin role
 * Must run AFTER authMiddleware
 * Only allows users with isPlatformAdmin = true
 * NO workspace admin access
 */
const requirePlatformAdmin = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                error: "Unauthorized",
                message: "Authentication required",
            });
        }
        // Check isPlatformAdmin flag (cast to any to access soft-delete properties)
        const user = req.user;
        if (!user.isPlatformAdmin) {
            logger_1.default.warn(`Non-admin user attempted restricted access: ${user.email}`, {
                isPlatformAdmin: user.isPlatformAdmin,
                path: req.path,
            });
            return res.status(403).json({
                error: "Forbidden",
                message: "Platform admin access required",
            });
        }
        next();
    }
    catch (error) {
        logger_1.default.error("Platform admin middleware error", error);
        res.status(500).json({
            error: "Internal server error",
            message: "Authentication check failed",
        });
    }
};
exports.requirePlatformAdmin = requirePlatformAdmin;
//# sourceMappingURL=soft-delete.middleware.js.map