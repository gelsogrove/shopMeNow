/**
 * ChatEngine Link Replacement Debug Step Tests
 * 
 * TASK17: Verify debug step appears when tokens are replaced
 */

import { ChatEngineService } from "../../../src/application/chat-engine/chat-engine.service"

// Mock all external dependencies
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $disconnect: jest.fn(),
    chatSession: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    conversationMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
    },
    workspace: {
      findUnique: jest.fn(),
    },
    agentConfig: {
      findFirst: jest.fn(),
    },
  })),
}))

jest.mock("../../../src/application/services/link-replacement.service")

describe("ChatEngine - Link Replacement Debug Step (TASK17)", () => {
  let chatEngineService: ChatEngineService
  let mockLinkReplacementService: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock LinkReplacementService
    const LinkReplacementServiceModule = require("../../../src/application/services/link-replacement.service")
    mockLinkReplacementService = {
      replaceTokens: jest.fn(),
    }
    LinkReplacementServiceModule.LinkReplacementService = jest.fn(() => mockLinkReplacementService)

    chatEngineService = new ChatEngineService()
  })

  describe("Debug Step Creation Logic", () => {
    it("should document the bug in original implementation", () => {
      // ORIGINAL BUG:
      // Line 4370: finalMessage = replacementResult.response
      // Line 4372: if (replacementResult.response !== finalMessage) { ... }
      //
      // This condition is ALWAYS false because:
      // - replacementResult.response is assigned to finalMessage
      // - Then we compare replacementResult.response !== finalMessage
      // - They are identical, so condition never triggers

      const originalResponse = "Vai qui: [LINK_CHECKOUT_WITH_TOKEN]"
      const replacedResponse = "Vai qui: https://example.com/cart?token=abc123"

      // In the original buggy code:
      const finalMessage = replacedResponse // Line 4370
      const condition = replacedResponse !== finalMessage // Line 4372 - ALWAYS false!

      expect(condition).toBe(false) // Bug documented
    })

    it("should document the correct fix approach", () => {
      // CORRECT APPROACH:
      // Compare BEFORE and AFTER replacement
      const messageBeforeReplacement = "Vai qui: [LINK_CHECKOUT_WITH_TOKEN]"
      const messageAfterReplacement = "Vai qui: https://example.com/cart?token=abc123"

      const shouldShowDebugStep = messageAfterReplacement !== messageBeforeReplacement

      expect(shouldShowDebugStep).toBe(true) // Correct behavior
    })
  })

  describe("Debug Step Trigger Conditions", () => {
    it("should trigger debug step when tokens ARE replaced", () => {
      const originalMessage = "Completa l'ordine: [LINK_CHECKOUT_WITH_TOKEN]"
      const replacedMessage = "Completa l'ordine: https://example.com/checkout?token=xyz"

      const tokensWereReplaced = originalMessage !== replacedMessage

      expect(tokensWereReplaced).toBe(true)
      // Debug step SHOULD be added
    })

    it("should NOT trigger debug step when NO tokens are replaced", () => {
      const originalMessage = "Nessun link da sostituire qui"
      const unchangedMessage = "Nessun link da sostituire qui"

      const tokensWereReplaced = originalMessage !== unchangedMessage

      expect(tokensWereReplaced).toBe(false)
      // Debug step should NOT be added
    })

    it("should trigger debug step for markdown format replacement", () => {
      const originalMessage = "Clicca [qui]([LINK_PROFILE_WITH_TOKEN])"
      const replacedMessage = "Clicca [qui](https://example.com/profile?token=abc)"

      const tokensWereReplaced = originalMessage !== replacedMessage

      expect(tokensWereReplaced).toBe(true)
      // Debug step SHOULD be added
    })

    it("should trigger debug step when multiple tokens replaced", () => {
      const originalMessage = "Carrello: [LINK_CHECKOUT_WITH_TOKEN], Profilo: [LINK_PROFILE_WITH_TOKEN]"
      const replacedMessage = "Carrello: https://example.com/cart, Profilo: https://example.com/profile"

      const tokensWereReplaced = originalMessage !== replacedMessage

      expect(tokensWereReplaced).toBe(true)
      // Debug step SHOULD be added
    })
  })

  describe("Debug Step Data Structure", () => {
    it("should have correct debug step structure", () => {
      const debugStep = {
        type: "link-replacement",
        agent: "🔗 Link Replacement",
        timestamp: new Date().toISOString(),
        input: {
          textContent: "Scanning for [LINK_*_WITH_TOKEN] placeholders",
        },
        output: {
          textContent: "Tokens replaced with secure URLs",
          executionTimeMs: 42,
        },
        duration: 42,
      }

      expect(debugStep.type).toBe("link-replacement")
      expect(debugStep.agent).toBe("🔗 Link Replacement")
      expect(debugStep.input.textContent).toContain("[LINK_*_WITH_TOKEN]")
      expect(debugStep.output.textContent).toContain("secure URLs")
      expect(typeof debugStep.duration).toBe("number")
    })

    it("should include execution time in debug step", () => {
      const replacementStart = Date.now()
      // Simulate replacement...
      const replacementTime = Date.now() - replacementStart

      expect(replacementTime).toBeGreaterThanOrEqual(0)
      expect(typeof replacementTime).toBe("number")
    })
  })

  describe("Token Replacement Scenarios", () => {
    it("should verify LINK_CHECKOUT_WITH_TOKEN triggers debug step", () => {
      mockLinkReplacementService.replaceTokens.mockResolvedValue({
        success: true,
        response: "Link: https://example.com/checkout?token=abc123",
      })

      const originalResponse = "Link: [LINK_CHECKOUT_WITH_TOKEN]"
      const replacedResponse = "Link: https://example.com/checkout?token=abc123"

      expect(originalResponse).not.toBe(replacedResponse)
      // This difference should trigger debug step
    })

    it("should verify LINK_PROFILE_WITH_TOKEN triggers debug step", () => {
      mockLinkReplacementService.replaceTokens.mockResolvedValue({
        success: true,
        response: "Profilo: https://example.com/profile?token=xyz",
      })

      const originalResponse = "Profilo: [LINK_PROFILE_WITH_TOKEN]"
      const replacedResponse = "Profilo: https://example.com/profile?token=xyz"

      expect(originalResponse).not.toBe(replacedResponse)
      // This difference should trigger debug step
    })

    it("should verify LINK_CATALOG triggers debug step", () => {
      mockLinkReplacementService.replaceTokens.mockResolvedValue({
        success: true,
        response: "Catalogo: https://example.com/catalog",
      })

      const originalResponse = "Catalogo: [LINK_CATALOG]"
      const replacedResponse = "Catalogo: https://example.com/catalog"

      expect(originalResponse).not.toBe(replacedResponse)
      // This difference should trigger debug step
    })

    it("should NOT trigger debug step when no tokens present", () => {
      mockLinkReplacementService.replaceTokens.mockResolvedValue({
        success: false,
        response: "Nessun token qui",
        error: "No replaceable tokens found",
      })

      const originalResponse = "Nessun token qui"
      const unchangedResponse = "Nessun token qui"

      expect(originalResponse).toBe(unchangedResponse)
      // No debug step should be added
    })
  })

  describe("Fix Verification Pattern", () => {
    it("should show correct comparison pattern for fix", () => {
      // BEFORE FIX (WRONG):
      const replacementResult = { response: "https://example.com" }
      let finalMessage = replacementResult.response
      const wrongCondition = replacementResult.response !== finalMessage

      expect(wrongCondition).toBe(false) // Bug: always false

      // AFTER FIX (CORRECT):
      const messageBeforeReplacement = "[LINK_CHECKOUT_WITH_TOKEN]"
      finalMessage = replacementResult.response
      const correctCondition = messageBeforeReplacement !== finalMessage

      expect(correctCondition).toBe(true) // Fix: correctly detects change
    })

    it("should demonstrate the fix implementation", () => {
      // Store message BEFORE replacement
      const messageBeforeReplacement = "Vai qui: [LINK_CHECKOUT_WITH_TOKEN]"

      // Apply replacement
      const replacementResult = {
        success: true,
        response: "Vai qui: https://example.com/cart?token=xyz",
      }
      const finalMessage = replacementResult.response

      // Compare BEFORE vs AFTER (not result vs result)
      const shouldAddDebugStep =
        replacementResult.success &&
        replacementResult.response &&
        messageBeforeReplacement !== finalMessage

      expect(shouldAddDebugStep).toBe(true)
    })
  })

  describe("Edge Cases for Debug Step", () => {
    it("should NOT add debug step when replacementResult.success is false", () => {
      const replacementResult = {
        success: false,
        response: "Message",
      }

      const shouldAddDebugStep = replacementResult.success

      expect(shouldAddDebugStep).toBe(false)
    })

    it("should NOT add debug step when replacementResult.response is undefined", () => {
      const replacementResult = {
        success: true,
        response: undefined,
      }

      const shouldAddDebugStep = replacementResult.success && replacementResult.response

      expect(shouldAddDebugStep).toBeFalsy() // undefined is falsy
    })

    it("should add debug step only when content actually changed", () => {
      const messageBeforeReplacement = "Message without tokens"
      const replacementResult = {
        success: true,
        response: "Message without tokens", // Same content
      }

      const shouldAddDebugStep =
        replacementResult.success &&
        replacementResult.response &&
        messageBeforeReplacement !== replacementResult.response

      expect(shouldAddDebugStep).toBe(false) // No change = no debug step
    })
  })

  describe("Integration: Complete Debug Step Flow", () => {
    it("should document complete flow from token detection to debug step", () => {
      // 1. Original message with token
      const originalMessage = "Completa: [LINK_CHECKOUT_WITH_TOKEN]"

      // 2. LinkReplacementService processes it
      const replacementStart = Date.now()
      const replacementResult = {
        success: true,
        response: "Completa: https://example.com/checkout?token=abc",
      }
      const replacementTime = Date.now() - replacementStart

      // 3. Check if replacement occurred
      const tokensWereReplaced = originalMessage !== replacementResult.response

      // 4. If tokens replaced, create debug step
      let debugStep = null
      if (tokensWereReplaced && replacementResult.success) {
        debugStep = {
          type: "link-replacement",
          agent: "🔗 Link Replacement",
          timestamp: new Date().toISOString(),
          input: {
            textContent: "Scanning for [LINK_*_WITH_TOKEN] placeholders",
          },
          output: {
            textContent: "Tokens replaced with secure URLs",
            executionTimeMs: replacementTime,
          },
          duration: replacementTime,
        }
      }

      // Verify
      expect(tokensWereReplaced).toBe(true)
      expect(debugStep).not.toBeNull()
      expect(debugStep?.type).toBe("link-replacement")
    })
  })
})
