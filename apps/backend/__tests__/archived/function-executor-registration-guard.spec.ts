/**
 * Feature 174: Registration Guard Tests
 * 
 * Tests for function-level registration check in FunctionExecutorService
 * 
 * Flow:
 * - Unregistered users (isActive=false) can chat freely
 * - Protected functions (cart, orders, profile) require registration
 * - Guard returns REGISTRATION_REQUIRED error with link token
 * - Public functions (product/service details, search) always allowed
 */

import { FunctionExecutorService } from "../../../src/services/function-executor.service"

describe("FunctionExecutorService - Registration Guard (Feature 174)", () => {
  let service: FunctionExecutorService

  beforeEach(() => {
    service = new FunctionExecutorService()
  })

  describe("Protected Functions - Require Registration", () => {
    const protectedFunctions = [
      { name: "addItemToCart", args: { sku: "TEST-001", quantity: 1 } },
      { name: "addToCart", args: { sku: "TEST-001", quantity: 1 } },
      { name: "viewCart", args: {} },
      { name: "clearCart", args: {} },
      { name: "getLinkOrderByCode", args: { orderCode: "ORD-001" } },
      { name: "repeatOrder", args: { orderCode: "ORD-001" } },
      { name: "repeatLastOrder", args: {} },
      { name: "getOrderDetails", args: { orderCode: "ORD-001" } },
      { name: "confirmOrder", args: {} },
      { name: "showCheckout", args: {} },
      { name: "handlePushNotifications", args: { enable: true } },
      { name: "getProfileLink", args: {} },
    ]

    protectedFunctions.forEach(({ name, args }) => {
      it(`should block ${name} for unregistered users (isActive=false)`, async () => {
        const context = {
          workspaceId: "ws-test",
          customerId: "cust-test",
          customerName: "Test User",
          customerLanguage: "it",
          customerDiscount: 0,
          customerIsActive: false, // 🔒 NOT registered
        }

        const result = await service.execute(name, args, context)

        expect(result.success).toBe(false)
        expect(result.error).toBe("REGISTRATION_REQUIRED")
        expect(result.data.message).toContain("[LINK_REGISTRATION_WITH_TOKEN]")
        expect(result.data.functionName).toBe(name)
        expect(result.data.requiresRegistration).toBe(true)
      })

      it(`should allow ${name} for registered users (isActive=true)`, async () => {
        const context = {
          workspaceId: "ws-test",
          customerId: "cust-test",
          customerName: "Test User",
          customerLanguage: "it",
          customerDiscount: 0,
          customerIsActive: true, // ✅ Registered
        }

        // NOTE: Function will fail for other reasons (missing data, etc.)
        // We just verify the guard doesn't block it
        const result = await service.execute(name, args, context)

        // Guard did NOT block (no REGISTRATION_REQUIRED error)
        expect(result.error).not.toBe("REGISTRATION_REQUIRED")
      })
    })
  })

  describe("Public Functions - Always Allowed", () => {
    const publicFunctions = [
      { name: "getProductDetails", args: { sku: "TEST-001" } },
      { name: "getServiceDetails", args: { sku: "SRV-001" } },
      { name: "searchProductForStatistic", args: { productName: "test" } },
      { name: "contactOperator", args: { message: "help" } },
    ]

    publicFunctions.forEach(({ name, args }) => {
      it(`should allow ${name} for unregistered users`, async () => {
        const context = {
          workspaceId: "ws-test",
          customerId: "cust-test",
          customerName: "Test User",
          customerLanguage: "it",
          customerDiscount: 0,
          customerIsActive: false, // 🔒 NOT registered
        }

        const result = await service.execute(name, args, context)

        // Guard did NOT block (no REGISTRATION_REQUIRED error)
        expect(result.error).not.toBe("REGISTRATION_REQUIRED")
      })
    })
  })

  describe("Guard Error Format", () => {
    it("should return proper error structure with token placeholder", async () => {
      const context = {
        workspaceId: "ws-test",
        customerId: "cust-test",
        customerName: "Test User",
        customerLanguage: "it",
        customerDiscount: 0,
        customerIsActive: false,
      }

      const result = await service.execute("addToCart", { sku: "TEST-001" }, context)

      expect(result).toMatchObject({
        success: false,
        error: "REGISTRATION_REQUIRED",
        data: {
          message: expect.stringContaining("[LINK_REGISTRATION_WITH_TOKEN]"),
          functionName: "addToCart",
          requiresRegistration: true,
        },
      })
    })
  })

  describe("Edge Cases", () => {
    it("should handle missing customerIsActive (defaults to false)", async () => {
      const context = {
        workspaceId: "ws-test",
        customerId: "cust-test",
        customerName: "Test User",
        customerLanguage: "it",
        customerDiscount: 0,
        // customerIsActive: undefined
      }

      const result = await service.execute("addToCart", { sku: "TEST-001" }, context as any)

      expect(result.success).toBe(false)
      expect(result.error).toBe("REGISTRATION_REQUIRED")
    })

    it("should handle unknown function gracefully", async () => {
      const context = {
        workspaceId: "ws-test",
        customerId: "cust-test",
        customerName: "Test User",
        customerLanguage: "it",
        customerDiscount: 0,
        customerIsActive: false,
      }

      const result = await service.execute("unknownFunction", {}, context)

      // Unknown function returns error, but NOT registration error
      expect(result.error).not.toBe("REGISTRATION_REQUIRED")
    })
  })
})
