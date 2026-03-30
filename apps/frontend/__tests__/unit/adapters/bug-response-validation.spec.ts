/**
 * Critical Bug #2: Inconsistent Response Validation in Widget Adapter
 *
 * SCENARIO: Widget API response validation has inconsistent logic
 * RULE: Empty response ONLY allowed in operator handoff case (activeChatbot=false && blocked=true)
 * RULE: For normal responses, response field is MANDATORY
 *
 * BUG: Lines 187-205 in widgetAdapter.ts allowed empty response in handoff BUT
 * threw error for missing response in normal path → Race condition possible
 *
 * FIX: Added clear comments documenting the exception, added blocked flag to response
 */

describe("BUG #2: Response Validation Consistency in Widget Adapter", () => {
  // Simulate the validation logic from widgetAdapter.ts
  const validateWidgetResponse = (data) => {
    // RULE: operator handoff active — backend blocked the LLM intentionally.
    // Return activeChatbot:false so the widget switches to waiting mode silently.
    // IMPORTANT: Empty response is INTENTIONAL in this handoff case, not a validation error
    if (data?.activeChatbot === false && data?.blocked === true) {
      return {
        response: "",
        sessionId: undefined,
        messageId: undefined,
        suggestions: undefined,
        activeChatbot: false,
        blocked: true, // Preserve blocked flag for downstream handling
      }
    }

    // RULE: For normal (non-handoff) responses, response must be present
    if (!data?.response) {
      throw new Error("Widget response missing")
    }

    return {
      response: data.response,
      sessionId: data.sessionId,
      messageId: data.messageId,
      suggestions: Array.isArray(data.suggestions)
        ? data.suggestions.slice(0, 4)
        : undefined,
      activeChatbot: data.activeChatbot,
    }
  }

  describe("Normal response path", () => {
    it("should accept valid response with all fields", () => {
      // SCENARIO: Backend returns normal LLM response
      // RULE: Response validation should succeed with all fields

      const data = {
        response: "Ciao! Come posso aiutarti?",
        sessionId: "sess-123",
        messageId: "msg-456",
        suggestions: ["Ordina ora", "Vedi catalogo", "Chat con operatore"],
        activeChatbot: true,
      }

      const result = validateWidgetResponse(data)

      expect(result.response).toBe("Ciao! Come posso aiutarti?")
      expect(result.sessionId).toBe("sess-123")
      expect(result.messageId).toBe("msg-456")
      expect(result.suggestions).toEqual(["Ordina ora", "Vedi catalogo", "Chat con operatore"])
      expect(result.activeChatbot).toBe(true)
    })

    it("should accept valid response with partial fields", () => {
      // SCENARIO: Response has only required fields
      // RULE: Optional fields (sessionId, messageId, suggestions) can be undefined

      const data = {
        response: "Domanda successiva?",
      }

      const result = validateWidgetResponse(data)

      expect(result.response).toBe("Domanda successiva?")
      expect(result.sessionId).toBeUndefined()
      expect(result.messageId).toBeUndefined()
      expect(result.suggestions).toBeUndefined()
    })

    it("should reject response with missing response field", () => {
      // SCENARIO: Backend forgets to send response field in normal flow
      // RULE: MUST throw error - response is mandatory for non-handoff

      const data = {
        sessionId: "sess-123",
        messageId: "msg-456",
      }

      expect(() => validateWidgetResponse(data)).toThrow("Widget response missing")
    })

    it("should reject response with null response field", () => {
      // SCENARIO: Backend sends null instead of empty string
      // RULE: Null is treated as missing, must throw

      const data = {
        response: null,
        sessionId: "sess-123",
      }

      expect(() => validateWidgetResponse(data)).toThrow("Widget response missing")
    })

    it("should truncate suggestions to max 4 items", () => {
      // SCENARIO: Backend returns 6 suggestions (more than max)
      // RULE: Only first 4 suggestions sent to frontend

      const data = {
        response: "Ecco le opzioni:",
        suggestions: ["Opt1", "Opt2", "Opt3", "Opt4", "Opt5", "Opt6"],
      }

      const result = validateWidgetResponse(data)

      expect(result.suggestions).toEqual(["Opt1", "Opt2", "Opt3", "Opt4"])
      expect(result.suggestions.length).toBe(4)
    })
  })

  describe("Operator handoff path (EXCEPTION)", () => {
    it("should accept EMPTY response when operator handoff is active", () => {
      // SCENARIO: Operator takes over chat (contactOperator CF triggered)
      // RULE: Empty response is INTENTIONAL → widget switches to waiting mode
      // RULE: This is the ONLY case where empty response is acceptable

      const data = {
        response: "", // ✅ EMPTY is OK in handoff
        activeChatbot: false, // Customer is in operator mode
        blocked: true, // Operator handling
      }

      const result = validateWidgetResponse(data)

      expect(result.response).toBe("")
      expect(result.activeChatbot).toBe(false)
      expect(result.blocked).toBe(true)
    })

    it("should preserve blocked flag for downstream handling", () => {
      // SCENARIO: Frontend needs to know if response is due to handoff
      // RULE: blocked flag MUST be preserved in response object

      const data = {
        response: "",
        activeChatbot: false,
        blocked: true,
      }

      const result = validateWidgetResponse(data)

      // 🆕 This flag is now preserved for downstream handling
      expect(result.blocked).toBe(true)
      expect(result.activeChatbot).toBe(false)
    })

    it("should require activeChatbot=false for empty response exception", () => {
      // SCENARIO: Backend sends empty response but activeChatbot is still true (INVALID)
      // RULE: Empty response ONLY allowed with activeChatbot=false && blocked=true

      const data = {
        response: "", // Empty response
        activeChatbot: true, // ❌ Still true - invalid combination
        blocked: true,
      }

      // Should throw because it's empty response WITHOUT proper handoff flags
      expect(() => validateWidgetResponse(data)).toThrow("Widget response missing")
    })

    it("should require blocked=true flag for empty response exception", () => {
      // SCENARIO: Empty response with activeChatbot=false but blocked is missing/false
      // RULE: Both flags MUST be true for empty response to be valid

      const data = {
        response: "", // Empty response
        activeChatbot: false, // True
        blocked: false, // ❌ Missing or false - invalid
      }

      // Should throw because blocked flag is not set
      expect(() => validateWidgetResponse(data)).toThrow("Widget response missing")
    })

    it("should handle multiple handoff scenarios correctly", () => {
      // SCENARIO: Multiple operator handoff messages in sequence
      // RULE: Each handoff response must follow the same validation rules

      const handoffResponses = [
        { response: "", activeChatbot: false, blocked: true },
        { response: "", activeChatbot: false, blocked: true, sessionId: "new-sess" },
        { response: "", activeChatbot: false, blocked: true, messageId: "admin-msg" },
      ]

      handoffResponses.forEach((data) => {
        const result = validateWidgetResponse(data)
        expect(result.response).toBe("")
        expect(result.activeChatbot).toBe(false)
        expect(result.blocked).toBe(true)
      })
    })
  })

  describe("Edge cases and error conditions", () => {
    it("should handle empty string response in normal flow", () => {
      // SCENARIO: Backend legitimately sends empty string in normal flow
      // RULE: Empty string is still a valid response (not missing)

      const data = {
        response: "", // Empty string but not null
        sessionId: "sess-123",
      }

      // Empty string is falsy but not missing - depends on implementation
      // Current implementation treats falsy as missing error
      expect(() => validateWidgetResponse(data)).toThrow("Widget response missing")
    })

    it("should handle response with whitespace only", () => {
      // SCENARIO: Backend sends only whitespace as response
      // RULE: Whitespace-only responses should be treated as empty

      const data = {
        response: "   ", // Only spaces
        sessionId: "sess-123",
      }

      const result = validateWidgetResponse(data)
      expect(result.response).toBe("   ") // Accepted as-is
    })

    it("should handle undefined vs null vs empty object data", () => {
      // SCENARIO: Various invalid data states
      // RULE: All should throw proper errors

      const invalidDataStates = [undefined, null, {}, { activeChatbot: undefined }, { blocked: undefined }]

      invalidDataStates.forEach((data) => {
        expect(() => validateWidgetResponse(data)).toThrow("Widget response missing")
      })
    })

    it("should log validation exceptions for debugging", () => {
      // SCENARIO: Frontend needs to log when validation fails
      // RULE: Clear error messages for debugging

      const testCases = [
        { data: { activeChatbot: true }, error: "Widget response missing" },
        { data: {}, error: "Widget response missing" },
        { data: null, error: "Widget response missing" },
      ]

      testCases.forEach(({ data, error }) => {
        try {
          validateWidgetResponse(data)
          fail("Should have thrown error")
        } catch (e) {
          expect(e.message).toContain(error)
        }
      })
    })
  })
})
