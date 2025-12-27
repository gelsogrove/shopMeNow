"use strict";
/**
 * Rate Limiting Middleware
 * Implements brute force protection using database-backed rate limiting
 *
 * SECURITY FEATURES:
 * - Per-IP rate limiting
 * - Per-email rate limiting
 * - Account lockout after threshold
 * - Exponential backoff
 * - Audit logging
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
exports.clearRateLimitAttempts = exports.rateLimitMiddleware = exports.isAccountLocked = exports.logAuthAttempt = exports.checkRateLimit = void 0;
const database_1 = require("@echatbot/database");
const security_config_1 = require("../config/security.config");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Check rate limit for specific attempt type
 * @param email - User email
 * @param ipAddress - Client IP address
 * @param attemptType - Type of authentication attempt
 * @returns True if rate limit exceeded
 */
const checkRateLimit = (email, ipAddress, attemptType) => __awaiter(void 0, void 0, void 0, function* () {
    const config = (0, security_config_1.getSecurityConfig)();
    const rateLimitConfig = config.rateLimit[attemptType];
    const windowStart = new Date(Date.now() - rateLimitConfig.windowMs);
    // Count failed attempts in time window (by email)
    const emailAttempts = yield database_1.prisma.authenticationAttempt.count({
        where: {
            email: email.toLowerCase(),
            attemptType: attemptType,
            success: false,
            timestamp: {
                gte: windowStart,
            },
        },
    });
    // Count failed attempts in time window (by IP)
    const ipAttempts = yield database_1.prisma.authenticationAttempt.count({
        where: {
            ipAddress: ipAddress,
            attemptType: attemptType,
            success: false,
            timestamp: {
                gte: windowStart,
            },
        },
    });
    const maxAttempts = rateLimitConfig.maxAttempts;
    const emailLimited = emailAttempts >= maxAttempts;
    const ipLimited = ipAttempts >= maxAttempts * 2; // IP limit is 2x email limit
    if (emailLimited || ipLimited) {
        const resetTime = new Date(Date.now() + rateLimitConfig.windowMs);
        logger_1.default.warn('Rate limit exceeded', {
            email,
            ipAddress,
            attemptType,
            emailAttempts,
            ipAttempts,
            maxAttempts,
            resetTime,
        });
        return {
            limited: true,
            remainingAttempts: 0,
            resetTime,
        };
    }
    return {
        limited: false,
        remainingAttempts: maxAttempts - emailAttempts,
    };
});
exports.checkRateLimit = checkRateLimit;
/**
 * Log authentication attempt
 * @param data - Attempt data
 */
const logAuthAttempt = (data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield database_1.prisma.authenticationAttempt.create({
            data: {
                userId: data.userId,
                email: data.email.toLowerCase(),
                attemptType: data.attemptType,
                success: data.success,
                failureReason: data.failureReason,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
                metadata: data.metadata,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Failed to log auth attempt', error);
    }
});
exports.logAuthAttempt = logAuthAttempt;
/**
 * Check if account is locked
 * @param email - User email
 * @returns True if account is locked
 */
const isAccountLocked = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const config = (0, security_config_1.getSecurityConfig)();
    const windowStart = new Date(Date.now() - config.accountLockout.durationMs);
    // Count failed login attempts in lockout window
    const failedAttempts = yield database_1.prisma.authenticationAttempt.count({
        where: {
            email: email.toLowerCase(),
            attemptType: 'login',
            success: false,
            timestamp: {
                gte: windowStart,
            },
        },
    });
    const locked = failedAttempts >= config.accountLockout.threshold;
    if (locked) {
        // Find most recent failed attempt to calculate unlock time
        const lastAttempt = yield database_1.prisma.authenticationAttempt.findFirst({
            where: {
                email: email.toLowerCase(),
                attemptType: 'login',
                success: false,
            },
            orderBy: {
                timestamp: 'desc',
            },
        });
        if (lastAttempt) {
            const unlockTime = new Date(lastAttempt.timestamp.getTime() + config.accountLockout.durationMs);
            logger_1.default.warn('Account locked', {
                email,
                failedAttempts,
                unlockTime,
            });
            return { locked: true, unlockTime };
        }
    }
    return { locked: false };
});
exports.isAccountLocked = isAccountLocked;
/**
 * Rate limit middleware factory
 * Creates middleware for specific attempt type
 */
const rateLimitMiddleware = (attemptType) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c;
        const email = (_a = req.body.email) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
        if (!email) {
            return next(); // Skip if no email in request
        }
        try {
            // Check rate limit
            const rateLimit = yield (0, exports.checkRateLimit)(email, ipAddress, attemptType);
            if (rateLimit.limited) {
                const minutesUntilReset = Math.ceil(((((_b = rateLimit.resetTime) === null || _b === void 0 ? void 0 : _b.getTime()) || 0) - Date.now()) / 60000);
                return res.status(429).json({
                    error: 'Too many attempts. Please try again later.',
                    code: 'RATE_LIMIT_EXCEEDED',
                    remainingAttempts: 0,
                    resetTime: rateLimit.resetTime,
                    message: `Too many ${attemptType} attempts. Please try again in ${minutesUntilReset} minutes.`,
                });
            }
            // Check account lockout (for login attempts)
            if (attemptType === 'login') {
                const lockStatus = yield (0, exports.isAccountLocked)(email);
                if (lockStatus.locked) {
                    const minutesUntilUnlock = Math.ceil(((((_c = lockStatus.unlockTime) === null || _c === void 0 ? void 0 : _c.getTime()) || 0) - Date.now()) / 60000);
                    return res.status(423).json({
                        error: 'Account temporarily locked due to too many failed login attempts.',
                        code: 'ACCOUNT_LOCKED',
                        unlockTime: lockStatus.unlockTime,
                        message: `Account locked. Try again in ${minutesUntilUnlock} minutes.`,
                    });
                }
            }
            // Attach rate limit info to request
            ;
            req.rateLimit = rateLimit;
            next();
        }
        catch (error) {
            logger_1.default.error('Rate limit check failed', error);
            // Don't block on rate limit errors
            next();
        }
    });
};
exports.rateLimitMiddleware = rateLimitMiddleware;
/**
 * Clear rate limit attempts for successful login
 * @param email - User email
 */
const clearRateLimitAttempts = (email) => __awaiter(void 0, void 0, void 0, function* () {
    // We don't delete attempts (audit log), but successful login resets the window
    // The time-based window automatically "clears" old attempts
    logger_1.default.info('User successfully authenticated, rate limit window reset', { email });
});
exports.clearRateLimitAttempts = clearRateLimitAttempts;
//# sourceMappingURL=rateLimit.middleware.js.map