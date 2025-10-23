/**
 * 🔄 Integration Test: repeatOrder Function
 *
 * Tests that LLM correctly calls repeatOrder (or asks confirmation)
 * when user wants to repeat last order.
 * Example: "voglio rifare l'ultimo ordine"
 */

import {
  TEST_CONFIG,
  callLLMAndGetFunctionInfo,
  cleanup,
  setupTestCustomer,
} from "./cf-setup"

describe("🔄 CF: repeatOrder", () => {
  beforeAll(async () => {
    await setupTestCustomer()
  }, 10000)

  afterAll(async () => {
    await cleanup()
  })

  it(
    "should call repeatOrder (or ask confirmation) for 'voglio rifare l'ultimo ordine'",
    async () => {
      const result = await callLLMAndGetFunctionInfo(
        "voglio rifare l'ultimo ordine"
      )

      console.log("📊 repeatOrder Result:", {
        functionCalled: result.functionCalled,
        responseLength: result.response.length,
        success: result.success,
      })

      // Should either call repeatOrder OR ask for confirmation
      const calledRepeatOrder = result.functionCalled === "repeatOrder"
      const asksConfirmation =
        result.response.toLowerCase().includes("conferma") ||
        result.response.toLowerCase().includes("sicuro") ||
        result.response.toLowerCase().includes("vuoi") ||
        result.response.toLowerCase().includes("ultimo ordine")

      expect(calledRepeatOrder || asksConfirmation).toBe(true)
    },
    TEST_CONFIG.timeout
  )
})
