/**
 * 🔗 Integration Test: GetLinkOrderByCode Function
 *
 * Tests that LLM returns order link when user asks for last order.
 * Example: "dammi ultimo ordine"
 */

import {
  TEST_CONFIG,
  callLLMAndGetFunctionInfo,
  cleanup,
  setupTestCustomer,
} from "./cf-setup"

describe("🔗 CF: GetLinkOrderByCode", () => {
  beforeAll(async () => {
    await setupTestCustomer()
  }, 10000)

  afterAll(async () => {
    await cleanup()
  })

  it(
    "should call GetLinkOrderByCode OR return link for 'dammi ultimo ordine'",
    async () => {
      const result = await callLLMAndGetFunctionInfo("dammi ultimo ordine")

      console.log("📊 GetLinkOrderByCode Result:", {
        functionCalled: result.functionCalled,
        responseLength: result.response.length,
        success: result.success,
        hasLink:
          result.response.includes("http://") ||
          result.response.includes("https://"),
      })

      // ⚠️ In TEST MODE: Should detect GetLinkOrderByCode function call
      // ⚠️ In PRODUCTION: Should return actual link in response
      // We accept EITHER behavior as valid
      const isValid =
        result.functionCalled === "GetLinkOrderByCode" ||
        result.response.includes("http://") ||
        result.response.includes("https://")

      expect(isValid).toBe(true)
      expect(result.success).toBe(true)
    },
    TEST_CONFIG.timeout
  )
})
