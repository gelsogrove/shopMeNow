// Step 1 of the turn — UNDERSTAND (docs/turn-design.md).
//
// The model reads the history, the guest card and the latest message and
// answers ONE forced tool call: an intent, the slots it can fill, the request
// the guest made. It cannot write prose. This file owns the tool's schema,
// the DETERMINISTIC capture that runs before the model (the net under it),
// and the guards that validate what the model returns — the same provenance
// rules the old `save_preferences` handler enforced, in one place, with no
// retry: a refused value is dropped and the intake asks for it.
//
// Nothing here reads the meaning of the guest's words (CLAUDE.md §14): the
// model does the reading; the code checks shapes and provenance.

import type { StayProfile } from './agent.js'
import { dateInDays, nextWeekdayDate } from './date-parse.js'
import { parseParty } from './party-parse.js'
import {
  isRuleOutOnly,
  membersAnchored,
  partyTotal,
  quoteAnchoredIn,
  rulesOutParty,
  withinQuoteAnchoredCap,
} from './provenance.js'

// ── Intents (the "commands" of the turn) ───────────────────────────────────

/**
 * What the guest is doing with this message. Decided by the model, used by
 * code: `request` triggers the answer call, everything else does not.
 *
 *   answer          → replying to our question (or volunteering facts)
 *   request         → asking for something: a place, a plan, an information
 *   chitchat        → greeting / thanks / small talk, nothing to serve
 *   opt_out         → does not want messages any more
 *   change_language → asks to switch language
 *   restart_stay    → says they are back for a new holiday
 */
export const INTENTS = ['answer', 'request', 'chitchat', 'opt_out', 'change_language', 'restart_stay'] as const
export type Intent = (typeof INTENTS)[number]

// ── The tool the model must call ───────────────────────────────────────────

export const UNDERSTAND_TOOL = {
  type: 'function',
  function: {
    name: 'understand',
    description:
      'Report what you understood from the conversation so far: the intent of the latest message, ' +
      'every stay fact you now know (from ANY earlier message too), and the request to serve, if any. ' +
      'Only facts the guest actually stated — never guess a number, a date or a name.',
    parameters: {
      type: 'object',
      properties: {
        intent: { type: 'string', enum: [...INTENTS] },
        request: {
          type: 'string',
          description:
            'What the guest asked for, in their own words, when intent is "request" — a place to sleep, ' +
            'where to eat, a walk, an information. Empty otherwise.',
        },
        language: { type: 'string', description: 'ISO 639-1 code of the language the guest writes in.' },
        slots: {
          type: 'object',
          description: 'Stay facts stated by the guest, anywhere in the conversation, not yet on the card.',
          properties: {
            presence: { type: 'string', enum: ['in_loco', 'planned', 'remote'] },
            adults: { type: 'integer' },
            children: { type: 'integer', description: '0 when the guest rules children out or names the whole party without any.' },
            seniors: { type: 'integer' },
            partySaidAs: { type: 'string', description: "The guest's exact words stating who is in the party." },
            partyMembers: {
              type: 'array',
              items: { type: 'string' },
              description: 'One entry per person counted, in the guest\'s words: ["io", "mio marito"].',
            },
            childrenAges: { type: 'string' },
            arrivalDate: { type: 'string', description: 'YYYY-MM-DD' },
            departureDate: { type: 'string', description: 'YYYY-MM-DD, computed from today when the guest says "5 giorni".' },
            dateSaidAs: { type: 'string', description: "The guest's exact words stating the dates." },
            constraints: { type: 'string', description: 'What limits them: intolerances, no car, mobility, a dog. Their words.' },
            interests: { type: 'string', description: 'What they want to do or see. Their words.' },
            origin: { type: 'string' },
            name: { type: 'string', description: 'Their first name, only if they said it.' },
            consent: { type: 'string', enum: ['granted', 'declined'], description: 'Their answer to the notifications question.' },
            itinerary: { type: 'string', enum: ['yes', 'no'], description: 'Their answer to the itinerary question.' },
            doneAlready: { type: 'string', description: 'Something they did or saw, with how it went.' },
          },
          additionalProperties: false,
        },
      },
      required: ['intent', 'slots'],
      additionalProperties: false,
    },
  },
} as const

// ── Context the guards need ────────────────────────────────────────────────

export interface UnderstandContext {
  message: string
  profile: StayProfile | null | undefined
  /** The intake question put to the guest this turn (from the machine), if any. */
  questionKey: string | null
  now: Date
  /** Languages the tenant enabled; anything else falls back to the default. */
  enabledLanguages?: string[]
  defaultLanguage?: string
}

export interface Understanding {
  intent: Intent
  request: string
  language: string | undefined
  /** Validated slot values, ready to merge into the profile. */
  slots: Partial<StayProfile>
  /** Consent answer, when given — recorded by code with the host handler. */
  consent: 'granted' | 'declined' | undefined
  /** The guest's first name, when they said it — kept on the customer, not the stay. */
  name: string | undefined
  /** What the model sent and the guards refused, for the log. */
  refused: string[]
}

// ── 0. Deterministic capture — the net under the model ─────────────────────

const PARTY_KEYS = new Set(['party', 'headcount', 'composition', 'constraints'])
const DATE_KEYS = new Set(['party', 'stay'])
const YES = /^(s[iì]|yes|ja|oui|ok|okay|certo|va bene)\.?!?$/i
const NO = /^(no|nein|non|nope)\.?!?$/i
// A negative that goes on ("no nessuna", "no grazie") is still a no.
const NO_LEADING = /^(no|nein|non|nope)\b/i

/**
 * Facts the code reads on its own from the latest message — numbers, named
 * people, weekdays, durations, bare yes/no answers to the question just put.
 * Runs BEFORE the model and never depends on it.
 */
export function deterministicSlots(ctx: UnderstandContext): Partial<StayProfile> & { consent?: 'granted' | 'declined' } {
  const out: Partial<StayProfile> & { consent?: 'granted' | 'declined' } = {}
  const { message, profile, questionKey, now } = ctx
  const verbatim = message.trim().slice(0, 200)
  if (!verbatim || message.includes('?')) return out

  // Party: digits, number-words, categories, "coppia", named people.
  const party = parseParty(message)
  const partyUnknown = profile?.adults === undefined && profile?.children === undefined && profile?.seniors === undefined
  if (party.enumerated && partyUnknown) {
    out.adults = party.adults ?? 0
    out.children = party.children ?? 0
    out.seniors = party.seniors ?? 0
  } else if (questionKey && PARTY_KEYS.has(questionKey)) {
    if (party.adults !== undefined && profile?.adults === undefined) out.adults = Math.min(99, party.adults)
    if (party.children !== undefined && profile?.children === undefined) out.children = Math.min(30, party.children)
    if (party.seniors !== undefined && profile?.seniors === undefined) out.seniors = Math.min(30, party.seniors)
    // "due adulti" with no child/senior word, or a plain "no": adults-only.
    const namedOthers = party.children !== undefined || party.seniors !== undefined
    const adultsOnly = party.adults !== undefined && !namedOthers && /\b(adul|erwa|volw|voks)/i.test(message)
    if ((adultsOnly || (rulesOutParty(verbatim) && !namedOthers)) && profile?.children === undefined) {
      out.children = 0
      out.seniors = 0
    }
  }

  // Dates: a weekday beats everything; a duration only when nothing is on file.
  const wd = nextWeekdayDate(message, now)
  if (wd && profile?.departureDate !== wd && (questionKey === null || DATE_KEYS.has(questionKey) || partyUnknown)) {
    out.departureDate = wd
  } else if (!wd && party.days !== undefined && !profile?.departureDate) {
    out.departureDate = dateInDays(party.days, now)
  }

  // Bare yes/no to the question just put — the §14 closed class.
  if (questionKey === 'location' && profile?.presence === undefined) {
    if (YES.test(verbatim)) out.presence = 'in_loco'
    else if (NO.test(verbatim)) out.presence = 'remote'
  }
  if (questionKey === 'consent' && !profile?.consentAsked) {
    out.consentAsked = true
    if (YES.test(verbatim)) out.consent = 'granted'
    else if (NO_LEADING.test(verbatim)) out.consent = 'declined'
  }
  // 'asked' is the offer having been put; the answer overwrites it.
  if (questionKey === 'itinerary' && (!profile?.itinerary || profile.itinerary === 'asked')) {
    if (YES.test(verbatim)) out.itinerary = 'yes'
    else if (NO_LEADING.test(verbatim)) out.itinerary = 'no'
  }

  // Free-text answers to their own question: the guest's whole sentence is
  // the value; the model reads the meaning when it recommends.
  // The guest's whole sentence is the value — a bare "si"/"no" included: to
  // "C'è qualcosa di particolare…?" a "no" says "nothing", and re-asking the
  // same words a second and third time is the loop the contract forbids
  // (sim, 2026-08-28: the constraints question three times in a row).
  if (questionKey === 'constraints' && !profile?.constraints) out.constraints = verbatim
  if (questionKey === 'interests' && !profile?.interests) out.interests = verbatim
  if (questionKey === 'childrenAges' && !profile?.childrenAges && /\d/.test(verbatim)) out.childrenAges = verbatim

  return out
}

// ── 1→2. Guards on what the model returned ─────────────────────────────────

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const int = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined
const ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * Validate the model's `understand` call against the guest's words and the
 * profile. Provenance rules, unchanged from the old handler:
 *   - party numbers need a number in the message, or enumerated members
 *     anchored one by one (≤ 3), or zeros on a turn that asked about the party;
 *   - dates need the guest's exact words (`dateSaidAs`) anchored in the
 *     message, or a turn that asked for the dates;
 *   - consent needs its question to have been put, unless the guest wrote a
 *     sentence;
 *   - a filled slot is never overwritten by a weaker source.
 * Refused values are listed, not retried.
 */
export function applyUnderstanding(raw: unknown, ctx: UnderstandContext): Understanding {
  const args = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const s = (args.slots && typeof args.slots === 'object' ? args.slots : {}) as Record<string, unknown>
  const { message, profile, questionKey } = ctx
  const refused: string[] = []
  const slots: Partial<StayProfile> = {}

  const intent: Intent = INTENTS.includes(args.intent as Intent) ? (args.intent as Intent) : 'answer'
  const request = intent === 'request' ? (str(args.request) ?? message.trim()) : ''

  // Language: only what the tenant enabled.
  let language = str(args.language)?.toLowerCase().slice(0, 2)
  if (language && ctx.enabledLanguages && !ctx.enabledLanguages.map((l) => l.toLowerCase()).includes(language)) {
    language = ctx.defaultLanguage?.toLowerCase()
  }

  // A greeting carries no facts: one or two words cannot state a party or a date.
  const statedFacts = message.trim().split(/\s+/).length >= 2

  // Party numbers with provenance.
  const probe = parseParty(message)
  const hasDigit = /\d/.test(message)
  const partyArgs = { adults: s.adults, children: s.children, seniors: s.seniors }
  const partyTurn = !!questionKey && PARTY_KEYS.has(questionKey)
  const anchored =
    probe.adults !== undefined ||
    probe.children !== undefined ||
    probe.seniors !== undefined ||
    hasDigit ||
    (quoteAnchoredIn(str(s.partySaidAs), message) &&
      withinQuoteAnchoredCap(partyArgs) &&
      membersAnchored(s.partyMembers, message) === partyTotal(partyArgs)) ||
    (partyTurn && isRuleOutOnly(partyArgs))
  // Numbers the card already holds are the model repeating itself, not a
  // claim to verify: dropped silently, never logged as refused.
  const same = (k: 'adults' | 'children' | 'seniors'): boolean => int(s[k]) !== undefined && int(s[k]) === profile?.[k]
  for (const k of ['adults', 'children', 'seniors'] as const) if (same(k)) delete s[k]
  const sentNumbers = int(s.adults) !== undefined || int(s.children) !== undefined || int(s.seniors) !== undefined
  // Per category: a number in the message anchors only the category it
  // was attached to. "siamo a Sappada con due bambini" carries the 2 for the
  // children; the adults the model added were a guess (sim, 2026-08-28).
  // A loose number/digit ("siamo in 3") or the enumerated/zero paths anchor
  // every category the model sends.
  const loose = hasDigit || (probe.adults !== undefined && !/\b(adul|erwa|volw|voks)/i.test(message))
  const fullyEnumerated = partyTotal(partyArgs) > 0 && membersAnchored(s.partyMembers, message) === partyTotal(partyArgs)
  const anyCategory = anchored && (loose || (partyTurn && isRuleOutOnly(partyArgs)) || fullyEnumerated)
  const acceptCategory = (k: 'adults' | 'children' | 'seniors'): boolean =>
    anyCategory || probe[k] !== undefined || (partyTurn && int(s[k]) === 0)
  if (sentNumbers && anchored && statedFacts) {
    let accepted = false
    for (const k of ['adults', 'children', 'seniors'] as const) {
      const v = int(s[k])
      if (v === undefined) continue
      if (acceptCategory(k)) {
        slots[k] = Math.min(k === 'adults' ? 99 : 30, v)
        accepted = true
      } else refused.push(k)
    }
    if (!accepted) refused.push('party')
  } else if (sentNumbers) {
    refused.push('party')
  }

  // Dates with provenance.
  if (str(s.departureDate) && str(s.departureDate) === profile?.departureDate) delete s.departureDate
  if (str(s.arrivalDate) && str(s.arrivalDate) === profile?.arrivalDate) delete s.arrivalDate
  const dateSent = str(s.arrivalDate) || str(s.departureDate)
  const dateTurn = !!questionKey && DATE_KEYS.has(questionKey)
  const dateOk = dateTurn || quoteAnchoredIn(str(s.dateSaidAs), message)
  if (dateSent && dateOk && statedFacts) {
    const a = str(s.arrivalDate)
    const d = str(s.departureDate)
    if (a && ISO.test(a)) slots.arrivalDate = a
    if (d && ISO.test(d)) slots.departureDate = d
  } else if (dateSent) {
    refused.push('dates')
  }

  // Enums.
  const presence = str(s.presence)
  if (presence && ['in_loco', 'planned', 'remote'].includes(presence)) slots.presence = presence as StayProfile['presence']
  // The itinerary answer exists only once the offer was put: "no grazie" to
  // the consent question came back as itinerary:"no" and closed a step that
  // had never been asked (sim, 2026-08-28).
  const itinerary = str(s.itinerary)
  const offerPut = questionKey === 'itinerary' || profile?.itinerary === 'asked'
  if (itinerary && ['yes', 'no'].includes(itinerary)) {
    if (offerPut) slots.itinerary = itinerary
    else refused.push('itinerary')
  }

  // Consent: its question must have been put, unless the guest wrote a sentence.
  let consent: 'granted' | 'declined' | undefined
  const consentRaw = str(s.consent)
  if (consentRaw === 'granted' || consentRaw === 'declined') {
    const asked = questionKey === 'consent' || !!profile?.consentAsked
    if (asked || message.trim().split(/\s+/).length >= 3) {
      consent = consentRaw
      slots.consentAsked = true
    } else {
      refused.push('consent')
    }
  }

  // Free text: only when the guest wrote more than a word; appended by the caller.
  if (statedFacts) {
    for (const key of ['constraints', 'interests', 'origin', 'doneAlready', 'childrenAges'] as const) {
      const v = str(s[key])
      if (v) slots[key] = v
    }
  }
  const nameRaw = str(s.name)
  const name = nameRaw && statedFacts && !/^visitor/i.test(nameRaw) ? nameRaw.slice(0, 60) : undefined

  return { intent, request, language, slots, consent, name, refused }
}

// ── Merge: deterministic first, model fills the rest ───────────────────────

/**
 * Combine the code's own capture with the model's validated slots into what
 * gets written this turn. The code's values win where both speak (they are
 * read off the guest's words directly); the model fills what the code could
 * not read; nothing overwrites a value already on file except the party
 * numbers and dates with strong provenance (an explicit correction).
 */
export function mergeSlots(
  profile: StayProfile | null | undefined,
  deterministic: Partial<StayProfile>,
  model: Partial<StayProfile>,
  strongProvenance: boolean,
): Partial<StayProfile> {
  const out: Partial<StayProfile> = {}
  const keys = new Set([...Object.keys(deterministic), ...Object.keys(model)]) as Set<keyof StayProfile>
  for (const key of keys) {
    const det = deterministic[key]
    const mod = model[key]
    let cur = profile?.[key]
    // 'asked' is the itinerary OFFER having been put, not an answer: the
    // answer ('yes'/'no') replaces it (sim 2026-08-28: "si" left it 'asked').
    if (key === 'itinerary' && cur === 'asked') cur = undefined
    const value = det !== undefined ? det : mod
    if (value === undefined) continue
    const isCount = key === 'adults' || key === 'children' || key === 'seniors' || key === 'departureDate' || key === 'arrivalDate'
    if (cur !== undefined && cur !== null && cur !== '' && !(isCount && strongProvenance)) {
      // Free text grows, it does not get replaced.
      if ((key === 'constraints' || key === 'interests' || key === 'doneAlready') && typeof cur === 'string' && typeof value === 'string') {
        if (!cur.toLowerCase().includes(value.toLowerCase())) (out as Record<string, unknown>)[key] = `${cur}; ${value}`
      }
      continue
    }
    ;(out as Record<string, unknown>)[key] = value
  }
  return out
}
