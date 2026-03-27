/**
 * StockService — Atomic Decrement Tests (BUG#8 fix)
 *
 * VULNERABILITY FIXED:
 * scaleStockForConfirmedOrder() used a read-then-write pattern:
 *   1. findUnique → read product.stock (e.g. 5)
 *   2. newStock = product.stock - item.quantity   (e.g. 5 - 3 = 2)
 *   3. update({ data: { stock: newStock } })
 *
 * Under concurrent order confirmations, two calls to step 1 return the same
 * stock value. Both write stock=2, but the real result should be -1 → OVERSOLD.
 *
 * FIX: Use Prisma's atomic updateMany with:
 *   - where: { id, stock: { gte: quantity } }  ← atomic guard
 *   - data: { stock: { decrement: quantity } }  ← atomic write
 *
 * RULE: If updateMany.count === 0, the stock was already depleted (concurrent
 * update won the race). Log a warning and skip — do NOT silently oversell.
 *
 * @see apps/backend/src/application/services/stock.service.ts
 */

// ---- MOCKS FIRST ----

const mockPrisma = {
  orders: {
    findUnique: jest.fn(),
  },
  products: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
}

jest.mock("../../../src/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}
jest.mock("../../../src/utils/logger", () => ({ default: mockLogger, __esModule: true }))

// EmailService and pushMessagingService not needed for these tests
jest.mock("../../../src/application/services/email.service", () => ({
  EmailService: jest.fn().mockImplementation(() => ({})),
}))
jest.mock("../../../src/services/push-messaging.service", () => ({
  pushMessagingService: { sendOrderConfirmation: jest.fn().mockResolvedValue(true) },
}))

// ---- IMPORTS AFTER MOCKS ----

import { StockService } from "../../../src/application/services/stock.service"

// ---- HELPERS ----

function makeOrder(overrides: any = {}) {
  return {
    id: "order-1",
    orderCode: "ORD-001-2026-3",
    workspaceId: "ws-1",
    customer: { id: "cust-1", email: "test@test.com", phone: "+39123", name: "Mario" },
    workspace: { notificationEmail: "admin@test.com" },
    items: [
      {
        id: "item-1",
        itemType: "PRODUCT",
        productId: "prod-1",
        quantity: 3,
        unitPrice: 10,
        totalPrice: 30,
        productVariant: null,
      },
    ],
    totalAmount: 30,
    ...overrides,
  }
}

// ---- TESTS ----

describe("StockService — Atomic Stock Decrement (BUG#8 fix)", () => {
  let stockService: StockService

  beforeEach(() => {
    jest.clearAllMocks()
    stockService = new StockService()
  })

  describe("scaleStockForConfirmedOrder — called via handleOrderStatusChange", () => {
    it("uses updateMany with atomic { gte: quantity } guard and { decrement } — NOT read-write", async () => {
      // SCENARIO: Order PENDING → CONFIRMED with 1 product (qty 3, current stock 5)
      // RULE: Must use updateMany with atomic guards to prevent race conditions
      const order = makeOrder()

      mockPrisma.orders.findUnique.mockResolvedValue(order)
      mockPrisma.products.findUnique.mockResolvedValue({ id: "prod-1", name: "Widget", stock: 5 })
      mockPrisma.products.updateMany.mockResolvedValue({ count: 1 })

      await stockService.handleOrderStatusChange("order-1", "PENDING", "CONFIRMED")

      // ASSERT: updateMany called with atomic where-guard (not plain update)
      expect(mockPrisma.products.updateMany).toHaveBeenCalledWith({
        where: {
          id: "prod-1",
          stock: { gte: 3 }, // Atomic guard: only succeeds if stock is still >= qty
        },
        data: { stock: { decrement: 3 } }, // Atomic decrement
      })
    })

    it("does NOT call prisma.products.update (the non-atomic write)", async () => {
      // REGRESSION TEST: The buggy code used products.update({ data: { stock: newStock } })
      // This must NEVER be called — only updateMany is safe
      const order = makeOrder()

      mockPrisma.orders.findUnique.mockResolvedValue(order)
      mockPrisma.products.findUnique.mockResolvedValue({ id: "prod-1", name: "Widget", stock: 5 })
      mockPrisma.products.updateMany.mockResolvedValue({ count: 1 })

      await stockService.handleOrderStatusChange("order-1", "PENDING", "CONFIRMED")

      expect(mockPrisma.products.update).not.toHaveBeenCalled()
    })

    it("logs a warning when updateMany.count === 0 (race condition — stock depleted by concurrent update)", async () => {
      // SCENARIO: Two concurrent order confirmations. The second one arrives after
      // the first already decremented stock to 0. updateMany returns count=0.
      // RULE: Must warn and skip — should NOT oversell
      const order = makeOrder()

      mockPrisma.orders.findUnique.mockResolvedValue(order)
      mockPrisma.products.findUnique.mockResolvedValue({ id: "prod-1", name: "Widget", stock: 3 })
      mockPrisma.products.updateMany.mockResolvedValue({ count: 0 }) // Atomic guard rejected write

      await stockService.handleOrderStatusChange("order-1", "PENDING", "CONFIRMED")

      // RULE: A warning must be logged explaining the race condition was prevented
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("race condition prevented")
      )
    })

    it("skips non-PRODUCT items (services) without touching stock", async () => {
      // RULE: Stock is only decremented for PRODUCT items, not SERVICE items
      const orderWithService = makeOrder({
        items: [
          { id: "item-1", itemType: "SERVICE", serviceId: "svc-1", productId: null, quantity: 2 },
        ],
      })

      mockPrisma.orders.findUnique.mockResolvedValue(orderWithService)

      await stockService.handleOrderStatusChange("order-1", "PENDING", "CONFIRMED")

      expect(mockPrisma.products.updateMany).not.toHaveBeenCalled()
      expect(mockPrisma.products.update).not.toHaveBeenCalled()
    })

    it("skips status transitions other than PENDING → CONFIRMED (no stock decrement)", async () => {
      // RULE: Stock only decremented on PENDING → CONFIRMED transition
      mockPrisma.orders.findUnique.mockResolvedValue(makeOrder())

      await stockService.handleOrderStatusChange("order-1", "CONFIRMED", "SHIPPED")

      expect(mockPrisma.products.updateMany).not.toHaveBeenCalled()
    })
  })

  describe("restoreStockForCancelledOrder — called via handleOrderStatusChange", () => {
    it("restores stock when CONFIRMED → CANCELLED", async () => {
      // RULE: Stock must be restored when a confirmed order is cancelled
      const order = makeOrder()
      mockPrisma.orders.findUnique.mockResolvedValue(order)
      mockPrisma.products.findUnique.mockResolvedValue({ id: "prod-1", name: "Widget", stock: 0 })
      mockPrisma.products.update.mockResolvedValue({ id: "prod-1", stock: 3 })

      await stockService.handleOrderStatusChange("order-1", "CONFIRMED", "CANCELLED")

      expect(mockPrisma.products.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: { stock: 3 }, // 0 + 3 restored
      })
    })
  })
})
