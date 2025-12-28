"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTokenRouter = createTokenRouter;
const express_1 = require("express");
const cart_routes_1 = require("../../interfaces/http/routes/cart.routes");
const checkout_routes_1 = require("../../interfaces/http/routes/checkout.routes");
const public_orders_routes_1 = __importDefault(require("../../interfaces/http/routes/public-orders.routes"));
const registration_routes_1 = __importDefault(require("../../interfaces/http/routes/registration.routes"));
const logger_1 = __importDefault(require("../../utils/logger"));
// ========================================
// 🎫 TOKEN ROUTES
// ========================================
// Purpose: Token-based routes (Registration, Checkout, Public Orders)
// Authentication: Token in URL query params (NO sessionId required)
// Middleware: Token validation only
// Base path: /api/token/*
// ========================================
/**
 * Creates and configures all token-based routes
 * These routes use token-based authentication (no sessionId)
 */
function createTokenRouter() {
    const router = (0, express_1.Router)();
    logger_1.default.info("🎫 Setting up token routes...");
    // Registration routes (/api/token/registration/*)
    router.use("/registration", (0, registration_routes_1.default)());
    logger_1.default.info("✅ Registered /token/registration/* routes");
    // Checkout routes (/api/token/checkout/*)
    router.use("/checkout", checkout_routes_1.checkoutRouter);
    logger_1.default.info("✅ Registered /token/checkout/* routes");
    // Public orders routes - includes validate-secure-token, orders-public, customer-profile
    // Mounted on / so routes are: /api/token/validate-secure-token, /api/token/orders-public/*, /api/token/customer-profile/*
    router.use("/", public_orders_routes_1.default);
    logger_1.default.info("✅ Registered /token/validate-secure-token route");
    logger_1.default.info("✅ Registered /token/orders-public/* routes");
    logger_1.default.info("✅ Registered /token/customer-profile/* routes");
    // Cart routes (/api/token/cart/*)
    router.use("/cart", cart_routes_1.cartRouter);
    logger_1.default.info("✅ Registered /token/cart/* routes (shopping cart)");
    logger_1.default.info("✅ Token routes setup complete");
    return router;
}
//# sourceMappingURL=index.js.map