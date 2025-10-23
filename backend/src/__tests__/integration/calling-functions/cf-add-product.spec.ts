/**
 * 🛒 Integration Test: addProduct Function
 * 
 * Tests that LLM asks confirmation before adding product to cart.
 * Example: "voglio aggiungere il panettone nel carrello"
 */

import {
  TEST_CONFIG,
  setupTestCustomer,
  callLLMAndGetFunctionInfo,
  cleanup,
} from "./cf-setup"

describe("🛒 CF: addProduct", () => {
  beforeAll(async () => {
    await setupTestCustomer()
  }, 10000)

  afterAll(async () => {
    await cleanup()
  })

  it("should ask confirmation for 'voglio aggiungere il panettone nel carrello'", async () => {
    const result = await callLLMAndGetFunctionInfo(
      "voglio aggiungere il panettone nel carrello"
    )

    console.log("📊 addProduct Result:", {
      functionCalled: result.functionCalled,
      responseLength: result.response.length,
      success: result.success,
    })

    // Should ask for confirmation (quantity, etc.)
    const asksConfirmation =
      result.response.toLowerCase().includes("quant") ||
      result.response.toLowerCase().includes("conferma") ||
      result.response.toLowerCase().includes("sicuro") ||
      result.response.toLowerCase().includes("panettone")

    // Should NOT call addProduct yet (needs confirmation first)
    expect(result.functionCalled).not.toBe("addProduct")
    expect(asksConfirmation).toBe(true)
  }, TEST_CONFIG.timeout)
})
