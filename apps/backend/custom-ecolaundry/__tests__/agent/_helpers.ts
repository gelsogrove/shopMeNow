// Test helpers for agent acceptance tests.
// Concept-based assertions: we check ideas, not exact wording.

import { createAgentSession, agentTurn, type AgentSession } from '../../agent.js'

export interface TestCase {
  name: string
  // Pre-conditions or fixture setup if needed (none for now)
  run: (ctx: TestContext) => Promise<void>
}

export interface TestContext {
  session: AgentSession
  /** Send a message, return the bot reply (and store it in lastReply). */
  send: (msg: string) => Promise<string>
  /** Last reply received from the bot. */
  lastReply: string
  /** Accumulated dialog (for diagnostics on failure). */
  dialog: Array<{ user: string; bot: string }>
}

export async function runTest(tc: TestCase): Promise<{ ok: boolean; reason?: string; dialog: Array<{ user: string; bot: string }> }> {
  const session = await createAgentSession()
  // Force the LLM-polish opt-in flags OFF for the test suite. Decision
  // (Andrea, 2026-05-10): tests assert the deterministic content of guard
  // outcomes and the operator briefing. The settings.json file may have
  // these flags ON for production / CLI demo, but the test runner must
  // override them so assertions stay reliable. See CLAUDE.md "Test
  // deterministic vs production polished".
  if (session.ar.runtime.settings) {
    ;(session.ar.runtime.settings as Record<string, unknown>).naturalRephrase = false
    ;(session.ar.runtime.settings as Record<string, unknown>).operatorBriefingFromLlm = false
  }
  const ctx: TestContext = {
    session,
    lastReply: '',
    dialog: [],
    send: async (msg: string) => {
      const reply = await agentTurn(session, msg)
      ctx.lastReply = reply
      ctx.dialog.push({ user: msg, bot: reply })
      return reply
    },
  }

  try {
    await tc.run(ctx)
    return { ok: true, dialog: ctx.dialog }
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
      dialog: ctx.dialog,
    }
  }
}

// ── Normalisation ─────────────────────────────────────────────────────────────

export function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Concept-based assertions ──────────────────────────────────────────────────

/**
 * Assert that the reply is in a specific language.
 * Uses simple word-fingerprint heuristics. Loose: it counts unique markers.
 */
export function expectInLanguage(reply: string, lang: 'es' | 'it' | 'en' | 'ca' | 'pt' | 'fr'): void {
  const n = norm(reply)
  // Discriminative markers: words that are unique-ish to one language so we
  // do not confuse "lavanderia" (it/es/pt all share variants).
  const markers = {
    es: ['¿', 'donde esta', 'donde estas', 'pantalla', 'que aparece', 'lavanderia esta', 'soy eco', 'asistente virtual de ecolaundry'],
    it: ['dove si trova', 'lavatrice', 'asciugatrice', 'tranquillo', 'ciao!', 'aiuto', "l'assistente virtuale", 'sono eco'],
    en: ['where is the', 'laundry?', 'machine?', 'washer', 'dryer', "don't worry", "i'll help", "i'm eco", 'tell me'],
    ca: ['on esta', 'bugaderia', 'rentadora', 'assecadora', "t'ajudo", 'tranquil,', "soc eco", "l'assistent virtual"],
    pt: ['lavandaria', 'sou eco', 'o assistente virtual da ecolaundry', 'ajudo-te', 'em que lavandaria', 'maquina nao', 'voce'],
    fr: ['laverie', "lave-linge", "seche-linge", "j'aide", "es-tu", "pas de souci", "je suis eco", "l'assistant virtuel"],
  } as const
  const counts = Object.fromEntries(
    Object.entries(markers).map(([l, words]) => [
      l,
      words.filter((w) => n.includes(w)).length,
    ]),
  ) as Record<string, number>

  // Priority: a language with at least 1 distinctive marker wins over a
  // language with no markers, even if there is overlap (es and pt share
  // many words).
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  if (top[0] !== lang) {
    throw new Error(
      `expected reply in '${lang}', detected '${top[0]}' (counts=${JSON.stringify(counts)})\nReply: ${reply}`,
    )
  }
}

/**
 * Assert that the reply asks for the laundry location.
 * Loose: any combination of "where/dove/donde" + "laundry/lavanderia/lavandería/bugaderia/laverie/lavandaria".
 */
export function expectAsksForLocation(reply: string): void {
  const n = norm(reply)
  // The ES canonical location question "¿En qué lavandería estás?" lacks
  // "donde" — accept "en que" + laundry-word as an equivalent where-signal.
  const whereWord =
    /\b(donde|dove|where|on|onde|ou)\b/.test(n) || n.includes('en que')
  const laundryWord = /\b(lavanderia|laundry|bugaderia|laverie|lavandaria)\b/.test(n)
  if (!(whereWord && laundryWord)) {
    throw new Error(`expected a question asking for the laundry location.\nReply: ${reply}`)
  }
}

/**
 * Assert that the reply asks for the street within Mataró.
 */
export function expectAsksForMataroStreet(reply: string): void {
  const n = norm(reply)
  const hasMataro = n.includes('mataro')
  const hasStreetWord = /\b(calle|via|carrer|street|rua|rue)\b/.test(n)
  if (!(hasMataro && hasStreetWord)) {
    throw new Error(`expected the bot to ask for the street within Mataró.\nReply: ${reply}`)
  }
}

/**
 * Assert that the reply asks for the machine type (washer or dryer).
 */
export function expectAsksForMachineType(reply: string): void {
  const n = norm(reply)
  const has = /\b(lavadora|lavatrice|washer|rentadora|secadora|asciugatrice|dryer|assecadora)\b/.test(n)
  const hasOr = /\b(o|or)\b/.test(n)
  if (!(has && hasOr)) {
    throw new Error(`expected a question asking washer or dryer.\nReply: ${reply}`)
  }
}

/**
 * Assert that the reply asks for the machine number.
 */
export function expectAsksForMachineNumber(reply: string): void {
  const n = norm(reply)
  const has = /\b(numero|number|number of|number)\b/.test(n)
  if (!has) {
    throw new Error(`expected a question asking for the machine number.\nReply: ${reply}`)
  }
}

/**
 * Assert that the reply asks if payment was completed.
 */
export function expectAsksAboutPayment(reply: string): void {
  const n = norm(reply)
  const has = /\b(pagado|pagato|paid|pagaste|hai pagato|has pagado|payment|pago|pagat)\b/.test(n)
  if (!has) {
    throw new Error(`expected a question about payment.\nReply: ${reply}`)
  }
}

/**
 * Assert that the reply asks what the display shows.
 */
export function expectAsksAboutDisplay(reply: string): void {
  const n = norm(reply)
  const screenWord = /\b(pantalla|schermo|screen|display|ecra|ecran)\b/.test(n)
  const askWord = /\b(que|cosa|what|aparece|appare|shows|muestra|indica)\b/.test(n)
  if (!(screenWord && askWord)) {
    throw new Error(`expected a question about the display.\nReply: ${reply}`)
  }
}

/**
 * Assert that the reply asks if the central returned change.
 */
export function expectAsksAboutChange(reply: string): void {
  const n = norm(reply)
  const has = /\b(cambio|resto|change)\b/.test(n)
  const ret = /\b(devuelto|restituito|returned|reso|tornat)\b/.test(n)
  if (!(has && ret)) {
    throw new Error(`expected a question about whether the central returned change.\nReply: ${reply}`)
  }
}

/**
 * Assert that the reply contains a warm greeting (welcome message).
 * Loose: looks for chatbot name OR canonical greeting words.
 */
export function expectWelcome(reply: string): void {
  const n = norm(reply)
  const hasGreet = /\b(hola|ciao|hi|hello|ola|bonjour)\b/.test(n)
  const hasIntro = /\b(eco|ecolaundry|asistente|assistente|assistant)\b/.test(n)
  if (!(hasGreet && hasIntro)) {
    throw new Error(`expected a warm welcome (greeting + chatbot intro).\nReply: ${reply}`)
  }
}

/**
 * Assert that the reply does NOT contain a welcome greeting (turn 2+).
 */
export function expectNoWelcome(reply: string): void {
  const n = norm(reply)
  const hasIntro = /\b(soy eco|sono eco|i'm eco|im eco|ecolaundry virtual|asistente virtual de ecolaundry|assistente virtuale di ecolaundry)\b/.test(n)
  if (hasIntro) {
    throw new Error(`expected NO welcome on this turn.\nReply: ${reply}`)
  }
}

/**
 * Assert that the reply contains a loopback question (asks if it works now).
 */
export function expectLoopback(reply: string): void {
  const n = norm(reply)
  const ifWord = /\b(si|if|se)\b/.test(n)
  const works = /\b(funciona|funziona|works|empieza|inizia|parte|arranca|starts)\b/.test(n)
  const ask = /\b(dime|dimmi|tell me|dis-moi|dize-me|digues)\b/.test(n) || /\?/.test(reply)
  if (!(ifWord && works && ask)) {
    throw new Error(`expected a loopback question (asks if it works now).\nReply: ${reply}`)
  }
}

/**
 * Assert escalation message is present.
 */
export function expectEscalation(reply: string): void {
  const n = norm(reply)
  const has = /\b(operador|operatore|operator|revisar|revisione|review|revisarlo|revisione manuale|manual review|revis|human support)\b/.test(n)
  if (!has) {
    throw new Error(`expected an escalation/manual-review message.\nReply: ${reply}`)
  }
}

/**
 * Assert NO escalation message.
 */
export function expectNoEscalation(reply: string): void {
  const n = norm(reply)
  const has = /\b(operador|operatore|operator|human support)\b/.test(n)
  if (has) {
    throw new Error(`expected NO escalation but found one.\nReply: ${reply}`)
  }
}

/**
 * Assert state has the given facts (after a turn).
 */
export function expectStateHas(session: AgentSession, expected: Record<string, unknown>): void {
  const state = session.ar.state as unknown as Record<string, unknown>
  const wrong: string[] = []
  for (const [k, v] of Object.entries(expected)) {
    if (state[k] !== v) wrong.push(`${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(state[k])}`)
  }
  if (wrong.length) {
    throw new Error(`state mismatch:\n  ${wrong.join('\n  ')}`)
  }
}

/**
 * Assert reply contains all of the given tokens (case-insensitive, accent-insensitive).
 */
export function expectMentionsAll(reply: string, tokens: string[]): void {
  const n = norm(reply)
  const missing = tokens.filter((t) => !n.includes(norm(t)))
  if (missing.length) {
    throw new Error(`expected reply to mention all of: ${tokens.join(', ')}\nMissing: ${missing.join(', ')}\nReply: ${reply}`)
  }
}

/**
 * Assert reply does NOT contain any of the given tokens.
 */
export function expectMentionsNone(reply: string, tokens: string[]): void {
  const n = norm(reply)
  const found = tokens.filter((t) => n.includes(norm(t)))
  if (found.length) {
    throw new Error(`expected reply to mention NONE of: ${tokens.join(', ')}\nFound: ${found.join(', ')}\nReply: ${reply}`)
  }
}
