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
 * Keys the UI does not expose (maxToolHops, rate limits, similarityThreshold…)
 * are preserved from the file as-is: the generator merges onto what is there,
 * it never rewrites the file from scratch.
 */
import { existsSync } from "fs"
import { readFile, writeFile } from "fs/promises"
import path from "path"
import logger from "../../utils/logger"

/** Shape consumed by custom-<module>/agent.ts. Mirrors its `Settings` type. */
export interface ChatbotSettingsJson {
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
  // Customer-facing copy, editable in the app. Rendered by the LLM in the
  // customer's language; {{customerName}} is substituted at runtime.
  /** Greeting for a customer we already know by name (returning visitor). */
  welcomeBackMessage?: string
  /** Sentence sent when the conversation is handed to a human operator. */
  humanSupportMessage?: string
}

/** Workspace fields this generator reads. Kept narrow on purpose. */
export interface WorkspaceChatbotSource {
  customChatbotId?: string | null
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
  audioOutput?: boolean | null
  audioVoices?: unknown
  welcomeBackMessage?: string | null
  humanSupportMessage?: string | null
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

  return {
    ...current,
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
    audioOutput:
      typeof workspace.audioOutput === "boolean" ? workspace.audioOutput : current.audioOutput,
    audioVoices: audioVoices ?? current.audioVoices,
    welcomeBackMessage:
      workspace.welcomeBackMessage?.trim() || current.welcomeBackMessage,
    humanSupportMessage:
      workspace.humanSupportMessage?.trim() || current.humanSupportMessage,
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
