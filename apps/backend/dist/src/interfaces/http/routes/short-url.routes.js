"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shortUrlRoutes = void 0;
const express_1 = require("express");
const short_url_controller_1 = require("../controllers/short-url.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
exports.shortUrlRoutes = router;
/**
 * Short URL Routes
 * Handle URL shortening and redirection
 *
 * 🔓 PUBLIC: Redirect and resolve endpoints are public (short URLs for customers)
 * 🔒 PROTECTED: Stats endpoint requires authentication
 */
// Redirect from short URL (public route - NO AUTH REQUIRED)
router.get("/s/:shortCode", short_url_controller_1.shortUrlController.redirect);
// Resolve short URL to JSON (public route - NO AUTH REQUIRED)
// Used by frontend SPA to avoid CORS redirect issues
router.get("/s/:shortCode/resolve", short_url_controller_1.shortUrlController.resolve);
// Get short URL statistics (API route - REQUIRES AUTH)
router.get("/api/short-urls/:shortCode/stats", auth_middleware_1.authMiddleware, short_url_controller_1.shortUrlController.getStats);
//# sourceMappingURL=short-url.routes.js.map