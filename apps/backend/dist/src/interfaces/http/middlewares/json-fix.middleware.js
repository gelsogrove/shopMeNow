"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonFixMiddleware = void 0;
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * Middleware to fix malformed JSON requests with incorrect escaping
 */
const jsonFixMiddleware = (req, res, next) => {
    var _a, _b;
    // Only process POST, PUT and PATCH requests with content-type application/json
    const contentType = req.headers["content-type"];
    if (["POST", "PUT", "PATCH"].includes(req.method) &&
        contentType &&
        contentType.includes("application/json") &&
        req.rawBody) {
        // If req.body is already a valid object, skip processing
        if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
            logger_1.default.info("=== JSON FIX MIDDLEWARE - SKIPPING (body is already valid) ===");
            logger_1.default.info("req.body:", req.body);
            logger_1.default.info("req.body.salesId:", (_a = req.body) === null || _a === void 0 ? void 0 : _a.salesId);
            next();
            return;
        }
        try {
            // Try parsing the body first to check if it's valid JSON
            logger_1.default.info("=== JSON FIX MIDDLEWARE ===");
            logger_1.default.info("req.body BEFORE:", req.body);
            logger_1.default.info("req.body.salesId BEFORE:", (_b = req.body) === null || _b === void 0 ? void 0 : _b.salesId);
            logger_1.default.info("req.rawBody:", req.rawBody);
            JSON.parse(req.body);
            // If it parses successfully, do nothing and proceed
        }
        catch (err) {
            // If parsing fails, try to fix the JSON
            try {
                // First attempt: try with the raw body we stored
                if (req.rawBody) {
                    const parsedBody = JSON.parse(req.rawBody);
                    logger_1.default.info("Parsed rawBody:", parsedBody);
                    logger_1.default.info("Parsed rawBody.salesId:", parsedBody.salesId);
                    req.body = parsedBody;
                    logger_1.default.info("req.body AFTER:", req.body);
                    logger_1.default.info("req.body.salesId AFTER:", req.body.salesId);
                    logger_1.default.info("Fixed JSON request body using rawBody");
                }
                // Second attempt: try unescaping common escape sequences
                else {
                    const rawBody = JSON.stringify(req.body);
                    const fixedJson = rawBody
                        .replace(/\\"/g, '"') // Replace escaped quotes
                        .replace(/\\\\/g, "\\"); // Replace double backslashes
                    const parsedBody = JSON.parse(fixedJson);
                    req.body = parsedBody;
                    logger_1.default.info("Fixed JSON request body by removing escape characters");
                }
            }
            catch (fixError) {
                logger_1.default.error("Failed to fix malformed JSON:", fixError);
                // Don't modify the body if we can't fix it
            }
        }
    }
    next();
};
exports.jsonFixMiddleware = jsonFixMiddleware;
//# sourceMappingURL=json-fix.middleware.js.map