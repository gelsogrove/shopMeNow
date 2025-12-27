"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const campaignRoutes = (controller) => {
    const router = (0, express_1.Router)();
    // All routes require authentication
    router.use(auth_middleware_1.authMiddleware);
    // Get all campaigns for workspace
    router.get("/:workspaceId/campaigns", controller.getCampaigns.bind(controller));
    // Get specific campaign
    router.get("/:workspaceId/campaigns/:id", controller.getCampaignById.bind(controller));
    // Create new campaign
    router.post("/:workspaceId/campaigns", controller.createCampaign.bind(controller));
    // Update campaign
    router.put("/:workspaceId/campaigns/:id", controller.updateCampaign.bind(controller));
    // Delete campaign
    router.delete("/:workspaceId/campaigns/:id", controller.deleteCampaign.bind(controller));
    // Toggle campaign active status
    router.patch("/:workspaceId/campaigns/:id/toggle", controller.toggleCampaignActive.bind(controller));
    return router;
};
exports.campaignRoutes = campaignRoutes;
//# sourceMappingURL=campaign.routes.js.map