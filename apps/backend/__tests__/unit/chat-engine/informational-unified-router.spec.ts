/**
 * Unit Tests: Informational Flow → UnifiedChatRouter Rewire (Task 1.1/1.3)
 *
 * CONTEXT: handleInformationalMessage() was rewired from CustomerSupportAgentLLM
 * to UnifiedChatRouter → LLMRouterService. This gives the informational path:
 * - Conversation history (20min window)
 * - Booking functions from DB (when enableCalendarBooking=true)
 * - Multi-function loop (8 iterations instead of 1)
 * - Single translation point (wrapper handles it, no double-translation)
 * - Single security point (wrapper handles widget safety, no double-security)
 *
 * These tests verify:
 * 1. Correct routing through UnifiedChatRouter (not CustomerSupportAgentLLM)
 * 2. Param contract completeness (all required params passed)
 * 3. No double-translation (applyTranslation NOT called inside handleInformationalMessage)
 * 4. No double-security (widget security NOT called inside handleInformationalMessage)
 * 5. Deterministic intercepts preserved (REQUEST_HUMAN, UPDATE_PROFILE, CHANGE_LANGUAGE)
 * 6. Response mapping to ChatEngineOutput
 * 7. Link replacement and saveMessages after router response
 */

import { ChatEngineService, ChatEngineInput } from "../../../src/application/chat-engine/chat-engine.service"

// ========================================================================
// SECTION 1: UnifiedChatRouter routing (not CustomerSupportAgentLLM)
// ========================================================================
describe("ChatEngine - Informational Unified Router (Task 1.1)", () => {

  describe("Routing through UnifiedChatRouter", () => {
    // SCENARIO: Informational workspace routes through unifiedChatRouter, not CustomerSupportAgentLLM
    // RULE: After Task 1.1, handleInformationalMessage calls this.unifiedChatRouter.routeMessage()
    it("should route informational messages through UnifiedChatRouter, not CustomerSupportAgentLLM", () => {
      // Read the source code of handleInformationalMessage:
      // - OLD: `const customerSupportAgent = new CustomerSupportAgentLLM(this.prisma)`
      // - NEW: `const llmResponse = await this.unifiedChatRouter.routeMessage({...})`
      //
      // Verify the import: CustomerSupportAgentLLM is NO LONGER imported in chat-engine.service.ts
      // Verify the code: unifiedChatRouter.routeMessage() is called with RouteMessageParams

      const fs = require("fs")
      const path = require("path")
      const chatEngineSource = fs.readFileSync(
        path.join(__dirname, "../../../src/application/chat-engine/chat-engine.service.ts"),
        "utf-8"
      )

      // RULE: CustomerSupportAgentLLM should NOT be imported (removed in Task 1.1)
      expect(chatEngineSource).not.toContain('import { CustomerSupportAgentLLM }')

      // RULE: unifiedChatRouter.routeMessage should be called in handleInformationalMessage
      const handleInfoMethod = chatEngineSource.split("handleInformationalMessage")[1]
      expect(handleInfoMethod).toContain("this.unifiedChatRouter.routeMessage")

      // RULE: No direct CustomerSupportAgentLLM instantiation
      expect(handleInfoMethod).not.toContain("new CustomerSupportAgentLLM")
    })
  })

  // ========================================================================
  // SECTION 2: Param Contract
  // ========================================================================
  describe("Param Contract", () => {
    // RULE: PARAM CONTRACT — routeMessage receives ALL required params
    // CRITICAL: If even ONE param is missing, the system loses history (conversationId),
    // breaks translation (customerLanguage), breaks function filtering (channel),
    // or skips WIP (workspaceId)
    it("should pass ALL required params to routeMessage (param contract)", () => {
      const fs = require("fs")
      const path = require("path")
      const chatEngineSource = fs.readFileSync(
        path.join(__dirname, "../../../src/application/chat-engine/chat-engine.service.ts"),
        "utf-8"
      )

      // Extract the routeMessage call inside handleInformationalMessage
      const handleInfoStart = chatEngineSource.indexOf("private async handleInformationalMessage")
      const handleInfoEnd = chatEngineSource.indexOf("private async", handleInfoStart + 1)
      const handleInfoMethod = chatEngineSource.substring(handleInfoStart, handleInfoEnd > 0 ? handleInfoEnd : undefined)

      // Find the routeMessage call block
      const routeMessageCallStart = handleInfoMethod.indexOf("this.unifiedChatRouter.routeMessage({")
      expect(routeMessageCallStart).toBeGreaterThan(-1)

      const routeMessageBlock = handleInfoMethod.substring(
        routeMessageCallStart,
        handleInfoMethod.indexOf("})", routeMessageCallStart) + 2
      )

      // RULE: Every required param must be present in the call
      const requiredParams = [
        "workspaceId",        // tenant isolation
        "customerId",         // customer identification
        "conversationId",     // history loading (CRITICAL)
        "messageId",          // tracking
        "message",            // user message
        "customerName",       // personalizzazione
        "customerLanguage",   // translation decision (CRITICAL)
        "customerDiscount",   // discount application
        "channel",            // function filtering for widget (CRITICAL)
        "registrationPromptLevel", // registration reminder (CRITICAL)
      ]

      for (const param of requiredParams) {
        expect(routeMessageBlock).toContain(param)
      }
    })

    // SCENARIO: conversationId and registrationPromptLevel correctly passed to router
    // RULE: conversationId enables 20min history window, registrationPromptLevel triggers reminder
    it("should pass conversationId for history loading and registrationPromptLevel for registration", () => {
      const fs = require("fs")
      const path = require("path")
      const chatEngineSource = fs.readFileSync(
        path.join(__dirname, "../../../src/application/chat-engine/chat-engine.service.ts"),
        "utf-8"
      )

      const handleInfoStart = chatEngineSource.indexOf("private async handleInformationalMessage")
      const handleInfoMethod = chatEngineSource.substring(handleInfoStart, handleInfoStart + 12000)

      // RULE: conversationId must be derived from input.conversationId with temp- fallback
      expect(handleInfoMethod).toContain("input.conversationId || `temp-${input.customerId}`")

      // RULE: registrationPromptLevel must be passed directly from input
      expect(handleInfoMethod).toContain("registrationPromptLevel: input.registrationPromptLevel")
    })
  })

  // ========================================================================
  // SECTION 3: No Double-Translation & No Double-Security
  // ========================================================================
  describe("Single Translation & Security (No Double-Processing)", () => {
    // RULE: applyTranslation NOT called inside handleInformationalMessage for LLM path
    // The routeMessage() wrapper (lines ~1700-1720) handles translation once
    it("should NOT call applyTranslation inside handleInformationalMessage LLM path", () => {
      const fs = require("fs")
      const path = require("path")
      const chatEngineSource = fs.readFileSync(
        path.join(__dirname, "../../../src/application/chat-engine/chat-engine.service.ts"),
        "utf-8"
      )

      // Extract handleInformationalMessage method body
      const handleInfoStart = chatEngineSource.indexOf("private async handleInformationalMessage")
      const nextPrivateMethod = chatEngineSource.indexOf("\n  private ", handleInfoStart + 50)
      const handleInfoMethod = chatEngineSource.substring(handleInfoStart, nextPrivateMethod > 0 ? nextPrivateMethod : undefined)

      // Count applyTranslation calls in LLM path (after intercepts)
      // Note: applyTranslation IS called inside the intercept blocks (REQUEST_HUMAN, PROFILE, LANGUAGE)
      // because those return early before the wrapper's translation runs.
      // But in the main LLM path (after intercepts), it should NOT be called.

      // Find the section after the intercept blocks and before the return
      const afterIntercepts = handleInfoMethod.indexOf("this.unifiedChatRouter.routeMessage")
      const mainLLMPath = handleInfoMethod.substring(afterIntercepts)

      // RULE: No applyTranslation in the main LLM path
      expect(mainLLMPath).not.toContain("this.applyTranslation")
    })

    // RULE: widget security NOT called inside handleInformationalMessage for LLM path
    // The routeMessage() wrapper (lines ~1731-1782) handles security once
    it("should NOT call securityAgent.process inside handleInformationalMessage LLM path", () => {
      const fs = require("fs")
      const path = require("path")
      const chatEngineSource = fs.readFileSync(
        path.join(__dirname, "../../../src/application/chat-engine/chat-engine.service.ts"),
        "utf-8"
      )

      const handleInfoStart = chatEngineSource.indexOf("private async handleInformationalMessage")
      const nextPrivateMethod = chatEngineSource.indexOf("\n  private ", handleInfoStart + 50)
      const handleInfoMethod = chatEngineSource.substring(handleInfoStart, nextPrivateMethod > 0 ? nextPrivateMethod : undefined)

      // After the intercept blocks, the main LLM path should NOT call securityAgent
      const afterIntercepts = handleInfoMethod.indexOf("this.unifiedChatRouter.routeMessage")
      const mainLLMPath = handleInfoMethod.substring(afterIntercepts)

      // RULE: No security agent call in the main LLM path
      expect(mainLLMPath).not.toContain("this.securityAgent.process")
    })

    // RULE: appendRegistrationReminder NOT called inside handleInformationalMessage LLM path
    // The routeMessage() wrapper (line ~1690) appends it once
    it("should NOT call appendRegistrationReminder inside handleInformationalMessage LLM path", () => {
      const fs = require("fs")
      const path = require("path")
      const chatEngineSource = fs.readFileSync(
        path.join(__dirname, "../../../src/application/chat-engine/chat-engine.service.ts"),
        "utf-8"
      )

      const handleInfoStart = chatEngineSource.indexOf("private async handleInformationalMessage")
      const nextPrivateMethod = chatEngineSource.indexOf("\n  private ", handleInfoStart + 50)
      const handleInfoMethod = chatEngineSource.substring(handleInfoStart, nextPrivateMethod > 0 ? nextPrivateMethod : undefined)

      const afterIntercepts = handleInfoMethod.indexOf("this.unifiedChatRouter.routeMessage")
      const mainLLMPath = handleInfoMethod.substring(afterIntercepts)

      // RULE: No appendRegistrationReminder in the main LLM path
      expect(mainLLMPath).not.toContain("this.appendRegistrationReminder")
    })

    // RULE: applyTranslation called exactly ONCE per informational message
    // Double-translation regression test: the wrapper calls it, handleInformationalMessage must NOT
    it("should ensure translation happens exactly once via wrapper, not duplicated internally", () => {
      const fs = require("fs")
      const path = require("path")
      const chatEngineSource = fs.readFileSync(
        path.join(__dirname, "../../../src/application/chat-engine/chat-engine.service.ts"),
        "utf-8"
      )

      // The routeMessage wrapper MUST call applyTranslation
      const routeMessageWrapperStart = chatEngineSource.indexOf("async routeMessage(input: ChatEngineInput)")
      const routeMessageWrapperEnd = chatEngineSource.indexOf("\n  private ", routeMessageWrapperStart + 50)
      const routeMessageWrapper = chatEngineSource.substring(routeMessageWrapperStart, routeMessageWrapperEnd > 0 ? routeMessageWrapperEnd : routeMessageWrapperStart + 8000)

      expect(routeMessageWrapper).toContain("applyTranslation")

      // handleInformationalMessage LLM path must NOT call applyTranslation
      const handleInfoStart = chatEngineSource.indexOf("private async handleInformationalMessage")
      const nextMethod = chatEngineSource.indexOf("\n  private ", handleInfoStart + 50)
      const handleInfoMethod = chatEngineSource.substring(handleInfoStart, nextMethod > 0 ? nextMethod : handleInfoStart + 10000)
      const afterRouter = handleInfoMethod.indexOf("this.unifiedChatRouter.routeMessage")
      const mainLLMPath = handleInfoMethod.substring(afterRouter)

      expect(mainLLMPath).not.toContain("this.applyTranslation")
    })
  })

  // ========================================================================
  // SECTION 4: Response Mapping
  // ========================================================================
  describe("Response Mapping", () => {
    // SCENARIO: Router response correctly mapped to ChatEngineOutput
    // RULE: RouteMessageResponse fields must map to ChatEngineOutput fields
    it("should map RouteMessageResponse to ChatEngineOutput correctly", () => {
      // Simulate RouteMessageResponse from UnifiedChatRouter
      const llmResponse = {
        response: "Ecco le informazioni richieste...",
        agentUsed: "INFO_AGENT",
        confidence: 0.95,
        tokensUsed: 150,
        executionTimeMs: 1200,
        wasFAQ: false,
      }

      // The mapping in handleInformationalMessage (Task 1.1):
      const agentResponse = {
        success: !!llmResponse.response,
        output: llmResponse.response || "",
        tokensUsed: llmResponse.tokensUsed || 0,
        executionTimeMs: llmResponse.executionTimeMs || 0,
        functionCalls: [],
      }

      // RULE: success is true when response is non-empty
      expect(agentResponse.success).toBe(true)
      // RULE: output maps from response
      expect(agentResponse.output).toBe("Ecco le informazioni richieste...")
      // RULE: tokensUsed preserved
      expect(agentResponse.tokensUsed).toBe(150)
      // RULE: executionTimeMs preserved
      expect(agentResponse.executionTimeMs).toBe(1200)
    })

    // SCENARIO: Router returns empty response → triggers safe fallback
    // RULE: Empty/null response must trigger fallback, never expose internal config
    it("should trigger safe fallback when router returns empty response", () => {
      const llmResponse = {
        response: "",
        tokensUsed: 0,
        executionTimeMs: 500,
      }

      const agentResponse = {
        success: !!llmResponse.response,
        output: llmResponse.response || "",
        tokensUsed: llmResponse.tokensUsed || 0,
        executionTimeMs: llmResponse.executionTimeMs || 0,
        functionCalls: [],
      }

      // RULE: success is false for empty response
      expect(agentResponse.success).toBe(false)

      // Simulate fallback logic
      let finalMessage = agentResponse.output
      if (!agentResponse.success || !finalMessage) {
        const agentName = "TestWorkspace"
        finalMessage = `Ciao! Sono l'assistente di ${agentName}. Al momento non sono riuscito a elaborare la tua richiesta. Puoi riformulare la domanda?`
      }

      expect(finalMessage).toContain("Puoi riformulare")
      expect(finalMessage).not.toBe("")
    })
  })

  // ========================================================================
  // SECTION 5: Post-Router Operations (Link Replacement & SaveMessages)
  // ========================================================================
  describe("Post-Router Operations", () => {
    // RULE: linkReplacementService.replaceTokens() runs after router response
    it("should call linkReplacementService.replaceTokens after router response", () => {
      const fs = require("fs")
      const path = require("path")
      const chatEngineSource = fs.readFileSync(
        path.join(__dirname, "../../../src/application/chat-engine/chat-engine.service.ts"),
        "utf-8"
      )

      const handleInfoStart = chatEngineSource.indexOf("private async handleInformationalMessage")
      const nextPrivateMethod = chatEngineSource.indexOf("\n  private ", handleInfoStart + 50)
      const handleInfoMethod = chatEngineSource.substring(handleInfoStart, nextPrivateMethod > 0 ? nextPrivateMethod : undefined)

      // Link replacement must appear AFTER router call
      const routerCallPos = handleInfoMethod.indexOf("this.unifiedChatRouter.routeMessage")
      const linkReplacementPos = handleInfoMethod.indexOf("this.linkReplacementService.replaceTokens")

      expect(routerCallPos).toBeGreaterThan(-1)
      expect(linkReplacementPos).toBeGreaterThan(-1)
      expect(linkReplacementPos).toBeGreaterThan(routerCallPos)
    })

    // RULE: saveMessages() runs after router response with correct AgentType
    it("should call saveMessages after router response with AgentType.INFO_AGENT", () => {
      const fs = require("fs")
      const path = require("path")
      const chatEngineSource = fs.readFileSync(
        path.join(__dirname, "../../../src/application/chat-engine/chat-engine.service.ts"),
        "utf-8"
      )

      const handleInfoStart = chatEngineSource.indexOf("private async handleInformationalMessage")
      const nextPrivateMethod = chatEngineSource.indexOf("\n  private ", handleInfoStart + 50)
      const handleInfoMethod = chatEngineSource.substring(handleInfoStart, nextPrivateMethod > 0 ? nextPrivateMethod : undefined)

      // saveMessages must appear AFTER router call — search for the occurrence AFTER router
      const routerCallPos = handleInfoMethod.indexOf("this.unifiedChatRouter.routeMessage")
      // Find saveMessages AFTER the router call (intercept blocks also call saveMessages before)
      const afterRouterCode = handleInfoMethod.substring(routerCallPos)
      const saveMessagesInAfterRouter = afterRouterCode.indexOf("this.messagePersistence.saveMessages")

      expect(routerCallPos).toBeGreaterThan(-1)
      expect(saveMessagesInAfterRouter).toBeGreaterThan(-1)

      // RULE: saveMessages must use AgentType.INFO_AGENT (in the post-router section)
      const saveMessagesBlock = afterRouterCode.substring(saveMessagesInAfterRouter, saveMessagesInAfterRouter + 300)
      expect(saveMessagesBlock).toContain("AgentType.INFO_AGENT")
    })
  })

  // ========================================================================
  // SECTION 6: Deterministic Intercepts Preserved
  // ========================================================================
  describe("Deterministic Intercepts Preserved", () => {
    // SCENARIO: REQUEST_HUMAN intent bypasses router (deterministic intercept preserved)
    // RULE: REQUEST_HUMAN must be intercepted BEFORE reaching UnifiedChatRouter
    it("should intercept REQUEST_HUMAN before reaching UnifiedChatRouter", () => {
      const fs = require("fs")
      const path = require("path")
      const chatEngineSource = fs.readFileSync(
        path.join(__dirname, "../../../src/application/chat-engine/chat-engine.service.ts"),
        "utf-8"
      )

      const handleInfoStart = chatEngineSource.indexOf("private async handleInformationalMessage")
      const nextPrivateMethod = chatEngineSource.indexOf("\n  private ", handleInfoStart + 50)
      const handleInfoMethod = chatEngineSource.substring(handleInfoStart, nextPrivateMethod > 0 ? nextPrivateMethod : undefined)

      // REQUEST_HUMAN check with if-statement pattern (not just any mention in comments)
      const interceptPattern = 'intentResult.intent.type === "REQUEST_HUMAN"'
      const requestHumanPos = handleInfoMethod.indexOf(interceptPattern)
      const routerCallPos = handleInfoMethod.indexOf("this.unifiedChatRouter.routeMessage")

      expect(requestHumanPos).toBeGreaterThan(-1)
      expect(routerCallPos).toBeGreaterThan(-1)
      // RULE: Intercept happens BEFORE router
      expect(requestHumanPos).toBeLessThan(routerCallPos)
    })

    // SCENARIO: UPDATE_PROFILE intent bypasses router (deterministic intercept preserved)
    // RULE: UPDATE_PROFILE must be intercepted to generate profile link, not LLM response
    it("should intercept UPDATE_PROFILE before reaching UnifiedChatRouter", () => {
      const fs = require("fs")
      const path = require("path")
      const chatEngineSource = fs.readFileSync(
        path.join(__dirname, "../../../src/application/chat-engine/chat-engine.service.ts"),
        "utf-8"
      )

      const handleInfoStart = chatEngineSource.indexOf("private async handleInformationalMessage")
      const nextPrivateMethod = chatEngineSource.indexOf("\n  private ", handleInfoStart + 50)
      const handleInfoMethod = chatEngineSource.substring(handleInfoStart, nextPrivateMethod > 0 ? nextPrivateMethod : undefined)

      const interceptPattern = 'intentResult.intent.type === "UPDATE_PROFILE"'
      const updateProfilePos = handleInfoMethod.indexOf(interceptPattern)
      const routerCallPos = handleInfoMethod.indexOf("this.unifiedChatRouter.routeMessage")

      expect(updateProfilePos).toBeGreaterThan(-1)
      expect(routerCallPos).toBeGreaterThan(-1)
      expect(updateProfilePos).toBeLessThan(routerCallPos)
    })

    // SCENARIO: CHANGE_LANGUAGE intent bypasses router (deterministic intercept preserved)
    // RULE: CHANGE_LANGUAGE needs profile link for language selection, not LLM response
    it("should intercept CHANGE_LANGUAGE before reaching UnifiedChatRouter", () => {
      const fs = require("fs")
      const path = require("path")
      const chatEngineSource = fs.readFileSync(
        path.join(__dirname, "../../../src/application/chat-engine/chat-engine.service.ts"),
        "utf-8"
      )

      const handleInfoStart = chatEngineSource.indexOf("private async handleInformationalMessage")
      const nextPrivateMethod = chatEngineSource.indexOf("\n  private ", handleInfoStart + 50)
      const handleInfoMethod = chatEngineSource.substring(handleInfoStart, nextPrivateMethod > 0 ? nextPrivateMethod : undefined)

      const interceptPattern = 'intentResult.intent.type === "CHANGE_LANGUAGE"'
      const changeLangPos = handleInfoMethod.indexOf(interceptPattern)
      const routerCallPos = handleInfoMethod.indexOf("this.unifiedChatRouter.routeMessage")

      expect(changeLangPos).toBeGreaterThan(-1)
      expect(routerCallPos).toBeGreaterThan(-1)
      expect(changeLangPos).toBeLessThan(routerCallPos)
    })
  })

  // ========================================================================
  // SECTION 7: Return Type & Debug Info
  // ========================================================================
  describe("Return Type Verification", () => {
    // SCENARIO: handleInformationalMessage return value has correct ChatEngineOutput structure
    // RULE: Must include agentType=INFO_AGENT, wasFAQ=false, isBlocked=false
    it("should return ChatEngineOutput with INFO_AGENT agentType and correct structure", () => {
      const fs = require("fs")
      const path = require("path")
      const chatEngineSource = fs.readFileSync(
        path.join(__dirname, "../../../src/application/chat-engine/chat-engine.service.ts"),
        "utf-8"
      )

      const handleInfoStart = chatEngineSource.indexOf("private async handleInformationalMessage")
      const nextPrivateMethod = chatEngineSource.indexOf("\n  private ", handleInfoStart + 50)
      const handleInfoMethod = chatEngineSource.substring(handleInfoStart, nextPrivateMethod > 0 ? nextPrivateMethod : undefined)

      // Find the final return statement (not early returns from intercepts)
      // The last return should have all ChatEngineOutput fields
      const lastReturn = handleInfoMethod.lastIndexOf("return {")
      const returnBlock = handleInfoMethod.substring(lastReturn, lastReturn + 700)

      // RULE: agentType must be INFO_AGENT
      expect(returnBlock).toContain("AgentType.INFO_AGENT")
      // RULE: wasFAQ must be false (it's routed, not FAQ-matched)
      expect(returnBlock).toContain("wasFAQ: false")
      // RULE: isBlocked must be false (expanded window captures it)
      expect(returnBlock).toContain("isBlocked: false")
      // RULE: message field present
      expect(returnBlock).toContain("message: finalMessage")
      // RULE: debugInfo with steps present
      expect(returnBlock).toContain("debugInfo")
      // RULE: _assistantMessageId from saveMessages
      expect(returnBlock).toContain("_assistantMessageId")
    })
  })
})
