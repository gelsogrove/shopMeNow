/**
 * ⚠️ Integration Test: Ambiguity - Priority Handling
 * 
 * Tests that LLM correctly handles ambiguous requests by prioritizing
 * PRIORITY 1 functions over PRIORITY 2.
 * Example: "sono stufo, dammi ultimo ordine" → ContactOperator wins
 */

import {
  TEST_CONFIG,
  setupTestCustomer,
  callLLMAndGetFunctionInfo,
  cleanup,
} from "./cf-setup"

describe("⚠️ CF: Ambiguity (Priority 1 Wins)", () => {
  beforeAll(async () => {
    await setupTestCustomer()
  }, 10000)

  afterAll(async () => {
    await cleanup()
  })

  it("should call ContactOperator (PRIORITY 1) for 'sono stufo, dammi ultimo ordine'", async () => {
    const result = await callLLMAndGetFunctionInfo(
      "sono stufo, dammi ultimo ordine"
    )

    console.log("📊 Ambiguity Result:", {
      functionCalled: result.functionCalled,
      responseLength: result.response.length,
      success: result.success,
    })

    // "sono stufo" → ContactOperator PRIORITY 1
    // "dammi ultimo ordine" → GetLinkOrderByCode PRIORITY 2
    // Even though "dammi ultimo ordine" → GetLinkOrderByCode PRIORITY 2
    // PRIORITY 1 should WIN
    expect(result.functionCalled).toBe("ContactOperator")

    // ⚠️ NOTE: In TEST MODE, response content validation is not relevant
    // The important part is that the CORRECT function (with HIGHEST priority) was detected
  }, TEST_CONFIG.timeout)
})
