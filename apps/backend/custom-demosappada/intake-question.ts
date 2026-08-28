// How the dictated intake question is RENDERED for this guest: the tenant's
// wording, in the guest's language, minus the parts the guest has already
// answered.
//
// The machine (intake-machine.ts) decides WHICH question is due and the
// tenant's settings decide its wording — but a wording can bundle more than
// one fact ("qualcosa da segnalarci? senza macchina? bambini o anziani?"),
// and a guest who has just said "siamo senza macchina" was read the whole
// sentence back, "senza macchina" included (Andrea, 2026-08-28: "questo è il
// minimo che un utente si aspetta da un chatbot").
//
// Division of labour, as everywhere in this module: the code splits the
// question into sentences and lists the facts the profile holds; the model
// only says WHICH sentence a WHICH fact answers (JSON, nothing free-form);
// the code deletes those sentences and translates the rest. The code reads
// no meaning (CLAUDE.md §14), the model writes no words: it cannot rephrase,
// decorate, or drop a sentence without naming the fact that answers it.
// Anything malformed drops nothing — the wording goes out as the tenant
// wrote it, so the intake never loses a question.

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
 * The question split into its sentences, delimiters kept. "A? B? C?" → three
 * items. Shape only, holds in every language.
 */
export function splitSentences(question: string): string[] {
  return (question.match(/[^?!.]+[?!.]*/g) ?? []).map((s) => s.trim()).filter(Boolean)
}

/**
 * What the model may say: which sentences to drop, each bound to the fact
 * that answers it. Parsed strictly — anything malformed drops NOTHING.
 */
export function parseDrops(raw: string, sentenceCount: number, factCount: number): number[] {
  try {
    const json = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const arr = JSON.parse(json)
    if (!Array.isArray(arr)) return []
    const out = new Set<number>()
    for (const item of arr) {
      const sentence = Number(item?.sentence)
      const fact = Number(item?.fact)
      if (!Number.isInteger(sentence) || !Number.isInteger(fact)) continue
      if (sentence < 1 || sentence > sentenceCount) continue
      if (fact < 1 || fact > factCount) continue
      out.add(sentence)
    }
    return [...out].sort((a, b) => a - b)
  } catch {
    return []
  }
}

/**
 * The question as it goes out.
 *
 * Facts known → ONE model call that returns, as JSON, the sentences to drop
 * and the fact answering each — the model never rewrites a word. The code
 * deletes exactly those sentences (a drop not bound to a listed fact is
 * ignored; dropping everything is refused) and only THEN translates, through
 * the same cached path as before. The first version let the model rewrite
 * the question freely and gpt-4o-mini deleted "Sarete senza macchina?" with
 * nothing about a car known, and decorated with emoji (sim, 2026-08-28) —
 * so the model now chooses, and the code edits.
 *
 * No facts known → the plain translation, no extra call, behaviour unchanged.
 */
export async function renderIntakeQuestion(
  question: string,
  profile: StayProfile | null | undefined,
  language: string | null | undefined,
  needsTranslation: boolean,
  settings: Settings,
): Promise<string> {
  const translate = async (text: string): Promise<string> =>
    needsTranslation && language ? translateWelcome(text, language, settings) : text
  const facts = knownFacts(profile)
  const sentences = splitSentences(question)
  if (facts.length === 0 || sentences.length < 2) return translate(question)

  try {
    const result = await callLLM(
      [
        {
          role: 'system',
          content:
            'A question for a guest is split into numbered sentences. The guest has ALREADY told us ' +
            'the numbered facts below. Return ONLY a JSON array of the sentences that a listed fact ' +
            'fully answers, each as {"sentence": n, "fact": m}. A sentence stays unless a fact ' +
            'answers exactly what it asks. Never bind a sentence to a fact about something else. ' +
            'Empty array [] when nothing is answered.\n\nFACTS:\n' +
            facts.map((f, i) => `${i + 1}. ${f}`).join('\n'),
        },
        {
          role: 'user',
          content: 'SENTENCES:\n' + sentences.map((s, i) => `${i + 1}. ${s}`).join('\n'),
        },
      ],
      { ...settings, maxTokens: 200 },
      [],
    )
    const drops = parseDrops(result.content, sentences.length, facts.length)
    if (drops.length > 0 && drops.length < sentences.length) {
      const kept = sentences.filter((_, i) => !drops.includes(i + 1)).join(' ')
      // eslint-disable-next-line no-console
      console.error(`[demosappada][question-render] dropped sentences ${drops.join(',')} of "${question.slice(0, 60)}"`)
      return translate(kept)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[demosappada][question-render] failed — plain wording used', err)
  }
  return translate(question)
}
