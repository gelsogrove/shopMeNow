import { Router } from "express";
import logger from "../../../utils/logger";
import { SettingsController } from "../controllers/settings.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { workspaceAuthMiddleware } from "../middlewares/workspace-auth.middleware";
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware";

/**
 * Creates and configures routes for whatsapp settings
 */
export const settingsRouter = (controller: SettingsController): Router => {
  const router = Router({ mergeParams: true });
  
  logger.info("Setting up settings routes");
  
  // Apply auth middleware first (but it will be skipped in test environment)
  // This ensures all routes have authentication in production
  if (process.env.NODE_ENV === 'production') {
    router.use(authMiddleware);
  } else {
    // In non-production environments, still use auth but allow test bypasses
    router.use(authMiddleware);
  }
  
  // CRITICAL FIX: Apply workspace validation middleware only to specific routes that need it
  // Don't apply it globally as it interferes with parameter extraction
  
  // Routes for GDPR content (simplified - no workspace validation middleware)
  router.get("/gdpr", authMiddleware, controller.getGdprContent.bind(controller));
  router.put("/gdpr", authMiddleware, controller.updateGdprContent.bind(controller));
  router.get("/default-gdpr", controller.getDefaultGdprContent.bind(controller));
  
  // Routes for general settings (with workspace validation)
  router.get("/", workspaceValidationMiddleware, workspaceAuthMiddleware, controller.getSettings.bind(controller));
  router.put("/", workspaceValidationMiddleware, workspaceAuthMiddleware, controller.updateSettings.bind(controller));
  router.delete("/", workspaceValidationMiddleware, workspaceAuthMiddleware, controller.deleteSettings.bind(controller));
  
  logger.info("Settings routes setup complete");
  return router;
};

/**
 * Creates a route instance with settings controller
 */
export default function createSettingsRouter(): Router {
  return settingsRouter(new SettingsController());
} 