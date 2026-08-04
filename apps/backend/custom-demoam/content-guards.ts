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
      dictates_text: true,
      instruction:
        'The customer has failed to provide a valid serial number 3 times. Do NOT ask again: ' +
        'acknowledge that, and move straight to the pre-operator checks (call escalate_to_operator).',
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
