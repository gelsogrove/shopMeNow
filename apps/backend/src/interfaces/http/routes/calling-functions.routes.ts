import { Router } from "express"
import { PrismaClient } from "@echatbot/database"
import { CallingFunctionsController } from "../controllers/calling-functions.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

export const createCallingFunctionsRouter = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true })
    const controller = new CallingFunctionsController(prisma)

    // All routes are protected by workspace admin auth
    // Middleware should be applied at the parent level in index.ts or here

    // List all functions
    router.get("/", controller.getFunctions.bind(controller))

    // Get valid DELEGATE_TO_AGENT types for this workspace's channelMode
    // MUST be before /:functionName routes to avoid param capture
    router.get("/agent-types", controller.getAgentTypes.bind(controller))

    // Get system functions valid for this workspace but NOT installed (for Reinstall UI section)
    // MUST be before /:functionName routes to avoid param capture
    router.get("/system-missing", controller.getMissingSystemFunctions.bind(controller))

    // Create custom function
    router.post("/", controller.createFunction.bind(controller))

    // Test webhook (MUST be before /:functionName to avoid param capture)
    router.post("/test-webhook", controller.testWebhook.bind(controller))

    // Update function (system or custom)
    router.patch("/:functionName", controller.updateFunction.bind(controller))

    // Delete a function (system or custom — hard delete)
    router.delete("/:functionName", controller.deleteFunction.bind(controller))

    // Reinstall a system function to factory defaults
    router.post("/:functionName/reinstall", controller.reinstallFunction.bind(controller))

    return router
}
