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

    // Create custom function
    router.post("/", controller.createFunction.bind(controller))

    // Update function (system or custom)
    router.patch("/:functionName", controller.updateFunction.bind(controller))

    // Delete custom function
    router.delete("/:functionName", controller.deleteFunction.bind(controller))

    // Test webhook
    router.post("/test-webhook", controller.testWebhook.bind(controller))

    return router
}
