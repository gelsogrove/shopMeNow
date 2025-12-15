/**
 * Unit Tests for ConversationStateService (FSM)
 * 
 * Tests the Finite State Machine for conversation flow management.
 * 
 * @see apps/backend/src/application/chat-engine/conversation-state.service.ts
 */

import { 
  ConversationStateService, 
  ConversationState,
  StateContext,
  CONFIRM_TRIGGERS_CHECKOUT,
  NUMERIC_MEANS_PRODUCT,
  NUMERIC_MEANS_ORDER,
  NUMERIC_MEANS_CATEGORY,
  NUMERIC_MEANS_ORDER_ACTION,
} from "../../../application/chat-engine/conversation-state.service"

// Mock PrismaClient
const mockPrisma = {
  chatSession: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

describe("ConversationStateService", () => {
  let service: ConversationStateService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ConversationStateService(mockPrisma as any)
  })

  // ============================================================================
  // getState() Tests
  // ============================================================================
  describe("getState()", () => {
    it("should return IDLE state when no session context exists", async () => {
      mockPrisma.chatSession.findUnique.mockResolvedValue({ context: null })
      
      const result = await service.getState("session-123")
      
      expect(result.state).toBe(ConversationState.IDLE)
    })

    it("should return IDLE state when conversationState is missing", async () => {
      mockPrisma.chatSession.findUnique.mockResolvedValue({ 
        context: { otherData: "test" } 
      })
      
      const result = await service.getState("session-123")
      
      expect(result.state).toBe(ConversationState.IDLE)
    })

    it("should return saved state from database", async () => {
      mockPrisma.chatSession.findUnique.mockResolvedValue({ 
        context: { 
          conversationState: {
            state: ConversationState.BROWSING_PRODUCTS,
            stateEnteredAt: "2024-01-01T00:00:00Z",
            selectedCategoryName: "Formaggi",
          }
        } 
      })
      
      const result = await service.getState("session-123")
      
      expect(result.state).toBe(ConversationState.BROWSING_PRODUCTS)
      expect(result.selectedCategoryName).toBe("Formaggi")
    })

    it("should return pendingAction if present", async () => {
      mockPrisma.chatSession.findUnique.mockResolvedValue({ 
        context: { 
          conversationState: {
            state: ConversationState.AWAITING_ORDER_CONFIRM,
            stateEnteredAt: "2024-01-01T00:00:00Z",
            pendingAction: { type: "CONFIRM_ORDER", orderCode: "ORD-001" },
          }
        } 
      })
      
      const result = await service.getState("session-123")
      
      expect(result.state).toBe(ConversationState.AWAITING_ORDER_CONFIRM)
      expect(result.pendingAction?.type).toBe("CONFIRM_ORDER")
      expect(result.pendingAction?.orderCode).toBe("ORD-001")
    })
  })

  // ============================================================================
  // setState() Tests
  // ============================================================================
  describe("setState()", () => {
    it("should update state in database", async () => {
      mockPrisma.chatSession.findUnique.mockResolvedValue({ context: {} })
      mockPrisma.chatSession.update.mockResolvedValue({})
      
      await service.setState("session-123", ConversationState.BROWSING_CATEGORIES)
      
      expect(mockPrisma.chatSession.update).toHaveBeenCalledWith({
        where: { id: "session-123" },
        data: {
          context: expect.objectContaining({
            conversationState: expect.objectContaining({
              state: ConversationState.BROWSING_CATEGORIES,
            }),
          }),
        },
      })
    })

    it("should preserve existing context data", async () => {
      mockPrisma.chatSession.findUnique.mockResolvedValue({ 
        context: { 
          customData: "preserved",
          conversationState: {
            state: ConversationState.IDLE,
            stateEnteredAt: "2024-01-01T00:00:00Z",
          }
        } 
      })
      mockPrisma.chatSession.update.mockResolvedValue({})
      
      await service.setState("session-123", ConversationState.VIEWING_PRODUCT, {
        selectedProductSku: "PROD-001",
      })
      
      expect(mockPrisma.chatSession.update).toHaveBeenCalledWith({
        where: { id: "session-123" },
        data: {
          context: expect.objectContaining({
            customData: "preserved",  // Should be preserved
            conversationState: expect.objectContaining({
              state: ConversationState.VIEWING_PRODUCT,
              selectedProductSku: "PROD-001",
            }),
          }),
        },
      })
    })

    it("should clear context data when returning to IDLE", async () => {
      mockPrisma.chatSession.findUnique.mockResolvedValue({ 
        context: { 
          conversationState: {
            state: ConversationState.VIEWING_PRODUCT,
            stateEnteredAt: "2024-01-01T00:00:00Z",
            selectedProductId: "prod-123",
            selectedProductSku: "PROD-001",
            selectedProductName: "Test Product",
          }
        } 
      })
      mockPrisma.chatSession.update.mockResolvedValue({})
      
      const result = await service.setState("session-123", ConversationState.IDLE)
      
      expect(result.selectedProductId).toBeUndefined()
      expect(result.selectedProductSku).toBeUndefined()
      expect(result.selectedProductName).toBeUndefined()
    })

    it("should maintain state history (last 3 states)", async () => {
      mockPrisma.chatSession.findUnique.mockResolvedValue({ 
        context: { 
          conversationState: {
            state: ConversationState.BROWSING_PRODUCTS,
            stateEnteredAt: "2024-01-01T00:00:00Z",
            stateHistory: [
              { state: ConversationState.IDLE, timestamp: "2024-01-01T00:00:00Z" },
              { state: ConversationState.BROWSING_CATEGORIES, timestamp: "2024-01-01T00:01:00Z" },
            ],
          }
        } 
      })
      mockPrisma.chatSession.update.mockResolvedValue({})
      
      const result = await service.setState("session-123", ConversationState.VIEWING_PRODUCT)
      
      // History keeps last 2 from existing + current state being replaced
      // Existing: [IDLE, BROWSING_CATEGORIES], current: BROWSING_PRODUCTS
      // After slice(-2): [IDLE, BROWSING_CATEGORIES] + {BROWSING_PRODUCTS} = 3 entries
      expect(result.stateHistory).toHaveLength(3)
      expect(result.stateHistory![0].state).toBe(ConversationState.IDLE)
      expect(result.stateHistory![1].state).toBe(ConversationState.BROWSING_CATEGORIES)
      expect(result.stateHistory![2].state).toBe(ConversationState.BROWSING_PRODUCTS)
    })
  })

  // ============================================================================
  // getNextState() - State Transition Tests
  // ============================================================================
  describe("getNextState()", () => {
    it("should return BROWSING_CATEGORIES from IDLE on SHOW_CATEGORIES", () => {
      const nextState = service.getNextState(ConversationState.IDLE, "SHOW_CATEGORIES")
      expect(nextState).toBe(ConversationState.BROWSING_CATEGORIES)
    })

    it("should return BROWSING_ORDERS from IDLE on VIEW_ORDERS", () => {
      const nextState = service.getNextState(ConversationState.IDLE, "VIEW_ORDERS")
      expect(nextState).toBe(ConversationState.BROWSING_ORDERS)
    })

    it("should return VIEWING_PRODUCT from BROWSING_PRODUCTS on SELECT_PRODUCT", () => {
      const nextState = service.getNextState(ConversationState.BROWSING_PRODUCTS, "SELECT_PRODUCT")
      expect(nextState).toBe(ConversationState.VIEWING_PRODUCT)
    })

    it("should return VIEWING_ORDER from BROWSING_ORDERS on SELECT_ORDER", () => {
      const nextState = service.getNextState(ConversationState.BROWSING_ORDERS, "SELECT_ORDER")
      expect(nextState).toBe(ConversationState.VIEWING_ORDER)
    })

    it("should return IN_CHECKOUT from AWAITING_ORDER_CONFIRM on CONFIRM", () => {
      const nextState = service.getNextState(ConversationState.AWAITING_ORDER_CONFIRM, "CONFIRM")
      expect(nextState).toBe(ConversationState.IN_CHECKOUT)
    })

    it("should return AWAITING_ORDER_CONFIRM from VIEWING_ORDER on REPEAT_ORDER", () => {
      const nextState = service.getNextState(ConversationState.VIEWING_ORDER, "REPEAT_ORDER")
      expect(nextState).toBe(ConversationState.AWAITING_ORDER_CONFIRM)
    })

    it("should allow global VIEW_CART from any state", () => {
      // VIEW_CART should work from any state (global intent)
      expect(service.getNextState(ConversationState.BROWSING_PRODUCTS, "VIEW_CART")).toBe(ConversationState.VIEWING_CART)
      expect(service.getNextState(ConversationState.VIEWING_ORDER, "VIEW_CART")).toBe(ConversationState.VIEWING_CART)
    })

    it("should return null for invalid transitions", () => {
      // Can't SELECT_ORDER when browsing products
      const nextState = service.getNextState(ConversationState.BROWSING_PRODUCTS, "SELECT_ORDER")
      expect(nextState).toBeNull()
    })
  })

  // ============================================================================
  // Helper Methods Tests
  // ============================================================================
  describe("getNumericSelectionType()", () => {
    it("should return PRODUCT for BROWSING_PRODUCTS state", () => {
      expect(service.getNumericSelectionType(ConversationState.BROWSING_PRODUCTS)).toBe("PRODUCT")
    })

    it("should return PRODUCT for BROWSING_SUBCATEGORIES state", () => {
      expect(service.getNumericSelectionType(ConversationState.BROWSING_SUBCATEGORIES)).toBe("PRODUCT")
    })

    it("should return ORDER for BROWSING_ORDERS state", () => {
      expect(service.getNumericSelectionType(ConversationState.BROWSING_ORDERS)).toBe("ORDER")
    })

    it("should return CATEGORY for BROWSING_CATEGORIES state", () => {
      expect(service.getNumericSelectionType(ConversationState.BROWSING_CATEGORIES)).toBe("CATEGORY")
    })

    it("should return ORDER_ACTION for VIEWING_ORDER state", () => {
      expect(service.getNumericSelectionType(ConversationState.VIEWING_ORDER)).toBe("ORDER_ACTION")
    })

    it("should return UNKNOWN for IDLE state", () => {
      expect(service.getNumericSelectionType(ConversationState.IDLE)).toBe("UNKNOWN")
    })
  })

  describe("shouldConfirmTriggerCheckout()", () => {
    it("should return true for AWAITING_ORDER_CONFIRM", () => {
      expect(service.shouldConfirmTriggerCheckout(ConversationState.AWAITING_ORDER_CONFIRM)).toBe(true)
    })

    it("should return true for VIEWING_CART", () => {
      expect(service.shouldConfirmTriggerCheckout(ConversationState.VIEWING_CART)).toBe(true)
    })

    it("should return false for BROWSING_PRODUCTS", () => {
      expect(service.shouldConfirmTriggerCheckout(ConversationState.BROWSING_PRODUCTS)).toBe(false)
    })

    it("should return false for IDLE", () => {
      expect(service.shouldConfirmTriggerCheckout(ConversationState.IDLE)).toBe(false)
    })
  })

  // ============================================================================
  // Integration Scenario Tests
  // ============================================================================
  describe("Integration Scenarios", () => {
    it("should handle complete browse → select → add to cart flow", async () => {
      // Start from IDLE
      mockPrisma.chatSession.findUnique.mockResolvedValue({ context: {} })
      mockPrisma.chatSession.update.mockResolvedValue({})
      
      // 1. Show categories → BROWSING_CATEGORIES
      let nextState = service.getNextState(ConversationState.IDLE, "SHOW_CATEGORIES")
      expect(nextState).toBe(ConversationState.BROWSING_CATEGORIES)
      
      // 2. Select category → BROWSING_SUBCATEGORIES
      nextState = service.getNextState(ConversationState.BROWSING_CATEGORIES, "SELECT_CATEGORY")
      expect(nextState).toBe(ConversationState.BROWSING_SUBCATEGORIES)
      
      // 3. Select product → VIEWING_PRODUCT
      nextState = service.getNextState(ConversationState.BROWSING_SUBCATEGORIES, "SELECT_PRODUCT")
      expect(nextState).toBe(ConversationState.VIEWING_PRODUCT)
      
      // 4. Add to cart → AWAITING_ADD_CONFIRM
      nextState = service.getNextState(ConversationState.VIEWING_PRODUCT, "ADD_TO_CART")
      expect(nextState).toBe(ConversationState.AWAITING_ADD_CONFIRM)
      
      // 5. Confirm → IDLE (added to cart)
      nextState = service.getNextState(ConversationState.AWAITING_ADD_CONFIRM, "CONFIRM")
      expect(nextState).toBe(ConversationState.IDLE)
    })

    it("should handle repeat order → confirm flow", async () => {
      // 1. View orders → BROWSING_ORDERS
      let nextState = service.getNextState(ConversationState.IDLE, "VIEW_ORDERS")
      expect(nextState).toBe(ConversationState.BROWSING_ORDERS)
      
      // 2. Select order → VIEWING_ORDER
      nextState = service.getNextState(ConversationState.BROWSING_ORDERS, "SELECT_ORDER")
      expect(nextState).toBe(ConversationState.VIEWING_ORDER)
      
      // 3. Repeat order → AWAITING_ORDER_CONFIRM
      nextState = service.getNextState(ConversationState.VIEWING_ORDER, "REPEAT_ORDER")
      expect(nextState).toBe(ConversationState.AWAITING_ORDER_CONFIRM)
      
      // 4. Confirm → IN_CHECKOUT (this is the bug we fixed!)
      nextState = service.getNextState(ConversationState.AWAITING_ORDER_CONFIRM, "CONFIRM")
      expect(nextState).toBe(ConversationState.IN_CHECKOUT)
    })
  })
})

// ============================================================================
// Constants Tests
// ============================================================================
describe("FSM Constants", () => {
  describe("CONFIRM_TRIGGERS_CHECKOUT", () => {
    it("should include AWAITING_ORDER_CONFIRM", () => {
      expect(CONFIRM_TRIGGERS_CHECKOUT).toContain(ConversationState.AWAITING_ORDER_CONFIRM)
    })

    it("should include VIEWING_CART", () => {
      expect(CONFIRM_TRIGGERS_CHECKOUT).toContain(ConversationState.VIEWING_CART)
    })
  })

  describe("NUMERIC_MEANS_PRODUCT", () => {
    it("should include BROWSING_PRODUCTS", () => {
      expect(NUMERIC_MEANS_PRODUCT).toContain(ConversationState.BROWSING_PRODUCTS)
    })

    it("should include BROWSING_SUBCATEGORIES", () => {
      expect(NUMERIC_MEANS_PRODUCT).toContain(ConversationState.BROWSING_SUBCATEGORIES)
    })
  })

  describe("NUMERIC_MEANS_ORDER", () => {
    it("should include BROWSING_ORDERS", () => {
      expect(NUMERIC_MEANS_ORDER).toContain(ConversationState.BROWSING_ORDERS)
    })
  })

  describe("NUMERIC_MEANS_CATEGORY", () => {
    it("should include BROWSING_CATEGORIES", () => {
      expect(NUMERIC_MEANS_CATEGORY).toContain(ConversationState.BROWSING_CATEGORIES)
    })
  })

  describe("NUMERIC_MEANS_ORDER_ACTION", () => {
    it("should include VIEWING_ORDER", () => {
      expect(NUMERIC_MEANS_ORDER_ACTION).toContain(ConversationState.VIEWING_ORDER)
    })

    it("should include VIEWING_ORDER_ACTIONS", () => {
      expect(NUMERIC_MEANS_ORDER_ACTION).toContain(ConversationState.VIEWING_ORDER_ACTIONS)
    })
  })
})
