import { Router } from "express"
import { feedbackLimiter } from "../../../config/rate-limiters"
import { FeedbackController } from "../controllers/feedback.controller"
import { authMiddleware } from "../middlewares/auth.middleware"

export const feedbackRoutes = (controller: FeedbackController): Router => {
  const router = Router()

  // Public routes (no auth required) - accessed with token
  // 🔒 SECURITY: Rate limited to prevent spam attacks
  router.get("/feedback", feedbackLimiter, controller.getFeedback.bind(controller))
  router.post("/feedback", feedbackLimiter, controller.submitFeedback.bind(controller))

  // Admin routes (auth required)
  router.get(
    "/workspaces/:workspaceId/feedbacks",
    authMiddleware,
    controller.getWorkspaceFeedbacks.bind(controller)
  )

  return router
}
