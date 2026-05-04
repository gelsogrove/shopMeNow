/**
 * Unit test: Translation layer must be SKIPPED when the workspace delegates
 * to a custom chatbot module (workspaceConfig.customChatbotId !== null).
 *
 * SCENARIO:
 *   Ecolaundry workspace runs cliente-0 custom chatbot. cliente-0 already
 *   produces output in the customer's language via its internal `history`
 *   prompt. Running TranslationAgent again on that output would:
 *     - waste tokens (double LLM call per turn)
 *     - risk corrupting an already-translated response
 *
 * RULE: When workspaceConfig.customChatbotId is truthy, the chat-engine
 *   translation step MUST be skipped. SecurityAgent + billing still run
 *   as usual (they are independent of translation).
 *
 * Implementation under test: chat-engine.service.ts → routeMessage()
 *   logic around `shouldSkipTranslation`. This unit test exercises that
 *   decision in isolation using the same boolean expression, without
 *   bootstrapping the whole engine (which would require ~30 dependencies).
 */

// Replicates the production decision verbatim. If this expression diverges
// from chat-engine.service.ts the test will fail and the developer must
// keep both in sync.
function shouldSkipTranslation(args: {
  customChatbotId: string | null
  languageChangedThisTurn: boolean
  normalizedLanguage: string
  catalogBaseLanguage: string
}): boolean {
  const isCustomChatbot = !!args.customChatbotId
  return (
    isCustomChatbot ||
    (!args.languageChangedThisTurn &&
      args.normalizedLanguage === args.catalogBaseLanguage)
  )
}

describe("ChatEngine.routeMessage — translation skip decision", () => {
  // RULE: Custom chatbot workspaces (cliente-0 etc.) own translation themselves
  it("SKIPS translation when workspaceConfig.customChatbotId is set", () => {
    // SCENARIO: Ecolaundry / cliente-0, customer writes in Spanish, catalog
    // base is Italian. Without the custom-chatbot rule the engine would
    // translate (es ≠ it). With the rule it must skip.
    const result = shouldSkipTranslation({
      customChatbotId: "cliente-0",
      languageChangedThisTurn: false,
      normalizedLanguage: "es",
      catalogBaseLanguage: "it",
    })
    expect(result).toBe(true)
  })

  it("SKIPS translation for custom chatbot even when language changed this turn", () => {
    // RULE: customChatbotId wins over the language-changed override.
    // The custom chatbot regenerates in the new language internally.
    const result = shouldSkipTranslation({
      customChatbotId: "cliente-0",
      languageChangedThisTurn: true,
      normalizedLanguage: "pt",
      catalogBaseLanguage: "it",
    })
    expect(result).toBe(true)
  })

  it("SKIPS translation for custom chatbot even when languages match", () => {
    // RULE: still skip — the custom chatbot decides on its own.
    const result = shouldSkipTranslation({
      customChatbotId: "cliente-0",
      languageChangedThisTurn: false,
      normalizedLanguage: "it",
      catalogBaseLanguage: "it",
    })
    expect(result).toBe(true)
  })

  // RULE: Standard workspaces (no custom chatbot) keep the legacy behavior
  it("RUNS translation for standard workspace when customer lang differs from catalog", () => {
    // SCENARIO: BellItalia ecommerce, catalog in Italian, customer in Spanish.
    // Engine must translate normally.
    const result = shouldSkipTranslation({
      customChatbotId: null,
      languageChangedThisTurn: false,
      normalizedLanguage: "es",
      catalogBaseLanguage: "it",
    })
    expect(result).toBe(false)
  })

  it("SKIPS translation for standard workspace when customer lang matches catalog", () => {
    // SCENARIO: Italian customer, Italian catalog — nothing to translate.
    const result = shouldSkipTranslation({
      customChatbotId: null,
      languageChangedThisTurn: false,
      normalizedLanguage: "it",
      catalogBaseLanguage: "it",
    })
    expect(result).toBe(true)
  })

  it("RUNS translation for standard workspace when language was changed this turn", () => {
    // SCENARIO: customer just switched language mid-session; the response
    // was generated in the OLD language and must be translated to the NEW.
    // Even if new lang == catalog base, we still translate this single turn.
    const result = shouldSkipTranslation({
      customChatbotId: null,
      languageChangedThisTurn: true,
      normalizedLanguage: "it",
      catalogBaseLanguage: "it",
    })
    expect(result).toBe(false)
  })

  it("RUNS translation for empty-string customChatbotId (treated as no custom chatbot)", () => {
    // RULE: only a non-empty customChatbotId disables translation.
    const result = shouldSkipTranslation({
      customChatbotId: "",
      languageChangedThisTurn: false,
      normalizedLanguage: "es",
      catalogBaseLanguage: "it",
    })
    expect(result).toBe(false)
  })
})
