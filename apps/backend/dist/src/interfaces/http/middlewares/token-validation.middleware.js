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
exports.tokenValidationMiddleware = void 0;
const secure_token_service_1 = require("../../../application/services/secure-token.service");
const prisma_1 = require("../../../lib/prisma");
const logger_1 = __importDefault(require("../../../utils/logger"));
const secureTokenService = new secure_token_service_1.SecureTokenService();
/**
 * Middleware for validating secure tokens in public endpoints
 *
 * Extracts token from request (body, query, or params), validates it,
 * and attaches customerId, workspaceId, and tokenData to request object.
 *
 * @middleware
 * @security Validates token expiry and signature
 * @security Implements workspace isolation
 * @security Falls back to phone number lookup if customerId missing
 *
 * @example
 * ```typescript
 * router.post("/endpoint",
 *   publicOrdersLimiter,
 *   tokenValidationMiddleware,
 *   async (req, res) => {
 *     const { customerId, workspaceId } = req as any
 *     // ... business logic with validated data
 *   }
 * )
 * ```
 *
 * @throws {400} If token is missing from request
 * @throws {401} If token is invalid or expired
 * @throws {401} If token doesn't contain valid customer information
 */
const tokenValidationMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. Extract token from multiple possible locations
        const token = req.body.token || req.query.token || req.params.token || null;
        // 🔒 SECURITY: Token is required
        if (!token) {
            return res.status(400).json({
                success: false,
                error: "Token is required",
            });
        }
        logger_1.default.info("[TOKEN-VALIDATION-MIDDLEWARE] Validating token");
        // 2. Validate token with SecureTokenService
        const validation = yield secureTokenService.validateToken(token);
        if (!validation.valid) {
            logger_1.default.warn("[TOKEN-VALIDATION-MIDDLEWARE] Invalid or expired token");
            return res.status(401).json({
                success: false,
                error: "Invalid or expired token",
            });
        }
        // 3. Extract customer and workspace information from validated token
        const tokenData = validation.data;
        const payload = validation.payload;
        // Try to get customerId from multiple sources (payload has priority)
        let customerId = (payload === null || payload === void 0 ? void 0 : payload.customerId) || (tokenData === null || tokenData === void 0 ? void 0 : tokenData.customerId) || (tokenData === null || tokenData === void 0 ? void 0 : tokenData.userId);
        const workspaceId = tokenData === null || tokenData === void 0 ? void 0 : tokenData.workspaceId;
        // 4. ULTIMATE FALLBACK: If no customerId, try to find customer by phone number
        if (!customerId && (tokenData === null || tokenData === void 0 ? void 0 : tokenData.phoneNumber) && workspaceId) {
            logger_1.default.info("[TOKEN-VALIDATION-MIDDLEWARE] Attempting phone number fallback");
            const customer = yield prisma_1.prisma.customers.findFirst({
                where: {
                    phone: tokenData.phoneNumber,
                    workspaceId: workspaceId,
                },
            });
            if (customer) {
                customerId = customer.id;
                logger_1.default.info(`[TOKEN-VALIDATION-MIDDLEWARE] Found customer by phone: ${customerId}`);
            }
        }
        // 5. Verify we have all required information
        if (!customerId || !workspaceId) {
            logger_1.default.error("[TOKEN-VALIDATION-MIDDLEWARE] Token missing required information", {
                hasCustomerId: !!customerId,
                hasWorkspaceId: !!workspaceId,
            });
            return res.status(401).json({
                success: false,
                error: "Token does not contain valid customer information",
            });
        }
        // 6. ✅ SUCCESS: Attach validated data to request object
        ;
        req.customerId = customerId;
        req.workspaceId = workspaceId;
        req.tokenData = tokenData;
        req.tokenPayload = payload;
        logger_1.default.info("[TOKEN-VALIDATION-MIDDLEWARE] ✅ Token validated successfully", {
            customerId,
            workspaceId,
        });
        next();
    }
    catch (error) {
        logger_1.default.error("[TOKEN-VALIDATION-MIDDLEWARE] Unexpected error during validation:", error);
        return res.status(500).json({
            success: false,
            error: "Error validating token",
        });
    }
});
exports.tokenValidationMiddleware = tokenValidationMiddleware;
//# sourceMappingURL=token-validation.middleware.js.map