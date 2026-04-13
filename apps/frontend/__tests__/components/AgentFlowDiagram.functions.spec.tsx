/**
 * Unit tests for AgentFlowDiagram function filtering
 * 
 * RULE: In Informational Mode, e-commerce specific functions should be filtered out
 * from the Router Agent's available functions.
 * 
 * E-commerce functions to filter:
 * - productSearchAgent
 * - cartManagementAgent
 * - orderTrackingAgent
 */
import { describe, it, expect } from "vitest"

// Define the filtering logic (mirrors AgentFlowDiagram.tsx)
const ECOMMERCE_FUNCTIONS = ["productSearchAgent", "cartManagementAgent", "orderTrackingAgent"]

const ROUTER_ALL_FUNCTIONS = [
  "productSearchAgent",
  "cartManagementAgent", 
  "orderTrackingAgent",
  "customerSupportAgent",
  "profileManagementAgent",
  "RESET_ACTIVE_AGENT",
]

const getFilteredFunctions = (
  availableFunctions: string[],
  channelMode: boolean
): string[] => {
  if (channelMode) return availableFunctions
  // Informational mode: filter out e-commerce specific functions
  return availableFunctions.filter(fn => !ECOMMERCE_FUNCTIONS.includes(fn))
}

describe("AgentFlowDiagram - Function Filtering", () => {
  describe("E-commerce Mode (channelMode=true)", () => {
    it("should show ALL Router functions in e-commerce mode", () => {
      // SCENARIO: Workspace is e-commerce enabled
      // RULE: All 6 functions should be available
      const filtered = getFilteredFunctions(ROUTER_ALL_FUNCTIONS, true)
      
      expect(filtered).toEqual(ROUTER_ALL_FUNCTIONS)
      expect(filtered.length).toBe(6)
      expect(filtered).toContain("productSearchAgent")
      expect(filtered).toContain("cartManagementAgent")
      expect(filtered).toContain("orderTrackingAgent")
    })
  })

  describe("Informational Mode (channelMode=false)", () => {
    it("should filter OUT e-commerce functions in informational mode", () => {
      // SCENARIO: Workspace is informational only (eChatbot HQ Support)
      // RULE: E-commerce functions should NOT appear
      const filtered = getFilteredFunctions(ROUTER_ALL_FUNCTIONS, false)
      
      expect(filtered.length).toBe(3)
      expect(filtered).not.toContain("productSearchAgent")
      expect(filtered).not.toContain("cartManagementAgent")
      expect(filtered).not.toContain("orderTrackingAgent")
    })

    it("should keep non-ecommerce functions in informational mode", () => {
      // SCENARIO: Workspace is informational only
      // RULE: Support, Profile, and Reset should remain
      const filtered = getFilteredFunctions(ROUTER_ALL_FUNCTIONS, false)
      
      expect(filtered).toContain("customerSupportAgent")
      expect(filtered).toContain("profileManagementAgent")
      expect(filtered).toContain("RESET_ACTIVE_AGENT")
    })
  })

  describe("Agent-specific functions", () => {
    it("should not filter Customer Support functions (they are NOT ecommerce-only)", () => {
      // SCENARIO: Customer Support Agent has only contactOperator
      // RULE: contactOperator is available in BOTH modes (ecommerce and informational)
      const supportFunctions = ["contactOperator"]
      
      const ecommerceFiltered = getFilteredFunctions(supportFunctions, true)
      const informationalFiltered = getFilteredFunctions(supportFunctions, false)
      
      expect(ecommerceFiltered).toEqual(supportFunctions)
      expect(informationalFiltered).toEqual(supportFunctions)
    })

    it("should not filter Profile Management functions", () => {
      // SCENARIO: Profile Management Agent has no functions
      // RULE: Empty array should remain empty in both modes
      const profileFunctions: string[] = []
      
      const ecommerceFiltered = getFilteredFunctions(profileFunctions, true)
      const informationalFiltered = getFilteredFunctions(profileFunctions, false)
      
      expect(ecommerceFiltered).toEqual([])
      expect(informationalFiltered).toEqual([])
    })
  })

  describe("Edge cases", () => {
    it("should handle undefined/empty functions gracefully", () => {
      // SCENARIO: Agent with no functions defined
      // RULE: Should return empty array
      expect(getFilteredFunctions([], true)).toEqual([])
      expect(getFilteredFunctions([], false)).toEqual([])
    })

    it("should be case-sensitive for function names", () => {
      // SCENARIO: Function names with different casing
      // RULE: Only exact matches should be filtered
      const mixedCase = ["ProductSearchAgent", "cartManagementAgent"]
      
      const filtered = getFilteredFunctions(mixedCase, false)
      
      // "ProductSearchAgent" is NOT in ECOMMERCE_FUNCTIONS (case mismatch)
      // "cartManagementAgent" IS in ECOMMERCE_FUNCTIONS
      expect(filtered).toContain("ProductSearchAgent")
      expect(filtered).not.toContain("cartManagementAgent")
    })
  })
})
