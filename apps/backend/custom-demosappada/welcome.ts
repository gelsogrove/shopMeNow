// The opening of a conversation: the tenant's welcome (translated once and
// cached), the presentation video, and the placeholders the host has not
// already resolved. The greeting is prepended by CODE — see withWelcome.

import type { Settings } from './agent.js'
import { callLLM } from './llm.js'
import { stripLeadingGreeting } from './language-guards.js'

/**
 * Prepend the welcome (and, on a brand-new conversation, the presentation
 * video) to a reply that does not already carry it.
 *
 * This is CODE, not another sentence in the prompt, because the prompt lost.
 * The model can hold "greet on the first turn", "call get_weather" and "answer
 * with real proposals" — but not all three at once: reinforcing any one of
 * them made it drop another, turn after turn (Andrea, 2026-08-23: "al welcome
 * non lo vedo"). The greeting is a fixed string in a fixed place, so it
 * belongs to the mechanism; only the ANSWER needs a model.
 *
 * The intro line before the video is written here in the reply's own language,
 * so a message never mixes two languages.
 */
const VIDEO_INTRO: Record<string, string> = {
  it: 'Prima di iniziare, ecco una breve presentazione 👇',
  en: 'Before we start, here is a short presentation 👇',
  de: 'Bevor wir beginnen, hier eine kurze Vorstellung 👇',
  es: 'Antes de empezar, aquí tienes una breve presentación 👇',
  fr: 'Avant de commencer, voici une brève présentation 👇',
}

/**
 * Translations of the tenant's welcome, keyed by `lang:text`.
 *
 * The welcome is authored once, in one language (CLAUDE.md §1A — no
 * pre-translated copy in code), but it is prepended by CODE, so nothing
 * translates it on the way out: an Austrian guest got the Italian welcome on
 * top of a German reply (live check, 2026-08-23). One isolated call fixes it,
 * and the cache means a tenant pays for it once per language for the life of
 * the process, not once per guest.
 */
const welcomeTranslations = new Map<string, string>()

export async function translateWelcome(
  text: string,
  language: string,
  settings: Settings,
): Promise<string> {
  const key = `${language}:${text}`
  const cached = welcomeTranslations.get(key)
  if (cached) return cached
  const translated = await translateText(text, language, settings)
  if (translated !== text) welcomeTranslations.set(key, translated)
  return translated
}

/**
 * Translate a reply into the language the model itself declared.
 *
 * The model reliably KNOWS the language — it emits ⟦LANG:es⟧ correctly — and
 * then writes the answer in the workspace default anyway. Asking it more
 * firmly in the prompt did not change that (2026-08-23: a Spanish "hola qué
 * hago hoy" answered in Italian, tagged es). So the mismatch is repaired
 * afterwards, by code, instead of being hoped away.
 */
export async function translateText(
  text: string,
  language: string,
  settings: Settings,
): Promise<string> {
  try {
    const result = await callLLM(
      [
        {
          role: 'system',
          content:
            `Translate the user message into the language with ISO 639-1 code "${language}". ` +
            'Keep the tone, the emoji and the Markdown exactly as they are. If it is already in that ' +
            'language, return it unchanged. Output ONLY the translation — no preamble, no quotes.',
        },
        { role: 'user', content: text },
      ],
      { ...settings, maxTokens: 600 },
      [],
    )
    return result.content.trim() || text
  } catch {
    // A reply in the wrong language beats no reply at all.
    return text
  }
}

/**
 * Substitute the per-customer placeholders in tenant copy.
 *
 * The host does this for the strings IT sends, but the greeting is prepended
 * by this module, so nothing had resolved it: "Bentornato {{customerName}}!"
 * reached a guest verbatim (live check, 2026-08-23). With no name known the
 * placeholder is removed rather than left or filled with a stand-in — a
 * greeting addressed to nobody still reads fine, one addressed to
 * "{{customerName}}" does not.
 */
export function substitutePlaceholders(text: string, customerName: string | undefined): string {
  const name = customerName?.trim()
  if (name) return text.replace(/\{\{\s*customerName\s*\}\}/gi, name)
  return text
    .replace(/[ \t]*\{\{\s*customerName\s*\}\}[ \t]*/gi, ' ')
    .replace(/\s+([,!?.])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export async function withWelcome(
  reply: string,
  welcomeText: string | undefined,
  videoUrl: string | undefined,
  language: string | undefined,
  settings: Settings,
  customerName: string | undefined,
  /**
   * The intake question due on this turn, already in the guest's language.
   *
   * The welcome may place it with {{firstQuestion}}, so the whole opening
   * message — greeting, video, first question — is edited in ONE field in the
   * backoffice (Andrea, 2026-08-25). It is still the machine that decides
   * WHICH question that is, so it stays tracked as asked; the tenant only
   * decides where it sits.
   */
  firstQuestion?: string,
): Promise<string> {
  const welcome = substitutePlaceholders(welcomeText?.trim() ?? '', customerName)
  if (!welcome) return reply

  // The model was told not to greet, and greeted anyway — so the greeting it
  // wrote is REMOVED rather than the configured one skipped.
  //
  // Comparing the two texts does not work: the model paraphrases ("Ciao! Sono
  // l'assistente della Pro Loco di Sappada") and no substring of the tenant's
  // welcome appears in it, so the guard passed and the guest read two
  // different welcomes in a row (Andrea, 2026-08-23). What identifies a
  // greeting is its SHAPE — an opening line that introduces the assistant and
  // asks nothing — not its wording, and the shape is something code can find.
  const stripped = stripLeadingGreeting(reply)
  const body = stripped.trim() ? stripped : reply

  const lang = (language || settings.defaultLanguage || 'it').toLowerCase()
  const sourceLang = (settings.defaultLanguage || 'it').toLowerCase()
  const translated =
    lang === sourceLang ? welcome : await translateWelcome(welcome, lang, settings)

  // {{firstQuestion}} — the tenant decides WHERE the opening question sits;
  // the intake machine decides WHICH one it is. With no question due (a
  // returning guest whose profile is complete) the placeholder collapses,
  // taking its blank line with it rather than leaving a hole.
  const QUESTION_SLOT = /\n?[ \t]*\{\{\s*firstQuestion\s*\}\}[ \t]*/gi
  const hasSlot = QUESTION_SLOT.test(translated)
  QUESTION_SLOT.lastIndex = 0
  const greeting = hasSlot
    ? translated.replace(QUESTION_SLOT, firstQuestion?.trim() ? `\n${firstQuestion.trim()}` : '')
    : translated

  const parts = [greeting]
  const video = videoUrl?.trim()
  if (video && !reply.includes(video)) {
    parts.push('', VIDEO_INTRO[lang] ?? VIDEO_INTRO.it, video)
  }
  parts.push('', body)
  return parts.join('\n')
}
