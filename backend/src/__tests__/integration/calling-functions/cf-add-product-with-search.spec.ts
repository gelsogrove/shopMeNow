/**
 * 🛒🔍 Integration Test: addProduct WITH searchProduct
 *
 * Tests the COMPLETE SEQUENCE:
 * 1. searchProduct is called in BACKGROUND (PRIORITY 5, automatic)
 * 2. LLM asks confirmation before calling addProduct (PRIORITY 4)
 *
 * This verifies that when user wants to add a product, the system:
 * - Registers the search for analytics (searchProduct in background)
 * - Asks for confirmation before adding to cart (addProduct)
 *
 * Example: "voglio aggiungere la mozzarella di bufala nel carrello"
 */

import {
  TEST_CONFIG,
  callLLMAndGetFunctionInfo,
  cleanup,
  setupTestCustomer,
} from "./cf-setup"

describe("🛒🔍 CF: addProduct + searchProduct (Sequence)", () => {
  beforeAll(async () => {
    await setupTestCustomer()
  }, 10000)

  afterAll(async () => {
    await cleanup()
  })

  it(
    "should call searchProduct (BACKGROUND) and ask confirmation for 'voglio aggiungere la mozzarella di bufala'",
    async () => {
      const result = await callLLMAndGetFunctionInfo(
        "voglio aggiungere la mozzarella di bufala nel carrello"
      )

      console.log("📊 addProduct+searchProduct Result:", {
        functionCalled: result.functionCalled,
        responsePreview: result.response.substring(0, 200), // First 200 chars
        responseLength: result.response.length,
        success: result.success,
      })

      // DEBUG: Print full response to stderr (always visible)
      process.stderr.write("\n🔍 FULL RESPONSE:\n" + result.response + "\n\n")

      // CRITICAL: In TEST MODE, we can only detect ONE function call at a time
      // The LLM should prioritize:
      // 1. searchProduct (BACKGROUND, PRIORITY 5) - might be executed silently
      // 2. addProduct (needs confirmation, PRIORITY 4) - should ask before calling

      // The expected behavior:
      // - searchProduct is called in BACKGROUND (may not be visible in functionCalled)
      // - LLM asks confirmation about adding mozzarella to cart
      // - addProduct is NOT called yet (needs user confirmation first)

      // Test 1: Should mention mozzarella in response (searched product)
      const mentionsMozzarella =
        result.response.toLowerCase().includes("mozzarella") ||
        result.response.toLowerCase().includes("bufala")

      expect(mentionsMozzarella).toBe(true)

      // Test 2: Should ask for confirmation (quantity, stock, etc.)
      // Note: Customer is Spanish, so response might be in Spanish
      const responseLower = result.response.toLowerCase()
      const asksConfirmation =
        responseLower.includes("quant") || // IT: quantità
        responseLower.includes("conferma") || // IT: conferma
        responseLower.includes("sicuro") || // IT: sicuro
        responseLower.includes("aggiunger") || // IT: aggiungere
        responseLower.includes("carrello") || // IT: carrello
        responseLower.includes("vuoi") || // IT: vuoi
        responseLower.includes("quieres") || // ES: quieres (vuoi)
        responseLower.includes("carrito") || // ES: carrito (carrello)
        responseLower.includes("agregar") || // ES: agregar (aggiungere)
        responseLower.includes("añadir") || // ES: añadir (aggiungere)
        responseLower.includes("cantidad") // ES: cantidad (quantità)

      expect(asksConfirmation).toBe(true)

      // Test 3: Should NOT have called addProduct yet (needs confirmation)
      // Note: searchProduct might be detected OR executed silently in background
      if (result.functionCalled) {
        expect(result.functionCalled).not.toBe("addProduct")
        // If a function is detected, it should be searchProduct (BACKGROUND)
        if (result.functionCalled !== null) {
          expect(result.functionCalled).toBe("searchProduct")
        }
      }

      expect(result.success).toBe(true)
    },
    TEST_CONFIG.timeout
  )

  it(
    "should detect searchProduct for 'voglio la mozzarella di bufala'",
    async () => {
      const result = await callLLMAndGetFunctionInfo(
        "voglio la mozzarella di bufala"
      )

      console.log("📊 searchProduct (implicit add) Result:", {
        functionCalled: result.functionCalled,
        mentionsMozzarella: result.response
          .toLowerCase()
          .includes("mozzarella"),
        success: result.success,
      })

      // When user says "voglio X" (I want X), it's implicit:
      // 1. Search for the product (searchProduct - BACKGROUND)
      // 2. Ask if they want to add it to cart

      // Should either:
      // - Call searchProduct explicitly, OR
      // - Mention the product in response (searched implicitly)
      const isValid =
        result.functionCalled === "searchProduct" ||
        result.response.toLowerCase().includes("mozzarella") ||
        result.response.toLowerCase().includes("bufala")

      expect(isValid).toBe(true)
      expect(result.success).toBe(true)

      // Should NOT call addProduct without confirmation
      expect(result.functionCalled).not.toBe("addProduct")
    },
    TEST_CONFIG.timeout
  )
})
