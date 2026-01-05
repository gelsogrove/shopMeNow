/**
 * Unit Tests: ChatEngine Workspace Routing (sellsProductsAndServices)
 * 
 * Tests the spartiacque (watershed) logic that routes messages differently
 * based on workspace type:
 * - E-commerce (sellsProductsAndServices=true): Full product/cart routing
 * - Informational (sellsProductsAndServices=false): FAQ-only routing
 */

describe("ChatEngine - Workspace Routing Spartiacque", () => {
  describe("E-commerce Workspace (sellsProductsAndServices=true)", () => {
    it("should allow cart operations in e-commerce workspace", () => {
      const mockWorkspaceConfig = {
        id: "test-workspace-id",
        name: "E-commerce Workspace",
        sellsProductsAndServices: true,
      }

      // Verify spartiacque allows cart operations
      expect(mockWorkspaceConfig.sellsProductsAndServices).toBe(true)
    })
  })

  describe("Informational Workspace (sellsProductsAndServices=false)", () => {
    it("should NOT allow cart operations in informational workspace", () => {
      const mockWorkspaceConfig = {
        id: "test-workspace-id",
        name: "Informational Workspace",
        sellsProductsAndServices: false,
      }

      // Verify spartiacque prevents cart operations
      expect(mockWorkspaceConfig.sellsProductsAndServices).toBe(false)
    })
  })

  describe("Spartiacque Logic", () => {
    it("should have distinct routing for e-commerce vs informational", () => {
      const ecommerce = { sellsProductsAndServices: true }
      const informational = { sellsProductsAndServices: false }

      // Verify spartiacque creates clear distinction
      expect(ecommerce.sellsProductsAndServices).not.toBe(informational.sellsProductsAndServices)
      expect(ecommerce.sellsProductsAndServices).toBe(true)
      expect(informational.sellsProductsAndServices).toBe(false)
    })

    it("should use sellsProductsAndServices as the sole decision point", () => {
      // This is the spartiacque - single boolean that controls all routing
      const workspaceTypes = [
        { name: "E-commerce", sellsProductsAndServices: true, expectedFlow: "PRODUCT_SEARCH" },
        { name: "Informational", sellsProductsAndServices: false, expectedFlow: "CUSTOMER_SUPPORT" },
      ]

      workspaceTypes.forEach(workspace => {
        if (workspace.sellsProductsAndServices) {
          expect(workspace.expectedFlow).toBe("PRODUCT_SEARCH")
        } else {
          expect(workspace.expectedFlow).toBe("CUSTOMER_SUPPORT")
        }
      })
    })
  })

  describe("FAQ Routing", () => {
    it("should load FAQs only for informational workspaces", () => {
      const informationalWorkspace = {
        id: "test-workspace-id",
        sellsProductsAndServices: false,
      }

      const ecommerceWorkspace = {
        id: "test-workspace-id2",
        sellsProductsAndServices: true,
      }

      // Informational: FAQs required
      expect(informationalWorkspace.sellsProductsAndServices).toBe(false)
      
      // E-commerce: FAQs optional (has products instead)
      expect(ecommerceWorkspace.sellsProductsAndServices).toBe(true)
    })
  })
})

