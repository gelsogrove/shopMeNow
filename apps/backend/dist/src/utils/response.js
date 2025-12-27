"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppResponse = void 0;
const logger_1 = __importDefault(require("./logger"));
/**
 * Utility class for API responses
 */
class AppResponse {
    /**
     * Send a success response
     * @param res Express response object
     * @param data Data to include in response
     * @param statusCode HTTP status code (default: 200)
     */
    static success(res, data = {}, statusCode = 200) {
        res.status(statusCode).json(data);
    }
    /**
     * Send an error response
     * @param res Express response object
     * @param message Error message
     * @param statusCode HTTP status code
     * @param details Additional error details
     */
    static error(res, message, statusCode = 500, details) {
        const response = Object.assign({ success: false, message }, (details ? { details } : {}));
        res.status(statusCode).json(response);
    }
    /**
     * Send a bad request (400) response
     * @param res Express response object
     * @param message Error message
     */
    static badRequest(res, message) {
        this.error(res, message, 400);
    }
    /**
     * Send an unauthorized (401) response
     * @param res Express response object
     * @param message Error message
     */
    static unauthorized(res, message = 'Unauthorized') {
        this.error(res, message, 401);
    }
    /**
     * Send a forbidden (403) response
     * @param res Express response object
     * @param message Error message
     */
    static forbidden(res, message = 'Forbidden') {
        this.error(res, message, 403);
    }
    /**
     * Send a not found (404) response
     * @param res Express response object
     * @param message Error message
     */
    static notFound(res, message = 'Resource not found') {
        this.error(res, message, 404);
    }
    /**
     * Send a server error (500) response
     * @param res Express response object
     * @param message Error message
     * @param error Original error for logging
     */
    static serverError(res, message = 'Internal Server Error', error) {
        if (error) {
            logger_1.default.error(message, error);
        }
        this.error(res, message, 500);
    }
}
exports.AppResponse = AppResponse;
//# sourceMappingURL=response.js.map