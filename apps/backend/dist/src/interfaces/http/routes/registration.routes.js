"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registrationRouter = void 0;
exports.default = createRegistrationRouter;
const express_1 = require("express");
const rate_limiters_1 = require("../../../config/rate-limiters");
const logger_1 = __importDefault(require("../../../utils/logger"));
const registration_controller_1 = require("../controllers/registration.controller");
const async_middleware_1 = require("../middlewares/async.middleware");
/**
 * Creates and configures routes for customer registration
 * 🔒 SECURITY: Rate limited to prevent brute-force token validation
 */
const registrationRouter = (controller) => {
    const router = (0, express_1.Router)();
    // Apply rate limiting to all registration routes
    router.use(rate_limiters_1.registrationLimiter);
    logger_1.default.info("Setting up registration routes (with rate limiting)");
    // Registration routes
    router.get("/token/:token", (0, async_middleware_1.asyncHandler)(controller.validateToken.bind(controller)));
    router.post("/register", (0, async_middleware_1.asyncHandler)(controller.register.bind(controller)));
    router.get("/data-protection", (0, async_middleware_1.asyncHandler)(controller.getDataProtectionInfo.bind(controller)));
    logger_1.default.info("Registration routes setup complete");
    return router;
};
exports.registrationRouter = registrationRouter;
/**
 * Creates a route instance with registration controller
 */
function createRegistrationRouter() {
    return (0, exports.registrationRouter)(new registration_controller_1.RegistrationController());
}
//# sourceMappingURL=registration.routes.js.map