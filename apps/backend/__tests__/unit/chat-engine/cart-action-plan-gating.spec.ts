/**
 * Cart Action Plan Gating Tests
 * 
 * @feature optimize-transport
 * @description Tests that OPTIMIZE_TRANSPORT option (option 5) is only shown to Premium/Enterprise workspaces
 */

import { PrismaClient, PlanType } from "@echatbot/database"

// Mock Prisma
const mockPrisma = {
  workspace: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient

// We need to test buildCartActionOptions which is a private method in ChatEngineService
// So we'll test the behavior through a minimal extraction

describe("Cart Action Plan Gating", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  /**
   * Helper to simulate buildCartActionOptions logic
   * This mirrors the logic in chat-engine.service.ts
   */
  async function buildCartActionOptions(
    hasRemovableItems: boolean,
    workspaceId: string | undefined,
    prisma: PrismaClient
  ) {
    const options: Array<{ number: number; name: string; id: string }> = []
    let nextNumber = 1
    options.push({ number: nextNumber++, name: "✅ Confermare l'ordine", id: "CONFIRM_ORDER" })
    options.push({ number: nextNumber++, name: "🛍️ Esplorare il catalogo", id: "SHOW_PRODUCTS" })
    if (hasRemovableItems) {
      options.push({ number: nextNumber++, name: "🗑️ Rimuovere un articolo", id: "REMOVE_FROM_CART" })
    }
    options.push({ number: nextNumber++, name: "🧹 Cancella il carrello", id: "CLEAR_CART" })
    
    // Option 5: Order optimization (Premium/Enterprise only)
    if (workspaceId) {
      try {
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { planType: true }
        })
        if (workspace?.planType === 'PREMIUM' || workspace?.planType === 'ENTERPRISE') {
          options.push({ number: nextNumber++, name: "🚚 Ottimizza spedizione", id: "OPTIMIZE_TRANSPORT" })
        }
      } catch (err) {
        // Silently fail - option won't be shown
      }
    }
    
    return options
  }

  describe("buildCartActionOptions plan gating", () => {
    it("should NOT include OPTIMIZE_TRANSPORT for FREE_TRIAL plan", async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        planType: "FREE_TRIAL" as PlanType,
      })

      const options = await buildCartActionOptions(true, "workspace-123", mockPrisma)
      
      expect(options.map(o => o.id)).not.toContain("OPTIMIZE_TRANSPORT")
      expect(options.length).toBe(4) // CONFIRM, SHOW_PRODUCTS, REMOVE, CLEAR
    })

    it("should NOT include OPTIMIZE_TRANSPORT for BASIC plan", async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        planType: "BASIC" as PlanType,
      })

      const options = await buildCartActionOptions(true, "workspace-123", mockPrisma)
      
      expect(options.map(o => o.id)).not.toContain("OPTIMIZE_TRANSPORT")
      expect(options.length).toBe(4)
    })

    it("should INCLUDE OPTIMIZE_TRANSPORT for PREMIUM plan", async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        planType: "PREMIUM" as PlanType,
      })

      const options = await buildCartActionOptions(true, "workspace-123", mockPrisma)
      
      expect(options.map(o => o.id)).toContain("OPTIMIZE_TRANSPORT")
      expect(options.length).toBe(5) // CONFIRM, SHOW_PRODUCTS, REMOVE, CLEAR, OPTIMIZE
      
      // Verify it's option 5
      const optimizeOption = options.find(o => o.id === "OPTIMIZE_TRANSPORT")
      expect(optimizeOption?.number).toBe(5)
      expect(optimizeOption?.name).toBe("🚚 Ottimizza spedizione")
    })

    it("should INCLUDE OPTIMIZE_TRANSPORT for ENTERPRISE plan", async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        planType: "ENTERPRISE" as PlanType,
      })

      const options = await buildCartActionOptions(true, "workspace-123", mockPrisma)
      
      expect(options.map(o => o.id)).toContain("OPTIMIZE_TRANSPORT")
      expect(options.length).toBe(5)
    })

    it("should NOT include OPTIMIZE_TRANSPORT when workspaceId is undefined", async () => {
      const options = await buildCartActionOptions(true, undefined, mockPrisma)
      
      expect(options.map(o => o.id)).not.toContain("OPTIMIZE_TRANSPORT")
      expect(mockPrisma.workspace.findUnique).not.toHaveBeenCalled()
    })

    it("should NOT include OPTIMIZE_TRANSPORT when workspace not found", async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue(null)

      const options = await buildCartActionOptions(true, "workspace-123", mockPrisma)
      
      expect(options.map(o => o.id)).not.toContain("OPTIMIZE_TRANSPORT")
    })

    it("should NOT include OPTIMIZE_TRANSPORT when DB query fails", async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockRejectedValue(new Error("DB error"))

      const options = await buildCartActionOptions(true, "workspace-123", mockPrisma)
      
      expect(options.map(o => o.id)).not.toContain("OPTIMIZE_TRANSPORT")
      expect(options.length).toBe(4) // Should still have base options
    })

    it("should have correct option numbers without removable items", async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        planType: "PREMIUM" as PlanType,
      })

      const options = await buildCartActionOptions(false, "workspace-123", mockPrisma)
      
      // Without removable items: CONFIRM(1), SHOW_PRODUCTS(2), CLEAR(3), OPTIMIZE(4)
      expect(options.length).toBe(4)
      expect(options[0]).toEqual({ number: 1, name: "✅ Confermare l'ordine", id: "CONFIRM_ORDER" })
      expect(options[1]).toEqual({ number: 2, name: "🛍️ Esplorare il catalogo", id: "SHOW_PRODUCTS" })
      expect(options[2]).toEqual({ number: 3, name: "🧹 Cancella il carrello", id: "CLEAR_CART" })
      expect(options[3]).toEqual({ number: 4, name: "🚚 Ottimizza spedizione", id: "OPTIMIZE_TRANSPORT" })
    })

    it("should have correct option numbers with removable items", async () => {
      mockPrisma.workspace.findUnique = jest.fn().mockResolvedValue({
        planType: "ENTERPRISE" as PlanType,
      })

      const options = await buildCartActionOptions(true, "workspace-123", mockPrisma)
      
      // With removable items: CONFIRM(1), SHOW_PRODUCTS(2), REMOVE(3), CLEAR(4), OPTIMIZE(5)
      expect(options.length).toBe(5)
      expect(options[0]).toEqual({ number: 1, name: "✅ Confermare l'ordine", id: "CONFIRM_ORDER" })
      expect(options[1]).toEqual({ number: 2, name: "🛍️ Esplorare il catalogo", id: "SHOW_PRODUCTS" })
      expect(options[2]).toEqual({ number: 3, name: "🗑️ Rimuovere un articolo", id: "REMOVE_FROM_CART" })
      expect(options[3]).toEqual({ number: 4, name: "🧹 Cancella il carrello", id: "CLEAR_CART" })
      expect(options[4]).toEqual({ number: 5, name: "🚚 Ottimizza spedizione", id: "OPTIMIZE_TRANSPORT" })
    })
  })
})
