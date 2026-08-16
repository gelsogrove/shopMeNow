import { registerFieldRequest, updateState } from './state.js'

export interface GuardResult {
  ok: boolean
  [k: string]: unknown
}

const MAX_SERIAL_ATTEMPTS = 3
const SERIAL_ATTEMPTS_KEY = 'serialNumber_invalid'

export function validateSerialNumber(
  sessionId: string,
  candidate: string,
  pattern: string | undefined,
  formatHint: string | undefined,
): GuardResult | null {
  if (!pattern) return null
  if (new RegExp(pattern, 'i').test(candidate)) return null

  const attempts = registerFieldRequest(sessionId, SERIAL_ATTEMPTS_KEY)
  if (attempts >= MAX_SERIAL_ATTEMPTS) {
    updateState(sessionId, { serialNumberExhausted: true }, { mirror: false })
    return {
      ok: false,
      error: 'invalid_serial_format_exhausted',
      dictates_text: false,
      force_tool: 'escalate_to_operator',
      instruction:
        'The customer has failed to provide a valid serial number 3 times. Do NOT ask again and do ' +
        'NOT ask any diagnostic question of your own: move straight to the pre-operator checks by ' +
        "calling escalate_to_operator NOW with reason 'diagnostic_exhausted'.",
    }
  }
  return {
    ok: false,
    error: 'invalid_serial_format',
    dictates_text: true,
    instruction:
      `"${candidate}" is not a valid serial number` +
      (formatHint ? ` — it must be ${formatHint}.` : '.') +
      ' Tell the customer this and ask them to re-check it.',
  }
}

// Andrea 2026-08-05, seen live: with the gate waiting on the customer's name
// and escalate_to_operator refusing without it, the model called
// remember({key:'name', value:'unknown'}) — invented a placeholder instead
// of asking, and the refusal cleared, letting escalate_to_operator succeed
// with a customer who was never actually asked their name. Same class of bug
// as the invented technical-field values: a plausible-looking value that
// satisfies the tool's shape without coming from the customer at all.
const NAME_PLACEHOLDERS = new Set([
  'unknown', 'n/a', 'na', 'none', 'null', 'undefined', 'anonymous', 'anonymous customer',
  'sconosciuto', 'nessuno', 'non lo so', 'non specificato', 'anonimo',
])

export function validateCustomerName(candidate: string): GuardResult | null {
  const trimmed = candidate.trim()
  if (trimmed.length >= 2 && !NAME_PLACEHOLDERS.has(trimmed.toLowerCase())) return null

  return {
    ok: false,
    error: 'invalid_name',
    dictates_text: true,
    instruction:
      `"${candidate}" is not a real name — it looks like a placeholder, not something the customer ` +
      'actually said. Ask them for their name; if they refuse or truly have not answered, ask again ' +
      'rather than inventing one. Never pass a placeholder to remember for this field.',
  }
}

const MIN_PROBLEM_DESCRIPTION_CHARS = 8
const MAX_PROBLEM_DESCRIPTION_ATTEMPTS = 2
const PROBLEM_DESCRIPTION_ATTEMPTS_KEY = 'problemDescription_vague'

export function validateProblemDescription(sessionId: string, candidate: string): GuardResult | null {
  if (candidate.length >= MIN_PROBLEM_DESCRIPTION_CHARS) return null

  const attempts = registerFieldRequest(sessionId, PROBLEM_DESCRIPTION_ATTEMPTS_KEY)
  if (attempts >= MAX_PROBLEM_DESCRIPTION_ATTEMPTS) {
    return {
      ok: false,
      error: 'problem_description_too_vague_exhausted',
      dictates_text: true,
      instruction:
        'The customer could not give more detail after being asked twice. Do NOT ask again: ' +
        'acknowledge that and move on to the next question.',
    }
  }
  return {
    ok: false,
    error: 'problem_description_too_vague',
    dictates_text: true,
    instruction:
      `"${candidate}" is too generic to be a problem description — it does not say what is ` +
      'actually wrong with the robot. Ask ONE specific follow-up (what exactly is happening: an ' +
      'error code, a sound, a light, the robot not moving, etc.) and call remember again once ' +
      'they answer.',
  }
}
