/**
 * demoam — no hardcoded customer-facing copy, and the serial-number
 * 3-attempt gate fallback.
 *
 * Andrea 2026-08-04. Same rule as custom-demorobot (CLAUDE.md §1A/§1C): every
 * sentence a customer can read comes from settings.json / the workspace, the
 * module only ships the mechanism. Locked here by grepping the actual source
 * (demorobot-orchestration.spec.ts precedent), so a hardcoded string cannot
 * creep back in unnoticed.
 *
 * Also pins steps.md 2-C.1's confirmed decision: after 3 invalid serial-number
 * attempts, the code stops asking and routes to the pre-operator gate instead
 * of looping forever — verified by grepping agent.ts for the constant AND by
 * asserting the settings-driven wording lives in settings.json, not in code.
 */
import fs from 'fs'
import path from 'path'

import { nextPreOperatorStep } from '../../custom-demoam/gate'

const MODULE_DIR = path.join(__dirname, '..', '..', 'custom-demoam')

describe('demoam carries no hardcoded customer-facing copy', () => {
  const sources = ['agent.ts', 'gate.ts', 'state.ts'].map((f) =>
    fs.readFileSync(path.join(MODULE_DIR, f), 'utf8'),
  )
  // Comments explain WHY copy lives in settings and legitimately reference
  // old/example strings — only executable lines are checked.
  const code = sources
    .join('\n')
    .split('\n')
    .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
    .join('\n')

  it('has no tenant-specific serial format hardcoded', () => {
    // "19 characters starting with HK" is this tenant's own domain knowledge
    // (custom-demorobot's documented past violation) — must live in
    // settings.json's serialNumberFormatHint, never as a literal here.
    expect(code).not.toMatch(/19 characters/i)
    expect(code).not.toMatch(/starts with HK/i)
  })

  it('keeps the gate question wording in settings.json, not in the code', () => {
    const settings = JSON.parse(fs.readFileSync(path.join(MODULE_DIR, 'settings.json'), 'utf8'))

    expect(settings.gateQuestions).toBeDefined()
    for (const field of [
      'serialNumber',
      'problemDescription',
      'robotPoweredOn',
      'wifiActive',
      'cutSchedulingActive',
      'batterySufficient',
      'name',
    ]) {
      expect(settings.gateQuestions[field]).toBeTruthy()
    }
  })

  it('keeps welcome / welcome-back / wip / hand-off copy in settings.json', () => {
    const settings = JSON.parse(fs.readFileSync(path.join(MODULE_DIR, 'settings.json'), 'utf8'))

    expect(settings.welcomeMessage).toBeTruthy()
    expect(settings.welcomeBackMessage).toBeTruthy()
    expect(settings.wipMessage).toBeTruthy()
    expect(settings.humanSupportMessage).toBeTruthy()
    expect(settings.rateLimitedMessage).toBeTruthy()
    expect(settings.sessionTooLongMessage).toBeTruthy()
  })

  it('asks nothing at all when no gate wording is configured — fails toward silence', () => {
    expect(nextPreOperatorStep({}, undefined, {})).toBeNull()
    expect(nextPreOperatorStep({}, {}, {})).toBeNull()
  })

  it('never emits an untranslated hardcoded hand-off apology', () => {
    // The exact custom-demorobot regression this rule exists for: a
    // HANDOFF_MESSAGES table pre-translated into 8 languages.
    expect(code).not.toMatch(/HANDOFF_MESSAGES/)
    expect(code).not.toMatch(/Mi dispiace, non riesco/i)
  })
})

describe('demoam serial number — 3-attempt gate fallback (steps.md 2-C.1)', () => {
  const agentSource = fs.readFileSync(path.join(MODULE_DIR, 'agent.ts'), 'utf8')

  it('caps invalid serial attempts at 3, confirmed with Andrea (not hardcoded to any other number)', () => {
    expect(agentSource).toMatch(/MAX_SERIAL_ATTEMPTS\s*=\s*3/)
  })

  it('routes to the pre-operator gate instead of looping forever once exhausted', () => {
    expect(agentSource).toMatch(/invalid_serial_format_exhausted/)
    expect(agentSource).toMatch(/move straight to the pre-operator checks/i)
  })

  it('the format pattern itself is configured per workspace, not a literal regex tied to this tenant', () => {
    const settings = JSON.parse(fs.readFileSync(path.join(MODULE_DIR, 'settings.json'), 'utf8'))

    expect(settings.serialNumberPattern).toBeTruthy()
    expect(settings.serialNumberFormatHint).toBeTruthy()
    // The code reads ctx.serialNumberPattern, never a literal regex.
    expect(agentSource).not.toMatch(/new RegExp\(['"]\^HK/)
  })
})

describe('demoam pre-operator gate — persisted per session, per-field counters', () => {
  const stateSource = fs.readFileSync(path.join(MODULE_DIR, 'state.ts'), 'utf8')

  it('askedCounts is per-field, not one shared counter (CLAUDE.md §14: counted, never phrase-detected)', () => {
    // Mirrors demorobot's fix: one shared counter let a customer who ignored
    // ONE question skip ALL seven — the operator inherited an empty ticket.
    expect(stateSource).toMatch(/askedCounts: Record<string, number>/)
  })

  it('confirms serial-attempt counting is per-session (not persisted) per the steps.md decision', () => {
    // dehydrateState only persists {state, patches} — askedCounts (which
    // carries both the gate counters and serialNumber_invalid) is
    // deliberately excluded, same as turnCount/rate-limit timestamps.
    const dehydrateFn = stateSource.slice(stateSource.indexOf('export function dehydrateState'))
    expect(dehydrateFn).toContain('return { state: e.state, patches: e.patches }')
    expect(dehydrateFn).not.toContain('askedCounts')
  })
})
