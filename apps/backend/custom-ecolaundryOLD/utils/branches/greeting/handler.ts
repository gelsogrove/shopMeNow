// Greeting branch handler.
//
// When the router classifies the customer's first message as a pure
// greeting, this handler emits the welcome message + a NEUTRAL open
// question that does NOT presume a machine incident. The customer is
// then free on the next turn to ask a FAQ, report a problem, request an
// invoice, etc.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { SupportedLanguage } from '../../../models/index.js'
import { pickLang, type BranchHandler, type BranchI18n } from '../types.js'

interface GreetingStrings {
  openQuestion: string
}

// Load per-language strings at module load (sync, one-time cost).
// JSON `with { type: 'json' }` import attributes require a newer TS
// `module` setting than the project uses; we use the readFileSync pattern
// that runtime.ts uses for flows / locations / faqs / settings.
const HERE = path.dirname(fileURLToPath(import.meta.url))
function loadLang(lang: string): GreetingStrings {
  return JSON.parse(readFileSync(path.join(HERE, `${lang}.json`), 'utf8')) as GreetingStrings
}

const I18N: BranchI18n<GreetingStrings> = {
  es: loadLang('es'),
  it: loadLang('it'),
  en: loadLang('en'),
  ca: loadLang('ca'),
  pt: loadLang('pt'),
  fr: loadLang('fr'),
}

export const greetingHandler: BranchHandler = async ({ ar, language }) => {
  // OUTPUT language: tenant lock takes precedence over input language.
  // Today Ecolaundry is ES-only, so the bot replies in ES even if the
  // customer wrote in IT. The structure already supports per-language
  // output for the future: when settings.enabledLanguages opens up, the
  // pickLang call below will respect the customer's input language.
  const tenantLang = pickOutputLanguage(ar, language)
  const strings = pickLang(I18N, tenantLang)

  // The welcome paragraph is prepended by agent.ts:polishReplyForTurn at
  // T1 (renderWelcomeForTurn). The handler returns ONLY the open question
  // body; the welcome is added by the post-processor.
  return {
    reply: strings.openQuestion,
    // Greeting branch does not "stick" — after T1 the customer's next
    // message will be classified anew (it could be a FAQ, trouble, etc.).
    handoff: 'topic-switch',
  }
}

function pickOutputLanguage(
  ar: { runtime: { settings?: { enabledLanguages?: SupportedLanguage[] ; defaultLanguage?: SupportedLanguage } } },
  inputLang: SupportedLanguage,
): SupportedLanguage {
  const enabled = ar.runtime.settings?.enabledLanguages ?? []
  const fallback = ar.runtime.settings?.defaultLanguage ?? 'es'
  return enabled.includes(inputLang) ? inputLang : fallback
}
