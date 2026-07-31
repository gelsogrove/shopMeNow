/**
 * Chatbot settings.json generator
 *
 * Andrea 2026-07-31: when a workspace is saved from the Settings UI, the values
 * live in the database (source of truth — Heroku's filesystem is ephemeral, so
 * a file could never be one). This service renders the subset of those values
 * that the custom chatbot module actually consumes at runtime into the exact
 * shape of `custom-<module>/settings.json`.
 *
 * Deliberately EXCLUDED: anything the runtime never reads — widget look & feel
 * (colors, icon, title, quick replies), WhatsApp provider credentials, calendar
 * reminders, billing. Those are platform concerns, not chatbot config.
 *
 * The file on disk stays in git as the DEFAULT: values missing from the DB fall
 * back to it, so an unconfigured workspace behaves exactly as before.
 */
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
}

/** Workspace fields this generator reads. Kept narrow on purpose. */
export interface WorkspaceChatbotSource {
  customChatbotId?: string | null
  customChatbotModel?: string | null
  customChatbotTemperature?: number | null
  operatorEmail?: string | null
  defaultLanguage?: string | null
}

function moduleDir(customChatbotId: string): string {
  return path.join(__dirname, "..", "..", "..", `custom-${customChatbotId}`)
}

/**
 * Reads the module's committed settings.json — the defaults every generated
 * config is layered on top of. Throws if absent: per CLAUDE.md §1 there is no
 * hardcoded fallback, a missing module file is a real error.
 */
async function readModuleDefaults(customChatbotId: string): Promise<ChatbotSettingsJson> {
  const file = path.join(moduleDir(customChatbotId), "settings.json")
  const raw = await readFile(file, "utf8")
  return JSON.parse(raw) as ChatbotSettingsJson
}

/**
 * Builds the runtime config for a workspace: module defaults, with every value
 * the user has actually set in the Settings UI layered on top.
 *
 * Null/empty DB values intentionally fall through to the module default rather
 * than writing empty strings the agent would then have to defend against.
 */
export async function buildChatbotSettingsJson(
  workspace: WorkspaceChatbotSource
): Promise<ChatbotSettingsJson | null> {
  if (!workspace.customChatbotId) return null

  const defaults = await readModuleDefaults(workspace.customChatbotId)

  return {
    ...defaults,
    model: workspace.customChatbotModel?.trim() || defaults.model,
    temperature:
      typeof workspace.customChatbotTemperature === "number"
        ? workspace.customChatbotTemperature
        : defaults.temperature,
    operatorEmail: workspace.operatorEmail?.trim() || defaults.operatorEmail,
    operatorBriefingLanguage:
      workspace.defaultLanguage?.trim() || defaults.operatorBriefingLanguage,
  }
}

/**
 * Writes the generated config next to the module as `settings.generated.json`.
 *
 * The committed `settings.json` is never overwritten — it is the default layer
 * and belongs to git. On Heroku this written file disappears on the next dyno
 * restart, which is harmless: the database remains the source of truth and the
 * file is regenerated on the following save. Failures are logged, never thrown:
 * a settings save must not fail because of a filesystem quirk.
 */
export async function writeChatbotSettingsJson(
  workspace: WorkspaceChatbotSource
): Promise<void> {
  if (!workspace.customChatbotId) return

  try {
    const settings = await buildChatbotSettingsJson(workspace)
    if (!settings) return

    const target = path.join(moduleDir(workspace.customChatbotId), "settings.generated.json")
    await writeFile(target, JSON.stringify(settings, null, 2) + "\n", "utf8")
    logger.info(`[ChatbotSettings] Wrote ${target}`)
  } catch (err) {
    logger.warn(
      `[ChatbotSettings] Could not write settings for "${workspace.customChatbotId}" ` +
        `(database values are saved and remain authoritative):`,
      err
    )
  }
}
