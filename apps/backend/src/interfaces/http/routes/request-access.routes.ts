import { Router } from "express"
import { requestAccessLimiter } from "../../../config/rate-limiters"
import { RequestAccessController } from "../controllers/request-access.controller"

// Public sales-lead capture endpoint. Replaces the old self-service Sign Up
// flow on the marketing landing — visitors submit a short demo-request form
// and the email lands in the sales inbox (REQUEST_ACCESS_EMAIL env or the
// default in the controller). No auth, rate-limited, honeypot-protected.
export const requestAccessRoutes = (): Router => {
  const router = Router()
  const controller = new RequestAccessController()

  router.post(
    "/request-access",
    requestAccessLimiter,
    controller.submit.bind(controller),
  )

  return router
}
