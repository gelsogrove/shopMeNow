"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.authMiddleware = void 0;
const database_1 = require("@echatbot/database");
const jwt = __importStar(require("jsonwebtoken"));
const config_1 = require("../../../config");
const logger_1 = __importDefault(require("../../../utils/logger"));
const error_middleware_1 = require("../middlewares/error.middleware");
const async_middleware_1 = require("./async.middleware");
// Variabili di ambiente
const isTestEnvironment = process.env.NODE_ENV === "test";
const isIntegrationTest = process.env.INTEGRATION_TEST === "true";
/**
 * Middleware di autenticazione che verifica la presenza e validità del token JWT
 */
const authMiddlewareAsync = (req, _res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // In ambiente di test, verifichiamo la presenza di header speciali
        if (isTestEnvironment && isIntegrationTest) {
            // Headers speciali per i test
            const skipAuth = req.headers["x-test-skip-auth"] === "true";
            const forceAuth = req.headers["x-test-auth"] === "true";
            // Se skip auth è impostato, simuliamo un errore 401 per i test
            if (skipAuth) {
                logger_1.default.debug("Test environment: Simulating authentication failure due to x-test-skip-auth header");
                throw new error_middleware_1.AppError(401, "Authentication required");
            }
            // Se force auth è impostato, simuliamo anche un utente di test
            if (forceAuth) {
                logger_1.default.debug("Test environment: Using mock authentication due to x-test-auth header");
                req.user = {
                    userId: "test-user-id",
                    email: "test@example.com",
                    role: "ADMIN",
                    workspaces: [
                        {
                            id: req.headers["x-workspace-id"] || "test-workspace-id",
                            role: "OWNER",
                        },
                    ],
                };
                return next();
            }
            // Se i test stanno verificando un webhook (o altri percorsi pubblici), possiamo saltare l'autenticazione
            if (req.path.includes("/webhook")) {
                logger_1.default.debug("Test environment: Skipping authentication for webhook path");
                return next();
            }
        }
        // 🔓 PUBLIC ROUTES: Skip authentication for WhatsApp webhooks (use HMAC signature instead)
        if (req.path === "/whatsapp/webhook" ||
            req.path.includes("/whatsapp/webhook")) {
            logger_1.default.debug("🔓 Skipping auth for WhatsApp webhook (public endpoint with HMAC validation)");
            return next();
        }
        // 🛡️ PRIORITY: Authorization header FIRST, then cookies
        // This ensures that when frontend clears localStorage and sends new token in header,
        // we use the new token instead of stale cookie from previous session
        let token;
        // Check Authorization header FIRST (priority)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
            if (token && token.trim() !== "") {
                logger_1.default.info("Using token from Authorization header");
            }
            else {
                token = undefined;
            }
        }
        // Fallback to cookies only if no header token
        if (!token && ((_a = req.cookies) === null || _a === void 0 ? void 0 : _a.auth_token)) {
            token = req.cookies.auth_token;
            logger_1.default.info("Using token from cookie (no Authorization header)");
        }
        if (!token) {
            logger_1.default.info("No token found in headers or cookies");
            throw new error_middleware_1.AppError(401, "Authentication required");
        }
        try {
            logger_1.default.info(`Verifying token: ${token.substring(0, 10)}...`);
            const decoded = jwt.verify(token, config_1.config.jwt.secret);
            logger_1.default.info("Token decoded successfully:", {
                userId: decoded.userId,
                email: decoded.email,
            });
            // Make sure we have a userId
            if (!decoded.userId && !decoded.id) {
                logger_1.default.info("Token doesn't have userId or id field");
                throw new error_middleware_1.AppError(401, "Invalid token format");
            }
            // Normalize userId field
            if (!decoded.userId && decoded.id) {
                decoded.userId = decoded.id;
            }
            // Also ensure id is set (some controllers use req.user.id)
            if (!decoded.id && decoded.userId) {
                decoded.id = decoded.userId;
            }
            // Verify user exists in database and load workspaces
            try {
                // First check if user exists and is not soft-deleted
                const user = yield database_1.prisma.user.findUnique({
                    where: { id: decoded.userId },
                    select: { id: true, email: true, deletedAt: true },
                });
                if (!user) {
                    logger_1.default.info(`User ${decoded.userId} not found in database`);
                    throw new error_middleware_1.AppError(401, "User not found");
                }
                // 🚫 SOFT-DELETE CHECK: Block deleted users from accessing the system
                if (user.deletedAt !== null) {
                    logger_1.default.warn(`🚫 Deleted user attempted access: ${user.email}`, {
                        deletedAt: user.deletedAt,
                    });
                    throw new error_middleware_1.AppError(403, "Your account has been deleted and cannot be accessed");
                }
                logger_1.default.info("User found in database:", user.email);
                // Load user workspaces
                const userWorkspaces = yield database_1.prisma.userWorkspace.findMany({
                    where: { userId: decoded.userId },
                    include: {
                        workspace: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                    },
                });
                logger_1.default.info(`Loaded ${userWorkspaces.length} workspaces for user`);
                // Add workspaces to user object
                decoded.workspaces = userWorkspaces.map((uw) => ({
                    id: uw.workspace.id,
                    name: uw.workspace.name,
                    slug: uw.workspace.slug,
                    role: uw.role,
                }));
                logger_1.default.debug(`Loaded ${userWorkspaces.length} workspaces for user ${decoded.userId}`);
            }
            catch (dbError) {
                logger_1.default.error("Error loading user or workspaces:", dbError);
                if (dbError instanceof error_middleware_1.AppError) {
                    throw dbError;
                }
                throw new error_middleware_1.AppError(401, "Database error during authentication");
            }
            req.user = decoded;
            return next();
        }
        catch (error) {
            logger_1.default.error("❌ Token verification failed:", error);
            logger_1.default.error("   Error name:", error.name);
            logger_1.default.error("   Error message:", error.message);
            logger_1.default.error("   Token (first 30 chars):", token === null || token === void 0 ? void 0 : token.substring(0, 30));
            throw new error_middleware_1.AppError(401, "Invalid token");
        }
    }
    catch (error) {
        logger_1.default.info("Auth middleware error:", error.message);
        if (error instanceof error_middleware_1.AppError) {
            throw error;
        }
        throw new error_middleware_1.AppError(401, "Authentication failed");
    }
});
// Export the wrapped middleware
exports.authMiddleware = (0, async_middleware_1.asyncHandler)(authMiddlewareAsync);
//# sourceMappingURL=auth.middleware.js.map