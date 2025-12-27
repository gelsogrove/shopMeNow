"use strict";
/**
 * Enhanced Authentication Controller
 * Handles advanced auth features: Registration, OAuth, 2FA Setup, Recovery Codes
 *
 * ROUTES:
 * - POST /api/auth/register - Email/password registration
 * - POST /api/auth/setup-2fa - Setup 2FA after registration
 * - POST /api/auth/verify-2fa-setup - Verify 2FA setup code
 * - POST /api/auth/verify-recovery-code - Verify recovery code (2FA bypass)
 * - GET /api/auth/oauth/:provider - Initiate OAuth flow
 * - GET /api/auth/callback/:provider - OAuth callback
 *
 * SECURITY:
 * - Rate limiting on all routes
 * - Mandatory 2FA for all users
 * - Audit logging
 * - Input validation
 */
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
exports.EnhancedAuthController = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const config_1 = require("../../../config");
const oauth_auth_service_1 = require("../../../application/services/oauth-auth.service");
const otp_service_1 = require("../../../application/services/otp.service");
const email_service_1 = require("../../../application/services/email.service");
const admin_session_service_1 = require("../../../application/services/admin-session.service");
const error_middleware_1 = require("../middlewares/error.middleware");
const rateLimit_middleware_1 = require("../../../middlewares/rateLimit.middleware");
const logger_1 = __importDefault(require("../../../utils/logger"));
const database_1 = require("@echatbot/database");
class EnhancedAuthController {
    constructor() {
        this.oauthAuthService = new oauth_auth_service_1.OAuthAuthService(database_1.prisma);
        this.otpService = new otp_service_1.OtpService(database_1.prisma);
        this.emailService = new email_service_1.EmailService();
        this.adminSessionService = new admin_session_service_1.AdminSessionService();
    }
    /**
     * Generate JWT token
     */
    generateToken(user) {
        const signOptions = {
            // @ts-ignore
            expiresIn: config_1.config.jwt.expiresIn,
        };
        return jwt.sign({
            id: user.id,
            email: user.email,
            role: user.role,
            isPlatformAdmin: user.isPlatformAdmin || false,
            isDeveloperUser: user.isDeveloperUser || false,
            twoFactorEnabled: user.twoFactorEnabled
        }, config_1.config.jwt.secret, signOptions);
    }
    /**
     * Register new user with email/password
     * POST /api/auth/register
     *
     * Body: { email, password, firstName, lastName, gdprAccepted }
     * Response: { user, qrCode } - User created, must setup 2FA next
     */
    register(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, password, firstName, lastName, gdprAccepted } = req.body;
                const ipAddress = req.ip || req.socket.remoteAddress;
                const userAgent = req.headers['user-agent'];
                // Validate input
                if (!email || !password || !firstName || !lastName) {
                    throw new error_middleware_1.AppError(400, 'Missing required fields');
                }
                if (!gdprAccepted) {
                    throw new error_middleware_1.AppError(400, 'GDPR acceptance is required');
                }
                // Register user
                const user = yield this.oauthAuthService.registerWithEmail({
                    email,
                    password,
                    firstName,
                    lastName,
                    gdprAccepted: new Date(),
                }, ipAddress, userAgent);
                // Generate 2FA QR code
                const qrCode = yield this.otpService.setupTwoFactor(user.id);
                // 🔒 SECURITY: NO session/token until 2FA is verified!
                // User must complete 2FA setup before getting authenticated
                // Send welcome email
                try {
                    yield this.emailService.sendWelcomeEmail({
                        to: user.email,
                        firstName: user.firstName,
                    });
                    logger_1.default.info(`✅ Welcome email sent to: ${user.email}`);
                }
                catch (emailError) {
                    logger_1.default.error('Failed to send welcome email', emailError);
                    // Don't fail registration if email fails
                }
                res.status(201).json({
                    message: 'Registration successful. Please setup 2FA.',
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                    },
                    qrCode, // QR code for 2FA setup
                    // NO sessionId or token - user must verify 2FA first!
                });
            }
            catch (error) {
                if (error instanceof error_middleware_1.AppError) {
                    throw error;
                }
                logger_1.default.error('Registration error:', error);
                throw new error_middleware_1.AppError(500, 'Registration failed');
            }
        });
    }
    /**
     * Verify 2FA setup and enable 2FA
     * POST /api/auth/verify-2fa-setup
     *
     * Body: { userId, code }
     * Response: { recoveryCodes } - 2FA enabled, return recovery codes
     */
    verify2FASetup(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info('🔍 [verify2FASetup] ENTRY POINT - Method called', {
                url: req.url,
                method: req.method,
                body: req.body,
            });
            try {
                logger_1.default.info('🔍 [verify2FASetup] Inside try block');
                const { userId, code } = req.body;
                const ipAddress = req.ip || req.socket.remoteAddress;
                const userAgent = req.headers['user-agent'];
                if (!userId || !code) {
                    logger_1.default.error('❌ [verify2FASetup] Missing userId or code');
                    throw new error_middleware_1.AppError(400, 'User ID and verification code are required');
                }
                logger_1.default.info(`🔍 [verify2FASetup] Verifying TOTP for user: ${userId}`);
                // Verify TOTP code
                const isValid = yield this.otpService.verifyTwoFactor(userId, code);
                if (!isValid) {
                    yield (0, rateLimit_middleware_1.logAuthAttempt)({
                        userId,
                        email: 'unknown',
                        attemptType: '2fa',
                        success: false,
                        failureReason: 'Invalid 2FA code during setup',
                        ipAddress,
                        userAgent,
                    });
                    throw new error_middleware_1.AppError(400, 'Invalid verification code');
                }
                // Enable 2FA (Feature 189: Recovery codes removed)
                yield this.oauthAuthService.enable2FA(userId);
                // Get user info
                const user = yield database_1.prisma.user.findUnique({
                    where: { id: userId },
                    select: {
                        id: true,
                        email: true,
                        role: true,
                        firstName: true,
                        lastName: true,
                        authProvider: true,
                        profilePicture: true,
                    },
                });
                if (!user) {
                    throw new error_middleware_1.AppError(404, 'User not found');
                }
                logger_1.default.info('🔍 [verify2FASetup] User fetched from DB:', {
                    userId: user.id,
                    email: user.email
                });
                // ❌ REMOVED: Automatic workspace creation
                // User MUST create workspace manually after registration
                // This allows users to customize workspace name, phone number, etc.
                // 🔐 CREATE ADMIN SESSION (user is now fully authenticated after 2FA setup)
                const sessionId = yield this.adminSessionService.createSession(user.id, null, // workspaceId: null (will be set after workspace selection)
                ipAddress, userAgent);
                logger_1.default.info(`✅ User ${user.email} completed 2FA setup with sessionId: ${sessionId.substring(0, 8)}...`);
                // Generate JWT token (user is now fully authenticated)
                const token = this.generateToken(user);
                // 🔍 DEBUG: Decode token to verify content
                const decodedToken = jwt.decode(token);
                logger_1.default.info('🔍 [verify2FASetup] Token generated for user:', {
                    userId: user.id,
                    email: user.email,
                    tokenPreview: token.substring(0, 20) + '...',
                    decodedToken: {
                        id: decodedToken === null || decodedToken === void 0 ? void 0 : decodedToken.id,
                        email: decodedToken === null || decodedToken === void 0 ? void 0 : decodedToken.email,
                        role: decodedToken === null || decodedToken === void 0 ? void 0 : decodedToken.role,
                    }
                });
                yield (0, rateLimit_middleware_1.logAuthAttempt)({
                    userId,
                    email: user.email,
                    attemptType: '2fa',
                    success: true,
                    ipAddress,
                    userAgent,
                    metadata: { action: 'setup_complete' },
                });
                res.status(200).json({
                    message: '2FA enabled successfully',
                    // NOTE: Recovery codes removed (Feature 189) - users contact admin for reset
                    token, // JWT token for API calls
                    sessionId, // 🆕 Include sessionId for frontend
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        role: user.role,
                        authProvider: user.authProvider || 'email',
                        profilePicture: user.profilePicture,
                    },
                });
            }
            catch (error) {
                if (error instanceof error_middleware_1.AppError) {
                    throw error;
                }
                logger_1.default.error('2FA setup verification error:', error);
                throw new error_middleware_1.AppError(500, '2FA setup verification failed');
            }
        });
    }
    /**
     * Verify 2FA code (TOTP) during LOGIN
     * POST /api/auth/verify-2fa
     *
     * Called after user enters email/password and system detects 2FA is enabled.
     * Verifies TOTP code and creates session + token for authenticated user.
     */
    verify2FA(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId, code } = req.body;
                const ipAddress = req.ip || req.socket.remoteAddress;
                const userAgent = req.headers['user-agent'];
                if (!userId || !code) {
                    throw new error_middleware_1.AppError(400, 'ID utente e codice di verifica sono richiesti');
                }
                // Verify TOTP code
                const isValid = yield this.otpService.verifyTwoFactor(userId, code);
                if (!isValid) {
                    yield (0, rateLimit_middleware_1.logAuthAttempt)({
                        userId,
                        email: '', // Will be filled after user fetch
                        attemptType: '2fa',
                        success: false,
                        failureReason: 'Codice TOTP non valido',
                        ipAddress,
                        userAgent,
                    });
                    throw new error_middleware_1.AppError(401, 'Invalid verification code');
                }
                // TOTP valid - fetch user and create session
                const user = yield database_1.prisma.user.findUnique({ where: { id: userId } });
                if (!user) {
                    throw new error_middleware_1.AppError(404, 'User not found');
                }
                // 🕐 Update lastLogin timestamp (2FA verification is the actual login completion)
                yield database_1.prisma.user.update({
                    where: { id: userId },
                    data: { lastLogin: new Date() },
                });
                logger_1.default.info(`🕐 Updated lastLogin for user ${user.email} after 2FA verification`);
                // Log successful 2FA
                yield (0, rateLimit_middleware_1.logAuthAttempt)({
                    userId,
                    email: user.email,
                    attemptType: '2fa',
                    success: true,
                    ipAddress,
                    userAgent,
                    metadata: { method: 'totp' },
                });
                // 🔐 CREATE ADMIN SESSION (CRITICAL - only after 2FA verified)
                const sessionId = yield this.adminSessionService.createSession(user.id, null, // workspaceId: null (will be set after workspace selection)
                ipAddress, userAgent);
                logger_1.default.info(`✅ User ${user.email} verified 2FA with sessionId: ${sessionId.substring(0, 8)}...`);
                // Generate JWT token
                const token = this.generateToken(user);
                res.status(200).json({
                    valid: true,
                    message: 'Verifica 2FA completata con successo',
                    token,
                    sessionId, // 🆕 CRITICAL: Include sessionId for frontend to save
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        role: user.role,
                        authProvider: user.authProvider || 'email',
                        profilePicture: this.oauthAuthService.getUserAvatar(user),
                    },
                });
            }
            catch (error) {
                if (error instanceof error_middleware_1.AppError) {
                    throw error;
                }
                logger_1.default.error('Errore verifica 2FA:', error);
                throw new error_middleware_1.AppError(500, 'Verifica 2FA fallita');
            }
        });
    }
    /**
     * Verify recovery code (2FA bypass)
     * POST /api/auth/verify-recovery-code
     *
     * Body: { userId, code }
     * Response: { valid, sessionId, token } - If valid, logs user in
     */
    verifyRecoveryCode(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId, code } = req.body;
                const ipAddress = req.ip || req.socket.remoteAddress;
                const userAgent = req.headers['user-agent'];
                if (!userId || !code) {
                    throw new error_middleware_1.AppError(400, 'ID utente e codice di recupero sono richiesti');
                }
                const user = yield database_1.prisma.user.findUnique({ where: { id: userId } });
                if (!user) {
                    throw new error_middleware_1.AppError(404, 'Utente non trovato');
                }
                // Verify recovery code
                const result = yield this.oauthAuthService.verifyRecoveryCode(userId, code);
                if (!result.valid) {
                    yield (0, rateLimit_middleware_1.logAuthAttempt)({
                        userId,
                        email: user.email,
                        attemptType: '2fa',
                        success: false,
                        failureReason: 'Codice di recupero non valido',
                        ipAddress,
                        userAgent,
                    });
                    throw new error_middleware_1.AppError(401, 'Codice di recupero non valido'); // 401 for authentication failure
                }
                // Recovery code valid - log user in
                yield (0, rateLimit_middleware_1.logAuthAttempt)({
                    userId,
                    email: user.email,
                    attemptType: '2fa',
                    success: true,
                    ipAddress,
                    userAgent,
                    metadata: { method: 'recovery_code' },
                });
                // 🔐 CREATE ADMIN SESSION
                const sessionId = yield this.adminSessionService.createSession(user.id, null, // workspaceId: null (will be set after workspace selection)
                ipAddress, userAgent);
                logger_1.default.info(`✅ User ${user.email} logged in via recovery code with sessionId: ${sessionId.substring(0, 8)}...`);
                // Generate JWT token
                const token = this.generateToken(user);
                res.status(200).json({
                    valid: true, // For compatibility with frontend
                    message: 'Codice di recupero accettato',
                    token,
                    sessionId, // 🆕 Include sessionId for frontend
                    newRecoveryCode: result.newRecoveryCode, // ✅ Return new recovery code to user
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        profilePicture: this.oauthAuthService.getUserAvatar(user),
                    },
                });
            }
            catch (error) {
                if (error instanceof error_middleware_1.AppError) {
                    throw error;
                }
                logger_1.default.error('Errore verifica codice di recupero:', error);
                throw new error_middleware_1.AppError(500, 'Verifica codice di recupero fallita');
            }
        });
    }
    /**
     * OAuth login/registration callback
     * This is called by OAuth strategies after successful authentication
     *
     * @param profile - OAuth profile from provider
     * @param req - Express request
     * @param res - Express response
     */
    handleOAuthCallback(profile, req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                const ipAddress = req.ip || req.socket.remoteAddress;
                const userAgent = req.headers['user-agent'];
                // Register or login user
                const { user, isNew } = yield this.oauthAuthService.registerOrLoginWithOAuth({
                    email: profile.email,
                    firstName: profile.firstName || ((_a = profile.name) === null || _a === void 0 ? void 0 : _a.givenName) || '',
                    lastName: profile.lastName || ((_b = profile.name) === null || _b === void 0 ? void 0 : _b.familyName) || '',
                    profilePicture: profile.picture || ((_d = (_c = profile.photos) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.value),
                    provider: profile.provider,
                }, ipAddress, userAgent);
                // If new user or 2FA not enabled, must setup 2FA
                // Check if user has twoFactorSecret (indicates 2FA setup completed)
                const needs2FASetup = isNew || !user.twoFactorSecret;
                if (needs2FASetup) {
                    // Generate QR code
                    const qrCode = yield this.otpService.setupTwoFactor(user.id);
                    // Redirect to 2FA setup page
                    const setupUrl = `${process.env.FRONTEND_URL}/auth/setup-2fa?userId=${user.id}&qrCode=${encodeURIComponent(qrCode)}&provider=${profile.provider}`;
                    return res.redirect(setupUrl);
                }
                // Existing user with 2FA - redirect to 2FA verification
                const verifyUrl = `${process.env.FRONTEND_URL}/auth/verify-2fa?userId=${user.id}&provider=${profile.provider}`;
                res.redirect(verifyUrl);
            }
            catch (error) {
                logger_1.default.error('OAuth callback error:', error);
                const errorUrl = `${process.env.FRONTEND_URL}/auth/login?error=oauth_failed`;
                res.redirect(errorUrl);
            }
        });
    }
    /**
     * Get user avatar (profile picture or default)
     * GET /api/auth/avatar/:userId
     */
    getUserAvatar(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId } = req.params;
                const user = yield database_1.prisma.user.findUnique({
                    where: { id: userId },
                });
                if (!user) {
                    throw new error_middleware_1.AppError(404, 'User not found');
                }
                const avatarUrl = this.oauthAuthService.getUserAvatar(user);
                res.status(200).json({ avatarUrl });
            }
            catch (error) {
                if (error instanceof error_middleware_1.AppError) {
                    throw error;
                }
                logger_1.default.error('Get avatar error:', error);
                throw new error_middleware_1.AppError(500, 'Failed to get avatar');
            }
        });
    }
}
exports.EnhancedAuthController = EnhancedAuthController;
//# sourceMappingURL=enhanced-auth.controller.js.map