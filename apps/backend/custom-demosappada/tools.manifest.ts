/**
 * The tools this module ships with, as DATA.
 *
 * Read by the backend at workspace-settings save time to seed one
 * `WorkspaceCallingFunction` row per tool, so the Settings → Custom Tools page
 * can switch them on and off and edit their descriptions. From the first seed
 * on, the DATABASE is authoritative: the text here is only ever used to CREATE
 * a row, never to overwrite one (see `syncModuleToolRows`).
 *
 * 🚨 This file must stay free of side effects and of imports from `agent.ts`.
 * The backend loads it with `tsImport` from a request path; pulling in the
 * agent would drag in `process.env.OPENROUTER_API_KEY` and 3000 lines of
 * runtime to read seven descriptions. The only import is `weather.ts`, which
 * imports nothing from this module.
 *
 * The schema constants live HERE and are re-imported by `agent.ts`, rather
 * than the other way round: one copy of each schema, and no import cycle.
 */

import { WEATHER_TOOL } from './weather.js'

export const MODULE_ID = 'demosappada'

export interface ModuleToolManifestEntry {
  /**
   * 🚨 MUST match the dispatch branch in `agent.ts` (`else if (name === …)`)
   * and the `name` in the schema below. The row's functionName is immutable
   * server-side, which is what keeps this link from drifting; a unit test
   * greps agent.ts to prove every name here still has a handler.
   */
  functionName: string
  description: string
  responseInstructions?: string
  parameters: Record<string, unknown>
  /**
   * Platform system functions this tool makes redundant. The seeder
   * DEACTIVATES them (never deletes) the first time this tool is created, so
   * the model is not offered two tools that do the same job.
   */
  supersedes?: string[]
  /**
   * What breaks for the guest if an admin switches this off. Shown in the
   * confirmation dialog — an admin disabling a tool should be told the
   * consequence, not discover it from a degraded bot.
   */
  impact?: string
}

// ── Tool schemas ──────────────────────────────────────────────────────────

export const REMEMBER_TOOL = {
  type: 'function',
  function: {
    name: 'remember',
    description:
      'Save a fact the customer told you about themselves, so it survives the conversation. Call it the ' +
      'moment they mention their name — even in passing.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', enum: ['name'] },
        value: { type: 'string' },
      },
      required: ['key', 'value'],
      additionalProperties: false,
    },
  },
} as const

export const SAVE_STAY_TOOL = {
  type: 'function',
  function: {
    name: 'save_preferences',
    description:
      'Save what you have learned about this holiday. Call it the moment the customer tells you any of ' +
      'it — how many they are, how long they stay, where they come from, or something they have already ' +
      'done. Send ONLY the fields you actually learned; the rest is preserved.',
    parameters: {
      type: 'object',
      properties: {
        presence: {
          type: 'string',
          enum: ['in_loco', 'remote', 'planned'],
          description:
            "Where the customer stands with Sappada. 'in_loco' = they are in town right now. " +
            "'planned' = a holiday is booked or decided but not started ('veniamo il prossimo mese') " +
            "— treat them like a future guest: dates, party, interests all apply. 'remote' = they are " +
            'not coming as far as you know: asking about lodging, an event or information from home. ' +
            'Save it the moment their answer to "Siete già a Sappada?" — or anything they volunteer — ' +
            'makes it clear.',
        },
        adults: {
          type: 'integer',
          description:
            'How many adults. Count the people the guest NAMES, not only digits: "io e mio marito" is ' +
            'adults 2 — and, since no children were named, children 0 in the same call. When the message ' +
            'has no number, send partySaidAs AND partyMembers with it. A plural verb ("cerchiamo", "siamo") ' +
            'or "un gruppo" does NOT tell you how many: send nothing and let the headcount be asked.',
        },
        partySaidAs: {
          type: 'string',
          description:
            "The customer's EXACT words stating who is in the party, copied verbatim from their latest " +
            'message — e.g. "io e mio marito", "siamo in 3", "due adulti e un bimbo", "we are a couple". ' +
            'REQUIRED whenever adults/children/seniors are sent and the message carries no digit or ' +
            'number-word: numbers arriving without it, or with words the customer never wrote, are ' +
            'DISCARDED. Never paraphrase it, never quote a sentence that does not name the people.',
        },
        partyMembers: {
          type: 'array',
          items: { type: 'string' },
          description:
            'One entry per person you counted, in the guest\'s own words: "io e mio marito" → ' +
            '["io", "mio marito"]; "my wife and I" → ["my wife", "I"]. REQUIRED with partySaidAs. The ' +
            'number of entries must equal adults+children+seniors, and each must be a person the guest ' +
            'actually named — otherwise the numbers are DISCARDED.',
        },
        children: { type: 'integer', description: 'How many children. Send 0 the moment the guest rules children out ("nessun bambino", "solo adulti", "no kids") — 0 is a real answer, not a value to leave unset, and omitting it here is what makes the intake ask about children again after the guest already answered.' },
        childrenAges: { type: 'string', description: 'Their ages as the guest said them, e.g. "8, 9 e 10". Save it the moment you learn it — it changes what is worth proposing.' },
        constraints: { type: 'string', description: 'Anything that limits what suits them: coeliac or another intolerance, no car, a pregnancy, limited walking, a dog, a wheelchair. Append to what is already there rather than replacing it.' },
        interests: { type: 'string', description: 'What they said they enjoy: nature, food, history, quiet, walking, local culture. A preference, NOT a limitation — anything that rules an option out belongs in constraints. Append to what is already there rather than replacing it.' },
        seniors: { type: 'integer', description: 'How many elderly people. Send 0 the moment the guest rules seniors out ("nessun anziano", "solo adulti", "siamo giovani") — same reasoning as children: 0 is a real answer, and leaving it unset is what makes the intake ask about it again.' },
        pendingRequest: {
          type: 'string',
          description:
            'What the customer just asked for, in a few words, WHENEVER your reply this turn does not ' +
            'fully serve it yet — an accommodation, an event, an itinerary, a recommendation, anything ' +
            'that needs more turns or more of their answers first. Send it even without a question mark: ' +
            '"cerchiamo un albergo" is a request, not a stay fact. RULE: you always answer it first — ' +
            'even one line, even a generic answer with what you already know — THEN ask your own ' +
            'question; this field is for a request that genuinely needs another turn to finish serving, ' +
            'not an excuse to postpone answering. The moment you have fully answered a request you were ' +
            'carrying, send the exact word "RISOLTO" (nothing else) to stop carrying it — an empty string ' +
            'is silently ignored and would leave the OLD request stuck forever. Never invent a request: ' +
            'only what the customer actually asked.',
        },
        arrivalDate: { type: 'string', description: 'YYYY-MM-DD, the day they arrived.' },
        departureDate: { type: 'string', description: 'YYYY-MM-DD, the day they leave. Compute it from "we stay 5 days" using today\'s date in RUNTIME.' },
        dateSaidAs: {
          type: 'string',
          description:
            "The customer's EXACT words stating the dates, copied verbatim from their latest " +
            'message — e.g. "fino a domenica", "5 giorni", "dal 20 al 26". REQUIRED whenever ' +
            'arrivalDate or departureDate is sent: dates arriving without it, or with words the ' +
            'customer never wrote, are DISCARDED. Never paraphrase it.',
        },
        origin: { type: 'string', description: 'Where they travelled from (city or country). Never ask for this — it is not part of the intake (Andrea, 2026-08-24: "lo possiamo togliere, non importa"). Save it only if they volunteer it.' },
        doneAlready: {
          type: 'string',
          description:
            'Something they have now done or seen, in a few words, so it is not proposed again. ' +
            'When they say HOW it went, put that in the same line — "Cascatelle (piaciute molto)", ' +
            '"Malga Tuglia (troppo faticosa coi bambini)", "cena da X (deludente)". What they did ' +
            'stops you repeating it; what they thought of it tells you what to propose next.',
        },
        asked: {
          type: 'array',
          description:
            'Which intake questions you have now PUT to the guest, whether or not they answered. Send it ' +
            'in the same call as the question you just asked, so it is never asked twice.',
          items: { type: 'string', enum: ['party', 'stay', 'childrenAges', 'constraints', 'interests', 'name'] },
        },
        itinerary: {
          type: 'string',
          description:
            "Their answer about wanting a day-by-day plan: 'yes' or 'no'. Send it as soon as they answer.",
          enum: ['yes', 'no'],
        },
        notes: {
          type: 'string',
          description:
            'The whole holiday summed up in prose, for the person at the Pro Loco who opens this ' +
            "guest's card. Rewrite it IN FULL every time you learn something new — it is one " +
            'paragraph, not a log. Say who they are, when they are here, where from, what limits ' +
            'them, WHAT THEY SAID THEY WANT TO DO (never leave this out: the recommendations are '  +
            'built on it), and what they have already done: "Coppia da Vienna con un bimbo ' +
            'di 6, 22-26 agosto, senza auto, la mamma è celiaca. Amano camminare. Fatte le ' +
            'Cascatelle (piaciute)." Written for a colleague to read in five seconds, not for the ' +
            'guest.',
        },
      },
      additionalProperties: false,
    },
  },
} as const

export const SAVE_ITINERARY_TOOL = {
  type: 'function',
  function: {
    name: 'save_itinerary',
    description:
      'Save the day-by-day plan the customer ACCEPTED, so it survives the conversation and you can pick ' +
      'it up tomorrow. Call it right after they agree to a plan, and again — with the FULL updated plan ' +
      '— every time something changes it: the weather turns, they do something else, they leave earlier.',
    parameters: {
      type: 'object',
      properties: {
        plan: {
          type: 'string',
          description:
            'The whole plan, one line per day, starting with the ISO date: "2026-08-24: mattina ' +
            'Cascatelle, pomeriggio museo". Short lines — this is your own note, not the message you ' +
            'send the customer. Build it in this order: what they SAID THEY WANT (interests) first, ' +
            'then the season in RUNTIME, then the weather per day, then who they are and their ' +
            'constraints, and never repeat what is already in GIÀ FATTO. A plan that ignores their ' +
            'interests is a generic list and is worse than no plan.',
        },
      },
      required: ['plan'],
      additionalProperties: false,
    },
  },
} as const

export const SAVE_CONSENT_TOOL = {
  type: 'function',
  function: {
    name: 'save_push_consent',
    description:
      'Record whether the customer agrees to receive messages about the area (events, news, offers, ' +
      'weather — one consent covers all of them). Call it ONLY after they answered clearly, with their ' +
      'actual answer — never assume a yes. Call it again at the end of the holiday if you re-confirm it. ' +
      'This is also the ON/OFF switch, usable at ANY moment of the stay, not just when you first ask: ' +
      'the moment they say they want no more messages call it with granted=false, and if they later ' +
      'change their mind call it with granted=true. A guest who asks to be ' +
      'left alone and keeps receiving messages is the worst outcome this tool exists to prevent.',
    parameters: {
      type: 'object',
      properties: {
        granted: { type: 'boolean' },
      },
      required: ['granted'],
      additionalProperties: false,
    },
  },
} as const

export const SAVE_FEEDBACK_TOOL = {
  type: 'function',
  function: {
    name: 'save_feedback',
    description:
      'Save the end-of-stay feedback: what went well, what did not, and a 1-5 rating if they gave one. ' +
      'Call it once, when the holiday is ending and they have told you how it went.',
    parameters: {
      type: 'object',
      properties: {
        rating: { type: 'integer', minimum: 1, maximum: 5 },
        comment: { type: 'string', description: 'What went well and what did not, in their own words.' },
      },
      additionalProperties: false,
    },
  },
} as const

export const ACCOMMODATION_TOOL = {
  type: 'function',
  function: {
    name: 'check_accommodation',
    description:
      'List the accommodation the Pro Loco keeps on file, with contacts. Call it whenever the customer ' +
      'asks where to sleep, or about a rifugio, hotel, B&B, apartment or campsite. It does NOT report ' +
      'whether rooms are free — only the structure knows that.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
} as const

// ── The manifest ──────────────────────────────────────────────────────────

/**
 * Derive a manifest entry from a schema, so the description the model reads
 * and the description the admin edits start out as the same sentence.
 */
function entryOf(
  tool: { function: { name: string; description: string; parameters: unknown } },
  extra: Pick<ModuleToolManifestEntry, 'supersedes' | 'impact'> = {},
): ModuleToolManifestEntry {
  return {
    functionName: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters as Record<string, unknown>,
    ...extra,
  }
}

export const MODULE_TOOLS: ModuleToolManifestEntry[] = [
  entryOf(WEATHER_TOOL, {
    impact:
      'The chatbot can no longer check the forecast, and will say so rather than guess. Day-by-day ' +
      'plans stop taking the weather into account.',
  }),
  entryOf(ACCOMMODATION_TOOL, {
    impact:
      'Guests asking where to sleep are pointed to the InfoPoint instead of the accommodation on file.',
  }),
  entryOf(REMEMBER_TOOL, {
    impact: 'The chatbot stops learning guests\' names and cannot address them by name.',
  }),
  entryOf(SAVE_STAY_TOOL, {
    impact:
      'The chatbot stops remembering who the guest is, how long they stay and what limits them. It ' +
      'keeps asking the intake questions and never uses the answers.',
  }),
  entryOf(SAVE_ITINERARY_TOOL, {
    impact: 'Day-by-day plans are lost when the conversation ends and cannot be picked up tomorrow.',
  }),
  entryOf(SAVE_CONSENT_TOOL, {
    // `manageNotifications` is the platform's own consent tool. Both would be
    // offered to the model at once, which is an ambiguity that degrades tool
    // choice — and the platform one does not write `consentAsked` or the
    // interest tags, so it is the weaker of the two here.
    supersedes: ['manageNotifications'],
    impact:
      'Push consent can no longer be recorded or revoked in conversation, and interest tags stop ' +
      'being set for campaigns.',
  }),
  entryOf(SAVE_FEEDBACK_TOOL, {
    impact: 'End-of-stay feedback is no longer saved onto the customer card.',
  }),
]
