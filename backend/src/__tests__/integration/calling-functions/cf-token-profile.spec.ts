/**
 * 👤 Integration Test: Token Return - Indirizzo/Profilo
 * 
 * Tests that LLM returns profile link for address/profile changes.
 * Example: "voglio cambiare indirizzo di spedizione"
 */

import {
  TEST_CONFIG,
  setupTestCustomer,
  callLLMAndGetFunctionInfo,
  cleanup,
} from "./cf-setup"

describe("👤 CF: Token Indirizzo", () => {
  beforeAll(async () => {
    await setupTestCustomer()
  }, 10000)

  afterAll(async () => {
    await cleanup()
  })

  it("should return profile link (NOT function call) for 'voglio cambiare indirizzo di spedizione'", async () => {
    const result = await callLLMAndGetFunctionInfo(
      "voglio cambiare indirizzo di spedizione"
    )

    console.log("📊 Token Profile Result:", {
      functionCalled: result.functionCalled,
      responseLength: result.response.length,
      success: result.success,
      hasLink:
        result.response.includes("http://") ||
        result.response.includes("https://"),
      hasShortUrl: result.response.includes("/s/"),
    })

    // Should NOT call any function - link is generated directly by LLM
    expect(result.functionCalled).toBeNull()
    expect(result.success).toBe(true)

    // Should contain a real link (HTTP/HTTPS)
    const hasLink =
      result.response.includes("http://") ||
      result.response.includes("https://")
    expect(hasLink).toBe(true)

    // CRITICAL: Should contain SHORT URL pattern /s/XXXXXX
    // The system uses short URLs for security and brevity
    expect(result.response.includes("/s/")).toBe(true)
  }, TEST_CONFIG.timeout)
})
