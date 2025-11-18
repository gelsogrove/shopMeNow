import { Router } from "express";
import logger from "../../../utils/logger";
import { RegistrationController } from "../controllers/registration.controller";
import { asyncHandler } from "../middlewares/async.middleware";

/**
 * Creates and configures routes for customer registration
 */
export const registrationRouter = (controller: RegistrationController): Router => {
  const router = Router();
  
  logger.info("Setting up registration routes");
  
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