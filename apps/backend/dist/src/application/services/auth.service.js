"use strict";
/**
 * Authentication Service
 *
 * Centralizes all authentication logic:
 * - User registration
 * - Login/logout
 * - Password management (change, reset)
 * - 2FA verification
 *
 * ARCHITECTURE:
 * - Controllers handle HTTP (req/res)
 * - This service handles business logic
 * - Repositories handle database access
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
exports.AuthService = void 0;
const database_1 = require("@echatbot/database");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const error_middleware_1 = require("../../interfaces/http/middlewares/error.middleware");
const logger_1 = __importDefault(require("../../utils/logger"));
const config_1 = require("../../config");
const security_config_1 = require("../../config/security.config");
class AuthService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Register new user with email/password
     */
    register(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const { email, password, firstName, lastName, gdprAccepted } = data;
            // Validate password strength
            const validation = (0, security_config_1.validatePassword)(password);
            if (!validation.valid) {
                throw new error_middleware_1.AppError(400, validation.error);
            }
            // Check if user already exists (including soft-deleted - Feature 196)
            const existingUser = yield this.prisma.user.findUnique({
                where: { email: email.toLowerCase() },
            });
            if (existingUser) {
                // If soft-deleted, inform about recovery option
                if (existingUser.deletedAt !== null) {
                    const retentionDays = 90;
                    const expiryDate = new Date(existingUser.deletedAt);
                    expiryDate.setDate(expiryDate.getDate() + retentionDays);
                    const daysRemaining = Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                    throw new error_middleware_1.AppError(409, `This email belongs to a deleted account. Contact support within ${daysRemaining} days to recover it, or wait for permanent deletion.`);
                }
                throw new error_middleware_1.AppError(409, 'User with this email already exists');
            }
            // Hash password
            const passwordHash = yield bcryptjs_1.default.hash(password, 10);
            // Create user
            const user = yield this.prisma.user.create({
                data: {
                    email: email.toLowerCase(),
                    passwordHash,
                    firstName,
                    lastName,
                    role: 'MEMBER',
                    status: 'ACTIVE',
                    authProvider: 'email',
                    twoFactorEnabled: false,
                    recoveryCodes: [],
                    gdprAccepted: gdprAccepted || new Date(),
                },
            });
            logger_1.default.info(`✅ User registered: ${user.email}`);
            return user;
        });
    }
    /**
     * Login with email/password
     * Returns user, token, and 2FA requirement
     */
    login(email, password) {
        return __awaiter(this, void 0, void 0, function* () {
            // Find user
            const user = yield this.prisma.user.findUnique({
                where: { email: email.toLowerCase() },
            });
            if (!user) {
                throw new error_middleware_1.AppError(401, 'Invalid credentials');
            }
            // Check if account is soft-deleted (Feature 196)
            if (user.deletedAt !== null) {
                // Calculate days until permanent deletion
                const retentionDays = 90;
                const expiryDate = new Date(user.deletedAt);
                expiryDate.setDate(expiryDate.getDate() + retentionDays);
                const daysRemaining = Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                logger_1.default.warn(`🚫 Login attempt for soft-deleted user: ${user.email} (${daysRemaining} days until permanent delete)`);
                throw new error_middleware_1.AppError(403, `Your account has been deleted. You have ${daysRemaining} days to contact support for recovery before permanent deletion.`);
            }
            // Check account status
            if (user.status !== database_1.UserStatus.ACTIVE) {
                logger_1.default.warn(`🚫 Login attempt for disabled user: ${user.email}`);
                throw new error_middleware_1.AppError(403, 'Your account has been disabled. Please contact support.');
            }
            // Verify password
            const isPasswordValid = yield bcryptjs_1.default.compare(password, user.passwordHash);
            if (!isPasswordValid) {
                throw new error_middleware_1.AppError(401, 'Invalid credentials');
            }
            // Check if 2FA is enabled
            // 🔐 SKIP 2FA for Platform Admins and Developer Users
            const skip2FA = user.isPlatformAdmin || user.isDeveloperUser;
            if (user.twoFactorEnabled && !skip2FA) {
                logger_1.default.info(`🔐 User ${user.email} requires 2FA verification`);
                return {
                    user,
                    token: '', // No token until 2FA verified
                    requires2FA: true,
                };
            }
            if (skip2FA && user.twoFactorEnabled) {
                logger_1.default.info(`🔧 User ${user.email} has 2FA enabled but SKIPPED (isPlatformAdmin=${user.isPlatformAdmin}, isDeveloperUser=${user.isDeveloperUser})`);
            }
            // Generate JWT token
            const token = this.generateToken(user);
            logger_1.default.info(`✅ User ${user.email} logged in successfully`);
            return {
                user,
                token,
                requires2FA: false,
            };
        });
    }
    /**
     * Change user password (requires current password)
     */
    changePassword(userId, currentPassword, newPassword) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get user
            const user = yield this.prisma.user.findUnique({
                where: { id: userId },
            });
            if (!user) {
                throw new error_middleware_1.AppError(404, 'User not found');
            }
            // Verify current password
            if (!user.passwordHash) {
                throw new error_middleware_1.AppError(400, 'User has no password set (OAuth user)');
            }
            const isPasswordValid = yield bcryptjs_1.default.compare(currentPassword, user.passwordHash);
            if (!isPasswordValid) {
                throw new error_middleware_1.AppError(400, 'Current password is incorrect');
            }
            // Validate new password
            if (newPassword.length < 8) {
                throw new error_middleware_1.AppError(400, 'Password must be at least 8 characters');
            }
            if (newPassword === currentPassword) {
                throw new error_middleware_1.AppError(400, 'New password must be different from current password');
            }
            const validation = (0, security_config_1.validatePassword)(newPassword);
            if (!validation.valid) {
                throw new error_middleware_1.AppError(400, validation.error);
            }
            // Hash and update password
            const passwordHash = yield bcryptjs_1.default.hash(newPassword, 10);
            yield this.prisma.user.update({
                where: { id: userId },
                data: { passwordHash },
            });
            logger_1.default.info(`✅ Password changed for user: ${userId}`);
        });
    }
    /**
     * Request password reset (generates token, sends email)
     * Returns token for email sending
     */
    requestPasswordReset(email) {
        return __awaiter(this, void 0, void 0, function* () {
            // Generate reset token
            const crypto = yield Promise.resolve().then(() => __importStar(require('crypto')));
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 3600000); // 1 hour
            // Check if user exists (but don't reveal in response for security)
            const user = yield this.prisma.user.findUnique({
                where: { email: email.toLowerCase() },
            });
            if (user) {
                // Create reset token
                yield this.prisma.passwordReset.create({
                    data: {
                        userId: user.id,
                        token,
                        expiresAt,
                    },
                });
                logger_1.default.info(`🔑 Password reset token generated for: ${email}`);
            }
            else {
                logger_1.default.warn(`⚠️ Password reset requested for non-existent email: ${email}`);
            }
            return token;
        });
    }
    /**
     * Reset password using reset token
     */
    resetPassword(token, newPassword) {
        return __awaiter(this, void 0, void 0, function* () {
            // Find valid token
            const resetToken = yield this.prisma.passwordReset.findFirst({
                where: {
                    token,
                    usedAt: null,
                },
            });
            if (!resetToken) {
                throw new error_middleware_1.AppError(400, 'Invalid or expired reset token');
            }
            // Check expiration
            if (resetToken.expiresAt < new Date()) {
                throw new error_middleware_1.AppError(400, 'Reset token has expired');
            }
            // Validate new password
            if (newPassword.length < 8) {
                throw new error_middleware_1.AppError(400, 'Password must be at least 8 characters');
            }
            const validation = (0, security_config_1.validatePassword)(newPassword);
            if (!validation.valid) {
                throw new error_middleware_1.AppError(400, validation.error);
            }
            // Hash and update password + mark token as used in a transaction
            const passwordHash = yield bcryptjs_1.default.hash(newPassword, 10);
            yield this.prisma.$transaction([
                this.prisma.user.update({
                    where: { id: resetToken.userId },
                    data: { passwordHash },
                }),
                this.prisma.passwordReset.update({
                    where: { id: resetToken.id },
                    data: { usedAt: new Date() },
                }),
            ]);
            logger_1.default.info(`✅ Password reset successful for user: ${resetToken.userId}`);
        });
    }
    /**
     * Set password for OAuth user (Google, etc.)
     * Allows OAuth users to add password auth ("multi" provider)
     * Part B of spec 189-admin-2fa-reset
     */
    setPasswordForOAuthUser(userId, newPassword) {
        return __awaiter(this, void 0, void 0, function* () {
            // Find user
            const user = yield this.prisma.user.findUnique({
                where: { id: userId },
            });
            if (!user) {
                throw new error_middleware_1.AppError(404, 'User not found');
            }
            // Check if user already has a password
            if (user.passwordHash) {
                throw new error_middleware_1.AppError(400, 'You already have a password set. Use password reset to change it.');
            }
            // User must be OAuth user
            if (user.authProvider === 'email') {
                throw new error_middleware_1.AppError(400, 'Email users already have passwords.');
            }
            // Validate password strength
            const validation = (0, security_config_1.validatePassword)(newPassword);
            if (!validation.valid) {
                throw new error_middleware_1.AppError(400, validation.error);
            }
            // Hash password
            const passwordHash = yield bcryptjs_1.default.hash(newPassword, 10);
            // Update user with password and change provider to "multi"
            yield this.prisma.user.update({
                where: { id: userId },
                data: {
                    passwordHash,
                    authProvider: 'multi', // Can now login with Google OR email/password
                },
            });
            logger_1.default.info(`✅ Password set for OAuth user: ${user.email}, provider updated to 'multi'`);
        });
    }
    /**
     * Generate JWT token for user
     */
    generateToken(user) {
        return jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            role: user.role,
            isPlatformAdmin: user.isPlatformAdmin || false,
            isDeveloperUser: user.isDeveloperUser || false,
        }, config_1.config.jwt.secret, {
            expiresIn: config_1.config.jwt.expiresIn,
        });
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map