/**
 * Feature 174: Registration Guard + sellsProductsAndServices Tests
 * 
 * Tests for function-level registration check with workspace type filtering
 * 
 * Scenarios:
 * 1. E-commerce channel (sellsProductsAndServices=true) → Show registration link
 * 2. Informational channel (sellsProductsAndServices=false) → Show "feature not available"
 * 3. Registered users → All functions work regardless of channel type
 */

import { FunctionExecutor, ExecutionContext } from "../../src/services/function-executor.service"

// Mock PrismaClient
jest.mock("@echatbot/database", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $disconnect: jest.fn(),
  })),
}))

describe("FunctionExecutor - sellsProductsAndServices Integration", () => {
  let executor: FunctionExecutor

  beforeEach(() => {
    const mockPrisma = {
      $disconnect: jest.fn(),
    } as any
    executor = new FunctionExecutor(mockPrisma)
  })

  describe("E-commerce Channel (sellsProductsAndServices=true)", () => {
    it("should show registration link for unregistered user trying to add to cart", async () => {
      const context: ExecutionContext = {
        workspaceId: "ws-ecommerce",
        customerId: "cust-unregistered",
        customerName: "New User",
        customerLanguage: "it",
        customerDiscount: 0,
        customerIsActive: false, // ❌ NOT registered
        sellsProductsAndServices: true, // ✅ E-commerce channel
      }

      const result = await executor.execute("addToCart", { sku: "PROD-001", quantity: 1 }, context)

      expect(result.success).toBe(false)
      expect(result.error).toBe("REGISTRATION_REQUIRED")
      expect(result.data.message).toContain("[LINK_REGISTRATION]")
      expect(result.data.requiresRegistration).toBe(true)
    })

    it("should show registration link for unregistered user trying to view cart", async () => {
      const context: ExecutionContext = {
        workspaceId: "ws-ecommerce",
        customerId: "cust-unregistered",
        customerIsActive: false,
        sellsProductsAndServices: true,
      }

      const result = await executor.execute("viewCart", {}, context)

      expect(result.success).toBe(false)
      expect(result.error).toBe("REGISTRATION_REQUIRED")
      expect(result.data.message).toContain("registrazione")
    })

    it("should show registration link for unregistered user trying to get order details", async () => {
      const context: ExecutionContext = {
        workspaceId: "ws-ecommerce",
        customerId: "cust-unregistered",
        customerIsActive: false,
        sellsProductsAndServices: true,
      }

      const result = await executor.execute("getOrderDetails", { orderCode: "ORD-001" }, context)

      expect(result.success).toBe(false)
      expect(result.error).toBe("REGISTRATION_REQUIRED")
    })
  })

  describe("Informational Channel (sellsProductsAndServices=false)", () => {
    it("should return FEATURE_NOT_AVAILABLE for unregistered user trying to add to cart", async () => {
      const context: ExecutionContext = {
        workspaceId: "ws-informational",
        customerId: "cust-unregistered",
        customerName: "Visitor",
        customerLanguage: "it",
        customerDiscount: 0,
        customerIsActive: false, // ❌ NOT registered
        sellsProductsAndServices: false, // ❌ Informational channel (no e-commerce)
      }

      const result = await executor.execute("addToCart", { sku: "PROD-001", quantity: 1 }, context)

      expect(result.success).toBe(false)
      expect(result.error).toBe("FEATURE_NOT_AVAILABLE")
      expect(result.data.message).toContain("non è disponibile")
      expect(result.data.message).not.toContain("[LINK_REGISTRATION]")
      expect(result.data.requiresRegistration).toBe(false)
    })

    it("should return FEATURE_NOT_AVAILABLE for unregistered user trying to view cart", async () => {
      const context: ExecutionContext = {
        workspaceId: "ws-informational",
        customerId: "cust-unregistered",
        customerIsActive: false,
        sellsProductsAndServices: false,
      }

      const result = await executor.execute("viewCart", {}, context)

      expect(result.success).toBe(false)
      expect(result.error).toBe("FEATURE_NOT_AVAILABLE")
      expect(result.data.message).not.toContain("[LINK_REGISTRATION]")
    })

    it("should return FEATURE_NOT_AVAILABLE for order tracking functions", async () => {
      const context: ExecutionContext = {
        workspaceId: "ws-informational",
        customerId: "cust-unregistered",
        customerIsActive: false,
        sellsProductsAndServices: false,
      }

      const result = await executor.execute("getLinkOrderByCode", { orderCode: "ORD-001" }, context)

      expect(result.success).toBe(false)
      expect(result.error).toBe("FEATURE_NOT_AVAILABLE")
    })
  })

  describe("Registered Users - Both Channel Types", () => {
    it("should allow cart functions for registered user on e-commerce channel", async () => {
      const context: ExecutionContext = {
        workspaceId: "ws-ecommerce",
        customerId: "cust-registered",
        customerName: "Active User",
        customerLanguage: "it",
        customerDiscount: 10,
        customerIsActive: true, // ✅ Registered
        sellsProductsAndServices: true,
      }

      const result = await executor.execute("viewCart", {}, context)

      // Should pass registration guard (may fail for other reasons like missing cart data)
      expect(result.error).not.toBe("REGISTRATION_REQUIRED")
      expect(result.error).not.toBe("FEATURE_NOT_AVAILABLE")
    })

    it("should allow order functions for registered user on e-commerce channel", async () => {
      const context: ExecutionContext = {
        workspaceId: "ws-ecommerce",
        customerId: "cust-registered",
        customerIsActive: true,
        sellsProductsAndServices: true,
      }

      const result = await executor.execute("showCheckout", {}, context)

      expect(result.error).not.toBe("REGISTRATION_REQUIRED")
      expect(result.error).not.toBe("FEATURE_NOT_AVAILABLE")
    })

    // Note: On informational channels, even registered users shouldn't be able to use e-commerce functions
    // because the functions themselves won't work without product data
    it("should still pass guard for registered user on informational channel (function will fail later)", async () => {
      const context: ExecutionContext = {
        workspaceId: "ws-informational",
        customerId: "cust-registered",
        customerIsActive: true, // ✅ Registered
        sellsProductsAndServices: false, // ❌ Informational
      }

      const result = await executor.execute("viewCart", {}, context)

      // Guard passes (user is registered) but function may fail for lack of data
      expect(result.error).not.toBe("REGISTRATION_REQUIRED")
      // User is registered, so no feature availability check
    })
  })

  describe("Public Functions - Always Available", () => {
    it("should allow public functions on e-commerce channel without registration", async () => {
      const context: ExecutionContext = {
        workspaceId: "ws-ecommerce",
        customerId: "cust-visitor",
        customerIsActive: false,
        sellsProductsAndServices: true,
      }

      const result = await executor.execute("contactOperator", { message: "Need help" }, context)

      expect(result.error).not.toBe("REGISTRATION_REQUIRED")
      expect(result.error).not.toBe("FEATURE_NOT_AVAILABLE")
    })

    it("should allow public functions on informational channel without registration", async () => {
      const context: ExecutionContext = {
        workspaceId: "ws-informational",
        customerId: "cust-visitor",
        customerIsActive: false,
        sellsProductsAndServices: false,
      }

      const result = await executor.execute("contactOperator", { message: "Question" }, context)

      expect(result.error).not.toBe("REGISTRATION_REQUIRED")
      expect(result.error).not.toBe("FEATURE_NOT_AVAILABLE")
    })
  })

  describe("Edge Cases", () => {
    it("should treat undefined sellsProductsAndServices as false (feature not available)", async () => {
      const context: ExecutionContext = {
        workspaceId: "ws-legacy",
        customerId: "cust-test",
        customerIsActive: false,
        // sellsProductsAndServices: undefined (not provided - defaults to false/falsy)
      }

      const result = await executor.execute("addToCart", { sku: "TEST" }, context)

      // Undefined is falsy, so behaves like informational channel
      expect(result.error).toBe("FEATURE_NOT_AVAILABLE")
      expect(result.data.message).not.toContain("[LINK_REGISTRATION]")
    })

    it("should handle all protected functions consistently", async () => {
      const protectedFunctions = [
        "addItemToCart",
        "addToCart",
        "viewCart",
        "clearCart",
        "getLinkOrderByCode",
        "repeatOrder",
        "repeatLastOrder",
        "getOrderDetails",
        "confirmOrder",
        "showCheckout",
        "handlePushNotifications",
        "getProfileLink",
      ]

      for (const functionName of protectedFunctions) {
        // Test on informational channel
        const contextInfo: ExecutionContext = {
          workspaceId: "ws-info",
          customerId: "cust-test",
          customerIsActive: false,
          sellsProductsAndServices: false,
        }

        const resultInfo = await executor.execute(functionName, {}, contextInfo)
        expect(resultInfo.error).toBe("FEATURE_NOT_AVAILABLE")

        // Test on e-commerce channel
        const contextEcom: ExecutionContext = {
          workspaceId: "ws-ecom",
          customerId: "cust-test",
          customerIsActive: false,
          sellsProductsAndServices: true,
        }

        const resultEcom = await executor.execute(functionName, {}, contextEcom)
        expect(resultEcom.error).toBe("REGISTRATION_REQUIRED")
      }
    })
  })
})
