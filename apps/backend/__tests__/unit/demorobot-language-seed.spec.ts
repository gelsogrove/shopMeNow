/**
 * demorobot — conversation language seeding
 *
 * Andrea 2026-08-02, bug seen in production (AmRobots widget): the customer
 * wrote "hola" and Sofia replied in Italian.
 *
 * Root cause: the module never seeded a language, so `state.language` stayed
 * undefined and nothing carried the customer's own language into the prompt.
 * `seedLanguageIfNeeded` existed but was never called, and `config.language`
 * (what the registration form collected) was ignored by chatbotFn.
 *
 * The fix must satisfy TWO requirements that pull in opposite directions:
 *   1. Seed the language the host knows, so the bot starts in the right one.
 *   2. NOT lock the conversation to it — a customer who registered as "en"
 *      and then writes "hola" must get Spanish back. A seeded language is a
 *      hint until the LLM actually replies in a language and commits it.
 *
 * These tests cover the state layer, where that distinction lives.
 */
import {
  commitLanguageFromReply,
  formatStateForPrompt,
  getState,
  resetState,
  seedLanguageIfNeeded,
} from "../../custom-demorobot/state"

describe("demorobot language seeding", () => {
  const sessionId = "sess-lang-1"

  beforeEach(() => {
    resetState(sessionId)
  })

  it("seeds the language from the host when none is set", () => {
    const resolved = seedLanguageIfNeeded(sessionId, "es")

    expect(resolved).toBe("es")
    expect(getState(sessionId).language).toBe("es")
  })

  it("marks a seeded language as a hint, not a decision", () => {
    seedLanguageIfNeeded(sessionId, "en")

    // languageIsSeed is what stops the prompt from locking the conversation.
    expect(getState(sessionId).languageIsSeed).toBe(true)
  })

  it("tells the LLM to detect the real language while the seed is only a hint", () => {
    seedLanguageIfNeeded(sessionId, "en")

    const prompt = formatStateForPrompt(getState(sessionId))

    // The exact production failure: profile says "en", customer writes "hola".
    // The prompt must invite detection, never order the bot to keep English.
    expect(prompt).toMatch(/only a hint/i)
    expect(prompt).not.toMatch(/KEEP replying in en/)
  })

  it("locks the language once the LLM has actually replied in one", () => {
    seedLanguageIfNeeded(sessionId, "en")
    // The LLM replied in Spanish and declared it via the ⟦LANG:xx⟧ trailer.
    commitLanguageFromReply(sessionId, "es")

    const state = getState(sessionId)
    expect(state.language).toBe("es")
    // No longer a hint — subsequent turns must stick to Spanish.
    expect(state.languageIsSeed).toBeUndefined()

    expect(formatStateForPrompt(state)).toMatch(/KEEP replying in es/)
  })

  it("never overwrites a language already committed on a previous turn", () => {
    commitLanguageFromReply(sessionId, "es")
    // A later turn re-seeds from the profile — the real language must win.
    seedLanguageIfNeeded(sessionId, "en")

    expect(getState(sessionId).language).toBe("es")
  })

  it("falls back to English when the host sends an unusable language", () => {
    const resolved = seedLanguageIfNeeded(sessionId, "not-a-language")

    // English is the documented business default (state.ts DEFAULT_LANGUAGE).
    expect(resolved).toBe("en")
  })

  it("always instructs the LLM to emit the ⟦LANG:xx⟧ trailer", () => {
    // The trailer is how language becomes sticky. The AmRobots workspace uses
    // a custom system prompt that never mentions it, so the module's own block
    // must carry the instruction on every turn regardless.
    const prompt = formatStateForPrompt(getState(sessionId))

    expect(prompt).toContain("⟦LANG:xx⟧")
    expect(prompt).toMatch(/OUTPUT FORMAT \(mandatory, every turn\)/)
  })
})
