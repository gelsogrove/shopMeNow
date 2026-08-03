/**
 * demoam — conversation language: seeding, stickiness, and the
 * enabledLanguages gate.
 *
 * Same sticky-language mechanism as custom-demorobot (⟦LANG:xx⟧ trailer,
 * seed-vs-commit distinction — see demorobot-language-seed.spec.ts for the
 * production bug this prevents). NEW here (steps.md Step 1.4, verified during
 * design review that neither existing module actually wires this up):
 * seedLanguageIfNeeded and resolveEnabledLanguage both gate against
 * settings.enabledLanguages, falling back to settings.defaultLanguage rather
 * than a hardcoded "en" — a workspace enabling only ["en","it"] must never
 * seed or commit "es" just because the customer's profile or message says so.
 */
import {
  commitLanguageFromReply,
  formatStateForPrompt,
  getState,
  resetState,
  resolveEnabledLanguage,
  seedLanguageIfNeeded,
} from '../../custom-demoam/state'

describe('demoam language seeding', () => {
  const sessionId = 'sess-lang-1'

  beforeEach(() => {
    resetState(sessionId)
  })

  it('seeds the language from the host when it is enabled for the workspace', () => {
    const resolved = seedLanguageIfNeeded(sessionId, 'es', ['en', 'es'], 'en')

    expect(resolved).toBe('es')
    expect(getState(sessionId).language).toBe('es')
  })

  it('falls back to defaultLanguage when the seed is not in enabledLanguages', () => {
    // Workspace only enabled English — a Spanish-registered customer profile
    // must not silently seed a language the workspace never turned on.
    const resolved = seedLanguageIfNeeded(sessionId, 'es', ['en'], 'en')

    expect(resolved).toBe('en')
  })

  it('falls back to defaultLanguage when the host sends an invalid ISO code', () => {
    const resolved = seedLanguageIfNeeded(sessionId, 'not-a-language', ['en', 'it'], 'it')

    expect(resolved).toBe('it')
  })

  it('marks a seeded language as a hint, not a decision', () => {
    seedLanguageIfNeeded(sessionId, 'en', ['en'], 'en')

    expect(getState(sessionId).languageIsSeed).toBe(true)
  })

  it('never overwrites a language already committed on a previous turn', () => {
    commitLanguageFromReply(sessionId, 'es')
    const resolved = seedLanguageIfNeeded(sessionId, 'en', ['en', 'es'], 'en')

    expect(resolved).toBe('es')
    expect(getState(sessionId).language).toBe('es')
  })

  it('always instructs the LLM to emit the ⟦LANG:xx⟧ trailer', () => {
    const prompt = formatStateForPrompt(getState(sessionId))

    expect(prompt).toContain('⟦LANG:xx⟧')
    expect(prompt).toMatch(/OUTPUT FORMAT \(mandatory, every turn\)/)
  })
})

describe('resolveEnabledLanguage — gating the LLM-detected reply language', () => {
  it('keeps the detected language when it is enabled', () => {
    expect(resolveEnabledLanguage('it', ['en', 'it'], 'en')).toBe('it')
  })

  it('falls back to defaultLanguage when the detected language is not enabled', () => {
    // steps.md Step 1.4: "quella rilevata dal messaggio del cliente, SOLO SE
    // presente in enabledLanguages; altrimenti defaultLanguage" — this is the
    // gate on the OUTPUT side (what gets committed), distinct from ISO
    // validity (commitLanguageFromReply's own check).
    expect(resolveEnabledLanguage('es', ['en', 'it'], 'en')).toBe('en')
  })

  it('is case-insensitive against the enabled list', () => {
    expect(resolveEnabledLanguage('IT', ['en', 'it'], 'en')).toBe('it')
  })
})
