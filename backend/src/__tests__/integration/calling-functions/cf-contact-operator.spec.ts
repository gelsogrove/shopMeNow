/**
 * 📞 Integration Test: ContactOperator Function
 *
 * Tests that LLM correctly calls ContactOperator when user needs assistance.
 * Example: "voglio parlare con un operatore"
 */

import {
  TEST_CONFIG,
  callLLMAndGetFunctionInfo,
  cleanup,
  setupTestCustomer,
} from "./cf-setup"

describe("📞 CF: ContactOperator", () => {
  beforeAll(async () => {
    await setupTestCustomer()
  }, 10000)

  afterAll(async () => {
    await cleanup()
  })

  it(
    "should call ContactOperator for 'voglio parlare con un operatore'",
    async () => {
      const result = await callLLMAndGetFunctionInfo(
        "voglio parlare con un operatore"
      )

      console.log("📊 ContactOperator Result:", {
        functionCalled: result.functionCalled,
        response: result.response, // PRINT FULL RESPONSE
        success: result.success,
      })

      // Should call ContactOperator function
      expect(result.functionCalled).toBe("ContactOperator")
      expect(result.success).toBe(true)

      // ⚠️ NOTE: In TEST MODE, response might be empty or generic
      // The important part is that the function was DETECTED (not executed)
    },
    TEST_CONFIG.timeout
  )
})
