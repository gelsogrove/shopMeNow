import { Router } from "express"
import { CampaignController } from "../controllers/campaign.controller"
import { authMiddleware } from "../middlewares/auth.middleware"

export const campaignRoutes = (controller: CampaignController): Router => {
  const router = Router()

  // All routes require authentication
  router.use(authMiddleware)

  // Get all campaigns for workspace
  router.get(
    "/:workspaceId/campaigns",
    controller.getCampaigns.bind(controller)
  )

  // Get specific campaign
  router.get(
    "/:workspaceId/campaigns/:id",
    controller.getCampaignById.bind(controller)
  )

  // Create new campaign
  router.post(
    "/:workspaceId/campaigns",
    controller.createCampaign.bind(controller)
  )

  // Update campaign
  router.put(
    "/:workspaceId/campaigns/:id",
    controller.updateCampaign.bind(controller)
  )

  // Delete campaign
  router.delete(
    "/:workspaceId/campaigns/:id",
    controller.deleteCampaign.bind(controller)
  )

  // Toggle campaign active status
  router.patch(
    "/:workspaceId/campaigns/:id/toggle",
    controller.toggleCampaignActive.bind(controller)
  )

  return router
}
