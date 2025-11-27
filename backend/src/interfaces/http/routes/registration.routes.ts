import { Router } from "express";
import { registrationLimiter } from "../../../config/rate-limiters";
import logger from "../../../utils/logger";
import { RegistrationController } from "../controllers/registration.controller";
import { asyncHandler } from "../middlewares/async.middleware";

/**
 * Creates and configures routes for customer registration
 * 🔒 SECURITY: Rate limited to prevent brute-force token validation
 */
export const registrationRouter = (controller: RegistrationController): Router => {
  const router = Router();
  
  // Apply rate limiting to all registration routes
  router.use(registrationLimiter);
  
  logger.info("Setting up registration routes (with rate limiting)");
  
  // Registration routes
  router.get("/token/:token", asyncHandler(controller.validateToken.bind(controller)));
  router.post("/register", asyncHandler(controller.register.bind(controller)));
  router.get("/data-protection", asyncHandler(controller.getDataProtectionInfo.bind(controller)));
  
  logger.info("Registration routes setup complete");
  return router;
};

/**
 * Creates a route instance with registration controller
 */
export default function createRegistrationRouter(): Router {
  return registrationRouter(new RegistrationController());
} 