/**
 * ❓ Integration Test: Who Are You (No Function Call)
 *
 * Tests that LLM does NOT call any function for generic questions.
 * Example: "chi sei?"
 */

import {
  TEST_CONFIG,
  callLLMAndGetFunctionInfo,
  cleanup,
  setupTestCustomer,
} from "./cf-setup"

describe("❓ CF: who-are-you (No Function)", () => {
  beforeAll(async () => {
    await setupTestCustomer()
  }, 10000)

  afterAll(async () => {
    await cleanup()
  })

  it(
    "should NOT call any function for 'chi sei?'",
    async () => {
      const result = await callLLMAndGetFunctionInfo("chi sei?")

      console.log("📊 who-are-you Result:", {
        functionCalled: result.functionCalled,
        responseLength: result.response.length,
        success: result.success,
      })

      // Should NOT call any function
      expect(result.functionCalled).toBeNull()
      expect(result.success).toBe(true)

      // Should provide a response about who the assistant is
      expect(result.response.length).toBeGreaterThan(0)
    },
    TEST_CONFIG.timeout
  )
})
