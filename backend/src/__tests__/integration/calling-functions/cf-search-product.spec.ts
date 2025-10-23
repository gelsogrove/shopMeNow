/**
 * 🔍 Integration Test: searchProduct Function
 * 
 * Tests that LLM correctly calls searchProduct when user asks about products.
 * Example: "avete la mozzarella di bufala?"
 */

import {
  TEST_CONFIG,
  setupTestCustomer,
  callLLMAndGetFunctionInfo,
  cleanup,
} from "./cf-setup"

describe("🔍 CF: searchProduct", () => {
  beforeAll(async () => {
    await setupTestCustomer()
  }, 10000)

  afterAll(async () => {
    await cleanup()
  })

  it("should call searchProduct for 'avete la mozzarella di bufala?'", async () => {
    const result = await callLLMAndGetFunctionInfo(
      "avete la mozzarella di bufala?"
    )

    console.log("📊 searchProduct Result:", {
      functionCalled: result.functionCalled,
      responseLength: result.response.length,
      success: result.success,
    })

    // Should call searchProduct function
    expect(result.functionCalled).toBe("searchProduct")
    expect(result.success).toBe(true)

    // Response should mention the product
    expect(
      result.response.toLowerCase().includes("mozzarella") ||
        result.response.toLowerCase().includes("bufala")
    ).toBe(true)
  }, TEST_CONFIG.timeout)
})
