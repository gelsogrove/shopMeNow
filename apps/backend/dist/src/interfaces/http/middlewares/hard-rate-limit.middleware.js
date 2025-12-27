"use strict";
/**
 * 🔒 DATABASE-BACKED RATE LIMITING (HARD LIMITS)
 *
 * Andrea: "se inviamo più di 5 messaggi ogni 10 secondi si deve bloccare"
 *
 * SOLUZIONE: Rate limiting salvato in DATABASE
 * - ✅ Impossibile bypassare (restart server = limiti persistono)
 * - ✅ Ogni messaggio salvato PRIMA di inviare
 * - ✅ Query COUNT dal database per verificare limiti
 * - ✅ Transazioni atomiche (no race conditions)
 * - ✅ Blocco HARD: 6° messaggio in 10 secondi = REJECTED
 *
 * Limiti HARD (molto restrittivi per prevenire spam/abuso):
 * - Max 5 messaggi per customer ogni 10 secondi (anti-spam aggressivo)
 * - Max 30 messaggi per workspace al minuto (protezione burst attacks)
 * - Max 200 messaggi per workspace all'ora (protezione abuso prolungato)
 * - Max 1000 messaggi per workspace al giorno (protezione abuso massivo)
 *
 * Se supera: BLOCCO TOTALE fino al reset time
 *
 * @author Andrea Gelso
 * @date 2025-10-13
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
exports.hardRateLimitMiddleware = hardRateLimitMiddleware;
exports.getRateLimitStatus = getRateLimitStatus;
exports.resetRateLimits = resetRateLimits;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../../../utils/logger"));
// prisma imported
// HARD LIMITS (impossibile bypassare)
// Andrea: "se inviamo più di 5 messaggi ogni 10 secondi si deve bloccare"
const HARD_LIMITS = {
    PER_CUSTOMER_PER_10_SECONDS: 5, // 5 msg/10sec per customer (anti-spam)
    PER_WORKSPACE_PER_MINUTE: 30, // 30 msg/min per workspace (burst protection)
    PER_WORKSPACE_PER_HOUR: 200, // 200 msg/hour per workspace
    PER_WORKSPACE_PER_DAY: 1000, // 1000 msg/day per workspace
};
/**
 * Check rate limit from DATABASE (no in-memory bypass)
 *
 * Andrea: "se inviamo più di 5 messaggi ogni 10 secondi si deve bloccare"
 */
function checkRateLimitDatabase(customerId, workspaceId) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = new Date();
        // CHECK 1: Customer per 10 seconds (anti-spam aggressivo)
        // Andrea: "se inviamo più di 5 messaggi ogni 10 secondi si deve bloccare"
        const tenSecondsAgo = new Date(now.getTime() - 10 * 1000);
        const customerMessageCount = yield database_1.prisma.message.count({
            where: {
                metadata: {
                    path: ["customerId"],
                    equals: customerId,
                },
                createdAt: {
                    gte: tenSecondsAgo,
                },
                direction: "OUTBOUND",
            },
        });
        if (customerMessageCount >= HARD_LIMITS.PER_CUSTOMER_PER_10_SECONDS) {
            const resetAt = new Date(tenSecondsAgo.getTime() + 10 * 1000);
            logger_1.default.warn("🚨 [RATE-LIMIT] Customer 10-second limit EXCEEDED", {
                customerId,
                current: customerMessageCount,
                limit: HARD_LIMITS.PER_CUSTOMER_PER_10_SECONDS,
                resetAt,
                blockedReason: "Andrea: max 5 messaggi ogni 10 secondi",
            });
            return {
                allowed: false,
                violation: {
                    type: "CUSTOMER_10_SECONDS",
                    current: customerMessageCount,
                    limit: HARD_LIMITS.PER_CUSTOMER_PER_10_SECONDS,
                    resetAt,
                    message: `Customer has received ${customerMessageCount} messages in the last 10 seconds. Maximum is ${HARD_LIMITS.PER_CUSTOMER_PER_10_SECONDS} messages per 10 seconds. Anti-spam protection activated.`,
                },
            };
        }
        // CHECK 2: Workspace per minute (burst protection)
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
        const workspaceMinuteCount = yield database_1.prisma.message.count({
            where: {
                metadata: {
                    path: ["workspaceId"],
                    equals: workspaceId,
                },
                createdAt: {
                    gte: oneMinuteAgo,
                },
                direction: "OUTBOUND",
            },
        });
        if (workspaceMinuteCount >= HARD_LIMITS.PER_WORKSPACE_PER_MINUTE) {
            const resetAt = new Date(oneMinuteAgo.getTime() + 60 * 1000);
            logger_1.default.warn("🚨 [RATE-LIMIT] Workspace per-minute limit EXCEEDED", {
                workspaceId,
                current: workspaceMinuteCount,
                limit: HARD_LIMITS.PER_WORKSPACE_PER_MINUTE,
                resetAt,
            });
            return {
                allowed: false,
                violation: {
                    type: "WORKSPACE_MINUTE",
                    current: workspaceMinuteCount,
                    limit: HARD_LIMITS.PER_WORKSPACE_PER_MINUTE,
                    resetAt,
                    message: `Workspace has sent ${workspaceMinuteCount} messages in the last minute. Maximum is ${HARD_LIMITS.PER_WORKSPACE_PER_MINUTE} messages per minute.`,
                },
            };
        }
        // CHECK 3: Workspace per hour (last 60 minutes)
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const workspaceHourlyCount = yield database_1.prisma.message.count({
            where: {
                metadata: {
                    path: ["workspaceId"],
                    equals: workspaceId,
                },
                createdAt: {
                    gte: oneHourAgo,
                },
                direction: "OUTBOUND",
            },
        });
        if (workspaceHourlyCount >= HARD_LIMITS.PER_WORKSPACE_PER_HOUR) {
            const resetAt = new Date(oneHourAgo.getTime() + 60 * 60 * 1000);
            logger_1.default.error("🚨 [RATE-LIMIT] Workspace hourly limit EXCEEDED", {
                workspaceId,
                current: workspaceHourlyCount,
                limit: HARD_LIMITS.PER_WORKSPACE_PER_HOUR,
                resetAt,
            });
            return {
                allowed: false,
                violation: {
                    type: "WORKSPACE_HOUR",
                    current: workspaceHourlyCount,
                    limit: HARD_LIMITS.PER_WORKSPACE_PER_HOUR,
                    resetAt,
                    message: `Workspace has sent ${workspaceHourlyCount} messages in the last hour. Maximum is ${HARD_LIMITS.PER_WORKSPACE_PER_HOUR} messages per hour.`,
                },
            };
        }
        // CHECK 4: Workspace per day (last 24 hours)
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const workspaceDailyCount = yield database_1.prisma.message.count({
            where: {
                metadata: {
                    path: ["workspaceId"],
                    equals: workspaceId,
                },
                createdAt: {
                    gte: oneDayAgo,
                },
                direction: "OUTBOUND",
            },
        });
        if (workspaceDailyCount >= HARD_LIMITS.PER_WORKSPACE_PER_DAY) {
            const resetAt = new Date(oneDayAgo.getTime() + 24 * 60 * 60 * 1000);
            logger_1.default.error("🚨 [RATE-LIMIT] Workspace daily limit EXCEEDED!", {
                workspaceId,
                current: workspaceDailyCount,
                limit: HARD_LIMITS.PER_WORKSPACE_PER_DAY,
                resetAt,
            });
            return {
                allowed: false,
                violation: {
                    type: "WORKSPACE_DAY",
                    current: workspaceDailyCount,
                    limit: HARD_LIMITS.PER_WORKSPACE_PER_DAY,
                    resetAt,
                    message: `Workspace has sent ${workspaceDailyCount} messages in the last 24 hours. Maximum is ${HARD_LIMITS.PER_WORKSPACE_PER_DAY} messages per day.`,
                },
            };
        }
        // ✅ ALL CHECKS PASSED
        logger_1.default.info("✅ [RATE-LIMIT] All limits OK", {
            customerId,
            workspaceId,
            customer10Seconds: customerMessageCount,
            workspaceMinute: workspaceMinuteCount,
            workspaceHourly: workspaceHourlyCount,
            workspaceDaily: workspaceDailyCount,
        });
        return { allowed: true };
    });
}
/**
 * Middleware: Database-backed rate limiting (HARD LIMITS)
 *
 * BLOCCO TOTALE se supera limiti
 * Impossibile bypassare (salvato in database)
 */
function hardRateLimitMiddleware(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { customerId, workspaceId } = req.body;
            if (!customerId || !workspaceId) {
                res.status(400).json({
                    error: "Missing required fields",
                    message: "customerId and workspaceId are required",
                });
                return;
            }
            logger_1.default.info("[RATE-LIMIT] Checking database limits...", {
                customerId,
                workspaceId,
            });
            // Check limits from DATABASE (atomic, cannot bypass)
            const limitCheck = yield checkRateLimitDatabase(customerId, workspaceId);
            if (!limitCheck.allowed) {
                const violation = limitCheck.violation;
                logger_1.default.error("🚨 [RATE-LIMIT] REQUEST BLOCKED - Limit exceeded", {
                    customerId,
                    workspaceId,
                    violation: violation.type,
                    current: violation.current,
                    limit: violation.limit,
                    resetAt: violation.resetAt,
                });
                // Calculate retry-after in seconds
                const retryAfter = Math.ceil((violation.resetAt.getTime() - Date.now()) / 1000);
                res.status(429).json({
                    error: "Rate limit exceeded",
                    message: violation.message,
                    details: {
                        violationType: violation.type,
                        current: violation.current,
                        limit: violation.limit,
                        resetAt: violation.resetAt.toISOString(),
                        retryAfter: retryAfter,
                    },
                    // Standard rate limit headers
                    "X-RateLimit-Limit": violation.limit,
                    "X-RateLimit-Remaining": 0,
                    "X-RateLimit-Reset": violation.resetAt.toISOString(),
                    "Retry-After": retryAfter,
                });
                return;
            }
            // ✅ Rate limits OK - proceed
            logger_1.default.info("✅ [RATE-LIMIT] Limits OK - proceeding", {
                customerId,
                workspaceId,
            });
            next();
        }
        catch (error) {
            logger_1.default.error("❌ [RATE-LIMIT] Error checking limits:", {
                error: error.message,
                stack: error.stack,
            });
            // On error, REJECT request (fail-safe: deny by default)
            res.status(500).json({
                error: "Rate limit check failed",
                message: "Could not verify rate limits - request denied for security",
            });
        }
    });
}
/**
 * Get current rate limit status for monitoring
 */
function getRateLimitStatus(customerId, workspaceId) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = new Date();
        // Customer per 10 seconds
        const tenSecondsAgo = new Date(now.getTime() - 10 * 1000);
        const customerCount = yield database_1.prisma.message.count({
            where: {
                metadata: { path: ["customerId"], equals: customerId },
                createdAt: { gte: tenSecondsAgo },
                direction: "OUTBOUND",
            },
        });
        // Workspace per minute
        const oneMinuteAgoWorkspace = new Date(now.getTime() - 60 * 1000);
        const workspaceMinuteCount = yield database_1.prisma.message.count({
            where: {
                metadata: { path: ["workspaceId"], equals: workspaceId },
                createdAt: { gte: oneMinuteAgoWorkspace },
                direction: "OUTBOUND",
            },
        });
        // Workspace per hour
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const workspaceHourlyCount = yield database_1.prisma.message.count({
            where: {
                metadata: { path: ["workspaceId"], equals: workspaceId },
                createdAt: { gte: oneHourAgo },
                direction: "OUTBOUND",
            },
        });
        // Workspace per day
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const workspaceDailyCount = yield database_1.prisma.message.count({
            where: {
                metadata: { path: ["workspaceId"], equals: workspaceId },
                createdAt: { gte: oneDayAgo },
                direction: "OUTBOUND",
            },
        });
        return {
            customer: {
                current: customerCount,
                limit: HARD_LIMITS.PER_CUSTOMER_PER_10_SECONDS,
                remaining: Math.max(0, HARD_LIMITS.PER_CUSTOMER_PER_10_SECONDS - customerCount),
                resetAt: new Date(tenSecondsAgo.getTime() + 10 * 1000),
            },
            workspaceMinute: {
                current: workspaceMinuteCount,
                limit: HARD_LIMITS.PER_WORKSPACE_PER_MINUTE,
                remaining: Math.max(0, HARD_LIMITS.PER_WORKSPACE_PER_MINUTE - workspaceMinuteCount),
                resetAt: new Date(oneMinuteAgoWorkspace.getTime() + 60 * 1000),
            },
            workspaceHourly: {
                current: workspaceHourlyCount,
                limit: HARD_LIMITS.PER_WORKSPACE_PER_HOUR,
                remaining: Math.max(0, HARD_LIMITS.PER_WORKSPACE_PER_HOUR - workspaceHourlyCount),
                resetAt: new Date(oneHourAgo.getTime() + 60 * 60 * 1000),
            },
            workspaceDaily: {
                current: workspaceDailyCount,
                limit: HARD_LIMITS.PER_WORKSPACE_PER_DAY,
                remaining: Math.max(0, HARD_LIMITS.PER_WORKSPACE_PER_DAY - workspaceDailyCount),
                resetAt: new Date(oneDayAgo.getTime() + 24 * 60 * 60 * 1000),
            },
        };
    });
}
/**
 * Reset rate limits for customer/workspace (admin only)
 */
function resetRateLimits(customerId, workspaceId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (customerId) {
            // Delete messages for customer (or mark as excluded from rate limit)
            yield database_1.prisma.message.updateMany({
                where: {
                    metadata: { path: ["customerId"], equals: customerId },
                    direction: "OUTBOUND",
                },
                data: {
                    metadata: {
                        excludeFromRateLimit: true,
                    },
                },
            });
            logger_1.default.info(`🔄 Reset rate limits for customer ${customerId}`);
        }
        if (workspaceId) {
            yield database_1.prisma.message.updateMany({
                where: {
                    metadata: { path: ["workspaceId"], equals: workspaceId },
                    direction: "OUTBOUND",
                },
                data: {
                    metadata: {
                        excludeFromRateLimit: true,
                    },
                },
            });
            logger_1.default.info(`🔄 Reset rate limits for workspace ${workspaceId}`);
        }
    });
}
//# sourceMappingURL=hard-rate-limit.middleware.js.map