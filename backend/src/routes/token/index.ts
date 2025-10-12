import { Router } from "express"
import logger from "../../utils/logger"
import createRegistrationRouter from "../../interfaces/http/routes/registration.routes"
import { checkoutRouter } from "../../interfaces/http/routes/checkout.routes"
import publicOrdersRouter from "../../interfaces/http/routes/public-orders.routes"
import { cartRouter } from "../../interfaces/http/routes/cart.routes"

// ========================================
// 🎫 TOKEN ROUTES
// ========================================
// Purpose: Token-based routes (Registration, Checkout, Public Orders)
// Authentication: Token in URL query params (NO sessionId required)
// Middleware: Token validation only
// Base path: /api/token/*
// ========================================

/**
 * Creates and configures all token-based routes
 * These routes use token-based authentication (no sessionId)
 */
export function createTokenRouter(): Router {
  const router = Router()

  logger.info("🎫 Setting up token routes...")

  // Registration routes (/api/token/registration/*)
  router.use("/registration", createRegistrationRouter())
  logger.info("✅ Registered /token/registration/* routes")

  // Checkout routes (/api/token/checkout/*)
  router.use("/checkout", checkoutRouter)
  logger.info("✅ Registered /token/checkout/* routes")

  // Public orders routes - includes validate-secure-token, orders-public, customer-profile
  // Mounted on / so routes are: /api/token/validate-secure-token, /api/token/orders-public/*, /api/token/customer-profile/*
  router.use("/", publicOrdersRouter)
  logger.info("✅ Registered /token/validate-secure-token route")
  logger.info("✅ Registered /token/orders-public/* routes")
  logger.info("✅ Registered /token/customer-profile/* routes")

  // Cart routes (/api/token/cart/*)
  router.use("/cart", cartRouter)
  logger.info("✅ Registered /token/cart/* routes (shopping cart)")

  logger.info("✅ Token routes setup complete")

  return router
}
