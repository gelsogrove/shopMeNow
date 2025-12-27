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
exports.jwtAuthMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * JWT Authentication Middleware
 * Verifies JWT tokens from query params or Authorization header
 * Uses proper JWT signature verification with JWT_SECRET
 */
const jwtAuthMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const token = req.query.token ||
            ((_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace("Bearer ", ""));
        if (!token) {
            res.status(401).json({
                success: false,
                error: "Token is required",
            });
            return;
        }
        // Verify JWT token with proper signature validation
        const payload = yield verifyJWTToken(token);
        if (!payload) {
            res.status(401).json({
                success: false,
                error: "Invalid or expired token",
            });
            return;
        }
        // Add payload to request for use in controllers
        ;
        req.jwtPayload = payload;
        next();
    }
    catch (error) {
        logger_1.default.error("[JWT-AUTH] Middleware error:", error);
        res.status(500).json({
            success: false,
            error: "Authentication error",
        });
    }
});
exports.jwtAuthMiddleware = jwtAuthMiddleware;
/**
 * Verify JWT token with signature validation
 * Uses JWT_SECRET from environment for verification
 *
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid
 */
function verifyJWTToken(token) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                logger_1.default.error("[JWT-AUTH] JWT_SECRET not configured");
                return null;
            }
            // Verify JWT with signature validation
            const decoded = jsonwebtoken_1.default.verify(token, secret);
            // Additional validation: ensure required fields exist
            if (!decoded.clientId || !decoded.workspaceId || !decoded.scope) {
                logger_1.default.error("[JWT-AUTH] Token missing required fields");
                return null;
            }
            return decoded;
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                logger_1.default.warn("[JWT-AUTH] Token expired");
            }
            else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                logger_1.default.warn("[JWT-AUTH] Invalid token signature");
            }
            else {
                logger_1.default.error("[JWT-AUTH] Token verification error:", error);
            }
            return null;
        }
    });
}
//# sourceMappingURL=jwt-auth.middleware.js.map