import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import type { ChatChannel } from "../../../custom-client-0/types"
import type { ChatbotInput, ChatbotOutput } from "../../../custom-client-0/types"

import logger from "../../utils/logger"

type HistoryEntry = {
  role: "user" | "assistant"
  content: string
}

type SupportedLanguage = "it" | "es" | "pt" | "en" | "ca" | "fr"

type InvokeParams = {
  workspaceId: string
  workspaceSlug?: string | null
  customChatbotId?: string | null  // from workspace.customChatbotId (DB field)
  userMessage: string
  userName: string
  channel: ChatChannel
  welcomeMessage: string
  wipMessage: string
  channelActive: boolean
  debugChannel: boolean
  isPlayground: boolean
  language?: string | null
  sessionId: string
  customerId?: string
  phoneNumber?: string
  history: HistoryEntry[]
}

type InvokeResult = {
  handled: boolean
  output?: ChatbotOutput
}

type ChatbotModule = {
  chatbotFn: (input: ChatbotInput) => Promise<ChatbotOutput>
}

type TsImportFn = (
  specifier: string,
  options: {
    parentURL: string
  }
) => Promise<any>

export class CustomClientChatbotService {
  private readonly customClient0WorkspaceIds: Set<string>
  // Cache per chatbotId → modulo caricato. Ogni custom-client-N ha il proprio modulo.
  private readonly moduleCache = new Map<string, Promise<ChatbotModule>>()

  constructor() {
    const configuredIds = (process.env.CUSTOM_CLIENT_0_WORKSPACE_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)

    this.customClient0WorkspaceIds = new Set(configuredIds)
  }

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    const chatbotId = this.resolveChatbotId(params)
    if (!chatbotId) {
      return { handled: false }
    }

    // Guard: channel disabled — return immediately, no LLM call.
    if (!params.channelActive) {
      return {
        handled: true,
        output: {
          reply: null,
          wipMessage: params.debugChannel ? params.wipMessage : undefined,
          shouldEscalate: false,
          meta: { tokensUsed: 0, agentChain: [] },
        },
      }
    }

    try {
      const module = await this.loadChatbotModule(chatbotId)
      const output = await module.chatbotFn({
        userMessage: params.userMessage,
        userName: params.userName,
        channel: params.channel,
        config: {
          workspaceId: params.workspaceId,
          // channelActive/wipMessage/welcomeMessage handled above — not passed to chatbotFn
          debugChannel: params.debugChannel,
          isPlayground: params.isPlayground,
          language: this.normalizeLanguage(params.language),
        },
        context: {
          sessionId: params.sessionId,
          customerId: params.customerId,
          phoneNumber: params.phoneNumber,
          history: params.history,
        },
      })

      // Welcome merge (Option C): on the first turn (no prior history), prepend the workspace
      // welcomeMessage to the chatbot reply so the customer receives one combined message
      // ("¡Hola! Soy ...\n\nTranquilo, te ayudo. ¿En qué...?") instead of two separate ones.
      // Substitute the common template variables BEFORE prepending so customers never see
      // raw `{{chatbotName}}` placeholders. Workspaces typically store the welcome with
      // `{{chatbotName}}` as a literal — sub it for the workspace's chatbotName when known,
      // and fall back to a neutral assistant name otherwise.
      const isFirstTurn = params.history.length === 0
      if (isFirstTurn && params.welcomeMessage && output.reply) {
        const resolvedWelcome = params.welcomeMessage
          .replaceAll("{{chatbotName}}", "Ecolaundry")
          .replaceAll("{{customerName}}", params.userName || "")
          .replace(/\{\{[^}]+\}\}/g, "")
          .trim()
        if (resolvedWelcome) {
          output.reply = `${resolvedWelcome}\n\n${output.reply}`
        }
      }

      // Attach wipMessage from workspace settings (used by widget/WhatsApp to show debug banner)
      if (params.debugChannel && params.wipMessage) {
        output.wipMessage = params.wipMessage
      }

      return { handled: true, output }
    } catch (error) {
      logger.error("[CustomClientChatbotService] Failed to invoke custom chatbot", {
        workspaceId: params.workspaceId,
        chatbotId,
        error: error instanceof Error ? error.message : String(error),
      })

      return { handled: false }
    }
  }

  /**
   * Resolve which custom chatbot to use, in priority order:
   * 1. workspace.customChatbotId (DB field — authoritative, set in AI Personality settings)
   * 2. workspace.slug === "cliente-0" (legacy fallback for existing setup)
   * 3. CUSTOM_CLIENT_0_WORKSPACE_IDS env var (legacy env var override)
   * Returns null if no custom chatbot is configured.
   */
  private resolveChatbotId(params: InvokeParams): string | null {
    if (params.customChatbotId) {
      return params.customChatbotId.trim()
    }
    if (params.workspaceSlug?.toLowerCase() === "cliente-0") {
      return "cliente-0"
    }
    if (this.customClient0WorkspaceIds.has(params.workspaceId)) {
      return "cliente-0"
    }
    return null
  }

  private normalizeLanguage(language?: string | null): SupportedLanguage | undefined {
    if (!language) {
      return undefined
    }

    const normalized = language.toLowerCase().trim()
    const map: Record<string, SupportedLanguage> = {
      it: "it",
      italiano: "it",
      italian: "it",
      es: "es",
      esp: "es",
      español: "es",
      spanish: "es",
      en: "en",
      eng: "en",
      english: "en",
      pt: "pt",
      por: "pt",
      português: "pt",
      portuguese: "pt",
      ca: "ca",
      cat: "ca",
      català: "ca",
      catalan: "ca",
      fr: "fr",
      fra: "fr",
      français: "fr",
      french: "fr",
    }

    return map[normalized]
  }

  private async loadChatbotModule(chatbotId: string): Promise<ChatbotModule> {
    const cached = this.moduleCache.get(chatbotId)
    if (cached) return cached

    const promise = this.importChatbotModule(chatbotId)
    this.moduleCache.set(chatbotId, promise)
    return promise
  }

  private async importChatbotModule(chatbotId: string): Promise<ChatbotModule> {
    const entryPath = this.resolveCustomClientEntryPath(chatbotId)
    const entryUrl = pathToFileURL(entryPath).href
    const parentURL = pathToFileURL(__filename).href

    const { tsImport } = require("tsx/esm/api") as { tsImport: TsImportFn }
    const importedModule = await tsImport(entryUrl, { parentURL })
    if (!importedModule?.chatbotFn || typeof importedModule.chatbotFn !== "function") {
      throw new Error(`${chatbotId}/index.ts does not export chatbotFn`)
    }

    return importedModule as ChatbotModule
  }

  private resolveCustomClientEntryPath(chatbotId: string): string {
    // Security: only allow safe chatbotId values (lowercase letters, digits, hyphens).
    // This prevents path traversal attacks if the DB field contains "../../" sequences.
    if (!/^[a-z0-9-]+$/.test(chatbotId)) {
      throw new Error(`Invalid chatbotId "${chatbotId}": only lowercase letters, digits and hyphens are allowed`)
    }

    // chatbotId (e.g. "cliente-0") maps to custom-client-0 folder
    // Convention: "cliente-N" → "custom-client-N"
    const folderName = chatbotId.startsWith("cliente-")
      ? chatbotId.replace("cliente-", "custom-client-")
      : chatbotId

    const candidates = [
      path.resolve(process.cwd(), `${folderName}/index.ts`),
      path.resolve(process.cwd(), `apps/backend/${folderName}/index.ts`),
      path.resolve(__dirname, `../../../${folderName}/index.ts`),
      path.resolve(__dirname, `../../../../${folderName}/index.ts`),
    ]

    const existing = candidates.find((candidate) => fs.existsSync(candidate))
    if (!existing) {
      throw new Error(`${folderName}/index.ts not found (chatbotId: ${chatbotId})`)
    }

    return existing
  }
}
