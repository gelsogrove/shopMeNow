import { prisma } from "@echatbot/database"
import { Request, Response } from "express"
import * as fs from "fs"
import * as path from "path"
import { getChatEngine } from "../../../application/chat-engine"
import { CustomClientChatbotService, applyCustomerPatches, applyEscalationNotification } from "../../../application/services/custom-client-chatbot.service"
import { detectLanguageFromPhonePrefix } from "../../../utils/language-detector"
import { buildPhoneVariants } from "../../../utils/phone"
import logger from "../../../utils/logger"
import { messageAttachmentRepository } from "../../../repositories/message-attachment.repository"
import { storageService } from "../../../services/storage.service"
import { sniffMime, validateAttachment } from "../../../services/chat-attachment.validation"
import { transcribeAudio } from "../../../services/audio-transcription.service"

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
        select: { name: true, customChatbotId: true, slug: true, welcomeVideoUrl: true },
      })
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" })
      }
      return res.json({
        name: workspace.name,
        chatbotId: workspace.customChatbotId,
        slug: workspace.slug,
        welcomeVideoUrl: workspace.welcomeVideoUrl || null,
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
        where: { workspaceId, isPlayground: true },
        include: {
          customer: { select: { id: true, name: true, phone: true, language: true } },
        },
        // Manual order first (sortOrder ascending, NULLs last via Prisma's
        // nulls option), then most-recent activity. The frontend can still
        // refine ordering, but this gives a stable server-side baseline that
        // honours the user's drag-and-drop ordering after a reload.
        orderBy: [
          { sortOrder: { sort: "asc", nulls: "last" } },
          { updatedAt: "desc" },
        ],
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
          reaction: true, // 😀 server-synced reaction emoji
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

      // 📎 Hydrate attachments for these messages (fail-safe).
      const attByMessage: Record<string, any[]> = {}
      try {
        const msgIds = rows.map((r) => r.id)
        if (msgIds.length > 0) {
          const atts =
            await messageAttachmentRepository.listByConversationMessageIds(msgIds)
          for (const a of atts) {
            ;(attByMessage[a.conversationMessageId] ||= []).push({
              id: a.id,
              url: a.url,
              kind: a.kind,
              mimeType: a.mimeType,
              filename: a.filename,
              sizeBytes: a.sizeBytes,
            })
          }
        }
      } catch (e: any) {
        logger.error("Playground getMessages: attachment hydration failed:", e?.message)
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
          attachments: attByMessage[m.id] || undefined,
          reaction: m.reaction || null, // 😀 server-synced reaction emoji
        })),
      }))
      return res.json({ sessions })
    } catch (error: any) {
      logger.error("Playground getMessages error:", error)
      return res.status(500).json({ error: "Failed to load messages", message: error.message })
    }
  }

  // POST /api/v1/playground/messages/:messageId/reaction
  // 😀 Set (emoji) or clear ("") the reaction on a message — demo/customer side.
  // Persisted on ConversationMessage.reaction (same source the operator reads),
  // so a reaction set here is visible in the operator chat and vice versa.
  // ISOLATION (rule #2): the message MUST belong to the demo's bound workspace.
  async setReaction(req: Request, res: Response) {
    try {
      const workspaceId = await resolveWorkspaceId(req)
      const { messageId } = req.params
      const { emoji } = req.body

      if (!workspaceId) return res.status(401).json({ error: "no_workspace" })
      if (!messageId) return res.status(400).json({ error: "messageId is required" })
      if (typeof emoji !== "string") {
        return res.status(400).json({ error: "emoji must be a string ('' clears it)" })
      }

      // The message must belong to THIS workspace — never react cross-workspace.
      const msg = await prisma.conversationMessage.findFirst({
        where: { id: messageId, workspaceId },
        select: { id: true },
      })
      if (!msg) return res.status(404).json({ error: "message_not_found" })

      const nextReaction = emoji.trim() ? emoji.trim() : null
      await prisma.conversationMessage.update({
        where: { id: msg.id },
        data: { reaction: nextReaction },
      })

      return res.json({ success: true, messageId: msg.id, reaction: nextReaction })
    } catch (error: any) {
      logger.error("Playground setReaction error:", error)
      return res.status(500).json({ error: "Failed to set reaction", message: error.message })
    }
  }

  // POST /api/v1/playground/attachments
  // 📎 Upload image/PDF as the CUSTOMER side in the demo (role "user" → renders
  // left). Lets the playground test inbound media without a real WhatsApp.
  async uploadAttachments(req: Request, res: Response) {
    const files = ((req as any).files as Express.Multer.File[]) || []
    const cleanup = () => {
      for (const f of files) {
        try {
          fs.unlinkSync(f.path)
        } catch {
          /* ignore */
        }
      }
    }
    try {
      const workspaceId = await resolveWorkspaceId(req)
      const chatSessionId = req.body?.chatSessionId
      const caption = typeof req.body?.caption === "string" ? req.body.caption : ""
      if (!chatSessionId) {
        cleanup()
        return res.status(400).json({ error: "chatSessionId is required" })
      }
      if (files.length === 0) {
        cleanup()
        return res.status(400).json({ error: "No files provided" })
      }

      const session = await prisma.chatSession.findFirst({
        where: { id: chatSessionId, workspaceId },
        select: { id: true, customerId: true },
      })
      if (!session) {
        cleanup()
        return res.status(404).json({ error: "Chat session not found" })
      }

      const created: any[] = []
      for (const file of files) {
        const buffer = fs.readFileSync(file.path)
        const trueMime = sniffMime(buffer) || file.mimetype
        const validation = validateAttachment({
          mimeType: trueMime,
          filename: file.originalname,
          sizeBytes: buffer.length,
        })
        if (!validation.ok || !validation.kind) {
          cleanup()
          return res.status(400).json({ error: validation.error || "Invalid file" })
        }

        const ext =
          trueMime === "application/pdf" ? "pdf" : trueMime === "image/png" ? "png" : "jpg"
        const rand = Math.random().toString(36).slice(2, 8)
        const uploaded = await storageService.upload(buffer, {
          filename: `${Date.now()}_${rand}.${ext}`,
          folder: `chat-attachments/${workspaceId}/${chatSessionId}`,
          contentType: trueMime,
          isPublic: true,
        })

        // role "user" → customer side (left), simulating an inbound media msg.
        const msg = await prisma.conversationMessage.create({
          data: {
            workspaceId,
            customerId: session.customerId,
            conversationId: chatSessionId,
            role: "user",
            content: caption || "",
            deliveryStatus: "sent",
          },
        })

        const att = await messageAttachmentRepository.create({
          conversationMessageId: msg.id,
          workspaceId,
          kind: validation.kind,
          url: uploaded.url,
          storageKey: uploaded.key,
          mimeType: trueMime,
          filename: file.originalname,
          sizeBytes: buffer.length,
        })

        created.push({
          id: att.id,
          conversationMessageId: msg.id,
          url: uploaded.url,
          kind: validation.kind,
          mimeType: trueMime,
          filename: file.originalname,
          sizeBytes: buffer.length,
        })

        try {
          fs.unlinkSync(file.path)
        } catch {
          /* ignore */
        }
      }

      return res.json({ success: true, attachments: created })
    } catch (error: any) {
      logger.error("Playground uploadAttachments error:", error)
      cleanup()
      return res.status(500).json({ error: "Failed to upload attachments", message: error.message })
    }
  }

  // POST /api/v1/playground/chat-audio
  // 🎤 Voice note from the demo composer (browser MediaRecorder → blob).
  // Pipeline: transcribe (Whisper) → store the audio as an AUDIO attachment →
  // run the SAME bot turn as a text message (the transcription IS the message).
  // The chat bubble shows the player; the bot reasons on the transcription.
  // Reuses sendChat for the bot invocation — single source of truth.
  async sendChatAudio(req: Request, res: Response) {
    const file = (req as any).file as Express.Multer.File | undefined
    const cleanup = () => {
      if (file?.path) {
        try {
          fs.unlinkSync(file.path)
        } catch {
          /* ignore */
        }
      }
    }
    try {
      if (!file) {
        return res.status(400).json({ error: "audio file is required" })
      }
      const workspaceId = await resolveWorkspaceId(req)
      const sessionId = req.body?.sessionId
      if (!sessionId) {
        cleanup()
        return res.status(400).json({ error: "sessionId is required" })
      }
      const session = await prisma.chatSession.findFirst({
        where: { id: sessionId, workspaceId },
        select: { id: true },
      })
      if (!session) {
        cleanup()
        return res.status(404).json({ error: "Chat session not found" })
      }

      const buffer = fs.readFileSync(file.path)
      const trueMime = sniffMime(buffer) || (file.mimetype || "").split(";")[0].trim()
      const validation = validateAttachment({
        mimeType: trueMime,
        sizeBytes: buffer.length,
      })
      if (!validation.ok || validation.kind !== "AUDIO") {
        cleanup()
        return res.status(400).json({ error: validation.error || "Invalid audio file" })
      }

      // 1) Transcribe — the text becomes the message the bot reasons on.
      const transcription = await transcribeAudio({
        audioBuffer: buffer,
        declaredMime: trueMime,
        provider: "playground",
        workspaceId,
      })
      if (!transcription?.text) {
        cleanup()
        return res.status(422).json({ error: "Could not transcribe audio" })
      }

      // 2) Store the audio so the bubble shows a player.
      const EXT: Record<string, string> = {
        "audio/ogg": "ogg",
        "audio/mpeg": "mp3",
        "audio/mp4": "m4a",
        "audio/aac": "aac",
        "audio/amr": "amr",
        "audio/webm": "webm",
      }
      const ext = EXT[trueMime] || "bin"
      const rand = Math.random().toString(36).slice(2, 8)
      const uploaded = await storageService.upload(buffer, {
        filename: `${Date.now()}_${rand}.${ext}`,
        folder: `chat-attachments/${workspaceId}/${sessionId}`,
        contentType: trueMime,
        isPublic: true,
      })

      // 3) Hand off to the normal text turn: the transcription is the message,
      //    the audio is linked to the inbound message inside sendChat.
      req.body.message = transcription.text
      ;(req as any)._inboundAudio = {
        url: uploaded.url,
        storageKey: uploaded.key,
        mimeType: trueMime,
        sizeBytes: buffer.length,
        filename: file.originalname || `voice.${ext}`,
      }
      cleanup()
      return this.sendChat(req, res)
    } catch (error: any) {
      logger.error("Playground sendChatAudio error:", error)
      cleanup()
      return res.status(500).json({ error: "Failed to process voice note", message: error.message })
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
              email: null,
              isActive: false,
              registrationStatus: "NEW",
              // 🌍 Do NOT seed language from the phone prefix. The language is
              // detected by the bot from the customer's actual message (and then
              // persisted via the ⟦LANG⟧ reply trailer). Seeding from the prefix
              // wrongly locks the conversation language regardless of what the
              // customer writes.
              language: null,
            },
          })
        }
      }

      if (!session) {
        // 🧪 CRITICAL: Only reuse playground sessions — never attach to a real WhatsApp session
        session = await prisma.chatSession.findFirst({
          where: { customerId: customer.id, status: "active", isPlayground: true },
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
      const inboundMessage = await prisma.conversationMessage.create({
        data: {
          workspaceId,
          customerId: customer.id,
          conversationId: session.id,
          role: "user",
          content: message,
        },
      })

      // 🎤 Voice note: the recorder endpoint (sendChatAudio) stashes the already
      //    uploaded audio on the request. Link it to the inbound message we just
      //    created so the chat bubble shows the player (text = transcription is
      //    kept as content for the bot, hidden in the UI). Fail-safe: a media
      //    failure must never break the chat turn.
      const inboundAudio = (req as any)._inboundAudio as
        | { url: string; storageKey: string; mimeType: string; sizeBytes: number; filename?: string | null }
        | undefined
      if (inboundAudio) {
        try {
          await messageAttachmentRepository.create({
            conversationMessageId: inboundMessage.id,
            workspaceId,
            kind: "AUDIO",
            url: inboundAudio.url,
            storageKey: inboundAudio.storageKey,
            mimeType: inboundAudio.mimeType,
            filename: inboundAudio.filename ?? null,
            sizeBytes: inboundAudio.sizeBytes,
          })
        } catch (attErr: any) {
          logger.error("[Playground] Failed to attach voice note", {
            sessionId: session.id,
            error: attErr?.message,
          })
        }
      }

      // 🚦 If the customer has been handed over to a human operator (a
      //    previous turn triggered escalation), do NOT call the bot. The
      //    inbound message stays saved and the operator reads it in /chat.
      //    Mirrors the gate already applied by the WhatsApp / widget
      //    webhooks.
      if (customer.activeChatbot === false) {
        return res.json({
          sessionId: session.id,
          customerId: customer.id,
          response: null,
          chatbotDisabled: true,
        })
      }

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
            // 🌍 Reply language: pass the customer's KNOWN language only (set by
            //    the bot on previous turns via the ⟦LANG⟧ trailer). On the FIRST
            //    message it is null → we pass undefined so the bot detects the
            //    language from what the customer actually wrote, instead of being
            //    forced to a default. The prompt itself falls back to Spanish
            //    only when the first message is genuinely undecidable.
            language: customer.language || undefined,
            // 🚩 Per-turn override for the operator briefing language only
            //    ("Human Support message" emitted on escalation). Driven by
            //    the flag selected in the Use Cases panel; falls back to
            //    settings.json when null.
            operatorBriefingLanguageOverride: overrideLanguage,
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

            // 🚦 Hand the conversation to the human operator: stop the bot
            //    from replying further. The webhook / playground gate on
            //    `customer.activeChatbot` ensures inbound messages are saved
            //    but the LLM is not invoked. The operator re-enables the
            //    chatbot from the chat UI when they close the case.
            try {
              await prisma.$transaction([
                prisma.customers.update({
                  where: { id: customer.id },
                  data: { activeChatbot: false },
                }),
                prisma.chatSession.update({
                  where: { id: session.id },
                  data: { escalatedAt: new Date() },
                }),
              ])
            } catch (err: any) {
              logger.error(
                "[Playground] Failed to disable chatbot after escalation",
                { customerId: customer.id, sessionId: session.id, error: err?.message }
              )
            }
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

      // No blocking TODOs → safe to delete. We hard-delete the session and
      // its messages because the playground is a debug surface; production
      // chat history isn't affected (the playground only handles demo
      // workspaces).
      //
      // We delete from BOTH conversation_messages (new source of truth) and
      // messages (legacy FK still alive — see TD-001 in docs/tech-debt.md).
      // Old playground sessions created before the 2026-05-29 migration may
      // still have rows in the legacy `Message` table; without dropping
      // those first, the foreign-key constraint `messages_chatSessionId_fkey`
      // blocks `chatSession.delete`.
      await prisma.$transaction([
        prisma.conversationMessage.deleteMany({ where: { conversationId: id } }),
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

  // PATCH /api/v1/playground/sessions/:id
  // Persist the playground UI overlays (title / feedback / sortOrder) on the
  // chat session itself. Previously these lived in localStorage and were wiped
  // by the logout's localStorage.clear(); storing them server-side makes them
  // survive logout, browser changes and deploys. Workspace-scoped for tenant
  // isolation.
  async updateSession(req: Request, res: Response) {
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

      // Build the patch from only the provided fields. Each field is
      // independently optional so the frontend can update title, feedback or
      // order in isolation. Passing null explicitly clears a field (e.g.
      // un-liking a chat or removing a custom title).
      const { title, feedback, sortOrder } = req.body ?? {}
      const data: { title?: string | null; feedback?: string | null; sortOrder?: number | null } = {}

      if (title !== undefined) {
        if (title !== null && typeof title !== "string") {
          return res.status(400).json({ error: "title must be a string or null" })
        }
        const trimmed = typeof title === "string" ? title.trim() : null
        data.title = trimmed ? trimmed : null
      }
      if (feedback !== undefined) {
        if (feedback !== null && feedback !== "like" && feedback !== "dislike") {
          return res.status(400).json({ error: "feedback must be 'like', 'dislike' or null" })
        }
        data.feedback = feedback
      }
      if (sortOrder !== undefined) {
        if (sortOrder !== null && typeof sortOrder !== "number") {
          return res.status(400).json({ error: "sortOrder must be a number or null" })
        }
        data.sortOrder = sortOrder
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: "No updatable fields provided (title, feedback, sortOrder)" })
      }

      const updated = await prisma.chatSession.update({
        where: { id },
        data,
        select: { id: true, title: true, feedback: true, sortOrder: true },
      })

      return res.json({ ok: true, session: updated })
    } catch (error: any) {
      logger.error("Playground updateSession error:", error)
      return res.status(500).json({
        error: "Failed to update session",
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
