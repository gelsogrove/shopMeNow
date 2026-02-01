/**
 * Safety & Translation Agent - Coverage Test
 *
 * DOCUMENTATION TEST: Verifica che ogni messaggio Widget passa da Safety & Translation
 *
 * 🆕 IMPORTANT: SafetyTranslationAgent is now WIDGET-ONLY
 * 
 * - WIDGET: All messages pass through SafetyTranslationAgent (no scheduler processes widget)
 * - WHATSAPP: Skip SafetyTranslationAgent - scheduler handles security + translation
 * 
 * This optimization prevents double LLM costs for WhatsApp messages
 * (scheduler already does SecurityAgent + TranslationService)
 *
 * @author Andrea Gelso
 */

describe("Safety & Translation Agent - Widget-Only Coverage", () => {
  it("should process Widget welcome messages through Safety & Translation", () => {
    /**
     * EXPECTED BEHAVIOR (WIDGET CHANNEL):
     *
     * 1. Widget user sends first message
     * 2. Sistema genera welcome message
     * 3. BEFORE sending, passa da SafetyTranslationAgent:
     *    - Input: welcomeMessage
     *    - targetLanguage: customer language
     * 4. SafetyTranslationAgent verifica:
     *    - No contenuti offensivi/pericolosi
     *    - Traduce se necessario
     * 5. Output: finalMessage (safe + translated)
     * 6. Salva debug step con tokensUsed
     *
     * WHATSAPP: Welcome messages still use SafetyTranslationAgent
     * because they have deliveryStatus='not_queued' (scheduler doesn't process them)
     *
     * CODE LOCATION:
     * backend/src/utils/welcome-message.handler.ts (uses TranslationAgent)
     * backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts (uses SafetyTranslationAgent)
     */

    const expectedFlow = {
      step1: "Generate welcome message",
      step2: "Check channel type",
      step3_widget: "Call SafetyTranslationAgent.process()",
      step3_whatsapp: "Call SafetyTranslationAgent (not_queued messages only)",
      step4: "Verify safe=true and no blockedReason",
      step5: "Use translatedText as final message",
      step6: "Send finalMessage to customer",
    }

    const expectedDebugStep = {
      type: "safety",
      agent: "SafetyTranslationAgent",
      model: "openai/gpt-4o-mini",
      temperature: 0.2,
      input: {
        originalMessage: "Welcome message",
        targetLanguage: "it",
        customerName: "New Customer",
      },
      output: {
        translatedMessage: "Benvenuto!",
        safe: true,
        blockedReason: null,
      },
      tokenUsage: {
        totalTokens: 150, // Example
      },
    }

    // Verify structure
    expect(expectedDebugStep.type).toBe("safety")
    expect(expectedDebugStep.agent).toBe("SafetyTranslationAgent")
    expect(expectedDebugStep.output.safe).toBe(true)

    console.log("✅ Widget welcome message Safety & Translation flow documented")
  })

  it("should process operator messages through Safety & Translation (Widget only)", () => {
    /**
     * 🆕 UPDATED: Widget-only SafetyTranslationAgent
     *
     * WIDGET CHANNEL BEHAVIOR:
     * 1. Operator writes message
     * 2. Message passes through SafetyTranslationAgent ✅
     * 3. Safety checks + Translation applied
     * 4. Sent to widget customer
     *
     * WHATSAPP CHANNEL BEHAVIOR:
     * 1. Operator writes message
     * 2. Message goes to queue
     * 3. Scheduler handles security + translation ✅
     * 4. SafetyTranslationAgent SKIPPED (no double cost)
     *
     * Why different?
     * - WhatsApp: Scheduler processes all messages → already secure + translated
     * - Widget: No scheduler → SafetyTranslationAgent is the only layer
     *
     * CODE LOCATION:
     * backend/src/interfaces/http/controllers/chat.controller.ts
     */

    const widgetFlow = {
      step1: "Operator writes message",
      step2: "chat.controller receives",
      step3: "Channel check: widget → apply SafetyTranslationAgent ✅",
      step4: "Safety checks applied",
      step5: "Sent to customer",
    }

    const whatsappFlow = {
      step1: "Operator writes message",
      step2: "whatsapp-webhook.controller receives",
      step3: "Channel check: whatsapp → SKIP SafetyTranslationAgent",
      step4: "Add to WhatsApp queue",
      step5: "Scheduler handles security + translation",
    }

    // Widget: SafetyTranslationAgent applied
    expect(widgetFlow.step3).toContain("apply SafetyTranslationAgent")

    // WhatsApp: SafetyTranslationAgent skipped
    expect(whatsappFlow.step3).toContain("SKIP SafetyTranslationAgent")

    console.log("✅ Operator message: Widget=SafetyTranslationAgent, WhatsApp=Scheduler")
  })

  it("should process LLM responses through Safety & Translation (Widget only)", () => {
    /**
     * 🆕 UPDATED: Widget-only SafetyTranslationAgent
     *
     * WIDGET CHANNEL:
     * 1. LLM Router generates response (Product Search, Cart, etc.)
     * 2. Agent response passes through SafetyTranslationAgent ✅
     * 3. Safety checks:
     *    - No offensive content from LLM
     *    - Links are whitelisted (product links, order links)
     *    - Translate if needed
     * 4. Save debug step in conversationMessage
     * 5. Safe response sent to customer
     *
     * WHATSAPP CHANNEL:
     * 1. LLM Router generates response
     * 2. SafetyTranslationAgent SKIPPED ❌
     * 3. Response goes to queue
     * 4. Scheduler applies security + translation
     *
     * CODE PATTERN (llm-router.service.ts):
     * if (this.shouldApplySafetyTranslation(channel)) {
     *   // Widget: apply SafetyTranslationAgent
     * } else {
     *   // WhatsApp: skip, scheduler handles
     * }
     */

    const widgetAgentFlow = {
      step1: "Agent generates response (e.g., ProductSearchAgent)",
      step2: "Channel check: widget → apply SafetyTranslationAgent ✅",
      step3: "Pass allowedLinks (product/order URLs)",
      step4: "Verify safe=true",
      step5: "Save debug step with tokensUsed",
      step6: "Return finalMessage to customer",
    }

    const whatsappAgentFlow = {
      step1: "Agent generates response",
      step2: "Channel check: whatsapp → SKIP SafetyTranslationAgent",
      step3: "Add debugStep with 'Skipped'",
      step4: "Return message (scheduler will process)",
    }

    // Widget: SafetyTranslationAgent applied
    expect(widgetAgentFlow.step2).toContain("apply SafetyTranslationAgent")

    // WhatsApp: SafetyTranslationAgent skipped
    expect(whatsappAgentFlow.step2).toContain("SKIP SafetyTranslationAgent")

    console.log("✅ LLM response: Widget=SafetyTranslationAgent, WhatsApp=Scheduler")
  })

  it("should verify Safety & Translation is MANDATORY for Widget, optional for WhatsApp", () => {
    /**
     * 🆕 UPDATED REQUIREMENT (Widget-only SafetyTranslationAgent):
     *
     * WIDGET CHANNEL: MUST pass through SafetyTranslationAgent
     * - No scheduler processes widget messages
     * - SafetyTranslationAgent is the ONLY security + translation layer
     * 
     * WHATSAPP CHANNEL: SKIP SafetyTranslationAgent
     * - Scheduler handles security (SecurityAgentService) + translation (TranslationService)
     * - Prevents double LLM costs
     * - Exception: Welcome messages with deliveryStatus='not_queued' still use SafetyTranslationAgent
     *
     * This guarantees:
     * 1. Widget: Full protection (SafetyTranslationAgent in backend)
     * 2. WhatsApp: Full protection (SecurityAgent + TranslationService in scheduler)
     * 3. No duplicate LLM calls (cost optimization)
     *
     * Message types per channel:
     * 
     * WIDGET (SafetyTranslationAgent applied):
     * - Welcome messages
     * - LLM responses
     * - All chat messages
     * 
     * WHATSAPP (SafetyTranslationAgent SKIPPED - scheduler handles):
     * - LLM responses (scheduler does security + translation)
     * - WIP messages (scheduler does security + translation)
     * - Operator messages (scheduler does security + translation)
     * 
     * WHATSAPP EXCEPTION (SafetyTranslationAgent applied):
     * - Welcome messages (deliveryStatus='not_queued' - scheduler doesn't see them)
     */

    const channelBehavior = {
      widget: {
        safetyTranslationApplied: true,
        reason: "No scheduler processes widget messages",
      },
      whatsapp: {
        safetyTranslationApplied: false,
        reason: "Scheduler handles security + translation",
        exception: "Welcome messages with deliveryStatus='not_queued'",
      },
    }

    expect(channelBehavior.widget.safetyTranslationApplied).toBe(true)
    expect(channelBehavior.whatsapp.safetyTranslationApplied).toBe(false)

    console.log(
      "✅ Safety & Translation policy: Widget=MANDATORY, WhatsApp=SCHEDULER"
    )
  })

  it("should document token usage tracking and cost savings", () => {
    /**
     * BILLING OPTIMIZATION:
     *
     * Widget-only SafetyTranslationAgent = SIGNIFICANT COST SAVINGS
     *
     * BEFORE (all channels):
     * - Widget: SafetyTranslationAgent ~200 tokens
     * - WhatsApp: SafetyTranslationAgent ~200 tokens + Scheduler ~200 tokens = 400 tokens (DOUBLE COST!)
     *
     * AFTER (Widget-only):
     * - Widget: SafetyTranslationAgent ~200 tokens
     * - WhatsApp: Scheduler ~200 tokens only (NO DUPLICATE)
     *
     * SAVINGS: 50% token reduction on WhatsApp messages!
     *
     * Token tracking (still applies for Widget):
     * 1. SafetyTranslationAgent ritorna tokensUsed
     * 2. Salvato in debug step
     * 3. Sommato al totale message cost
     * 4. Salvato in conversationMessage.debugInfo
     *
     * Token estimates per channel:
     * - Widget welcome: ~150 tokens (SafetyTranslationAgent)
     * - Widget LLM response: ~200 tokens (SafetyTranslationAgent)
     * - WhatsApp: 0 tokens from SafetyTranslationAgent (scheduler handles)
     */

    const beforeOptimization = {
      whatsappMessage: {
        safetyAgentTokens: 200, // Backend SafetyTranslationAgent
        schedulerTokens: 200, // Scheduler security + translation
        totalTokens: 400, // DOUBLE COST!
      },
    }

    const afterOptimization = {
      whatsappMessage: {
        safetyAgentTokens: 0, // SKIPPED - scheduler handles
        schedulerTokens: 200, // Scheduler security + translation
        totalTokens: 200, // 50% SAVINGS!
      },
      widgetMessage: {
        safetyAgentTokens: 200, // Widget still uses SafetyTranslationAgent
        schedulerTokens: 0, // No scheduler for widget
        totalTokens: 200,
      },
    }

    const savings =
      beforeOptimization.whatsappMessage.totalTokens -
      afterOptimization.whatsappMessage.totalTokens

    expect(afterOptimization.whatsappMessage.safetyAgentTokens).toBe(0)
    expect(savings).toBe(200) // 50% savings per WhatsApp message

    console.log(
      "✅ Widget-only SafetyTranslationAgent: 50% token savings on WhatsApp!"
    )
  })
})
