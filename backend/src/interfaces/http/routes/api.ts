import { Router } from "express"
import { AuthController } from "../controllers/auth.controller"
import { createAuthRouter } from "./auth.routes"
import { categoriesRouter } from "./categories.routes"
import { chatRouter } from "./chat.routes"
import { customersRouter } from "./customers.routes"

import analyticsRouter from "./analytics.routes"
import callingFunctionsRouter from "./calling-functions.routes"
import { createCartTokenRouter } from "./cart-token.routes"
import { faqsRouter } from "./faqs.routes"
import { offersRouter } from "./offers.routes"
import { createOrderRouter } from "./order.routes"
import productsRouter from "./products.routes"
import { servicesRouter } from "./services.routes"
import { settingsRouter } from "./settings.routes"

import { createUserRouter } from "./user.routes"
// Removed whatsappRouter import
import { workspaceRouter } from "./workspace.routes"

import { ChatController } from "../controllers/chat.controller"
import { CustomersController } from "../controllers/customers.controller"

import { FaqController } from "../controllers/faq.controller"
// Removed MessageController import
import { OfferController } from "../controllers/offer.controller"
import { ProductController } from "../controllers/product.controller"
import { ServicesController } from "../controllers/services.controller"
import { SettingsController } from "../controllers/settings.controller"

import { UserController } from "../controllers/user.controller"
// Removed WhatsAppController import
import { WorkspaceController } from "../controllers/workspace.controller"

import { CustomerService } from "../../../application/services/customer.service"
import { FaqService } from "../../../application/services/faq.service"
// Removed MessageService import
import { OtpService } from "../../../application/services/otp.service"
import { PasswordResetService } from "../../../application/services/password-reset.service"
import { ProductService } from "../../../application/services/product.service"
import ServiceService from "../../../application/services/service.service"

import { UserService } from "../../../application/services/user.service"
import { WorkspaceService } from "../../../application/services/workspace.service"
import { prisma } from "../../../lib/prisma"

// Initialize services
const productService = new ProductService()
const serviceService = ServiceService
const userService = new UserService()
const workspaceService = new WorkspaceService()
const customerService = new CustomerService()
// Removed messageService
const faqService = new FaqService()

// Initialize controllers
const productController = new ProductController()
const servicesController = new ServicesController()
const userController = new UserController(userService)
const workspaceController = new WorkspaceController()
const chatController = new ChatController()
const customersController = new CustomersController()
const settingsController = new SettingsController()
// Removed messageController and whatsappController
const authController = new AuthController(
  userService,
  new OtpService(prisma),
  new PasswordResetService(prisma)
)

const offerController = new OfferController()
const faqController = new FaqController()

export const apiRouter = (): Router => {
  const router = Router()

  // Map routes
  router.use("/auth", createAuthRouter(authController))
  router.use("/users", createUserRouter())
  router.use("/products", productsRouter())
  router.use("/services", servicesRouter(servicesController))
  router.use("/categories", categoriesRouter())
  router.use("/workspace", workspaceRouter())
  router.use("/chat", chatRouter(chatController))
  router.use("/settings", settingsRouter(settingsController))

  router.use("/offers", offersRouter())
  router.use("/customers", customersRouter(customersController))
  router.use("/faqs", faqsRouter())
  // Removed messages, whatsapp, and openai test routes

  // Orders routes
  router.use("/orders", createOrderRouter())
  router.use("/workspaces/:workspaceId/orders", createOrderRouter())

  // Cart token routes
  router.use("/cart-tokens", createCartTokenRouter())

  // Mount products routes with workspace context
  router.use("/workspaces/:workspaceId/products", productsRouter())

  // Calling functions routes (LLM-callable)
  router.use("/workspaces", callingFunctionsRouter)

  // Analytics routes
  router.use("/analytics", analyticsRouter)

  return router
}
