"use strict";
/**
 * Rate Limiters Configuration
 *
 * Protects critical public endpoints from abuse, DoS attacks, and brute force attempts.
 * Each limiter is configured based on the endpoint's expected usage pattern.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generalApiLimiter = exports.cartTokenLimiter = exports.feedbackLimiter = exports.cartLimiter = exports.registrationLimiter = exports.checkoutLimiter = exports.publicOrdersLimiter = exports.webhookLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Webhook WhatsApp - Protezione DoS
 *
 * Prevents spam/DoS attacks on webhook endpoint.
 * Allows 10 requests per minute per IP address.
 */
exports.webhookLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minuto
    max: 10, // 10 richieste per IP
    message: "Too many webhook requests from this IP, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger_1.default.warn("Rate limit exceeded for webhook", {
            ip: req.ip,
            path: req.path,
        });
        res.status(429).json({
            error: "Too many requests",
            message: "Rate limit exceeded. Please try again later.",
            retryAfter: 60,
        });
    },
});
/**
 * Public Orders - Protezione brute force token
 *
 * Prevents brute force attacks on secure tokens.
 * Allows 30 requests per 15 minutes per IP (2 per minute).
 */
exports.publicOrdersLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 30, // 30 richieste per IP
    message: "Too many order requests, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger_1.default.warn("Rate limit exceeded for public orders", {
            ip: req.ip,
            path: req.path,
            token: req.query.token ? "present" : "missing",
        });
        res.status(429).json({
            error: "Too many requests",
            message: "Rate limit exceeded. Please try again in 15 minutes.",
            retryAfter: 900,
        });
    },
});
/**
 * Checkout - Protezione spam ordini
 *
 * Prevents spam order creation.
 * Allows 20 orders per hour per IP.
 */
exports.checkoutLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 ora
    max: 20, // 20 ordini per IP all'ora
    message: "Too many checkout attempts, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        var _a;
        logger_1.default.warn("Rate limit exceeded for checkout", {
            ip: req.ip,
            path: req.path,
            customerId: (_a = req.body) === null || _a === void 0 ? void 0 : _a.customerId,
        });
        res.status(429).json({
            error: "Too many requests",
            message: "Too many checkout attempts. Please try again in 1 hour.",
            retryAfter: 3600,
        });
    },
});
/**
 * Registration - Protezione account creation spam
 *
 * Prevents mass account creation spam.
 * Allows 5 registrations per hour per IP.
 */
exports.registrationLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 ora
    max: 5, // 5 registrazioni per IP all'ora
    message: "Too many registration attempts, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Count all attempts
    handler: (req, res) => {
        var _a;
        logger_1.default.warn("Rate limit exceeded for registration", {
            ip: req.ip,
            path: req.path,
            email: (_a = req.body) === null || _a === void 0 ? void 0 : _a.email,
        });
        res.status(429).json({
            error: "Too many requests",
            message: "Too many registration attempts. Please try again in 1 hour.",
            retryAfter: 3600,
        });
    },
});
/**
 * Cart Operations - Protezione cart manipulation
 *
 * Prevents rapid cart manipulation abuse.
 * Allows 30 operations per minute per IP.
 */
exports.cartLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minuto
    max: 30, // 30 operazioni al minuto
    message: "Too many cart operations, please slow down",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger_1.default.warn("Rate limit exceeded for cart operations", {
            ip: req.ip,
            path: req.path,
            method: req.method,
        });
        res.status(429).json({
            error: "Too many requests",
            message: "Too many cart operations. Please slow down.",
            retryAfter: 60,
        });
    },
});
/**
 * Feedback - Protezione spam feedback
 *
 * Prevents spam feedback submissions.
 * Allows 5 feedbacks per 15 minutes per IP.
 */
exports.feedbackLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 5, // 5 feedback per IP
    message: "Too many feedback submissions, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger_1.default.warn("Rate limit exceeded for feedback", {
            ip: req.ip,
            path: req.path,
        });
        res.status(429).json({
            error: "Too many requests",
            message: "Too many feedback submissions. Please try again in 15 minutes.",
            retryAfter: 900,
        });
    },
});
/**
 * Cart Token - Protezione generazione token
 *
 * Prevents cart token abuse.
 * Allows 10 token operations per minute per IP.
 */
exports.cartTokenLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minuto
    max: 10, // 10 operazioni al minuto
    message: "Too many cart token requests, please slow down",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger_1.default.warn("Rate limit exceeded for cart token", {
            ip: req.ip,
            path: req.path,
        });
        res.status(429).json({
            error: "Too many requests",
            message: "Too many cart token requests. Please slow down.",
            retryAfter: 60,
        });
    },
});
/**
 * General API Rate Limiter
 *
 * Fallback rate limiter for all API endpoints.
 * Allows 100 requests per minute per IP.
 */
exports.generalApiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minuto
    max: 100, // 100 richieste al minuto
    message: "Too many API requests, please slow down",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger_1.default.warn("General API rate limit exceeded", {
            ip: req.ip,
            path: req.path,
            method: req.method,
        });
        res.status(429).json({
            error: "Too many requests",
            message: "API rate limit exceeded. Please slow down.",
            retryAfter: 60,
        });
    },
});
//# sourceMappingURL=rate-limiters.js.map