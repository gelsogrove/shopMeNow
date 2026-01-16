import { Router } from "express"
import { authMiddleware } from "../middlewares/auth.middleware"
import { PushCampaignController } from "../controllers/push-campaign.controller"

export const pushCampaignRoutes = () => {
  const router = Router({ mergeParams: true })
  const controller = new PushCampaignController()

  router.use(authMiddleware)

  router.get("/", controller.list.bind(controller))
  router.get("/:id", controller.get.bind(controller))
  router.get("/:id/recipients", controller.recipients.bind(controller))

  router.post("/", controller.create.bind(controller))
  router.post("/:id/schedule", controller.schedule.bind(controller))
  router.post("/:id/run-now", controller.runNow.bind(controller))
  router.post("/:id/pause", controller.pause.bind(controller))
  router.post("/:id/resume", controller.resume.bind(controller))
  router.post("/:id/cancel", controller.cancel.bind(controller))

  return router
}
