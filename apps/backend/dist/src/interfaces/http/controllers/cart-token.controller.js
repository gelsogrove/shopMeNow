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
exports.CartTokenController = void 0;
const secure_token_service_1 = require("../../../application/services/secure-token.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * Controller for managing cart view tokens
 * Used by support interface to generate tokens for viewing customer carts
 */
class CartTokenController {
    constructor() {
        this.secureTokenService = new secure_token_service_1.SecureTokenService();
    }
    /**
     * Generate or retrieve token for customer cart access
     * Riutilizza token esistenti quando possibile (KISS strategy)
     */
    getCartToken(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { workspaceId, customerId } = req.body;
                // Validazione parametri
                if (!workspaceId) {
                    res.status(400).json({
                        success: false,
                        error: "workspaceId is required",
                    });
                    return;
                }
                if (!customerId) {
                    res.status(400).json({
                        success: false,
                        error: "customerId is required",
                    });
                    return;
                }
                logger_1.default.info(`[CART-TOKEN] 🎯 Richiesta token per customer: ${customerId}, workspace: ${workspaceId}`);
                // Debug: log customer details
                logger_1.default.info(`[CART-TOKEN] 🔍 DEBUG - customerId ricevuto: "${customerId}", tipo: ${typeof customerId}`);
                logger_1.default.info(`[CART-TOKEN] 🔍 DEBUG - workspaceId ricevuto: "${workspaceId}", tipo: ${typeof workspaceId}`);
                // Utilizza SecureTokenService con strategia KISS
                // Se esiste token valido lo riutilizza, altrimenti ne crea uno nuovo
                const token = yield this.secureTokenService.createToken("cart", // tipo token
                workspaceId, { purpose: "cart_view", access: "read_only", customerId }, // 🔧 FIX: Include customerId nel payload!
                "24h", // durata 24 ore
                undefined, // userId (non necessario per cart view)
                undefined, // phoneNumber (non necessario)
                req.ip, // IP address per sicurezza
                customerId // customerId
                );
                logger_1.default.info(`[CART-TOKEN] ✅ Token generato/riutilizzato per customer ${customerId}`);
                // Debug: log token details
                logger_1.default.info(`[CART-TOKEN] 🔍 DEBUG - Token generato: ${token.substring(0, 10)}...${token.substring(-10)} (length: ${token.length})`);
                res.status(200).json({
                    success: true,
                    data: {
                        token,
                        customerId,
                        workspaceId,
                        expiresIn: "24h",
                        purpose: "cart_view",
                    },
                });
            }
            catch (error) {
                logger_1.default.error(`[CART-TOKEN] ❌ Errore generazione token:`, error);
                res.status(500).json({
                    success: false,
                    error: "Internal server error while generating cart token",
                });
            }
        });
    }
    /**
     * Validate a cart token (optional endpoint for debugging)
     */
    validateCartToken(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const { token } = req.params;
                if (!token) {
                    res.status(400).json({
                        success: false,
                        error: "Token is required",
                    });
                    return;
                }
                const validation = yield this.secureTokenService.validateToken(token);
                if (!validation.valid) {
                    res.status(401).json({
                        success: false,
                        error: "Invalid or expired token",
                    });
                    return;
                }
                res.status(200).json({
                    success: true,
                    data: {
                        isValid: true,
                        customerId: (_a = validation.data) === null || _a === void 0 ? void 0 : _a.customerId,
                        workspaceId: (_b = validation.data) === null || _b === void 0 ? void 0 : _b.workspaceId,
                        expiresAt: (_c = validation.data) === null || _c === void 0 ? void 0 : _c.expiresAt,
                        payload: validation.payload,
                    },
                });
            }
            catch (error) {
                logger_1.default.error(`[CART-TOKEN] ❌ Errore validazione token:`, error);
                res.status(500).json({
                    success: false,
                    error: "Internal server error while validating token",
                });
            }
        });
    }
}
exports.CartTokenController = CartTokenController;
//# sourceMappingURL=cart-token.controller.js.map