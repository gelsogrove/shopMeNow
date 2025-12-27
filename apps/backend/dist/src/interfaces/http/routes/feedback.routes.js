"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedbackRoutes = void 0;
const express_1 = require("express");
const rate_limiters_1 = require("../../../config/rate-limiters");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const feedbackRoutes = (controller) => {
    const router = (0, express_1.Router)();
    // Public routes (no auth required) - accessed with token
    // 🔒 SECURITY: Rate limited to prevent spam attacks
    router.get("/feedback", rate_limiters_1.feedbackLimiter, controller.getFeedback.bind(controller));
    router.post("/feedback", rate_limiters_1.feedbackLimiter, controller.submitFeedback.bind(controller));
    // Admin routes (auth required)
    router.get("/workspaces/:workspaceId/feedbacks", auth_middleware_1.authMiddleware, controller.getWorkspaceFeedbacks.bind(controller));
    return router;
};
exports.feedbackRoutes = feedbackRoutes;
//# sourceMappingURL=feedback.routes.js.map