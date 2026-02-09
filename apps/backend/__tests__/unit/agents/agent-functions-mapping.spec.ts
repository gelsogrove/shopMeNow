/**
 * Test Suite: LLM Agent Functions Mapping
 *
 * Verifies that ALL LLM agents have the correct calling functions attached
 * from agent-functions.config.ts (Single Source of Truth)
 *
 * @requirement RULE-1: Database-First Architecture
 * @requirement All agents MUST have functions from config file
 */

import {
  ROUTER_FUNCTIONS,
  PRODUCT_SEARCH_FUNCTIONS,
  CART_MANAGEMENT_FUNCTIONS,
  ORDER_TRACKING_FUNCTIONS,
  CUSTOMER_SUPPORT_FUNCTIONS,
  SUMMARY_AGENT_FUNCTIONS,
  PROFILE_MANAGEMENT_FUNCTIONS,
  getAgentFunctions,
  getAgentFunctionNames,
  getAllFunctions,
} from "../../../src/config/agent-functions.config"

describe("Agent Functions Mapping - Single Source of Truth", () => {
  describe("ROUTER Agent Functions", () => {
    it("should have delegation functions to all specialist agents", () => {
      const functionNames = ROUTER_FUNCTIONS.map((fn) => fn.function.name)

      // Router delegates to specialist agents - NEVER executes directly
      expect(functionNames).toContain("productSearchAgent")
      expect(functionNames).toContain("cartManagementAgent")
      expect(functionNames).toContain("orderTrackingAgent")
      expect(functionNames).toContain("customerSupportAgent")
      expect(functionNames).toContain("profileManagementAgent")
    })

    it("should have exactly 5 delegation functions (no more, no less)", () => {
      expect(ROUTER_FUNCTIONS.length).toBe(5)
    })

    it("should NOT have any direct execution functions", () => {
      const functionNames = ROUTER_FUNCTIONS.map((fn) => fn.function.name)

      // Router should NOT have these (they belong to specialists)
      expect(functionNames).not.toContain("addToCart")
      expect(functionNames).not.toContain("getProductDetails")
      expect(functionNames).not.toContain("confirmOrder")
      expect(functionNames).not.toContain("contactOperator")
    })

    it("should have required query parameter for all delegation functions", () => {
      ROUTER_FUNCTIONS.forEach((fn) => {
        expect(fn.function.parameters.required).toContain("query")
        expect(fn.function.parameters.properties.query.type).toBe("string")
      })
    })
  })

  describe("PRODUCT_SEARCH Agent Functions", () => {
    it("should have product search and details functions", () => {
      const functionNames = PRODUCT_SEARCH_FUNCTIONS.map((fn) => fn.function.name)

      expect(functionNames).toContain("getProductDetails")
      expect(functionNames).toContain("getServiceDetails")
      expect(functionNames).toContain("searchProductForStatistic")
    })

    it("should have exactly 3 functions", () => {
      expect(PRODUCT_SEARCH_FUNCTIONS.length).toBe(3)
    })

    it("getProductDetails should require productName parameter", () => {
      const getProductDetails = PRODUCT_SEARCH_FUNCTIONS.find(
        (fn) => fn.function.name === "getProductDetails"
      )

      expect(getProductDetails).toBeDefined()
      expect(getProductDetails!.function.parameters.required).toContain("productName")
    })

    it("should NOT have cart management functions", () => {
      const functionNames = PRODUCT_SEARCH_FUNCTIONS.map((fn) => fn.function.name)

      expect(functionNames).not.toContain("addToCart")
      expect(functionNames).not.toContain("viewCart")
      expect(functionNames).not.toContain("clearCart")
    })
  })

  describe("CART_MANAGEMENT Agent Functions", () => {
    it("should have cart operation functions", () => {
      const functionNames = CART_MANAGEMENT_FUNCTIONS.map((fn) => fn.function.name)

      expect(functionNames).toContain("addToCart")
      expect(functionNames).toContain("viewCart")
      expect(functionNames).toContain("clearCart")
    })

    it("should have exactly 3 functions", () => {
      expect(CART_MANAGEMENT_FUNCTIONS.length).toBe(3)
    })

    it("addToCart should require items array parameter", () => {
      const addToCart = CART_MANAGEMENT_FUNCTIONS.find(
        (fn) => fn.function.name === "addToCart"
      )

      expect(addToCart).toBeDefined()
      expect(addToCart!.function.parameters.required).toContain("items")
      expect(addToCart!.function.parameters.properties.items.type).toBe("array")
    })

    it("should NOT have order tracking functions", () => {
      const functionNames = CART_MANAGEMENT_FUNCTIONS.map((fn) => fn.function.name)

      expect(functionNames).not.toContain("confirmOrder")
      expect(functionNames).not.toContain("repeatOrder")
      expect(functionNames).not.toContain("getOrderDetails")
    })
  })

  describe("ORDER_TRACKING Agent Functions", () => {
    it("should have order management functions", () => {
      const functionNames = ORDER_TRACKING_FUNCTIONS.map((fn) => fn.function.name)

      expect(functionNames).toContain("getLinkOrderByCode")
      expect(functionNames).toContain("repeatOrder")
      expect(functionNames).toContain("getOrderDetails")
      expect(functionNames).toContain("confirmOrder")
      expect(functionNames).toContain("showCheckout")
    })

    it("should have exactly 5 functions", () => {
      expect(ORDER_TRACKING_FUNCTIONS.length).toBe(5)
    })

    it("confirmOrder should have empty required array (no mandatory params)", () => {
      const confirmOrder = ORDER_TRACKING_FUNCTIONS.find(
        (fn) => fn.function.name === "confirmOrder"
      )

      expect(confirmOrder).toBeDefined()
      expect(confirmOrder!.function.parameters.required).toEqual([])
    })

    it("should NOT have product search functions", () => {
      const functionNames = ORDER_TRACKING_FUNCTIONS.map((fn) => fn.function.name)

      expect(functionNames).not.toContain("getProductDetails")
      expect(functionNames).not.toContain("searchProductForStatistic")
    })
  })

  describe("CUSTOMER_SUPPORT Agent Functions", () => {
    it("should have contactOperator function", () => {
      const functionNames = CUSTOMER_SUPPORT_FUNCTIONS.map((fn) => fn.function.name)

      expect(functionNames).toContain("contactOperator")
    })

    it("should have exactly 1 function (escalation only)", () => {
      expect(CUSTOMER_SUPPORT_FUNCTIONS.length).toBe(1)
    })

    it("contactOperator should have no required parameters", () => {
      const contactOperator = CUSTOMER_SUPPORT_FUNCTIONS.find(
        (fn) => fn.function.name === "contactOperator"
      )

      expect(contactOperator).toBeDefined()
      expect(contactOperator!.function.parameters.required).toEqual([])
    })
  })

  describe("SUMMARY_AGENT Functions", () => {
    it("should have NO functions (utility agent)", () => {
      expect(SUMMARY_AGENT_FUNCTIONS.length).toBe(0)
    })
  })

  describe("PROFILE_MANAGEMENT Agent Functions", () => {
    it("should have profile management functions", () => {
      const functionNames = PROFILE_MANAGEMENT_FUNCTIONS.map((fn) => fn.function.name)

      expect(functionNames).toContain("getProfileLink")
      expect(functionNames).toContain("contactOperator")
    })

    it("should have exactly 2 functions", () => {
      expect(PROFILE_MANAGEMENT_FUNCTIONS.length).toBe(2)
    })

    it("contactOperator should require reason and urgency parameters", () => {
      const contactOp = PROFILE_MANAGEMENT_FUNCTIONS.find(
        (fn) => fn.function.name === "contactOperator"
      )

      expect(contactOp).toBeDefined()
      expect(contactOp!.function.parameters.required).toContain("reason")
      expect(contactOp!.function.parameters.required).toContain("urgency")
      expect(contactOp!.function.parameters.properties.urgency.enum).toEqual([
        "low",
        "medium",
        "high",
        "critical",
      ])
    })
  })

  describe("getAgentFunctions() helper", () => {
    it("should return correct functions for each agent type", () => {
      expect(getAgentFunctions("ROUTER")).toEqual(ROUTER_FUNCTIONS)
      expect(getAgentFunctions("PRODUCT_SEARCH")).toEqual(PRODUCT_SEARCH_FUNCTIONS)
      expect(getAgentFunctions("CART_MANAGEMENT")).toEqual(CART_MANAGEMENT_FUNCTIONS)
      expect(getAgentFunctions("ORDER_TRACKING")).toEqual(ORDER_TRACKING_FUNCTIONS)
      expect(getAgentFunctions("CUSTOMER_SUPPORT")).toEqual(CUSTOMER_SUPPORT_FUNCTIONS)
      expect(getAgentFunctions("SUMMARY_AGENT")).toEqual(SUMMARY_AGENT_FUNCTIONS)
      expect(getAgentFunctions("PROFILE_MANAGEMENT")).toEqual(PROFILE_MANAGEMENT_FUNCTIONS)
    })

    it("should return empty array for SECURITY agent", () => {
      expect(getAgentFunctions("SECURITY")).toEqual([])
    })

    it("should return empty array for TRANSLATION agent", () => {
      expect(getAgentFunctions("TRANSLATION")).toEqual([])
    })

    it("should return null for unknown agent type", () => {
      expect(getAgentFunctions("UNKNOWN_AGENT")).toBeNull()
      expect(getAgentFunctions("INVALID")).toBeNull()
    })
  })

  describe("getAgentFunctionNames() helper", () => {
    it("should return array of function names only", () => {
      const routerNames = getAgentFunctionNames("ROUTER")

      expect(routerNames).toBeInstanceOf(Array)
      expect(routerNames).toContain("productSearchAgent")
      expect(routerNames).toContain("cartManagementAgent")
      // Should be string names, not full function definitions
      routerNames!.forEach((name) => {
        expect(typeof name).toBe("string")
      })
    })

    it("should return null for unknown agent type", () => {
      expect(getAgentFunctionNames("UNKNOWN")).toBeNull()
    })
  })

  describe("getAllFunctions() helper", () => {
    it("should return combined functions from all agents", () => {
      const allFunctions = getAllFunctions()

      // Should contain functions from all agents
      const allNames = allFunctions.map((fn) => fn.function.name)

      // Router functions
      expect(allNames).toContain("productSearchAgent")
      // Product search functions
      expect(allNames).toContain("getProductDetails")
      // Cart functions
      expect(allNames).toContain("addToCart")
      // Order functions
      expect(allNames).toContain("confirmOrder")
      // Support functions
      expect(allNames).toContain("contactOperator")
      // Profile functions
      expect(allNames).toContain("getProfileLink")
    })

    it("should have correct total count (sum of all agents)", () => {
      const allFunctions = getAllFunctions()
      const expectedCount =
        ROUTER_FUNCTIONS.length +
        PRODUCT_SEARCH_FUNCTIONS.length +
        CART_MANAGEMENT_FUNCTIONS.length +
        ORDER_TRACKING_FUNCTIONS.length +
        CUSTOMER_SUPPORT_FUNCTIONS.length +
        SUMMARY_AGENT_FUNCTIONS.length +
        PROFILE_MANAGEMENT_FUNCTIONS.length

      expect(allFunctions.length).toBe(expectedCount)
    })
  })

  describe("Function Definition Structure", () => {
    it("all functions should have correct OpenAI function calling format", () => {
      const allFunctions = getAllFunctions()

      allFunctions.forEach((fn) => {
        // Must have type: "function"
        expect(fn.type).toBe("function")
        // Must have function object
        expect(fn.function).toBeDefined()
        // Must have name
        expect(fn.function.name).toBeDefined()
        expect(typeof fn.function.name).toBe("string")
        expect(fn.function.name.length).toBeGreaterThan(0)
        // Must have description
        expect(fn.function.description).toBeDefined()
        expect(typeof fn.function.description).toBe("string")
        // Must have parameters object
        expect(fn.function.parameters).toBeDefined()
        expect(fn.function.parameters.type).toBe("object")
        expect(fn.function.parameters.properties).toBeDefined()
        expect(fn.function.parameters.required).toBeDefined()
        expect(Array.isArray(fn.function.parameters.required)).toBe(true)
      })
    })

    it("function names should be mostly unique (contactOperator is shared)", () => {
      const allFunctions = getAllFunctions()
      const allNames = allFunctions.map((fn) => fn.function.name)
      const uniqueNames = [...new Set(allNames)]

      // We expect 18 unique names out of 19 total (contactOperator appears twice)
      expect(uniqueNames.length).toBe(18)
      expect(allNames.length).toBe(19)

      // Verify contactOperator is the only duplicate
      const nameCounts: Record<string, number> = {}
      allNames.forEach((name) => {
        nameCounts[name] = (nameCounts[name] || 0) + 1
      })

      const duplicates = Object.entries(nameCounts)
        .filter(([_, count]) => count > 1)
        .map(([name]) => name)

      expect(duplicates).toEqual(["contactOperator"])
    })
  })
})
