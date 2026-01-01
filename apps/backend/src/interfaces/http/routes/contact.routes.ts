import { Router } from "express"
import { contactLimiter } from "../../../config/rate-limiters"
import { ContactController } from "../controllers/contact.controller"

export const contactRoutes = (): Router => {
  const router = Router()
  const controller = new ContactController()

  router.post("/contact", contactLimiter, controller.submitContact.bind(controller))

  return router
}
