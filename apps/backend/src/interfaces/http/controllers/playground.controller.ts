import { prisma } from "@echatbot/database"
import { Request, Response } from "express"
import * as fs from "fs"
import * as path from "path"
import { getChatEngine } from "../../../application/chat-engine"
import { CustomClientChatbotService, applyCustomerPatches } from "../../../application/services/custom-client-chatbot.service"
import { detectLanguageFromPhonePrefix } from "../../../utils/language-detector"
import { buildPhoneVariants } from "../../../utils/phone"
import logger from "../../../utils/logger"

const customClientChatbotService = new CustomClientChatbotService()

const ECOLAUNDRY_SLUG = "ecolaundry"
let ecolaundryWorkspaceIdCache: string | null = null

async function getEcolaundryWorkspaceId(): Promise<string> {
  if (ecolaundryWorkspaceIdCache) return ecolaundryWorkspaceIdCache
  const ws = await (prisma as any).workspace.findFirst({
    where: { slug: ECOLAUNDRY_SLUG },
    select: { id: true },
  })
  if (!ws) {
    throw new Error(
      `Ecolaundry workspace (slug=${ECOLAUNDRY_SLUG}) not found in database`
    )
  }
  ecolaundryWorkspaceIdCache = ws.id
  return ws.id
}

async function resolveWorkspaceId(req: Request): Promise<string> {
  // If set by middleware, use it (standard secure dashboard routing)
  if ((req as any).workspaceId) {
    return (req as any).workspaceId
  }
  // Try to read from headers or query parameters if set
  const wsId = (req.headers["x-workspace-id"] || req.query.workspaceId) as string
  if (wsId) {
    return wsId
  }
  // Otherwise, fallback to the default Ecolaundry workspace
  return await getEcolaundryWorkspaceId()
}

const ALLOWED_USERS = ["ANDREA", "OLGA"] as const
type PlaygroundUser = (typeof ALLOWED_USERS)[number]

const ALLOWED_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE", "NICE_TO_HAVE"]
const ALLOWED_PRIORITIES = ["Alto", "Medio", "Basso"]

function isAllowedUser(name: unknown): name is PlaygroundUser {
  return typeof name === "string" && ALLOWED_USERS.includes(name as PlaygroundUser)
}

function getIo(req: Request) {
  return (req.app.get("io") as any) || null
}

function emit(req: Request, event: string, payload: any) {
  const io = getIo(req)
  if (io && typeof io.emit === "function") {
    io.emit(`playground:${event}`, payload)
  }
}

export class PlaygroundController {
  // GET /api/v1/playground/usecases — serves the markdown file content dynamically
  async getUsecases(req: Request, res: Response) {
    try {
      const workspaceId = await resolveWorkspaceId(req)
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { slug: true },
      })
      const slug = workspace?.slug || ECOLAUNDRY_SLUG
      const candidates = [
        path.resolve(__dirname, `../../../../custom-${slug}/docs/usecases.md`),
        path.resolve(process.cwd(), `custom-${slug}/docs/usecases.md`),
        path.resolve(process.cwd(), `apps/backend/custom-${slug}/docs/usecases.md`),
        // Fallback to Ecolaundry if custom workspace-specific files are not found
        path.resolve(__dirname, "../../../../custom-ecolaundry/docs/usecases.md"),
        path.resolve(process.cwd(), "custom-ecolaundry/docs/usecases.md"),
        path.resolve(process.cwd(), "apps/backend/custom-ecolaundry/docs/usecases.md"),
      ]
      const filePath = candidates.find((p) => fs.existsSync(p))
      if (!filePath) {
        return res.status(404).json({ error: "usecases.md not found" })
      }
      const content = fs.readFileSync(filePath, "utf-8")
      res.setHeader("Content-Type", "text/markdown; charset=utf-8")
      return res.send(content)
    } catch (error: any) {
      logger.error("Playground getUsecases error:", error)
      return res.status(500).json({ error: "Failed to load usecases", message: error.message })
    }
  }

  // GET /api/v1/playground/messages
  async getMessages(req: Request, res: Response) {
    try {
      const workspaceId = await resolveWorkspaceId(req)
      const sessions = await prisma.chatSession.findMany({
        where: { workspaceId },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              direction: true,
              content: true,
              type: true,
              createdAt: true,
              aiGenerated: true,
              chatSessionId: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      })
      return res.json({ sessions })
    } catch (error: any) {
      logger.error("Playground getMessages error:", error)
      return res.status(500).json({ error: "Failed to load messages", message: error.message })
    }
  }

  // GET /api/v1/playground/todos
  async getTodos(req: Request, res: Response) {
    try {
      const workspaceId = await resolveWorkspaceId(req)
      const todos = await prisma.playgroundTodo.findMany({
        where: { workspaceId },
        include: { comments: { orderBy: { createdAt: "desc" } } },
        orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "desc" }],
      })
      return res.json({ todos })
    } catch (error: any) {
      logger.error("Playground getTodos error:", error)
      return res.status(500).json({ error: "Failed to load todos", message: error.message })
    }
  }

  // POST /api/v1/playground/todos
  async createTodo(req: Request, res: Response) {
    try {
      const {
        dialogId,
        messageType,
        messageContent,
        chatbotResponse,
        commentTitle,
        priority,
        createdBy,
        firstComment,
      } = req.body

      if (!isAllowedUser(createdBy)) {
        return res.status(401).json({ error: "Invalid user" })
      }
      if (!dialogId || !commentTitle || !messageContent || !messageType) {
        return res.status(400).json({ error: "Missing required fields" })
      }
      if (priority && !ALLOWED_PRIORITIES.includes(priority)) {
        return res.status(400).json({ error: "Invalid priority" })
      }

      const workspaceId = await resolveWorkspaceId(req)
      const lastInColumn = await prisma.playgroundTodo.findFirst({
        where: { workspaceId, status: "TODO" },
        orderBy: { position: "desc" },
        select: { position: true },
      })
      const nextPosition = (lastInColumn?.position ?? -1) + 1

      const todo = await prisma.playgroundTodo.create({
        data: {
          workspaceId,
          dialogId,
          messageType,
          messageContent,
          chatbotResponse: chatbotResponse || null,
          commentTitle,
          priority: priority || "Medio",
          status: "TODO",
          position: nextPosition,
          createdBy,
          comments: firstComment
            ? { create: [{ commentText: firstComment, createdBy }] }
            : undefined,
        },
        include: { comments: { orderBy: { createdAt: "desc" } } },
      })

      emit(req, "todo:created", todo)
      return res.status(201).json(todo)
    } catch (error: any) {
      logger.error("Playground createTodo error:", error)
      return res.status(500).json({ error: "Failed to create todo", message: error.message })
    }
  }

  // PATCH /api/v1/playground/todos/:id
  async updateTodo(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { status, priority, position, commentTitle } = req.body

      if (status && !ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: "Invalid status" })
      }
      if (priority && !ALLOWED_PRIORITIES.includes(priority)) {
        return res.status(400).json({ error: "Invalid priority" })
      }

      const workspaceId = await resolveWorkspaceId(req)
      const existingTodo = await prisma.playgroundTodo.findFirst({
        where: { id, workspaceId },
      })
      if (!existingTodo) {
        return res.status(404).json({ error: "Todo not found in this workspace" })
      }

      const todo = await prisma.playgroundTodo.update({
        where: { id },
        data: {
          ...(status !== undefined && { status }),
          ...(priority !== undefined && { priority }),
          ...(position !== undefined && { position }),
          ...(commentTitle !== undefined && { commentTitle }),
        },
        include: { comments: { orderBy: { createdAt: "desc" } } },
      })

      emit(req, "todo:updated", todo)
      return res.json(todo)
    } catch (error: any) {
      logger.error("Playground updateTodo error:", error)
      return res.status(500).json({ error: "Failed to update todo", message: error.message })
    }
  }

  // DELETE /api/v1/playground/todos/:id
  async deleteTodo(req: Request, res: Response) {
    try {
      const { id } = req.params
      const workspaceId = await resolveWorkspaceId(req)
      const existingTodo = await prisma.playgroundTodo.findFirst({
        where: { id, workspaceId },
      })
      if (!existingTodo) {
        return res.status(404).json({ error: "Todo not found in this workspace" })
      }

      await prisma.playgroundTodo.delete({ where: { id } })
      emit(req, "todo:deleted", { id })
      return res.json({ success: true })
    } catch (error: any) {
      logger.error("Playground deleteTodo error:", error)
      return res.status(500).json({ error: "Failed to delete todo", message: error.message })
    }
  }

  // POST /api/v1/playground/chat
  // Body: { customerPhone?, sessionId?, message }
  // Creates a customer/session if needed, runs ChatEngine and returns response
  async sendChat(req: Request, res: Response) {
    try {
      const { customerPhone, sessionId, message, customerName } = req.body
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message is required" })
      }

      const workspaceId = await resolveWorkspaceId(req)

      let session: any = null
      if (sessionId) {
        session = await prisma.chatSession.findFirst({
          where: { id: sessionId, workspaceId },
          include: { customer: true },
        })
      }

      let customer: any = session?.customer || null

      if (!customer) {
        if (!customerPhone) {
          return res.status(400).json({ error: "customerPhone or sessionId required" })
        }
        const phoneVariants = buildPhoneVariants(customerPhone)
        customer = await prisma.customers.findFirst({
          where: {
            workspaceId,
            OR: phoneVariants.map((v) => ({ phone: v })),
          },
        })
        if (!customer) {
          const safeName = customerName || `playground_${customerPhone}`
          customer = await prisma.customers.create({
            data: {
              workspaceId,
              phone: customerPhone,
              name: safeName,
              email: `${safeName.replace(/[^a-z0-9]/gi, "_")}@playground.local`,
              isActive: false,
              registrationStatus: "NEW",
              language: detectLanguageFromPhonePrefix(customerPhone) || "es",
            },
          })
        }
      }

      if (!session) {
        session = await prisma.chatSession.findFirst({
          where: { customerId: customer.id, status: "active" },
        })
        if (!session) {
          // @ts-ignore - isPlayground not yet in generated Prisma types (schema exists, regenerate to fix)
          session = await (prisma.chatSession.create as any)({
            data: {
              workspaceId,
              customerId: customer.id,
              status: "active",
              isPlayground: true,
            },
          })
        }
      }

      // 1) Persist inbound user message immediately so the UI always sees it
      await prisma.message.create({
        data: {
          chatSessionId: session.id,
          direction: "INBOUND",
          content: message,
          type: "TEXT",
          status: "received",
          aiGenerated: false,
        },
      })

      // 2) If the workspace has a custom chatbot module (e.g. ecolaundry),
      //    call it DIRECTLY here — bypassing chat-engine + FlowWorkspaceStrategy.
      //    The default FlowWorkspaceStrategy ignores customChatbotId and falls
      //    back to a generic Router LLM that does not know about ecolaundry
      //    (it ends up calling contactOperator() on the very first message).
      //    The widget controller already does this same direct invocation.
      let botResponse = ""
      let engineError: any = null

      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          slug: true,
          customChatbotId: true,
          welcomeMessage: true,
          channelStatus: true,
          debugMode: true,
        },
      })

      if (workspace?.customChatbotId) {
        try {
          // Build conversation history for the custom chatbot
          const recentMessages = await prisma.message.findMany({
            where: { chatSessionId: session.id, deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { direction: true, content: true, createdAt: true },
          })
          const history = recentMessages
            .reverse()
            // Skip the inbound message we just persisted (the custom chatbot
            // expects the LATEST user message via `userMessage`, not in history).
            .slice(0, -1)
            .map((m) => ({
              role: (m.direction === "INBOUND" ? "user" : "assistant") as
                | "user"
                | "assistant",
              content: m.content || "",
              timestamp: m.createdAt?.toISOString(),
            }))

          const customResult = await customClientChatbotService.invoke({
            workspaceId,
            workspaceSlug: workspace.slug,
            customChatbotId: workspace.customChatbotId,
            userMessage: message,
            userName: customer.name,
            channel: "playground",
            welcomeMessage:
              typeof workspace.welcomeMessage === "string"
                ? workspace.welcomeMessage
                : "",
            wipMessage: "",
            channelActive: workspace.channelStatus !== false,
            debugChannel: workspace.debugMode === true,
            isPlayground: true,
            language: customer.language || "es",
            sessionId: session.id,
            customerId: customer.id,
            phoneNumber: customer.phone || undefined,
            history,
          })

          if (customResult.handled && customResult.output) {
            await applyCustomerPatches(customResult.output.patches, customer.id, workspaceId)
          }
          if (customResult.handled && customResult.output?.reply) {
            botResponse = customResult.output.reply
          } else if (customResult.output?.error) {
            engineError = new Error(
              `custom-client-${workspace.customChatbotId} error: ${customResult.output.error}`
            )
          }
        } catch (err: any) {
          engineError = err
          logger.error("[Playground] Custom chatbot threw:", {
            customChatbotId: workspace.customChatbotId,
            message: err?.message,
            stack: err?.stack,
          })
        }
      }

      // Fallback to chat-engine for workspaces without a custom chatbot.
      if (!botResponse && !engineError) try {
        const chatEngine = getChatEngine(prisma as any)
        const result = await chatEngine.routeMessage({
          workspaceId,
          customerId: customer.id,
          conversationId: session.id,
          message,
          customerLanguage: customer.language || "es",
          customerName: customer.name,
          customerDiscount: customer.discount || 0,
          isPlayground: true,
          channel: "widget",
          registrationPromptLevel: 0,
        } as any)
        botResponse =
          (result as any).message || (result as any).response || ""
      } catch (err: any) {
        engineError = err
        logger.error("[Playground] ChatEngine threw:", {
          message: err?.message,
          stack: err?.stack,
        })
      }

      if (!botResponse) {
        botResponse = engineError
          ? `[Playground debug] Engine error: ${engineError.message || engineError}`
          : "[Playground debug] No response from chat engine"
      }

      // 3) Persist outbound bot response so the UI shows the dialog
      //    Note: the engine itself may also persist via MessagePersistenceService.
      //    We check that no identical assistant message was just saved to avoid duplicates.
      const recentBotMsg = await prisma.message.findFirst({
        where: {
          chatSessionId: session.id,
          direction: "OUTBOUND",
          createdAt: { gte: new Date(Date.now() - 30_000) },
        },
        orderBy: { createdAt: "desc" },
      })
      if (!recentBotMsg || recentBotMsg.content !== botResponse) {
        await prisma.message.create({
          data: {
            chatSessionId: session.id,
            direction: "OUTBOUND",
            content: botResponse,
            type: "TEXT",
            status: "sent",
            aiGenerated: !engineError,
          },
        })
      }

      // Bump session.updatedAt so list ordering reflects activity
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { updatedAt: new Date() },
      })

      return res.json({
        sessionId: session.id,
        customerId: customer.id,
        response: botResponse,
        engineError: engineError ? String(engineError.message || engineError) : null,
      })
    } catch (error: any) {
      logger.error("Playground sendChat error:", error)
      return res.status(500).json({ error: "Failed to send chat", message: error.message })
    }
  }

  // DELETE /api/v1/playground/sessions/:id
  // Deletes a chat session and its messages. BLOCKED with 409 if any TODO
  // still references one of this session's messages — the user must clean up
  // the kanban first. We match TODOs by their dialogId, which the frontend
  // sets to the message id when creating a TODO from the chat UI.
  async deleteSession(req: Request, res: Response) {
    try {
      const { id } = req.params
      if (!id) {
        return res.status(400).json({ error: "session id required" })
      }

      const workspaceId = await resolveWorkspaceId(req)

      const session = await prisma.chatSession.findFirst({
        where: { id, workspaceId },
        select: {
          id: true,
          messages: { where: { deletedAt: null }, select: { id: true } },
        },
      })
      if (!session) {
        return res.status(404).json({ error: "Session not found" })
      }

      const messageIds = session.messages.map((m) => m.id)
      const blockingTodos = messageIds.length
        ? await prisma.playgroundTodo.findMany({
            where: { workspaceId, dialogId: { in: messageIds } },
            select: { id: true, commentTitle: true, status: true },
          })
        : []

      if (blockingTodos.length > 0) {
        return res.status(409).json({
          error: "CHAT_HAS_TODOS",
          message:
            "This chat has TODO cards on the kanban. Delete or move them first, then retry.",
          todos: blockingTodos,
        })
      }

      // No blocking TODOs → safe to delete. We hard-delete the session and its
      // messages because the playground is a debug surface; production chat
      // history isn't affected (the playground only handles the Ecolaundry
      // demo workspace).
      await prisma.$transaction([
        prisma.message.deleteMany({ where: { chatSessionId: id } }),
        prisma.chatSession.delete({ where: { id } }),
      ])

      return res.json({ ok: true, deletedSessionId: id })
    } catch (error: any) {
      logger.error("Playground deleteSession error:", error)
      return res.status(500).json({
        error: "Failed to delete session",
        message: error.message,
      })
    }
  }

  // POST /api/v1/playground/todos/:id/comments
  async addComment(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { commentText, createdBy, color } = req.body

      if (!isAllowedUser(createdBy)) {
        return res.status(401).json({ error: "Invalid user" })
      }
      if (!commentText) {
        return res.status(400).json({ error: "Missing commentText" })
      }

      const workspaceId = await resolveWorkspaceId(req)
      const todoExists = await prisma.playgroundTodo.findFirst({
        where: { id, workspaceId },
      })
      if (!todoExists) {
        return res.status(404).json({ error: "Todo not found in this workspace" })
      }

      const comment = await prisma.playgroundComment.create({
        data: { todoId: id, commentText, createdBy, color: color || null },
      })

      await prisma.playgroundTodo.update({
        where: { id },
        data: { updatedAt: new Date() },
      })

      emit(req, "comment:created", { todoId: id, comment })
      return res.status(201).json(comment)
    } catch (error: any) {
      logger.error("Playground addComment error:", error)
      return res.status(500).json({ error: "Failed to add comment", message: error.message })
    }
  }

  // DELETE /api/v1/playground/todos/:todoId/comments/:commentId
  async deleteComment(req: Request, res: Response) {
    try {
      const { todoId, commentId } = req.params
      const { createdBy } = req.body

      if (!isAllowedUser(createdBy)) {
        return res.status(401).json({ error: "Invalid user" })
      }

      const workspaceId = await resolveWorkspaceId(req)
      const comment = await prisma.playgroundComment.findUnique({
        where: { id: commentId },
        include: { todo: true },
      })
      if (!comment || comment.todoId !== todoId || comment.todo.workspaceId !== workspaceId) {
        return res.status(404).json({ error: "Comment not found in this workspace" })
      }
      if (comment.createdBy !== createdBy) {
        return res.status(403).json({ error: "Cannot delete another user's comment" })
      }

      await prisma.playgroundComment.delete({ where: { id: commentId } })
      await prisma.playgroundTodo.update({
        where: { id: todoId },
        data: { updatedAt: new Date() },
      })

      emit(req, "comment:deleted", { todoId, commentId })
      return res.status(204).send()
    } catch (error: any) {
      logger.error("Playground deleteComment error:", error)
      return res.status(500).json({ error: "Failed to delete comment", message: error.message })
    }
  }
}
