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
exports.authRouter = exports.createAuthRouter = void 0;
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../../../utils/logger"));
const enhanced_auth_controller_1 = require("../controllers/enhanced-auth.controller");
const oauth_controller_1 = require("../controllers/oauth.controller");
const auth_service_1 = require("../../../application/services/auth.service");
const async_middleware_1 = require("../middlewares/async.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validation_middleware_1 = require("../middlewares/validation.middleware");
// Prisma client and services
// prisma imported
const authService = new auth_service_1.AuthService(database_1.prisma);
// Rate limiters
// 🔒 LOGIN RATE LIMITER (OWASP A07:2021 - Protection against brute force attacks)
// DEVELOPMENT SETTINGS: 15 minutes window, max 50 attempts (increased for testing)
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Max 50 login attempts per IP per 15 minutes (increased for development)
    message: {
        error: "Too many login attempts",
        message: "Too many login attempts from this IP, please try again after 15 minutes",
        retryAfter: "15 minutes",
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        logger_1.default.info(`🚨 RATE LIMIT EXCEEDED for IP ${req.ip} on ${req.path}`);
        res.status(429).json({
            error: "Too many login attempts",
            message: "Too many login attempts from this IP, please try again after 15 minutes",
            retryAfter: "15 minutes",
        });
    },
});
const twoFactorLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 🧪 INCREASED for testing (was 3) - CHANGE BACK TO 3 IN PRODUCTION
    message: {
        error: "Too many 2FA verification attempts, please try again later",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
const registerLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // limit each IP to 3 requests per windowMs
    message: { error: "Too many registration attempts, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
});
const passwordResetLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // limit each IP to 3 password reset requests per windowMs
    message: {
        error: "Too many password reset attempts, please try again later",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
const createAuthRouter = (authController) => {
    const router = (0, express_1.Router)();
    // Initialize enhanced auth controller
    const enhancedAuthController = new enhanced_auth_controller_1.EnhancedAuthController();
    // Initialize OAuth controller
    const oauthController = new oauth_controller_1.OAuthController();
    // ============================================
    // EXISTING ROUTES (Manteniamo compatibilità)
    // ============================================
    // 🔒 OWASP A07: Brute force protection on login endpoint (max 5 attempts per IP per 15 min)
    router.post("/login", loginLimiter, (0, async_middleware_1.asyncHandler)(authController.login.bind(authController)));
    router.get("/me", auth_middleware_1.authMiddleware, (0, async_middleware_1.asyncHandler)(authController.me.bind(authController)));
    router.post("/logout", auth_middleware_1.authMiddleware, (0, async_middleware_1.asyncHandler)(authController.logout.bind(authController)));
    // OLD register route (kept for backwards compatibility)
    router.post("/register-old", registerLimiter, (0, async_middleware_1.asyncHandler)(authController.register.bind(authController)));
    // 2FA routes (existing)
    router.get("/2fa/setup/:userId", twoFactorLimiter, (0, async_middleware_1.asyncHandler)(authController.setup2FA.bind(authController)));
    router.post("/2fa/verify", twoFactorLimiter, (0, async_middleware_1.asyncHandler)(authController.verify2FA.bind(authController)));
    // Password reset routes
    router.post("/forgot-password", passwordResetLimiter, validation_middleware_1.validateForgotPassword, (0, async_middleware_1.asyncHandler)(authController.forgotPassword.bind(authController)));
    router.post("/reset-password", passwordResetLimiter, validation_middleware_1.validateResetPassword, (0, async_middleware_1.asyncHandler)(authController.resetPassword.bind(authController)));
    // ============================================
    // NEW ENHANCED ROUTES (Multi-provider 2FA)
    // ============================================
    // Email/Password Registration (NEW - with mandatory 2FA)
    router.post("/register", registerLimiter, (0, async_middleware_1.asyncHandler)(enhancedAuthController.register.bind(enhancedAuthController)));
    // 2FA Setup Verification (NEW)
    // 🔒 NO AUTH REQUIRED - User hasn't authenticated yet (just registered)
    router.post("/verify-2fa-setup", 
    // Temporarily remove rate limiter to test if it's causing 401
    (0, async_middleware_1.asyncHandler)(enhancedAuthController.verify2FASetup.bind(enhancedAuthController)));
    // 2FA Login Verification (NEW)
    // 🔒 NO AUTH REQUIRED - User is verifying 2FA during login (creates sessionId)
    router.post("/verify-2fa", twoFactorLimiter, (0, async_middleware_1.asyncHandler)(enhancedAuthController.verify2FA.bind(enhancedAuthController)));
    // Recovery Code Verification - DEPRECATED (Feature 189)
    // Recovery codes have been removed. Users who lose access must contact admin for reset.
    router.post("/verify-recovery-code", (_req, res) => {
        res.status(410).json({
            error: 'Recovery codes have been removed',
            message: 'Please contact your administrator to reset your 2FA.',
        });
    });
    // Get User Avatar (NEW)
    router.get("/avatar/:userId", (0, async_middleware_1.asyncHandler)(enhancedAuthController.getUserAvatar.bind(enhancedAuthController)));
    // ============================================
    // SET PASSWORD FOR OAUTH USERS (Feature 189)
    // ============================================
    /**
     * @swagger
     * /api/auth/set-password:
     *   post:
     *     summary: Set password for OAuth user
     *     description: |
     *       Allows OAuth users (Google, etc.) to set a password.
     *       After setting password, user becomes "multi" provider
     *       and can login with either OAuth or email/password.
     *     tags: [Auth]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - password
     *             properties:
     *               password:
     *                 type: string
     *                 minLength: 8
     *                 description: New password (min 8 chars, must include uppercase, lowercase, number, special char)
     *     responses:
     *       200:
     *         description: Password set successfully
     *       400:
     *         description: Already has password or invalid password
     *       401:
     *         description: Not authenticated
     */
    router.post("/set-password", auth_middleware_1.authMiddleware, (0, async_middleware_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const userId = req.user.id;
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }
        yield authService.setPasswordForOAuthUser(userId, password);
        res.json({
            success: true,
            message: 'Password set successfully. You can now login with email/password too.',
        });
    })));
    // ============================================
    // OAUTH ROUTES (Google, Facebook, Apple)
    // ============================================
    // Google OAuth - Login/Register
    router.post("/oauth/google", loginLimiter, // Same rate limit as regular login
    (0, async_middleware_1.asyncHandler)(oauthController.googleAuth.bind(oauthController)));
    return router;
};
exports.createAuthRouter = createAuthRouter;
exports.authRouter = exports.createAuthRouter;
//# sourceMappingURL=auth.routes.js.map