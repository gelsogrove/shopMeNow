"use strict";
/**
 * OAuth Authentication Service
 * Handles advanced auth features: OAuth, 2FA, profile pictures
 *
 * SECURITY FEATURES:
 * - Multi-provider OAuth (Google, Facebook, Apple)
 * - Mandatory 2FA for all users
 * - Admin-initiated 2FA reset (Feature 189 - replaces recovery codes)
 * - Rate limiting integration
 * - Audit logging
 * - Session management
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
exports.OAuthAuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const error_middleware_1 = require("../../interfaces/http/middlewares/error.middleware");
const logger_1 = __importDefault(require("../../utils/logger"));
const security_config_1 = require("../../config/security.config");
const oauth_config_1 = require("../../config/oauth.config");
const rateLimit_middleware_1 = require("../../middlewares/rateLimit.middleware");
class OAuthAuthService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Register user with email/password
     * @param data - Registration data
     * @param ipAddress - Client IP
     * @param userAgent - Client User-Agent
     * @returns Created user
     */
    registerWithEmail(data, ipAddress, userAgent) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate password
                if (!data.password) {
                    throw new error_middleware_1.AppError(400, 'Password is required for email registration');
                }
                const validation = (0, security_config_1.validatePassword)(data.password);
                if (!validation.valid) {
                    yield (0, rateLimit_middleware_1.logAuthAttempt)({
                        email: data.email,
                        attemptType: 'registration',
                        success: false,
                        failureReason: validation.error,
                        ipAddress,
                        userAgent,
                    });
                    throw new error_middleware_1.AppError(400, validation.error);
                }
                // Check if user already exists
                const existingUser = yield this.prisma.user.findUnique({
                    where: { email: data.email.toLowerCase() },
                });
                if (existingUser) {
                    yield (0, rateLimit_middleware_1.logAuthAttempt)({
                        email: data.email,
                        attemptType: 'registration',
                        success: false,
                        failureReason: 'Utente già presente',
                        ipAddress,
                        userAgent,
                    });
                    throw new error_middleware_1.AppError(409, 'Utente già presente. Effettua il login.');
                }
                // Hash password
                const passwordHash = yield bcryptjs_1.default.hash(data.password, 10);
                // Create user
                const user = yield this.prisma.user.create({
                    data: {
                        email: data.email.toLowerCase(),
                        passwordHash,
                        firstName: data.firstName,
                        lastName: data.lastName,
                        authProvider: 'email',
                        profilePicture: null, // Will use default avatar
                        gdprAccepted: data.gdprAccepted || new Date(),
                        twoFactorEnabled: false, // Will be enabled after 2FA setup
                    },
                });
                // Log successful registration
                yield (0, rateLimit_middleware_1.logAuthAttempt)({
                    userId: user.id,
                    email: user.email,
                    attemptType: 'registration',
                    success: true,
                    ipAddress,
                    userAgent,
                });
                logger_1.default.info('User registered with email', {
                    userId: user.id,
                    email: user.email,
                });
                return user;
            }
            catch (error) {
                if (error instanceof error_middleware_1.AppError)
                    throw error;
                logger_1.default.error('Email registration failed', error);
                throw new error_middleware_1.AppError(500, 'Registration failed');
            }
        });
    }
    /**
     * Register or login user with OAuth provider
     * @param profile - OAuth profile data
     * @param ipAddress - Client IP
     * @param userAgent - Client User-Agent
     * @returns User and isNew flag
     */
    registerOrLoginWithOAuth(profile, ipAddress, userAgent) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if user exists
                let user = yield this.prisma.user.findUnique({
                    where: { email: profile.email.toLowerCase() },
                });
                if (user) {
                    // Existing user - update profile picture if provided
                    if (profile.profilePicture && !user.profilePicture) {
                        user = yield this.prisma.user.update({
                            where: { id: user.id },
                            data: { profilePicture: profile.profilePicture },
                        });
                    }
                    // Update linked providers if not already linked
                    const linkedProviders = user.linkedProviders || [];
                    const isProviderLinked = linkedProviders.some((p) => p.provider === profile.provider);
                    if (!isProviderLinked) {
                        yield this.prisma.user.update({
                            where: { id: user.id },
                            data: {
                                linkedProviders: [
                                    ...linkedProviders,
                                    { provider: profile.provider, linkedAt: new Date().toISOString() },
                                ],
                            },
                        });
                    }
                    // Log OAuth login
                    yield (0, rateLimit_middleware_1.logAuthAttempt)({
                        userId: user.id,
                        email: user.email,
                        attemptType: `oauth-${profile.provider}`,
                        success: true,
                        ipAddress,
                        userAgent,
                    });
                    logger_1.default.info('User logged in with OAuth', {
                        userId: user.id,
                        email: user.email,
                        provider: profile.provider,
                    });
                    return { user, isNew: false };
                }
                // New user - create account
                user = yield this.prisma.user.create({
                    data: {
                        email: profile.email.toLowerCase(),
                        passwordHash: null, // OAuth users don't have password
                        firstName: profile.firstName,
                        lastName: profile.lastName,
                        authProvider: profile.provider,
                        profilePicture: profile.profilePicture || null,
                        linkedProviders: [
                            { provider: profile.provider, linkedAt: new Date().toISOString() },
                        ],
                        gdprAccepted: new Date(),
                        twoFactorEnabled: false, // Will be enabled after 2FA setup
                    },
                });
                // Log OAuth registration
                yield (0, rateLimit_middleware_1.logAuthAttempt)({
                    userId: user.id,
                    email: user.email,
                    attemptType: `oauth-${profile.provider}`,
                    success: true,
                    ipAddress,
                    userAgent,
                    metadata: { action: 'registration' },
                });
                logger_1.default.info('User registered with OAuth', {
                    userId: user.id,
                    email: user.email,
                    provider: profile.provider,
                });
                return { user, isNew: true };
            }
            catch (error) {
                if (error instanceof error_middleware_1.AppError)
                    throw error;
                logger_1.default.error('OAuth registration/login failed', error);
                throw new error_middleware_1.AppError(500, 'OAuth authentication failed');
            }
        });
    }
    /**
     * Enable 2FA for user
     * NOTE: Recovery codes have been REMOVED (Feature 189)
     * Users who lose access must contact admin for 2FA reset
     * @param userId - User ID
     */
    enable2FA(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Update user - Enable 2FA
                yield this.prisma.user.update({
                    where: { id: userId },
                    data: {
                        twoFactorEnabled: true,
                        twoFactorEnabledAt: new Date(),
                        // NOTE: recoveryCodes field removed (Feature 189)
                    },
                });
                logger_1.default.info('2FA enabled for user', { userId });
            }
            catch (error) {
                logger_1.default.error('Failed to enable 2FA', error);
                throw new error_middleware_1.AppError(500, 'Failed to enable 2FA');
            }
        });
    }
    /**
     * Verify recovery code - DEPRECATED (Feature 189)
     * Recovery codes have been removed. Users must contact admin for 2FA reset.
     * @deprecated Use admin-initiated 2FA reset instead
     */
    verifyRecoveryCode(_userId, _code) {
        return __awaiter(this, void 0, void 0, function* () {
            // Feature 189: Recovery codes removed - return deprecated message
            logger_1.default.warn('verifyRecoveryCode called but recovery codes have been removed (Feature 189)');
            return {
                valid: false,
                // No newRecoveryCode - feature removed
            };
        });
    }
    /**
     * Get user profile picture URL (or default)
     * @param user - User object
     * @returns Profile picture URL
     */
    getUserAvatar(user) {
        if (user.profilePicture) {
            return user.profilePicture;
        }
        return (0, oauth_config_1.getDefaultAvatarUrl)(user.firstName || undefined, user.lastName || undefined);
    }
    /**
     * Add password to OAuth user (optional feature)
     * @param userId - User ID
     * @param password - New password
     */
    addPasswordToOAuthUser(userId, password) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield this.prisma.user.findUnique({
                    where: { id: userId },
                });
                if (!user) {
                    throw new error_middleware_1.AppError(404, 'User not found');
                }
                if (user.passwordHash) {
                    throw new error_middleware_1.AppError(400, 'User already has a password');
                }
                // Validate password
                const validation = (0, security_config_1.validatePassword)(password);
                if (!validation.valid) {
                    throw new error_middleware_1.AppError(400, validation.error);
                }
                // Hash and save password
                const passwordHash = yield bcryptjs_1.default.hash(password, 10);
                yield this.prisma.user.update({
                    where: { id: userId },
                    data: {
                        passwordHash,
                        authProvider: 'multi', // User now has multiple auth methods
                    },
                });
                logger_1.default.info('Password added to OAuth user', { userId });
            }
            catch (error) {
                if (error instanceof error_middleware_1.AppError)
                    throw error;
                logger_1.default.error('Failed to add password to OAuth user', error);
                throw new error_middleware_1.AppError(500, 'Failed to add password');
            }
        });
    }
}
exports.OAuthAuthService = OAuthAuthService;
//# sourceMappingURL=oauth-auth.service.js.map