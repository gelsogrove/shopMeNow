import { Router } from "express"
import { OnboardingQuestionnaireController } from "../controllers/onboarding-questionnaire.controller"
import { authMiddleware } from "../middlewares/auth.middleware"

const controller = new OnboardingQuestionnaireController()

const questionnairePublicRouter = Router()
const questionnaireAdminRouter = Router()

// PUBLIC — no auth
questionnairePublicRouter.post(
  "/questionnaire",
  (req, res) => controller.submit(req, res)
)

// ADMIN — auth required
questionnaireAdminRouter.get(
  "/questionnaire",
  authMiddleware,
  (req, res) => controller.getAll(req, res)
)
questionnaireAdminRouter.get(
  "/questionnaire/stats",
  authMiddleware,
  (req, res) => controller.getStats(req, res)
)
questionnaireAdminRouter.patch(
  "/questionnaire/:id/viewed",
  authMiddleware,
  (req, res) => controller.markViewed(req, res)
)

export { questionnairePublicRouter, questionnaireAdminRouter }
