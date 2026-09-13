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
  // Before /:id — "audience"/"trash" must never be parsed as a campaign id.
  router.get("/audience", controller.audience.bind(controller))
  router.get("/trash", controller.listTrash.bind(controller))
  router.get("/:id", controller.get.bind(controller))
  router.get("/:id/recipients", controller.recipients.bind(controller))
  router.get("/:id/sent-messages", controller.sentMessages.bind(controller))

  router.post("/", checkTrialValid, controller.create.bind(controller))
  router.put("/:id", controller.update.bind(controller))
  // Soft delete — the default, keeps recipient/send history intact.
  router.delete("/:id", controller.delete.bind(controller))
  // Restore from the trash (undo a soft delete).
  router.post("/:id/restore", controller.restore.bind(controller))
  // Permanent delete — backoffice cleanup only, blocked when actualSent > 0.
  router.delete("/:id/permanent", controller.hardDelete.bind(controller))
  router.post("/:id/schedule", controller.schedule.bind(controller))
  router.post("/:id/run-now", controller.runNow.bind(controller))
  router.post("/:id/pause", controller.pause.bind(controller))
  router.post("/:id/resume", controller.resume.bind(controller))
  router.post("/:id/cancel", controller.cancel.bind(controller))
  router.post("/:id/security-check", controller.securityCheck.bind(controller))

  return router
}
