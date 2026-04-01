import { Router } from "express"
import { authMiddleware } from "../middlewares/auth.middleware"
import { sessionValidationMiddleware } from "../middlewares/session-validation.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"
import { checkTrialValid } from "../middlewares/billing.middleware"
import { PushCampaignController } from "../controllers/push-campaign.controller"

export const pushCampaignRoutes = () => {
  const router = Router({ mergeParams: true })
  const controller = new PushCampaignController()

  // Security: 3-layer middleware stack (Rule #5 from CLAUDE.md)
  router.use(authMiddleware)
  router.use(sessionValidationMiddleware)
  router.use(workspaceValidationMiddleware)

  router.get("/", controller.list.bind(controller))
  router.get("/:id", controller.get.bind(controller))
  router.get("/:id/recipients", controller.recipients.bind(controller))
  router.get("/:id/sent-messages", controller.sentMessages.bind(controller))

  router.post("/", checkTrialValid, controller.create.bind(controller))
  router.put("/:id", controller.update.bind(controller))
  router.delete("/:id", controller.delete.bind(controller))
  router.post("/:id/schedule", controller.schedule.bind(controller))
  router.post("/:id/run-now", controller.runNow.bind(controller))
  router.post("/:id/pause", controller.pause.bind(controller))
  router.post("/:id/resume", controller.resume.bind(controller))
  router.post("/:id/cancel", controller.cancel.bind(controller))
  router.post("/:id/security-check", controller.securityCheck.bind(controller))

  return router
}
