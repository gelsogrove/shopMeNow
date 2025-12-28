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
exports.whatsappRateLimitMiddleware = whatsappRateLimitMiddleware;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../../../utils/logger"));
// In-memory cache per rate limiting (production: usa Redis!)
const rateLimitCache = {};
// Default rate limits (TODO: move to database configuration)
const WORKSPACE_LIMIT = 100;
const CUSTOMER_LIMIT = 10;
const WINDOW_MS = 60 * 1000; // 1 minute
/**
 * Check if rate limit is exceeded
 */
function checkRateLimit(key, limit) {
    const now = Date.now();
    const entry = rateLimitCache[key];
    // Reset if window expired
    if (!entry || now > entry.resetAt) {
        rateLimitCache[key] = {
            count: 1,
            resetAt: now + WINDOW_MS,
        };
        return false; // Not exceeded
    }
    // Increment count
    entry.count++;
    // Check if exceeded
    return entry.count > limit;
}
/**
 * Rate limit middleware for WhatsApp endpoints
 */
function whatsappRateLimitMiddleware(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        try {
            // Extract identifiers based on endpoint
            let workspaceId;
            let customerId;
            let phoneNumber;
            // For webhook (inbound)
            if (req.path.includes("/webhook") && req.method === "POST") {
                const message = (_g = (_f = (_e = (_d = (_c = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.entry) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.changes) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.value) === null || _f === void 0 ? void 0 : _f.messages) === null || _g === void 0 ? void 0 : _g[0];
                phoneNumber = (message === null || message === void 0 ? void 0 : message.from) ? `+${message.from}` : undefined;
                if (phoneNumber) {
                    // Find customer to get workspaceId
                    const customer = yield database_1.prisma.customers.findFirst({
                        where: { phone: phoneNumber },
                        select: { id: true, workspaceId: true },
                    });
                    if (customer) {
                        workspaceId = customer.workspaceId;
                        customerId = customer.id;
                    }
                }
            }
            // For send endpoint (outbound)
            if (req.path.includes("/send") && req.method === "POST") {
                workspaceId = (_h = req.body) === null || _h === void 0 ? void 0 : _h.workspaceId;
                customerId = (_j = req.body) === null || _j === void 0 ? void 0 : _j.customerId;
                phoneNumber = (_k = req.body) === null || _k === void 0 ? void 0 : _k.phoneNumber;
            }
            // 🔒 RATE LIMIT 1: Workspace limit
            if (workspaceId) {
                const workspaceKey = `workspace:${workspaceId}`;
                const workspaceExceeded = checkRateLimit(workspaceKey, WORKSPACE_LIMIT);
                if (workspaceExceeded) {
                    logger_1.default.warn("[RATE-LIMIT] ❌ Workspace limit exceeded", {
                        workspaceId,
                        limit: WORKSPACE_LIMIT,
                        window: "1 minute",
                    });
                    res.status(429).json({
                        error: "Rate limit exceeded",
                        message: `Workspace message limit exceeded (${WORKSPACE_LIMIT}/minute)`,
                        retryAfter: 60,
                    });
                    return;
                }
            }
            // 🔒 RATE LIMIT 2: Customer limit
            if (customerId) {
                const customerKey = `customer:${customerId}`;
                const customerExceeded = checkRateLimit(customerKey, CUSTOMER_LIMIT);
                if (customerExceeded) {
                    logger_1.default.warn("[RATE-LIMIT] ❌ Customer limit exceeded", {
                        customerId,
                        phoneNumber,
                        limit: CUSTOMER_LIMIT,
                        window: "1 minute",
                    });
                    res.status(429).json({
                        error: "Rate limit exceeded",
                        message: `Too many messages from this customer (${CUSTOMER_LIMIT}/minute)`,
                        retryAfter: 60,
                    });
                    return;
                }
            }
            // ✅ Rate limits not exceeded
            next();
        }
        catch (error) {
            logger_1.default.error("[RATE-LIMIT] Error checking rate limits:", {
                error: error.message,
                path: req.path,
            });
            // On error, allow request (fail open for availability)
            next();
        }
    });
}
/**
 * Clean up expired entries periodically
 */
setInterval(() => {
    const now = Date.now();
    Object.keys(rateLimitCache).forEach((key) => {
        if (rateLimitCache[key].resetAt < now) {
            delete rateLimitCache[key];
        }
    });
}, WINDOW_MS);
//# sourceMappingURL=whatsapp-rate-limit.middleware.js.map