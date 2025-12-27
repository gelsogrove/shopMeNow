"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggingMiddleware = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const loggingMiddleware = (req, res, next) => {
    // Log all requests
    logger_1.default.info(`Incoming ${req.method} request to ${req.url}`);
    // Capture the original send method
    const originalSend = res.send;
    // Override send method to log responses
    res.send = function (body) {
        logger_1.default.info(`Response for ${req.method} ${req.url} - Status: ${res.statusCode}`);
        // If there's an error and we're in development, log it
        if (res.statusCode >= 400 && process.env.NODE_ENV === 'development') {
            logger_1.default.error('Response body:', body);
        }
        // Call the original send
        return originalSend.call(this, body);
    };
    // Log any errors
    const errorHandler = (err) => {
        logger_1.default.error('Request error:', {
            method: req.method,
            url: req.url,
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    };
    // Attach error handler
    res.on('error', errorHandler);
    next();
};
exports.loggingMiddleware = loggingMiddleware;
//# sourceMappingURL=logging.middleware.js.map