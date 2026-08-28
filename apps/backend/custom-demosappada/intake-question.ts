// How the dictated intake question is RENDERED for this guest: the tenant's
// wording, in the guest's language, minus the parts the guest has already
// answered.
//
// The machine (intake-machine.ts) decides WHICH question is due and the
// tenant's settings decide its wording — but a wording can bundle more than
// one fact ("qualcosa da segnalarci? senza macchina? bambini o anziani?"),
// and a guest who has just said "siamo senza macchina" was read the whole
// sentence back, "senza macchina" included (Andrea, 2026-08-28: "questo è il
// minimo che un utente si aspetta da un chatbot"). So the question goes
// through ONE model call that translates it AND drops what is already known.
//
// Division of labour, as everywhere in this module: code owns which question,
// what is known, and whether the rendering is acceptable; the model owns the
// language. The code reads no meaning (CLAUDE.md §14): it lists the facts
// the profile holds and checks the SHAPE of what comes back. Anything that
// fails the shape check falls back to the plain translation — the wording
// as the tenant wrote it — so the intake never loses a question.

import type { Settings, StayProfile } from './agent.js'
import { callLLM } from './llm.js'
import { translateWelcome } from './welcome.js'

/**
 * The facts the profile already holds, one line each, for the model to
 * subtract from the question. Labels are instructions to the model, never
 * shown to the guest (§1B). Only fields a question could ask about again.
 */
export function knownFacts(profile: StayProfile | null | undefined): string[] {
  if (!profile) return []
  const facts: string[] = []
  const party: string[] = []
  if (profile.adults !== undefined) party.push(`${profile.adults} adulti`)
  if (profile.children !== undefined) party.push(`${profile.children} bambini`)
  if (profile.seniors !== undefined) party.push(`${profile.seniors} anziani`)
  if (party.length > 0) facts.push(`composizione del gruppo: ${party.join(', ')}`)
  if (profile.childrenAges) facts.push(`età dei bambini: ${profile.childrenAges}`)
  if (profile.departureDate) facts.push(`data di partenza: ${profile.departureDate}`)
  if (profile.constraints) facts.push(`vincoli/esigenze già dichiarati: ${profile.constraints}`)
  if (profile.interests) facts.push(`interessi già dichiarati: ${profile.interests}`)
  return facts
}

/**
 * Shape check on the rendering — the only judgement the code passes.
 * A rendering is usable when it is still a question, did not grow (the
 * model must subtract, never add), and did not collapse to nothing.
 */
export function renderingAcceptable(rendered: string, original: string): boolean {
  const r = rendered.trim()
  if (!r || !r.includes('?')) return false
  if (r.length > original.trim().length * 1.5 + 20) return false
  return true
}

/**
 * The question as it goes out. No known facts → the plain (cached)
 * translation, no extra call, behaviour unchanged. With facts known → one
 * model call that translates and trims, guarded by `renderingAcceptable`.
 */
export async function renderIntakeQuestion(
  question: string,
  profile: StayProfile | null | undefined,
  language: string | null | undefined,
  needsTranslation: boolean,
  settings: Settings,
): Promise<string> {
  const plain = async (): Promise<string> =>
    needsTranslation && language ? translateWelcome(question, language, settings) : question
  const facts = knownFacts(profile)
  if (facts.length === 0) return plain()

  try {
    const target = language || settings.defaultLanguage || 'it'
    const result = await callLLM(
      [
        {
          role: 'system',
          content:
            `You render ONE question for a guest, in the language with ISO 639-1 code "${target}". ` +
            'The question may ask several things at once. The guest has ALREADY told us:\n' +
            facts.map((f) => `- ${f}`).join('\n') +
            '\n\nRewrite the question so it asks ONLY what is still unknown: remove every part ' +
            'that the facts above already answer, keep everything else as it is, keep the tone ' +
            'and the emoji. Never add a new question, never mention the facts, never answer. ' +
            'Output ONLY the resulting question, no preamble, no quotes.',
        },
        { role: 'user', content: question },
      ],
      { ...settings, maxTokens: 300 },
      [],
    )
    const rendered = result.content.trim()
    if (renderingAcceptable(rendered, question)) return rendered
    // eslint-disable-next-line no-console
    console.error(`[demosappada][question-render] rejected "${rendered.slice(0, 80)}" — plain wording used`)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[demosappada][question-render] failed — plain wording used', err)
  }
  return plain()
}
