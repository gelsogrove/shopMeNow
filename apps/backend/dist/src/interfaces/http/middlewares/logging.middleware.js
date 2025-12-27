"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLoggingMiddleware = exports.loggingMiddleware = void 0;
const logger_1 = __importDefault(require("../../../utils/logger"));
const loggingMiddleware = (req, res, next) => {
    const startTime = Date.now();
    // Log request
    logger_1.default.info("Incoming request", {
        method: req.method,
        url: req.url,
        query: req.query,
        headers: Object.assign(Object.assign({}, req.headers), { authorization: req.headers.authorization ? "[REDACTED]" : undefined }),
        ip: req.ip,
    });
    // Capture response
    const originalSend = res.send;
    res.send = function (body) {
        const responseTime = Date.now() - startTime;
        // Log response
        logger_1.default.info("Outgoing response", {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime,
            size: Buffer.byteLength(body),
        });
        return originalSend.call(this, body);
    };
    next();
};
exports.loggingMiddleware = loggingMiddleware;
const requestLoggingMiddleware = (req, res, next) => {
    // Log the request
    logger_1.default.info(`Request: ${req.method} ${req.originalUrl}`);
    // Store the original end function
    const originalEnd = res.end;
    // Override the end function to log the response
    // @ts-ignore
    res.end = function (chunk, encoding, cb) {
        logger_1.default.info(`Response for ${req.method} ${req.originalUrl} - Status: ${res.statusCode}`);
        // Call the original end function
        return originalEnd.call(this, chunk, encoding, cb);
    };
    next();
};
exports.requestLoggingMiddleware = requestLoggingMiddleware;
//# sourceMappingURL=logging.middleware.js.map