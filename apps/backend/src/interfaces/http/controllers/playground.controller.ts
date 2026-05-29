import { prisma } from "@echatbot/database"
import { Request, Response } from "express"
import * as fs from "fs"
import * as path from "path"
import { getChatEngine } from "../../../application/chat-engine"
import { CustomClientChatbotService, applyCustomerPatches, applyEscalationNotification } from "../../../application/services/custom-client-chatbot.service"
import { detectLanguageFromPhonePrefix } from "../../../utils/language-detector"
import { buildPhoneVariants } from "../../../utils/phone"
import logger from "../../../utils/logger"

// ─────────────────────────────────────────────────────────────────────────────
// Usecases markdown translation cache
//
// Source language for usecases.md is Spanish (es). When a non-source language
// is requested via ?lang=xx, we translate via OpenRouter once and cache the
// result both in-memory and on disk (usecases.<lang>.md next to the original
// file). On subsequent requests we serve the cache directly.
// ─────────────────────────────────────────────────────────────────────────────
const SUPPORTED_USECASES_LANGS = ["es", "it", "en", "fr", "pt", "ca", "de"] as const
type UsecasesLang = (typeof SUPPORTED_USECASES_LANGS)[number]
const USECASES_SOURCE_LANG: UsecasesLang = "es"
const usecasesMemoryCache = new Map<string, string>() // key: `${filePath}:${lang}`

function isSupportedUsecasesLang(value: unknown): value is UsecasesLang {
  return (
    typeof value === "string" &&
    (SUPPORTED_USECASES_LANGS as readonly string[]).includes(value)
  )
}

/**
 * Returns the usecases markdown for the requested language.
 * Order: memory cache → disk cache (sibling file usecases.<lang>.md) → translate
 * via OpenRouter and persist to both caches.
 */
async function getUsecasesMarkdownForLang(
  sourcePath: string,
  lang: UsecasesLang
): Promise<string> {
  // 1) Source language: serve original directly
  if (lang === USECASES_SOURCE_LANG) {
    return fs.readFileSync(sourcePath, "utf-8")
  }
  const cacheKey = `${sourcePath}:${lang}`
  // 2) Memory cache
  const memHit = usecasesMemoryCache.get(cacheKey)
  if (memHit) return memHit
  // 3) Disk: sibling file named usecases_<lang>.md. We DO NOT translate
  // on-the-fly — every supported language must ship its own pre-written
  // markdown file. If the file is missing we fall back to the source so
  // the UI doesn't break, but the operator should add the missing file.
  const dir = path.dirname(sourcePath)
  const base = path.basename(sourcePath, ".md")
  const langFilePath = path.join(dir, `${base}_${lang}.md`)
  if (fs.existsSync(langFilePath)) {
    const content = fs.readFileSync(langFilePath, "utf-8")
    usecasesMemoryCache.set(cacheKey, content)
    return content
  }
  logger.warn(
    `[Usecases-i18n] Missing translation file ${langFilePath} — serving source`
  )
  return fs.readFileSync(sourcePath, "utf-8")
}

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

const ALLOWED_USERS = ["ANDREA", "OLGA", "demo"] as const
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
        select: { slug: true, customChatbotId: true },
      })
      const slug = workspace?.customChatbotId || workspace?.slug || ECOLAUNDRY_SLUG
      const candidates = [
        // New layout (post-2026-05-27 cleanup): usecases.md in root of custom-<slug>/
        path.resolve(__dirname, `../../../../custom-${slug}/usecases.md`),
        path.resolve(process.cwd(), `custom-${slug}/usecases.md`),
        path.resolve(process.cwd(), `apps/backend/custom-${slug}/usecases.md`),
        // Legacy layout (custom-<slug>/docs/usecases.md) — kept for backwards-compat
        path.resolve(__dirname, `../../../../custom-${slug}/docs/usecases.md`),
        path.resolve(process.cwd(), `custom-${slug}/docs/usecases.md`),
        path.resolve(process.cwd(), `apps/backend/custom-${slug}/docs/usecases.md`),
        // Fallback to Ecolaundry if custom workspace-specific files are not found
        path.resolve(__dirname, "../../../../custom-ecolaundry/usecases.md"),
        path.resolve(process.cwd(), "custom-ecolaundry/usecases.md"),
        path.resolve(process.cwd(), "apps/backend/custom-ecolaundry/usecases.md"),
      ]
      const filePath = candidates.find((p) => fs.existsSync(p))
      if (!filePath) {
        return res.status(404).json({ error: "usecases.md not found" })
      }
      // 🌍 Optional ?lang=xx — translate (and cache) into one of the
      // supported languages. Falls back to source (es) when unsupported.
      const rawLang = (req.query.lang as string | undefined)?.toLowerCase()
      const lang: UsecasesLang = isSupportedUsecasesLang(rawLang)
        ? rawLang
        : USECASES_SOURCE_LANG
      const content = await getUsecasesMarkdownForLang(filePath, lang)
      res.setHeader("Content-Type", "text/markdown; charset=utf-8")
      return res.send(content)
    } catch (error: any) {
      logger.error("Playground getUsecases error:", error)
      return res.status(500).json({ error: "Failed to load usecases", message: error.message })
    }
  }

  // GET /api/v1/playground/demo-usecases/:slug
  // Public endpoint: returns the usecases.md content for a demo chatbot
  // identified by slug (e.g. "demowash"). No auth required. Mirrors
  // getUsecases but resolves the workspace via customChatbotId match
  // instead of via auth header/session.
  async getDemoUsecases(req: Request, res: Response) {
    try {
      const slug = String(req.params.slug || "").toLowerCase()
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return res.status(400).json({ error: "Invalid slug format" })
      }
      // Whitelist check: only allow slugs that correspond to a real demo workspace
      const workspace = await prisma.workspace.findFirst({
        where: { customChatbotId: slug },
        select: { id: true },
      })
      if (!workspace) {
        return res.status(404).json({ error: `No demo workspace found for slug='${slug}'` })
      }
      const candidates = [
        path.resolve(__dirname, `../../../../custom-${slug}/usecases.md`),
        path.resolve(process.cwd(), `custom-${slug}/usecases.md`),
        path.resolve(process.cwd(), `apps/backend/custom-${slug}/usecases.md`),
      ]
      const filePath = candidates.find((p) => fs.existsSync(p))
      if (!filePath) {
        return res.status(404).json({ error: "usecases.md not found" })
      }
      // 🌍 Same ?lang=xx support as the auth'd endpoint
      const rawLang = (req.query.lang as string | undefined)?.toLowerCase()
      const lang: UsecasesLang = isSupportedUsecasesLang(rawLang)
        ? rawLang
        : USECASES_SOURCE_LANG
      const content = await getUsecasesMarkdownForLang(filePath, lang)
      res.setHeader("Content-Type", "text/markdown; charset=utf-8")
      return res.send(content)
    } catch (error: any) {
      logger.error("Playground getDemoUsecases error:", error)
      return res.status(500).json({ error: "Failed to load demo usecases", message: error.message })
    }
  }

  // GET /api/v1/playground/workspace-info
  // Returns minimal display info (name + chatbotId) about the current workspace.
  // Used by the playground top bar to render a dynamic title that matches the
  // active workspace (e.g. "Demowash Playground" instead of always "Ecolaundry").
  async getWorkspaceInfo(req: Request, res: Response) {
    try {
      const workspaceId = await resolveWorkspaceId(req)
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true, customChatbotId: true, slug: true },
      })
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" })
      }
      return res.json({
        name: workspace.name,
        chatbotId: workspace.customChatbotId,
        slug: workspace.slug,
      })
    } catch (error: any) {
      logger.error("Playground getWorkspaceInfo error:", error)
      return res.status(500).json({ error: "Failed to load workspace info", message: error.message })
    }
  }

  // GET /api/v1/playground/resolve-demo/:slug
  // Public endpoint: given a chatbot slug (e.g. "demowash"), returns the
  // workspaceId of the demo workspace whose customChatbotId matches. Used by
  // standalone demo pages (no login required) to discover which workspace
  // to talk to.
  async resolveDemo(req: Request, res: Response) {
    try {
      const slug = String(req.params.slug || "").toLowerCase()
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return res.status(400).json({ error: "Invalid slug format" })
      }
      const workspace = await prisma.workspace.findFirst({
        where: { customChatbotId: slug },
        select: { id: true, name: true, customChatbotId: true },
      })
      if (!workspace) {
        return res.status(404).json({ error: `No workspace found with customChatbotId='${slug}'` })
      }
      return res.json({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        chatbotId: workspace.customChatbotId,
      })
    } catch (error: any) {
      logger.error("Playground resolveDemo error:", error)
      return res.status(500).json({ error: "Failed to resolve demo", message: error.message })
    }
  }

  // GET /api/v1/playground/messages
  async getMessages(req: Request, res: Response) {
    try {
      const workspaceId = await resolveWorkspaceId(req)
      // 1) Load the most recent sessions + their customers.
      const rawSessions = await prisma.chatSession.findMany({
        where: { workspaceId },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      })
      if (rawSessions.length === 0) {
        return res.json({ sessions: [] })
      }
      // 2) Load conversationMessage rows for those sessions in a single query
      //    (no FK relation: conversationMessage.conversationId is a plain
      //    string that matches chatSession.id). Filter out "function" rows
      //    — they are internal LLM tool calls, never part of the UI dialog.
      const sessionIds = rawSessions.map((s) => s.id)
      const rows = await prisma.conversationMessage.findMany({
        where: {
          conversationId: { in: sessionIds },
          role: { in: ["user", "assistant"] },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          conversationId: true,
        },
      })
      // 3) Group messages by session id, then attach to sessions in the
      //    shape the frontend expects (direction/aiGenerated/type/chatSessionId).
      const bySession = new Map<string, typeof rows>()
      for (const r of rows) {
        const arr = bySession.get(r.conversationId)
        if (arr) arr.push(r)
        else bySession.set(r.conversationId, [r])
      }
      const sessions = rawSessions.map((s) => ({
        ...s,
        messages: (bySession.get(s.id) || []).map((m) => ({
          id: m.id,
          direction: m.role === "user" ? "INBOUND" : "OUTBOUND",
          content: m.content,
          type: "TEXT",
          createdAt: m.createdAt,
          aiGenerated: m.role === "assistant",
          chatSessionId: s.id,
        })),
      }))
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
  // POST /api/v1/playground/demo-chat
  // Public no-auth endpoint for standalone demo pages (e.g. /demo/demowash).
  // Accepts workspaceId in body, but ONLY allows workspaces with customChatbotId
  // set (i.e. demo workspaces). For non-demo workspaces use sendChat (auth-protected).
  async sendDemoChat(req: Request, res: Response) {
    try {
      const { workspaceId, message, customerPhone, sessionId, customerName } = req.body
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message is required" })
      }
      if (!workspaceId || typeof workspaceId !== "string") {
        return res.status(400).json({ error: "workspaceId is required" })
      }
      // Whitelist check: only allow demo workspaces (customChatbotId set)
      const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { customChatbotId: true },
      })
      if (!ws?.customChatbotId) {
        return res.status(403).json({ error: "demo-chat only allowed for workspaces with customChatbotId set" })
      }
      // Reuse the main sendChat logic by faking the request shape.
      // We set req.workspaceId so resolveWorkspaceId (called inside sendChat)
      // picks it up without needing JWT auth.
      ;(req as any).workspaceId = workspaceId
      ;(req as any).demoMode = true
      return this.sendChat(req, res)
    } catch (error: any) {
      logger.error("Playground sendDemoChat error:", error)
      return res.status(500).json({ error: "Failed to send demo chat", message: error.message })
    }
  }

  async sendChat(req: Request, res: Response) {
    try {
      const { customerPhone, sessionId, message, customerName, lang } = req.body
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "message is required" })
      }

      // 🌍 Playground language override:
      // The playground UI lets the admin pick a flag (ES/CA/IT/EN/FR/PT/DE)
      // from the Use Cases panel. That selection is forwarded as `lang` and
      // overrides `customer.language` for this single turn, so the bot reply
      // — and the "Human Support message" emitted on escalation — come back
      // in the chosen language. Default is "es" (the Use Cases source lang)
      // so a missing/invalid `lang` falls back to Spanish, matching the
      // panel's initial state.
      const SUPPORTED_LANGS = ["es", "it", "en", "fr", "pt", "ca", "de"] as const
      const overrideLanguage =
        typeof lang === "string" &&
        (SUPPORTED_LANGS as readonly string[]).includes(lang.toLowerCase())
          ? lang.toLowerCase()
          : null

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
          session = await prisma.chatSession.create({
            data: {
              workspaceId,
              customerId: customer.id,
              status: "active",
              isPlayground: true,
            },
          })
        }
      }

      // 1) Persist inbound user message immediately so the UI always sees it.
      //    Single source of truth: conversationMessage (the table the main
      //    /chat app reads from). The legacy `message` table is no longer
      //    written by playground.
      await prisma.conversationMessage.create({
        data: {
          workspaceId,
          customerId: customer.id,
          conversationId: session.id,
          role: "user",
          content: message,
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
          // Build conversation history for the custom chatbot from
          // conversationMessage (single source of truth). We skip "function"
          // rows (internal LLM tool calls — never part of dialog history).
          const recentMessages = await prisma.conversationMessage.findMany({
            where: {
              conversationId: session.id,
              role: { in: ["user", "assistant"] },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { role: true, content: true, createdAt: true },
          })
          const history = recentMessages
            .reverse()
            // Skip the inbound message we just persisted (the custom chatbot
            // expects the LATEST user message via `userMessage`, not in history).
            .slice(0, -1)
            .map((m) => ({
              role: m.role as "user" | "assistant",
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
            // 🌍 Prefer the per-turn override from the playground flag
            // selector; fall back to customer.language, then to "es".
            language: overrideLanguage || customer.language || "es",
            sessionId: session.id,
            customerId: customer.id,
            phoneNumber: customer.phone || undefined,
            history,
          })

          if (customResult.handled && customResult.output) {
            await applyCustomerPatches(customResult.output.patches, customer.id, workspaceId)
          }
          // Dispatch escalation notification (email/WhatsApp) when the custom
          // chatbot signals that the case must be handed over to a human
          // operator. Same single-point pattern used by whatsapp-webhook,
          // ultramsg-webhook and widget-chat controllers. Without this block
          // the playground would never trigger the Human Support email, even
          // when the bot reaches the "operator handoff" final reply.
          const customOutput = customResult.output
          if (customResult.handled && customOutput?.shouldEscalate && customOutput.escalationSummary) {
            void applyEscalationNotification({
              workspaceId,
              customerId: customer.id,
              escalationSummary: customOutput.escalationSummary,
              history: history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content || '' })),
              customerName: customer.name || 'Unknown',
              customerPhone: customer.phone || undefined,
              notificationEmails: customOutput.notificationEmails,
              operatorContactMethod: customOutput.operatorContactMethod,
              operatorWhatsappNumber: customOutput.operatorWhatsappNumber,
              smtpConfig: customOutput.smtpConfig,
            })
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

      // 3) Persist outbound bot response so the UI shows the dialog.
      //    Note: the engine itself may also persist via MessagePersistenceService.
      //    We check that no identical assistant message was just saved to avoid duplicates.
      const recentBotMsg = await prisma.conversationMessage.findFirst({
        where: {
          conversationId: session.id,
          role: "assistant",
          createdAt: { gte: new Date(Date.now() - 30_000) },
        },
        orderBy: { createdAt: "desc" },
      })
      if (!recentBotMsg || recentBotMsg.content !== botResponse) {
        await prisma.conversationMessage.create({
          data: {
            workspaceId,
            customerId: customer.id,
            conversationId: session.id,
            role: "assistant",
            content: botResponse,
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
        select: { id: true },
      })
      if (!session) {
        return res.status(404).json({ error: "Session not found" })
      }

      // Collect the message ids that may have TODOs attached. We check
      // conversationMessage (the new source of truth).
      const sessionMessages = await prisma.conversationMessage.findMany({
        where: { conversationId: id, role: { in: ["user", "assistant"] } },
        select: { id: true },
      })
      const messageIds = sessionMessages.map((m) => m.id)
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
      // history isn't affected (the playground only handles demo workspaces).
      await prisma.$transaction([
        prisma.conversationMessage.deleteMany({ where: { conversationId: id } }),
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
