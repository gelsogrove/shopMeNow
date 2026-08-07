import { prisma } from "@echatbot/database"
import { Router } from "express"
import rateLimit from "express-rate-limit"
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

// Rate limiter for the public no-auth demo-chat endpoint: 20 requests per
// minute per IP, same policy as /widget/chat. Without this, the in-module
// per-session limits are the only guard and sessionId is client-generated,
// so a script rotating sessionIds could burn LLM credit without bounds.
const demoChatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per window
  message: {
    error: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests. Please try again later.",
    retryAfter: 60000,
  },
  standardHeaders: true,
  legacyHeaders: false,
})

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
playgroundRouter.post("/playground/demo-chat", demoChatRateLimiter, (req, res) => controller.sendDemoChat(req, res))

// Public endpoint: returns the usecases.md content for a demo chatbot slug.
playgroundRouter.get("/playground/demo-usecases/:slug", (req, res) => controller.getDemoUsecases(req, res))

// Optional auth wrapper applied to all endpoints
playgroundRouter.get("/playground/workspace-info", optionalPlaygroundAuth, (req, res) => controller.getWorkspaceInfo(req, res))
playgroundRouter.get("/playground/usecases", optionalPlaygroundAuth, (req, res) => controller.getUsecases(req, res))
playgroundRouter.get("/playground/messages", optionalPlaygroundAuth, (req, res) => controller.getMessages(req, res))
// 😀 Set/clear the reaction on a message (demo/customer side) — workspace-isolated.
playgroundRouter.post("/playground/messages/:messageId/reaction", optionalPlaygroundAuth, (req, res) => controller.setReaction(req, res))
// ── Kanban (public /demo/<slug>/kanban) ──────────────────────────────────────
// These deliberately do NOT use optionalPlaygroundAuth: the board is one per
// workspace and holds a client's criticism of their own bot, so the workspace
// must not come from a spoofable x-workspace-id header. Each handler resolves
// workspace + author from the playground sessionId instead — see
// resolveKanbanIdentity in playground.controller.ts.
playgroundRouter.get("/playground/todos", (req, res) => controller.getTodos(req, res))
playgroundRouter.post("/playground/todos", (req, res) => controller.createTodo(req, res))
playgroundRouter.patch("/playground/todos/:id", (req, res) => controller.updateTodo(req, res))
playgroundRouter.delete("/playground/todos/:id", (req, res) => controller.deleteTodo(req, res))
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
// Kanban comments — session-derived identity, same rationale as the todo routes above.
playgroundRouter.post("/playground/todos/:id/comments", (req, res) =>
  controller.addComment(req, res)
)
playgroundRouter.delete(
  "/playground/todos/:todoId/comments/:commentId",
  (req, res) => controller.deleteComment(req, res)
)

export { playgroundRouter }
