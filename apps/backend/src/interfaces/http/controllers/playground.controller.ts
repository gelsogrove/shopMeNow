import { prisma } from "@echatbot/database"
import { Request, Response } from "express"
import * as fs from "fs"
import * as path from "path"
import { getChatEngine } from "../../../application/chat-engine"
import { detectLanguageFromPhonePrefix } from "../../../utils/language-detector"
import { buildPhoneVariants } from "../../../utils/phone"
import logger from "../../../utils/logger"

const ECOLAUNDRY_WORKSPACE_ID = "9d5cc88b-a550-416f-9b3b-4bcc4a11d00d"

const ALLOWED_USERS = ["ANDREA", "HOLGA"] as const
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
  // GET /api/v1/playground/usecases — serves the markdown file content
  async getUsecases(_req: Request, res: Response) {
    try {
      const candidates = [
        path.resolve(__dirname, "../../../../custom-client-0/docs/usecases.md"),
        path.resolve(process.cwd(), "custom-client-0/docs/usecases.md"),
        path.resolve(process.cwd(), "apps/backend/custom-client-0/docs/usecases.md"),
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
  async getMessages(_req: Request, res: Response) {
    try {
      const sessions = await prisma.chatSession.findMany({
        where: { workspaceId: ECOLAUNDRY_WORKSPACE_ID },
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
  async getTodos(_req: Request, res: Response) {
    try {
      const todos = await prisma.playgroundTodo.findMany({
        where: { workspaceId: ECOLAUNDRY_WORKSPACE_ID },
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

      const lastInColumn = await prisma.playgroundTodo.findFirst({
        where: { workspaceId: ECOLAUNDRY_WORKSPACE_ID, status: "TODO" },
        orderBy: { position: "desc" },
        select: { position: true },
      })
      const nextPosition = (lastInColumn?.position ?? -1) + 1

      const todo = await prisma.playgroundTodo.create({
        data: {
          workspaceId: ECOLAUNDRY_WORKSPACE_ID,
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

      let session: any = null
      if (sessionId) {
        session = await prisma.chatSession.findFirst({
          where: { id: sessionId, workspaceId: ECOLAUNDRY_WORKSPACE_ID },
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
            workspaceId: ECOLAUNDRY_WORKSPACE_ID,
            OR: phoneVariants.map((v) => ({ phone: v })),
          },
        })
        if (!customer) {
          const safeName = customerName || `playground_${customerPhone}`
          customer = await prisma.customers.create({
            data: {
              workspaceId: ECOLAUNDRY_WORKSPACE_ID,
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
          session = await prisma.chatSession.create({
            data: {
              workspaceId: ECOLAUNDRY_WORKSPACE_ID,
              customerId: customer.id,
              status: "active",
            },
          })
        }
      }

      const chatEngine = getChatEngine(prisma as any)
      const result = await chatEngine.routeMessage({
        workspaceId: ECOLAUNDRY_WORKSPACE_ID,
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

      return res.json({
        sessionId: session.id,
        customerId: customer.id,
        response: (result as any).message || (result as any).response || "",
      })
    } catch (error: any) {
      logger.error("Playground sendChat error:", error)
      return res.status(500).json({ error: "Failed to send chat", message: error.message })
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

      const todoExists = await prisma.playgroundTodo.findUnique({ where: { id } })
      if (!todoExists) {
        return res.status(404).json({ error: "Todo not found" })
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
}
