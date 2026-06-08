import { prisma } from "@echatbot/database"
import { Router } from "express"
import { PlaygroundController } from "../controllers/playground.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"
import {
  uploadChatAttachments,
  handleChatUploadError,
} from "../middlewares/chatAttachmentUpload"
import {
  uploadChatAudio,
  handleChatAudioUploadError,
} from "../middlewares/chatAudioUpload"

const controller = new PlaygroundController()
const playgroundRouter = Router()

// Conditional middleware to enforce JWT and workspace authentication if active dashboard access headers/query params are supplied
const optionalPlaygroundAuth = (req: any, res: any, next: any) => {
  const hasAuthHeader = !!req.headers.authorization
  const hasTokenQuery = !!req.query.token
  const wsHeader = (req.headers["x-workspace-id"] || req.query.workspaceId) as
    | string
    | undefined

  if (hasAuthHeader || hasTokenQuery || wsHeader) {
    // If token is supplied in query, put it in the Authorization header for authMiddleware to intercept
    if (req.query.token && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${req.query.token}`
    }

    // Public demo bypass: workspaceId is supplied but NO token is present.
    // If the target workspace is a demo (customChatbotId set), allow the
    // request through without JWT — these workspaces are intentionally
    // exposed for public-facing demo pages (e.g. /demo/demowash login admin).
    if (!hasAuthHeader && !hasTokenQuery && wsHeader) {
      return prisma.workspace
        .findUnique({
          where: { id: wsHeader },
          select: { customChatbotId: true },
        })
        .then((ws) => {
          if (ws?.customChatbotId) {
            ;(req as any).workspaceId = wsHeader
            ;(req as any).demoMode = true
            return next()
          }
          return res.status(401).json({ error: "Unauthorized" })
        })
        .catch(() => res.status(500).json({ error: "Auth check failed" }))
    }

    return authMiddleware(req, res, () => {
      return workspaceValidationMiddleware(req, res, () => {
        // Enforce workspace membership authorization check
        const user = req.user
        const workspaceId = req.workspaceId

        const hasAccess =
          user?.workspaces?.some((w: any) => w.id === workspaceId) ||
          user?.isPlatformAdmin

        if (!hasAccess) {
          return res.status(403).json({ error: "Access denied to this workspace" })
        }
        next()
      })
    })
  }
  next()
}

// Public endpoint: resolves chatbot slug → workspaceId for standalone demo
// pages. No auth, no workspace header. Read-only on workspace metadata.
playgroundRouter.get("/playground/resolve-demo/:slug", (req, res) => controller.resolveDemo(req, res))

// Public endpoint: send a chat message to a demo workspace (customChatbotId set).
// No auth required — workspaceId comes from body. Validation in the controller
// enforces that the target workspace is a demo (customChatbotId present).
playgroundRouter.post("/playground/demo-chat", (req, res) => controller.sendDemoChat(req, res))

// Public endpoint: returns the usecases.md content for a demo chatbot slug.
playgroundRouter.get("/playground/demo-usecases/:slug", (req, res) => controller.getDemoUsecases(req, res))

// Optional auth wrapper applied to all endpoints
playgroundRouter.get("/playground/workspace-info", optionalPlaygroundAuth, (req, res) => controller.getWorkspaceInfo(req, res))
playgroundRouter.get("/playground/usecases", optionalPlaygroundAuth, (req, res) => controller.getUsecases(req, res))
playgroundRouter.get("/playground/messages", optionalPlaygroundAuth, (req, res) => controller.getMessages(req, res))
// 😀 Set/clear the reaction on a message (demo/customer side) — workspace-isolated.
playgroundRouter.post("/playground/messages/:messageId/reaction", optionalPlaygroundAuth, (req, res) => controller.setReaction(req, res))
playgroundRouter.get("/playground/todos", optionalPlaygroundAuth, (req, res) => controller.getTodos(req, res))
playgroundRouter.post("/playground/todos", optionalPlaygroundAuth, (req, res) => controller.createTodo(req, res))
playgroundRouter.patch("/playground/todos/:id", optionalPlaygroundAuth, (req, res) => controller.updateTodo(req, res))
playgroundRouter.delete("/playground/todos/:id", optionalPlaygroundAuth, (req, res) => controller.deleteTodo(req, res))
playgroundRouter.post("/playground/chat", optionalPlaygroundAuth, (req, res) => controller.sendChat(req, res))
// 🎤 Voice note from the demo composer: transcribe → store audio → run bot turn.
playgroundRouter.post(
  "/playground/chat-audio",
  optionalPlaygroundAuth,
  uploadChatAudio,
  handleChatAudioUploadError,
  (req, res) => controller.sendChatAudio(req, res)
)
playgroundRouter.post(
  "/playground/attachments",
  optionalPlaygroundAuth,
  uploadChatAttachments,
  handleChatUploadError,
  (req, res) => controller.uploadAttachments(req, res)
)
playgroundRouter.patch("/playground/sessions/:id", optionalPlaygroundAuth, (req, res) =>
  controller.updateSession(req, res)
)
playgroundRouter.delete("/playground/sessions/:id", optionalPlaygroundAuth, (req, res) =>
  controller.deleteSession(req, res)
)
playgroundRouter.post("/playground/todos/:id/comments", optionalPlaygroundAuth, (req, res) =>
  controller.addComment(req, res)
)
playgroundRouter.delete(
  "/playground/todos/:todoId/comments/:commentId",
  optionalPlaygroundAuth,
  (req, res) => controller.deleteComment(req, res)
)

export { playgroundRouter }
