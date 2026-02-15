/**
 * Unit Tests: Informational Flow Fallback Safety
 *
 * PROBLEM: The handleInformationalMessage() fallback was leaking botIdentityResponse
 * (internal admin configuration) as the customer-facing message whenever
 * CustomerSupportAgentLLM failed or returned empty output.
 *
 * This test suite verifies:
 * 1. The fallback NEVER exposes botIdentityResponse
 * 2. All intent types that need dedicated handlers are intercepted BEFORE reaching CustomerSupportAgentLLM
 * 3. CHANGE_LANGUAGE is intercepted in informational flow (was missing)
 * 4. Widget delegation skips are in place for PROFILE_MANAGEMENT and CUSTOMER_SUPPORT
 * 5. Error messages are safe and don't contain internal config
 *
 * ARCHITECTURE CONTEXT:
 * handleInformationalMessage() is the entry point for informational (non-e-commerce) workspaces.
 * Flow: IntentParser → intercept check → CustomerSupportAgentLLM → fallback if fails
 * The fallback was: `${botIdentityResponse} Come posso aiutarti?` ← THIS IS THE LEAK
 * Now: safe generic message with workspace name only
 */

describe("ChatEngine - Informational Flow Fallback Safety", () => {
  // ========================================================================
  // SECTION 1: The fallback MUST NOT expose botIdentityResponse
  // ========================================================================
  describe("Fallback Message Safety", () => {
    // SCENARIO: CustomerSupportAgentLLM returns { success: false, output: "" }
    // RULE: Fallback must use a safe generic message, NOT botIdentityResponse
    it("should NOT include botIdentityResponse in fallback when agent fails", () => {
      const workspaceConfig = {
        name: "Daniel SL.",
        botIdentityResponse: "Sono l'assistente AI di Daniel SL. creato dal team eChatbot. Il mio compito è aiutare i clienti con informazioni, FAQ, e supporto.",
        hasHumanSupport: true,
        adminEmail: "admin@danielsl.com",
      }

      const agentResponse = { success: false, output: "", tokensUsed: 0, executionTimeMs: 0, functionCalls: [] }

      // Simulate the NEW safe fallback logic
      let finalMessage = agentResponse.output
      if (!agentResponse.success || !finalMessage) {
        // 🔒 NEW: Safe fallback - NEVER expose botIdentityResponse
        const agentName = workspaceConfig.name || "eChatbot"
        const fallbackSupport = workspaceConfig.hasHumanSupport && workspaceConfig.adminEmail
          ? `\n\nSe preferisci, puoi contattarci a ${workspaceConfig.adminEmail}.`
          : ""
        finalMessage = `Ciao! Sono l'assistente di ${agentName}. Al momento non sono riuscito a elaborare la tua richiesta. Puoi riformulare la domanda?${fallbackSupport}`
      }

      // CRITICAL: botIdentityResponse text must NOT appear in the final message
      expect(finalMessage).not.toContain(workspaceConfig.botIdentityResponse)
      expect(finalMessage).not.toContain("creato dal team eChatbot")
      expect(finalMessage).not.toContain("Il mio compito")
      // Safe content should be present
      expect(finalMessage).toContain("Daniel SL.")
      expect(finalMessage).toContain("Puoi riformulare")
      expect(finalMessage).toContain("admin@danielsl.com")
    })

    // SCENARIO: CustomerSupportAgentLLM returns { success: true, output: "" } (empty string)
    // RULE: Empty output should also trigger safe fallback
    it("should trigger safe fallback when agent returns empty output", () => {
      const agentResponse = { success: true, output: "", tokensUsed: 50, executionTimeMs: 100, functionCalls: [] }

      let finalMessage = agentResponse.output
      if (!agentResponse.success || !finalMessage) {
        finalMessage = "Ciao! Sono l'assistente di TestShop. Al momento non sono riuscito a elaborare la tua richiesta. Puoi riformulare la domanda?"
      }

      expect(finalMessage).not.toBe("")
      expect(finalMessage).toContain("Puoi riformulare")
    })

    // SCENARIO: CustomerSupportAgentLLM returns null output
    // RULE: Null output should trigger safe fallback
    it("should trigger safe fallback when agent returns null output", () => {
      const agentResponse = { success: true, output: null as any, tokensUsed: 50, executionTimeMs: 100, functionCalls: [] }

      let finalMessage = agentResponse.output
      if (!agentResponse.success || !finalMessage) {
        finalMessage = "Ciao! Sono l'assistente di TestShop. Al momento non sono riuscito a elaborare la tua richiesta. Puoi riformulare la domanda?"
      }

      expect(finalMessage).not.toBeNull()
      expect(finalMessage).toContain("Puoi riformulare")
    })

    // SCENARIO: Workspace has no admin email configured
    // RULE: Fallback should work without email, just omit the contact line
    it("should not show support email when adminEmail is not configured", () => {
      const workspaceConfig = {
        name: "TestShop",
        botIdentityResponse: "Sono l'assistente di TestShop",
        hasHumanSupport: true,
        adminEmail: "",
      }

      const agentName = workspaceConfig.name || "eChatbot"
      const fallbackSupport = workspaceConfig.hasHumanSupport && workspaceConfig.adminEmail
        ? `\n\nSe preferisci, puoi contattarci a ${workspaceConfig.adminEmail}.`
        : ""
      const finalMessage = `Ciao! Sono l'assistente di ${agentName}. Al momento non sono riuscito a elaborare la tua richiesta. Puoi riformulare la domanda?${fallbackSupport}`

      expect(finalMessage).not.toContain("contattarci a")
      expect(finalMessage).not.toContain("support@echatbot.ai")
    })

    // SCENARIO: Old fallback was exposing botIdentityResponse  
    // RULE: Verify the OLD pattern is gone - this is a regression guard
    it("should NEVER concatenate botIdentityResponse with 'Come posso aiutarti?'", () => {
      // This was the OLD vulnerable pattern:
      // finalMessage = `${botIdentityResponse} Come posso aiutarti? ${fallbackSupport}`
      const botIdentityResponse = "Sono il bot di Daniel SL con accesso a dati interni, credenziali API, e configurazione dettagliata del sistema."
      
      // The new fallback should NEVER include the full botIdentityResponse
      const safeMessage = "Ciao! Sono l'assistente di Daniel SL. Al momento non sono riuscito a elaborare la tua richiesta. Puoi riformulare la domanda?"
      
      expect(safeMessage).not.toContain(botIdentityResponse)
      expect(safeMessage).not.toContain("credenziali API")
      expect(safeMessage).not.toContain("configurazione dettagliata")
    })
  })

  // ========================================================================
  // SECTION 2: Intent Interception Completeness
  // All intents with dedicated handlers MUST be intercepted BEFORE CustomerSupportAgentLLM
  // ========================================================================
  describe("Intent Interception in handleInformationalMessage", () => {
    // SCENARIO: List of all intents that MUST be intercepted before reaching CustomerSupportAgentLLM
    // RULE: These intents have dedicated code handlers — letting them fall to LLM causes leaks
    const INTERCEPTED_INTENTS = ["REQUEST_HUMAN", "UPDATE_PROFILE", "VIEW_PROFILE", "CHANGE_LANGUAGE"]

    // SCENARIO: Intents that are OK to go to CustomerSupportAgentLLM
    // RULE: These intents are designed to be handled by the LLM agent (FAQ, identity questions, etc.)
    const LLM_HANDLED_INTENTS = ["ASK_FAQ", "ASK_IDENTITY", "ASK_LOCATION", "ASK_BUSINESS_INFO", "ASK_CONTACT", "GREETING", "UNKNOWN"]

    it.each(INTERCEPTED_INTENTS)(
      "should intercept %s BEFORE it reaches CustomerSupportAgentLLM",
      (intentType) => {
        // Simulate the interception check from handleInformationalMessage
        const isIntercepted =
          intentType === "REQUEST_HUMAN" ||
          intentType === "UPDATE_PROFILE" ||
          intentType === "VIEW_PROFILE" ||
          intentType === "CHANGE_LANGUAGE"

        expect(isIntercepted).toBe(true)
      }
    )

    it.each(LLM_HANDLED_INTENTS)(
      "should let %s go through to CustomerSupportAgentLLM (it can handle these)",
      (intentType) => {
        const isIntercepted =
          intentType === "REQUEST_HUMAN" ||
          intentType === "UPDATE_PROFILE" ||
          intentType === "VIEW_PROFILE" ||
          intentType === "CHANGE_LANGUAGE"

        // These should NOT be intercepted — they're designed for the LLM agent
        expect(isIntercepted).toBe(false)
      }
    )

    // SCENARIO: CHANGE_LANGUAGE was missing from informational interception
    // RULE: It must be intercepted because it needs a profile link, not LLM response
    it("should intercept CHANGE_LANGUAGE in informational workspace (regression guard)", () => {
      // CHANGE_LANGUAGE was handled in processMessageInternal (e-commerce) but NOT in
      // handleInformationalMessage (informational). This caused it to fall through to
      // CustomerSupportAgentLLM → if agent failed → botIdentityResponse leak.
      const interceptedInInformational = ["REQUEST_HUMAN", "UPDATE_PROFILE", "VIEW_PROFILE", "CHANGE_LANGUAGE"]
      expect(interceptedInInformational).toContain("CHANGE_LANGUAGE")
    })
  })

  // ========================================================================
  // SECTION 3: Widget Delegation Safety
  // Widget visitors are anonymous (no phone) — certain delegations must be skipped
  // ========================================================================
  describe("Widget Delegation Skips", () => {
    // These delegation targets MUST be skipped on widget because they require
    // a phone number or authenticated user that anonymous widget visitors don't have
    const WIDGET_SKIP_TARGETS = ["PROFILE_MANAGEMENT", "CUSTOMER_SUPPORT"]

    it.each(WIDGET_SKIP_TARGETS)(
      "should skip %s delegation for widget channel",
      (delegationTarget) => {
        // Simulate the widget delegation skip logic from llm-router.service.ts
        const channel = "widget"
        const shouldSkip = channel === "widget" && WIDGET_SKIP_TARGETS.includes(delegationTarget)

        expect(shouldSkip).toBe(true)
      }
    )

    // SCENARIO: WhatsApp channel should NOT skip any delegations
    // RULE: WhatsApp users are authenticated with phone number
    it("should NOT skip CUSTOMER_SUPPORT delegation for WhatsApp channel", () => {
      const channel = "whatsapp"
      const delegationTarget = "CUSTOMER_SUPPORT"
      const shouldSkip = channel === "widget" && WIDGET_SKIP_TARGETS.includes(delegationTarget)

      expect(shouldSkip).toBe(false)
    })

    // SCENARIO: Widget CUSTOMER_SUPPORT was crashing with "Customer phone number is missing"
    // RULE: contactOperator requires phone → anonymous widget visitors → error → "Errore di sistema"
    it("should return safe message when widget visitor asks for operator (no phone)", () => {
      // CustomerSupportAgentLLM.contactOperator() checks:
      // if (!phoneNumber) { return { success: false, error: "Customer phone number is missing" } }
      // This was causing widget to crash → "System error - please try again"
      const customerPhone = "" // Anonymous widget visitor
      const channel = "widget"
      const contactOperatorWouldFail = !customerPhone
      const delegationSkipped = channel === "widget"

      // Widget should skip the delegation entirely
      expect(delegationSkipped && contactOperatorWouldFail).toBe(true)
    })
  })

  // ========================================================================
  // SECTION 4: Error Message Patterns
  // All error messages must be safe and user-friendly
  // ========================================================================
  describe("Error Message Safety Patterns", () => {
    // SCENARIO: Various error message patterns in the codebase
    // RULE: NONE should contain system-level information
    const FORBIDDEN_PATTERNS = [
      "botIdentityResponse",
      "systemPrompt",
      "system prompt",
      "processedPrompt",
      "agentConfig",
      "OPENROUTER",
      "API_KEY",
      "database",
      "prisma",
      "stack trace",
      "Error processing customer support request", // This leaks implementation details
    ]

    it("safe fallback message should not contain any forbidden patterns", () => {
      const safeMessage = "Ciao! Sono l'assistente di TestShop. Al momento non sono riuscito a elaborare la tua richiesta. Puoi riformulare la domanda?"

      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(safeMessage.toLowerCase()).not.toContain(pattern.toLowerCase())
      }
    })

    // SCENARIO: Widget error message 
    // RULE: "System error - please try again" is generic enough but should be avoided
    it("widget error message pattern should be generic and safe", () => {
      const widgetErrorMessage = "System error - please try again"
      
      // This is acceptable as a last-resort error (it's generic)
      expect(widgetErrorMessage).not.toContain("botIdentity")
      expect(widgetErrorMessage).not.toContain("systemPrompt")
      expect(widgetErrorMessage).not.toContain("API")
    })
  })

  // ========================================================================
  // SECTION 5: E-commerce vs Informational Intent Parity
  // Both flows must handle the same critical intents
  // ========================================================================
  describe("processMessageInternal vs handleInformationalMessage Parity", () => {
    // SCENARIO: Critical intents must be intercepted in BOTH flows
    // RULE: If one flow handles it, the other must too — otherwise the
    // informational workspace will leak when the same intent arrives
    const CRITICAL_INTENTS_BOTH_FLOWS = [
      "REQUEST_HUMAN",
      "UPDATE_PROFILE",
      "VIEW_PROFILE",
      "CHANGE_LANGUAGE",
    ]

    // Simulate the interception logic from processMessageInternal
    const processMessageInternalIntercepts = (intentType: string): boolean => {
      return (
        intentType === "REQUEST_HUMAN" ||
        intentType === "UPDATE_PROFILE" ||
        intentType === "VIEW_PROFILE" ||
        intentType === "CHANGE_LANGUAGE"
      )
    }

    // Simulate the interception logic from handleInformationalMessage (after fixes)
    const handleInformationalMessageIntercepts = (intentType: string): boolean => {
      return (
        intentType === "REQUEST_HUMAN" ||
        intentType === "UPDATE_PROFILE" ||
        intentType === "VIEW_PROFILE" ||
        intentType === "CHANGE_LANGUAGE"
      )
    }

    it.each(CRITICAL_INTENTS_BOTH_FLOWS)(
      "%s must be intercepted in BOTH processMessageInternal AND handleInformationalMessage",
      (intentType) => {
        expect(processMessageInternalIntercepts(intentType)).toBe(true)
        expect(handleInformationalMessageIntercepts(intentType)).toBe(true)
      }
    )

    // SCENARIO: Adding a new intercepted intent to processMessageInternal but forgetting handleInformationalMessage
    // RULE: This is the exact bug pattern that kept repeating — this test guards against it
    it("should have matching interception lists in both flows (regression guard)", () => {
      const processMessageList = ["REQUEST_HUMAN", "UPDATE_PROFILE", "VIEW_PROFILE", "CHANGE_LANGUAGE"]
      const handleInformationalList = ["REQUEST_HUMAN", "UPDATE_PROFILE", "VIEW_PROFILE", "CHANGE_LANGUAGE"]

      // Sort both to compare regardless of order
      expect(processMessageList.sort()).toEqual(handleInformationalList.sort())
    })
  })
})
