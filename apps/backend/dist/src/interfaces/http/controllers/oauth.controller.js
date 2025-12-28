"use strict";
/**
 * OAuth Controller
 * Handles Google OAuth authentication
 *
 * ROUTES:
 * - POST /api/auth/oauth/google - Verify Google token and login/register
 *
 * FLOW:
 * 1. Frontend gets Google token via @react-oauth/google
 * 2. Frontend sends token to /auth/oauth/google
 * 3. Backend verifies token with Google
 * 4. If user exists: Login (check 2FA)
 * 5. If new user: Register + Setup 2FA
 *
 * SECURITY:
 * - Google token verification
 * - Mandatory 2FA for all users
 * - Audit logging
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
exports.OAuthController = void 0;
const google_auth_library_1 = require("google-auth-library");
const jwt = __importStar(require("jsonwebtoken"));
const config_1 = require("../../../config");
const oauth_auth_service_1 = require("../../../application/services/oauth-auth.service");
const admin_session_service_1 = require("../../../application/services/admin-session.service");
const otp_service_1 = require("../../../application/services/otp.service");
const error_middleware_1 = require("../middlewares/error.middleware");
const rateLimit_middleware_1 = require("../../../middlewares/rateLimit.middleware");
const logger_1 = __importDefault(require("../../../utils/logger"));
const database_1 = require("@echatbot/database");
class OAuthController {
    constructor() {
        this.oauthAuthService = new oauth_auth_service_1.OAuthAuthService(database_1.prisma);
        this.adminSessionService = new admin_session_service_1.AdminSessionService();
        this.otpService = new otp_service_1.OtpService(database_1.prisma);
        // Initialize Google OAuth client
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        if (!googleClientId) {
            logger_1.default.error('❌ GOOGLE_CLIENT_ID not configured in .env');
            throw new Error('Google OAuth not configured');
        }
        this.googleClient = new google_auth_library_1.OAuth2Client(googleClientId);
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
     * Google OAuth Login/Register
     * POST /api/auth/oauth/google
     *
     * Body:
     * - credential: Google ID token (JWT from Google)
     *
     * Response:
     * - NEW USER: { requiresSetup: true, userId, email, firstName, lastName, qrCode, provider: 'google' }
     * - EXISTING USER (2FA enabled): { requires2FA: true, userId, email, provider: 'google' }
     * - EXISTING USER (no 2FA): { sessionId, token, user } (should not happen - all users must have 2FA)
     */
    googleAuth(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { credential } = req.body;
                if (!credential) {
                    throw new error_middleware_1.AppError(400, 'Google credential required');
                }
                const ipAddress = req.headers['x-forwarded-for'] || req.ip || 'unknown';
                const userAgent = req.headers['user-agent'] || 'unknown';
                logger_1.default.info('🔐 [OAuth Google] Verifying Google token');
                // Verify Google token
                let ticket;
                try {
                    ticket = yield this.googleClient.verifyIdToken({
                        idToken: credential,
                        audience: process.env.GOOGLE_CLIENT_ID,
                    });
                }
                catch (error) {
                    logger_1.default.error('❌ [OAuth Google] Token verification failed:', error);
                    throw new error_middleware_1.AppError(401, 'Invalid Google token');
                }
                const payload = ticket.getPayload();
                if (!payload) {
                    throw new error_middleware_1.AppError(401, 'Invalid Google token payload');
                }
                const { email, given_name, family_name, picture, sub: googleId } = payload;
                if (!email) {
                    throw new error_middleware_1.AppError(400, 'Email not provided by Google');
                }
                logger_1.default.info(`🔍 [OAuth Google] User from Google: ${email}`);
                // Check if user exists
                const existingUser = yield database_1.prisma.user.findUnique({
                    where: { email },
                    select: {
                        id: true,
                        email: true,
                        role: true,
                        firstName: true,
                        lastName: true,
                        status: true, // 🚫 User status check
                        twoFactorEnabled: true,
                        twoFactorSecret: true,
                        authProvider: true,
                        profilePicture: true,
                        isPlatformAdmin: true, // 🔐 Platform Admin check
                        isDeveloperUser: true, // 🔧 Developer User check
                    },
                });
                // CASE 1: USER EXISTS
                if (existingUser) {
                    logger_1.default.info(`✅ [OAuth Google] Existing user found: ${email}`);
                    // 🚫 Check if user is disabled - block access before anything else
                    if (existingUser.status !== 'ACTIVE') {
                        logger_1.default.warn(`🚫 [OAuth Google] Login attempt for disabled user: ${email}`);
                        throw new error_middleware_1.AppError(403, 'Your account has been disabled. Please contact support.');
                    }
                    // Update profile picture if changed
                    if (picture && picture !== existingUser.profilePicture) {
                        yield database_1.prisma.user.update({
                            where: { id: existingUser.id },
                            data: { profilePicture: picture },
                        });
                        logger_1.default.info(`🖼️ [OAuth Google] Updated profile picture for ${email}`);
                    }
                    // 🔐 SKIP 2FA for Platform Admins and Developer Users
                    const skip2FA = existingUser.isPlatformAdmin || existingUser.isDeveloperUser;
                    if (skip2FA) {
                        logger_1.default.info(`🔧 [OAuth Google] User ${email} SKIPPING 2FA (isPlatformAdmin=${existingUser.isPlatformAdmin}, isDeveloperUser=${existingUser.isDeveloperUser})`);
                        // 🕐 Update lastLogin timestamp
                        yield database_1.prisma.user.update({
                            where: { id: existingUser.id },
                            data: { lastLogin: new Date() },
                        });
                        logger_1.default.info(`🕐 [OAuth Google] Updated lastLogin for ${email}`);
                        // Create session immediately (no 2FA required)
                        const sessionId = yield this.adminSessionService.createSession(existingUser.id, null, ipAddress, userAgent);
                        const token = this.generateToken(existingUser);
                        yield (0, rateLimit_middleware_1.logAuthAttempt)({
                            userId: existingUser.id,
                            email: existingUser.email,
                            attemptType: 'oauth',
                            success: true,
                            ipAddress,
                            userAgent,
                            metadata: { provider: 'google', action: 'login_skip_2fa' },
                        });
                        // Return full login response (no 2FA needed)
                        res.status(200).json({
                            sessionId,
                            token,
                            user: {
                                id: existingUser.id,
                                email: existingUser.email,
                                firstName: existingUser.firstName,
                                lastName: existingUser.lastName,
                                role: existingUser.role,
                                isPlatformAdmin: existingUser.isPlatformAdmin,
                                isDeveloperUser: existingUser.isDeveloperUser,
                                authProvider: existingUser.authProvider || 'google',
                                profilePicture: existingUser.profilePicture,
                            },
                            provider: 'google',
                            message: 'Login successful',
                        });
                        return;
                    }
                    // Check if 2FA is enabled
                    if (!existingUser.twoFactorEnabled || !existingUser.twoFactorSecret) {
                        logger_1.default.warn(`⚠️ [OAuth Google] User ${email} exists but 2FA not configured`);
                        // USER ALREADY EXISTS BUT 2FA NOT COMPLETED
                        // This can happen if:
                        // 1. User registered with email/password but didn't complete 2FA setup
                        // 2. User registered with Google but closed browser before completing setup
                        // SOLUTION: Setup 2FA now and let them continue
                        logger_1.default.info(`🔧 [OAuth Google] Setting up 2FA for existing user ${email}`);
                        // Generate 2FA secret and otpauth URL (frontend will render QR code)
                        const otpauthUrl = yield this.otpService.setupTwoFactor(existingUser.id);
                        yield (0, rateLimit_middleware_1.logAuthAttempt)({
                            userId: existingUser.id,
                            email: existingUser.email,
                            attemptType: 'oauth',
                            success: true,
                            ipAddress,
                            userAgent,
                            metadata: { provider: 'google', action: 'existing_user_setup_2fa' },
                        });
                        // Return setup required (same as new user registration)
                        res.status(200).json({
                            requiresSetup: true,
                            user: {
                                id: existingUser.id,
                                email: existingUser.email,
                                firstName: existingUser.firstName,
                                lastName: existingUser.lastName,
                                authProvider: existingUser.authProvider || 'google',
                                profilePicture: existingUser.profilePicture,
                            },
                            qrCode: otpauthUrl, // Frontend will render this as QR code
                            provider: 'google',
                            message: 'Please complete 2FA setup to secure your account',
                        });
                        return;
                    }
                    // USER EXISTS WITH 2FA ENABLED → Normal login flow
                    yield (0, rateLimit_middleware_1.logAuthAttempt)({
                        userId: existingUser.id,
                        email: existingUser.email,
                        attemptType: 'oauth',
                        success: true,
                        ipAddress,
                        userAgent,
                        metadata: { provider: 'google', action: 'login_requires_2fa' },
                    });
                    // Return user info and require 2FA verification
                    res.status(200).json({
                        requires2FA: true,
                        user: {
                            id: existingUser.id,
                            email: existingUser.email,
                            firstName: existingUser.firstName,
                            lastName: existingUser.lastName,
                            authProvider: existingUser.authProvider || 'google',
                            profilePicture: existingUser.profilePicture,
                        },
                        provider: 'google',
                        message: 'Please verify your identity with 2FA code',
                    });
                    return;
                }
                // CASE 2: NEW USER - REGISTER
                logger_1.default.info(`🆕 [OAuth Google] New user registration: ${email}`);
                // Create user with Google provider (2FA will be enabled after setup)
                const newUser = yield database_1.prisma.user.create({
                    data: {
                        email,
                        passwordHash: '', // OAuth users don't have password
                        firstName: given_name || '',
                        lastName: family_name || '',
                        role: 'MEMBER',
                        authProvider: 'google',
                        profilePicture: picture,
                        twoFactorEnabled: false, // Will be enabled after 2FA verification
                        gdprAccepted: new Date(), // Google login implies acceptance
                        linkedProviders: [{ provider: 'google', linkedAt: new Date().toISOString(), providerId: googleId }],
                    },
                });
                logger_1.default.info(`✅ [OAuth Google] User created: ${newUser.id}`);
                // Generate 2FA secret and otpauth URL using OtpService
                // This will create the secret and save it to the user automatically
                const otpauthUrl = yield this.otpService.setupTwoFactor(newUser.id);
                // Verify that 2FA secret was saved
                const userWithSecret = yield database_1.prisma.user.findUnique({
                    where: { id: newUser.id },
                    select: { twoFactorSecret: true },
                });
                if (!(userWithSecret === null || userWithSecret === void 0 ? void 0 : userWithSecret.twoFactorSecret)) {
                    logger_1.default.error(`❌ [OAuth Google] Failed to save 2FA secret for user ${newUser.id}`);
                    throw new error_middleware_1.AppError(500, 'Failed to setup 2FA');
                }
                logger_1.default.info(`✅ [OAuth Google] 2FA secret saved for user ${newUser.id}`);
                yield (0, rateLimit_middleware_1.logAuthAttempt)({
                    userId: newUser.id,
                    email: newUser.email,
                    attemptType: 'oauth',
                    success: true,
                    ipAddress,
                    userAgent,
                    metadata: { provider: 'google', action: 'register_requires_setup' },
                });
                // Return setup required response
                res.status(200).json({
                    requiresSetup: true,
                    user: {
                        id: newUser.id,
                        email: newUser.email,
                        firstName: newUser.firstName,
                        lastName: newUser.lastName,
                        authProvider: 'google',
                        profilePicture: picture,
                    },
                    qrCode: otpauthUrl, // Frontend will render this as QR code
                    provider: 'google',
                    message: 'Please setup 2FA to complete registration',
                });
            }
            catch (error) {
                if (error instanceof error_middleware_1.AppError) {
                    res.status(error.statusCode).json({
                        error: error.message,
                    });
                    return;
                }
                logger_1.default.error('❌ [OAuth Google] Error:', error);
                res.status(500).json({
                    error: 'OAuth authentication failed',
                });
            }
        });
    }
}
exports.OAuthController = OAuthController;
//# sourceMappingURL=oauth.controller.js.map