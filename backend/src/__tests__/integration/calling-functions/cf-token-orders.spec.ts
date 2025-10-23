/**
 * 🔗 Integration Test: Token Return - Lista Ordini
 * 
 * Tests that LLM returns orders list link for orders requests.
 * Example: "dammi la lista degli ordini"
 */

import {
  TEST_CONFIG,
  setupTestCustomer,
  callLLMAndGetFunctionInfo,
  cleanup,
} from "./cf-setup"

describe("🔗 CF: Token Lista Ordini", () => {
  beforeAll(async () => {
    await setupTestCustomer()
  }, 10000)

  afterAll(async () => {
    await cleanup()
  })

  it("should return orders link (NOT function call) for 'dammi la lista degli ordini'", async () => {
    const result = await callLLMAndGetFunctionInfo(
      "dammi la lista degli ordini"
    )

    console.log("📊 Token Orders Result:", {
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
