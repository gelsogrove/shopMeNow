/**
 * Chatbot settings.json generator
 *
 * Andrea 2026-07-31: the Settings UI writes to the database (source of truth),
 * and every save re-renders `custom-<module>/settings.json` from it so the
 * running chatbot picks the values up — the module already reads that file, so
 * nothing else has to change.
 *
 * Deliberately EXCLUDED: anything the runtime never reads — widget look & feel
 * (colors, icon, title, quick replies), WhatsApp credentials, calendar,
 * billing. Those are platform concerns, not chatbot config.
 *
 * Keys with no dedicated Workspace column (maxToolHops, rate limits,
 * similarityThreshold, rateLimitedMessage, intakeQuestions…) come from the
 * free-form `customChatbotAdvancedSettings` JSON column, edited as raw JSON
 * in the Settings UI. Anything still missing from both falls back to
 * whatever is already on disk: the generator merges onto the current file,
 * it never rewrites it from scratch.
 */
import { existsSync } from "fs"
import { readFile, writeFile } from "fs/promises"
import path from "path"
import logger from "../../utils/logger"
import { prisma } from "@echatbot/database"
import { PromptProcessorService } from "../../services/prompt-processor.service"
import { PromptVariables, VARIABLE_DEFAULTS } from "../../types/prompt-variables.types"
import { renderWorkspaceCopy } from "./workspace-copy.render"
import { resolveHumanSupportFlowId } from "./human-support-flow.resolve"

const promptProcessor = new PromptProcessorService()

/** Shape consumed by custom-<module>/agent.ts. Mirrors its `Settings` type. */
export interface ChatbotSettingsJson {
  /**
   * The module's main/system prompt (workspace.customChatbotSystemPrompt),
   * with system-level {{variables}} (companyName, chatbotName, toneOfVoice,
   * humanSupportInstructions, faqs, …) already substituted — the module
   * reads this verbatim. Per-customer variables (e.g. {{customerName}}) are
   * NOT touched here: those change per turn, so the module substitutes them
   * itself at runtime, the same way it already does for welcomeBackMessage
   * and humanSupportMessage.
   */
  mainPrompt?: string
  model: string
  temperature: number
  maxTokens: number
  maxToolHops: number
  operatorBriefingLanguage: string
  operatorEmail: string
  // Multi-operator escalation. `operatorDeliveryMode` tells the module how to
  // pick: 'all' | 'random' | 'custom' (the module applies its own rule and the
  // recipient lists are not configured in the UI at all).
  operatorEmails?: string[]
  operatorWhatsappNumbers?: string[]
  operatorDeliveryMode?: string
  emailFrom: string
  emailSubjectPrefix: string
  maxMessageChars: number
  maxMessagesPerMinute: number
  maxTurnsPerSession: number
  privacyPolicyUrl: string
  similarityThreshold: number
  topK: number
  audioOutput: boolean
  audioVoices: Record<string, string>
  /** Widget composer shows a microphone; voice notes are transcribed to text in the customer's detected language. */
  speechToTextEnabled?: boolean
  /** ISO 639-1 code used when the detected language isn't in `enabledLanguages`. */
  defaultLanguage?: string
  /** Languages the chatbot is allowed to reply in; detection outside this set falls back to `defaultLanguage`. */
  enabledLanguages?: string[]
  // Customer-facing copy, editable in the app. Rendered by the LLM in the
  // customer's language; {{customerName}} is substituted at runtime.
  /** Greeting for a customer writing for the first time (no prior history). */
  welcomeMessage?: string
  /** Greeting for a customer we already know by name (returning visitor). */
  welcomeBackMessage?: string
  /** Sentence sent when the conversation is handed to a human operator. */
  humanSupportMessage?: string
  /** Shown when the customer exceeds the per-minute message cap. */
  rateLimitedMessage?: string
  /** Shown when the conversation exceeds maxTurnsPerSession. */
  sessionTooLongMessage?: string
  /** Confirmation sent after the customer revokes consent with UNSUBSCRIBE. */
  unsubscribedMessage?: string
  /**
   * The intake questions asked verbatim while no flow is attached. Written in
   * one language; the chatbot translates them into the customer's.
   */
  intakeQuestions?: {
    serialNumber?: string
    problemDescription?: string
    problemStartedWhen?: string
  }
}

/** Workspace fields this generator reads. Kept narrow on purpose. */
export interface WorkspaceChatbotSource {
  id?: string
  name?: string | null
  customChatbotId?: string | null
  customChatbotSystemPrompt?: string | null
  chatbotName?: string | null
  humanSupportInstructions?: string | null
  toneOfVoice?: string | null
  address?: string | null
  businessType?: string | null
  currency?: string | null
  websiteUrl?: string | null
  url?: string | null
  whatsappPhoneNumber?: string | null
  whatsappSettings?: { adminEmail?: string | null } | null
  allowedExternalLinks?: string[] | null
  customChatbotModel?: string | null
  customChatbotTemperature?: number | null
  customChatbotMaxTokens?: number | null
  customChatbotOperatorEmail?: string | null
  customChatbotEmailFrom?: string | null
  customChatbotEmailSubjectPrefix?: string | null
  operatorEmail?: string | null
  operatorEmails?: string[] | null
  operatorWhatsappNumbers?: string[] | null
  operatorDeliveryMode?: string | null
  defaultLanguage?: string | null
  enabledLanguages?: string[] | null
  audioOutput?: boolean | null
  speechToTextEnabled?: boolean | null
  audioVoices?: unknown
  welcomeMessage?: string | null
  welcomeBackMessage?: string | null
  humanSupportMessage?: string | null
  termsAndConditions?: string | null
  // Free-form JSON for fields with no dedicated column (maxToolHops,
  // maxMessageChars, rateLimitedMessage, intakeQuestions, etc.). Merged onto
  // the file as-is; widget look & feel keys are stripped even if present.
  customChatbotAdvancedSettings?: unknown
}

/**
 * Widget look & feel is a platform concern, never chatbot runtime config —
 * stripped from the advanced-settings blob even if a stray key ends up there.
 */
const WIDGET_KEYS = new Set([
  "widgetColor",
  "widgetIcon",
  "widgetTitle",
  "widgetQuickReplies",
  "quickReplies",
  "primaryColor",
  "icon",
  "title",
])

/**
 * Validates the advanced-settings JSON column into a plain object safe to
 * spread onto settings.json. Anything not a plain object (bad manual edit)
 * is rejected so a malformed column cannot corrupt the file.
 */
function normaliseAdvancedSettings(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null

  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (WIDGET_KEYS.has(key)) continue
    out[key] = val
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * Locates `custom-<id>/settings.json`.
 *
 * Andrea 2026-08-02: this used to be a single path relative to __dirname,
 * which resolved only when running from `src/`. In production the code runs
 * from `dist/`, and the build copies `templates` and `public` but NOT the
 * custom-* modules — so every lookup died with
 * "ENOENT: /app/apps/backend/dist/custom-demorobot/settings.json".
 *
 * The module loader in custom-client-chatbot.service.ts already solved this
 * with a candidate list; the same strategy is applied here so both agree on
 * where a module lives, whether started from the repo root, apps/backend,
 * src/ or dist/.
 */
function settingsCandidates(customChatbotId: string): string[] {
  const folder = `custom-${customChatbotId}`
  return [
    path.resolve(process.cwd(), folder, "settings.json"),
    path.resolve(process.cwd(), "apps/backend", folder, "settings.json"),
    path.resolve(__dirname, "..", "..", "..", folder, "settings.json"),
    path.resolve(__dirname, "..", "..", "..", "..", folder, "settings.json"),
  ]
}

/**
 * First candidate that exists on disk. Falls back to the __dirname-relative
 * path so callers still get a sensible target to WRITE to when the file has
 * not been created yet.
 */
function settingsPath(customChatbotId: string): string {
  const candidates = settingsCandidates(customChatbotId)
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[2]
}

/**
 * Normalises the audioVoices JSON column into the `{ lang: voiceId }` map the
 * agent expects. Anything that is not a string-to-string object (bad manual
 * edit, legacy value) is rejected so a malformed column cannot corrupt the file.
 */
function normaliseAudioVoices(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null

  const out: Record<string, string> = {}
  for (const [lang, voiceId] of Object.entries(value as Record<string, unknown>)) {
    if (typeof voiceId === "string" && voiceId.trim()) out[lang] = voiceId.trim()
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * Substitutes system-level {{variables}} (companyName, chatbotName,
 * toneOfVoice, humanSupportInstructions, faqs, …) into
 * workspace.customChatbotSystemPrompt — the same set buildCustomChatbotSystemPrompt
 * used to process before the main prompt moved into settings.json.
 *
 * Per-customer variables (e.g. {{customerName}}) are deliberately NOT in
 * VARIABLE_DEFAULTS/here: this runs once per save, not once per turn, so the
 * module substitutes those itself at runtime.
 *
 * Returns the previous value (`current`) unchanged when the workspace has no
 * custom template set, so a workspace that never configured a prompt keeps
 * whatever settings.json already had rather than losing it.
 */
async function buildMainPrompt(
  workspace: WorkspaceChatbotSource,
  current: string | undefined
): Promise<string | undefined> {
  if (!workspace.customChatbotSystemPrompt?.trim()) return current
  if (!workspace.id) return current

  const faqs = await prisma.fAQ.findMany({
    where: { workspaceId: workspace.id, isActive: true },
    orderBy: { order: "asc" },
    select: { question: true, answer: true },
  })
  const faqsText = faqs.length > 0 ? faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n") : ""

  const variables = {
    ...VARIABLE_DEFAULTS,
    companyName: workspace.name || VARIABLE_DEFAULTS.companyName,
    chatbotName: workspace.chatbotName || VARIABLE_DEFAULTS.chatbotName,
    humanSupportInstructions: workspace.humanSupportInstructions || "",
    toneOfVoice: workspace.toneOfVoice || VARIABLE_DEFAULTS.toneOfVoice,
    address: workspace.address || "",
    businessType: workspace.businessType || VARIABLE_DEFAULTS.businessType,
    currency: workspace.currency || VARIABLE_DEFAULTS.currency,
    websiteUrl: workspace.websiteUrl || workspace.url || VARIABLE_DEFAULTS.websiteUrl,
    adminEmail: workspace.whatsappSettings?.adminEmail || "",
    whatsappNumber: workspace.whatsappPhoneNumber || "",
    allowedExternalLinks: workspace.allowedExternalLinks?.join("\n") || "",
    termsAndConditions: workspace.termsAndConditions || "",
    faqs: faqsText,
  } as PromptVariables

  return promptProcessor.processWithVariables(workspace.customChatbotSystemPrompt, variables)
}

// Workspace-level {{variables}} in customer copy are resolved by the shared
// renderWorkspaceCopy (see workspace-copy.render.ts for the full story —
// Andrea 2026-08-17, the {{chatbotName}} that reached a customer verbatim).
// This service applies it inside buildChatbotSettingsJson, which the host
// resolves per turn, so it covers both the serve path and the settings.json
// regeneration with one implementation.

/**
 * Builds the runtime config: the module's current settings.json, with every
 * value the user set in the Settings UI layered on top.
 *
 * Null/empty DB values fall through to the file rather than writing blanks the
 * agent would then have to defend against.
 */
export async function buildChatbotSettingsJson(
  workspace: WorkspaceChatbotSource
): Promise<ChatbotSettingsJson | null> {
  if (!workspace.customChatbotId) return null

  const raw = await readFile(settingsPath(workspace.customChatbotId), "utf8")
  const current = JSON.parse(raw) as ChatbotSettingsJson

  const audioVoices = normaliseAudioVoices(workspace.audioVoices)
  const advancedSettings = normaliseAdvancedSettings(workspace.customChatbotAdvancedSettings)
  const mainPrompt = await buildMainPrompt(workspace, current.mainPrompt)
  // Resolved BY PROPERTY from the DB (Flow.isProtected — CONTRACT.md rule 13
  // defines the Human Support flow as the protected one), never trusted to a
  // pinned id in a committed file: the id in settings.json goes stale the
  // moment the flow is recreated, and the whole technical hand-over order
  // silently degrades when it is missing (see human-support-flow.resolve.ts).
  // An explicit advancedSettings override still wins via the spread below.
  const humanSupportFlowId = workspace.id
    ? await resolveHumanSupportFlowId(prisma, workspace.id)
    : null

  return {
    ...current,
    ...(humanSupportFlowId ? { humanSupportFlowId } : {}),
    ...advancedSettings,
    mainPrompt,
    model: workspace.customChatbotModel?.trim() || current.model,
    temperature:
      typeof workspace.customChatbotTemperature === "number"
        ? workspace.customChatbotTemperature
        : current.temperature,
    maxTokens:
      typeof workspace.customChatbotMaxTokens === "number" && workspace.customChatbotMaxTokens > 0
        ? workspace.customChatbotMaxTokens
        : current.maxTokens,
    // Escalation email: the chatbot-specific override wins, then the general
    // Human Support address, then whatever the module shipped with.
    operatorEmail:
      workspace.customChatbotOperatorEmail?.trim() ||
      workspace.operatorEmail?.trim() ||
      current.operatorEmail,
    // Under 'custom' the module owns routing, so the lists are emitted empty
    // rather than carrying stale addresses the module must know to ignore.
    operatorDeliveryMode: workspace.operatorDeliveryMode || "all",
    operatorEmails:
      workspace.operatorDeliveryMode === "custom" ? [] : workspace.operatorEmails ?? [],
    operatorWhatsappNumbers:
      workspace.operatorDeliveryMode === "custom" ? [] : workspace.operatorWhatsappNumbers ?? [],
    emailFrom: workspace.customChatbotEmailFrom?.trim() || current.emailFrom,
    emailSubjectPrefix:
      workspace.customChatbotEmailSubjectPrefix?.trim() || current.emailSubjectPrefix,
    operatorBriefingLanguage:
      workspace.defaultLanguage?.trim() || current.operatorBriefingLanguage,
    defaultLanguage: workspace.defaultLanguage?.trim() || current.defaultLanguage,
    enabledLanguages:
      workspace.enabledLanguages && workspace.enabledLanguages.length > 0
        ? workspace.enabledLanguages
        : current.enabledLanguages,
    audioOutput:
      typeof workspace.audioOutput === "boolean" ? workspace.audioOutput : current.audioOutput,
    // Written only when a real value exists: every UI save provides the DB
    // boolean, so the key lands in the file then — but a module that never
    // configured it keeps its file untouched (backwards compatible).
    ...(typeof workspace.speechToTextEnabled === "boolean" ||
    typeof current.speechToTextEnabled === "boolean"
      ? {
          speechToTextEnabled:
            typeof workspace.speechToTextEnabled === "boolean"
              ? workspace.speechToTextEnabled
              : current.speechToTextEnabled,
        }
      : {}),
    audioVoices: audioVoices ?? current.audioVoices,
    welcomeMessage: renderWorkspaceCopy(
      workspace.welcomeMessage?.trim() || current.welcomeMessage,
      workspace
    ),
    welcomeBackMessage: renderWorkspaceCopy(
      workspace.welcomeBackMessage?.trim() || current.welcomeBackMessage,
      workspace
    ),
    humanSupportMessage: renderWorkspaceCopy(
      workspace.humanSupportMessage?.trim() || current.humanSupportMessage,
      workspace
    ),
  }
}

/**
 * Rewrites `custom-<module>/settings.json` from the saved workspace row.
 *
 * The database stays authoritative — this mirrors it to the file the module
 * already reads. On Heroku the write is reverted by the next deploy (the file
 * is in git), which is harmless: the next save regenerates it, and no
 * configuration is ever lost because it all lives in the database.
 *
 * Never throws: a settings save must not fail because of a filesystem problem.
 */
export async function writeChatbotSettingsJson(
  workspace: WorkspaceChatbotSource
): Promise<void> {
  if (!workspace.customChatbotId) return

  try {
    const settings = await buildChatbotSettingsJson(workspace)
    if (!settings) return

    const target = settingsPath(workspace.customChatbotId)
    await writeFile(target, JSON.stringify(settings, null, 2) + "\n", "utf8")
    logger.info(`[ChatbotSettings] Regenerated ${target}`)
  } catch (err) {
    logger.warn(
      `[ChatbotSettings] Could not write settings for "${workspace.customChatbotId}" ` +
        `(database values are saved and remain authoritative):`,
      err
    )
  }
}
