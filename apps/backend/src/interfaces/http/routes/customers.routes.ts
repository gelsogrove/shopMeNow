import { Router } from "express"
import logger from "../../../utils/logger"
import { CustomersController } from "../controllers/customers.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { checkPlanLimits } from "../middlewares/billing.middleware"

// Router per il mounting principale
export const customersRouter = (controller: CustomersController): Router => {
  const router = Router()

  // 🔒 SECURITY: All routes require authentication
  router.use(authMiddleware)

  logger.info("Setting up customers routes")

  // Routes for customers - adjust paths to work with the router mounting
  router.get(
    "/:workspaceId/customers",
    controller.getCustomersForWorkspace.bind(controller)
  )
  // 💰 BILLING: Check plan limits before creating a customer
  router.post(
    "/:workspaceId/customers",
    checkPlanLimits("customers"),
    controller.createCustomer.bind(controller)
  )
  router.get(
    "/:workspaceId/customers/:id",
    controller.getCustomerById.bind(controller)
  )
  router.put(
    "/:workspaceId/customers/:id",
    controller.updateCustomer.bind(controller)
  )
  router.delete(
    "/:workspaceId/customers/:id",
    controller.deleteCustomer.bind(controller)
  )
  router.post(
    "/:workspaceId/customers/:id/block",
    controller.blockCustomer.bind(controller)
  )
  router.post(
    "/:workspaceId/customers/:id/unblock",
    controller.unblockCustomer.bind(controller)
  )

  // Endpoint alternativo che supporta anche 'bloc' (senza 'k')
  router.post(
    "/:workspaceId/customers/:id/bloc",
    controller.blockCustomer.bind(controller)
  )

  // TASK 3: Operator Control Release Mechanism
  router.put(
    "/:workspaceId/customers/:customerId/chatbot-control",
    controller.updateChatbotControl.bind(controller)
  )

  // Validation endpoints for frontend real-time validation
  router.get(
    "/:workspaceId/customers/check-phone",
    controller.checkPhoneExists.bind(controller)
  )
  router.get(
    "/:workspaceId/customers/check-email",
    controller.checkEmailExists.bind(controller)
  )

  // Route for counting unknown customers
  router.get("/:workspaceId/unknown-customers/count", (req, res, next) => {
    logger.info(
      `💡 Processing request for unknown-customers count with workspace: ${req.params.workspaceId}`
    )
    return controller.countUnknownCustomers(req, res, next)
  })

  // 🗑️ Delete a registration attempt (blocked unregistered user)
  router.delete(
    "/:workspaceId/registration-attempts/:attemptId",
    controller.deleteRegistrationAttempt.bind(controller)
  )

  logger.info("Customers routes setup complete")
  return router
}

// Router specifico per quando è montato su /workspaces
export const workspaceCustomersRouter = (
  controller: CustomersController
): Router => {
  const router = Router()

  // All routes require authentication
  router.use(authMiddleware)

  logger.info("Setting up workspace customers routes")

  // Routes for customers under workspaces path - prefix è già /workspaces
  router.get(
    "/:workspaceId/customers",
    controller.getCustomersForWorkspace.bind(controller)
  )
  router.post(
    "/:workspaceId/customers",
    controller.createCustomer.bind(controller)
  )
  router.get(
    "/:workspaceId/customers/:id",
    controller.getCustomerById.bind(controller)
  )
  router.put(
    "/:workspaceId/customers/:id",
    controller.updateCustomer.bind(controller)
  )
  router.delete(
    "/:workspaceId/customers/:id",
    controller.deleteCustomer.bind(controller)
  )
  router.post(
    "/:workspaceId/customers/:id/block",
    controller.blockCustomer.bind(controller)
  )
  router.post(
    "/:workspaceId/customers/:id/unblock",
    controller.unblockCustomer.bind(controller)
  )

  // Endpoint alternativo che supporta anche 'bloc' (senza 'k')
  router.post(
    "/:workspaceId/customers/:id/bloc",
    controller.blockCustomer.bind(controller)
  )

  // TASK 3: Operator Control Release Mechanism
  router.put(
    "/:workspaceId/customers/:customerId/chatbot-control",
    controller.updateChatbotControl.bind(controller)
  )

  // Route for counting unknown customers (workspace specific)
  router.get(
    "/:workspaceId/unknown-customers/count",
    controller.countUnknownCustomers.bind(controller)
  )

  // 🗑️ Delete a registration attempt (blocked unregistered user)
  router.delete(
    "/:workspaceId/registration-attempts/:attemptId",
    controller.deleteRegistrationAttempt.bind(controller)
  )

  logger.info("Workspace customers routes setup complete")
  return router
}
