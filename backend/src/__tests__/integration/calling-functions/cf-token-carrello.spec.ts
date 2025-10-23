/**
 * 🛒 Integration Test: Token Return - Carrello
 *
 * Tests that LLM returns [LINK_CHECKOUT_WITH_TOKEN] for cart requests.
 * Example: "mostra carrello"
 */

import {
  TEST_CONFIG,
  callLLMAndGetFunctionInfo,
  cleanup,
  setupTestCustomer,
} from "./cf-setup"

describe("🛒 CF: Token Carrello", () => {
  beforeAll(async () => {
    await setupTestCustomer()
  }, 10000)

  afterAll(async () => {
    await cleanup()
  })

  it(
    "should return checkout link (NOT function call) for 'mostra carrello'",
    async () => {
      const result = await callLLMAndGetFunctionInfo("mostra carrello")

      console.log("📊 Token Carrello Result:", {
        functionCalled: result.functionCalled,
        responseLength: result.response.length,
        success: result.success,
        hasLink:
          result.response.includes("http://") ||
          result.response.includes("https://"),
        hasCheckoutToken: result.response.includes("checkout?token="),
      })

      // DEBUG: Print full response to see actual URL
      process.stderr.write(
        "\n🛒 CARRELLO RESPONSE:\n" + result.response + "\n\n"
      )

          // Should NOT call any function - link is generated directly by LLM
    expect(result.functionCalled).toBeNull()
    expect(result.success).toBe(true)

    // Should contain a real link (HTTP/HTTPS)
    const hasLink =
      result.response.includes("http://") ||
      result.response.includes("https://")
    expect(hasLink).toBe(true)

    // CRITICAL: Should contain SHORT URL pattern /s/XXXXXX (not full checkout?token=)
    // The system uses short URLs for security and brevity
    expect(result.response.includes("/s/")).toBe(true)
  },
  TEST_CONFIG.timeout
  )
})
