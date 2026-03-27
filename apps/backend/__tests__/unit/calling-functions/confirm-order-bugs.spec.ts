/**
 * confirmOrder Domain Function — Bug Regression Tests
 *
 * BUG#7: prisma.$disconnect() was called on the global shared Prisma instance
 * inside confirmOrder, contactOperator, getOrder, manageNotifications, and
 * repeatOrder. Calling $disconnect() on a shared singleton kills the DB
 * connection pool for ALL concurrent requests — not just the current one.
 * This causes random "connection not found" errors under load.
 *
 * FIX: All prisma.$disconnect() calls removed from domain functions.
 *
 * BUG#9: Order code was generated with a non-atomic count → derive → create
 * pattern. Two concurrent confirmOrder calls both read the same count, both
 * generate the same orderCode (e.g. ORD-011-2026-3), and the second prisma
 * create fails with P2002 unique constraint violation. The error was swallowed
 * by the generic catch block, showing an opaque error to the customer.
 *
 * FIX: Retry loop with letter suffix on P2002 collision (ORD-011-2026-3-B,
 * ORD-011-2026-3-C, ...). Retries up to 5 times.
 *
 * @see apps/backend/src/domain/calling-functions/confirmOrder.ts
 */

// ---- MOCKS FIRST ----

const mockDisconnect = jest.fn()

const mockPrisma = {
  $disconnect: mockDisconnect,
  customers: { findFirst: jest.fn() },
  workspace: { findUnique: jest.fn() },
  carts: { findFirst: jest.fn() },
  cartItems: { deleteMany: jest.fn() },
  orders: {
    count: jest.fn(),
    create: jest.fn(),
  },
  sales: { findUnique: jest.fn() },
  conversationMessage: { findMany: jest.fn() },
  whatsAppQueue: { create: jest.fn() },
}

jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
  AgentType: { SAFETY: "SAFETY" },
  PrismaClient: jest.fn(),
}))

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}
jest.mock("../../../src/utils/logger", () => ({ default: mockLogger, __esModule: true }))

// Stub out all services called inside confirmOrder that we don't care about for these tests
jest.mock("../../../src/application/services/price-calculation.service", () => ({
  PriceCalculationService: jest.fn().mockImplementation(() => ({
    calculatePricesWithDiscounts: jest.fn().mockResolvedValue({ products: [] }),
  })),
}))

jest.mock("../../../src/services/function-executor.service", () => ({
  FunctionExecutorService: jest.fn(),
}))

// ---- IMPORTS AFTER MOCKS ----

import { confirmOrder } from "../../../src/domain/calling-functions/confirmOrder"

// ---- HELPERS ----

function makeCustomer(overrides: any = {}) {
  return {
    id: "cust-1",
    name: "Mario Rossi",
    email: "mario@test.com",
    phone: "+39123456789",
    address: "Via Roma 1",
    discount: 0,
    isActive: true,
    workspaceId: "ws-1",
    salesId: null,
    ...overrides,
  }
}

function makeWorkspace() {
  return {
    id: "ws-1",
    name: "Test Shop",
    operatorEmail: "operator@test.com",
    hasSalesAgents: false,
    notificationEmail: "notify@test.com",
  }
}

function makeCart(items: any[] = []) {
  const defaultItem = {
    id: "cartitem-1",
    cartId: "cart-1",
    itemType: "PRODUCT",
    productId: "prod-1",
    serviceId: null,
    quantity: 1,
    notes: null,
    product: { id: "prod-1", name: "Widget", price: 10, sku: "WGT-1", stock: 5, isActive: true },
    service: null,
  }
  return {
    id: "cart-1",
    customerId: "cust-1",
    workspaceId: "ws-1",
    items: items.length > 0 ? items : [defaultItem],
  }
}

function makeConfirmRequest() {
  return {
    customerId: "cust-1",
    workspaceId: "ws-1",
  }
}

function makeCreatedOrder(orderCode = "ORD-001-2026-3") {
  return {
    id: "order-1",
    orderCode,
    customerId: "cust-1",
    workspaceId: "ws-1",
    status: "PENDING",
    totalAmount: 0,
    items: [],
  }
}

// ---- TESTS ----

describe("confirmOrder — BUG#7: NO prisma.$disconnect() on shared instance", () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Happy-path mocks — order creation succeeds
    mockPrisma.customers.findFirst.mockResolvedValue(makeCustomer())
    mockPrisma.workspace.findUnique.mockResolvedValue(makeWorkspace())
    mockPrisma.carts.findFirst.mockResolvedValue(makeCart())
    mockPrisma.orders.count.mockResolvedValue(0)
    mockPrisma.orders.create.mockResolvedValue(makeCreatedOrder())
    mockPrisma.cartItems.deleteMany.mockResolvedValue({ count: 0 })
    mockPrisma.sales.findUnique.mockResolvedValue(null)
  })

  it("never calls prisma.$disconnect() on the happy path", async () => {
    // BUG WAS: confirmOrder called prisma.$disconnect() before returning success.
    // Calling $disconnect() on the SHARED global Prisma instance kills the pool
    // for ALL concurrent requests — not just this one.
    await confirmOrder(makeConfirmRequest())

    expect(mockDisconnect).not.toHaveBeenCalled()
  })

  it("never calls prisma.$disconnect() when customer is not found (early return)", async () => {
    // BUG WAS: disconnect() was called in EVERY early return path
    mockPrisma.customers.findFirst.mockResolvedValue(null)

    await confirmOrder(makeConfirmRequest())

    expect(mockDisconnect).not.toHaveBeenCalled()
  })

  it("never calls prisma.$disconnect() when cart is empty (early return)", async () => {
    mockPrisma.carts.findFirst.mockResolvedValue({ id: "cart-1", customerId: "cust-1", workspaceId: "ws-1", items: [] } as any)

    await confirmOrder(makeConfirmRequest())

    expect(mockDisconnect).not.toHaveBeenCalled()
  })

  it("never calls prisma.$disconnect() when an exception is thrown", async () => {
    // BUG WAS: outer catch also called disconnect(), compounding the issue
    mockPrisma.customers.findFirst.mockRejectedValue(new Error("DB timeout"))

    await confirmOrder(makeConfirmRequest())

    expect(mockDisconnect).not.toHaveBeenCalled()
  })
})

describe("confirmOrder — BUG#9: orderCode collision retry on P2002", () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockPrisma.customers.findFirst.mockResolvedValue(makeCustomer())
    mockPrisma.workspace.findUnique.mockResolvedValue(makeWorkspace())
    mockPrisma.carts.findFirst.mockResolvedValue(makeCart())
    mockPrisma.orders.count.mockResolvedValue(0)
    mockPrisma.cartItems.deleteMany.mockResolvedValue({ count: 0 })
    mockPrisma.sales.findUnique.mockResolvedValue(null)
  })

  it("succeeds on first attempt when no collision", async () => {
    // SCENARIO: Normal case — no concurrent order with same code
    mockPrisma.orders.create.mockResolvedValue(makeCreatedOrder("ORD-001-2026-3"))

    const result = await confirmOrder(makeConfirmRequest())

    expect(result.success).toBe(true)
    expect(mockPrisma.orders.create).toHaveBeenCalledTimes(1)
  })

  it("retries with letter suffix when P2002 is thrown on first attempt", async () => {
    // SCENARIO: Concurrent request already created ORD-001-2026-3.
    // This request must retry with ORD-001-2026-3-B and succeed.
    // BUG WAS: P2002 was caught by the generic catch block and returned as
    //          an opaque error — customer got "Impossibile creare l'ordine"
    const p2002Error = Object.assign(new Error("Unique constraint failed"), { code: "P2002" })

    mockPrisma.orders.create
      .mockRejectedValueOnce(p2002Error) // Attempt 1: collision
      .mockResolvedValueOnce(makeCreatedOrder("ORD-001-2026-3-B")) // Attempt 2: success

    const result = await confirmOrder(makeConfirmRequest())

    expect(result.success).toBe(true)
    expect(mockPrisma.orders.create).toHaveBeenCalledTimes(2)

    // Verify warning was logged on collision
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("OrderCode collision on attempt 1")
    )
  })

  it("retries multiple times and succeeds on the 3rd attempt", async () => {
    // SCENARIO: Extremely unlucky — 2 collisions before success
    const p2002Error = Object.assign(new Error("Unique constraint"), { code: "P2002" })

    mockPrisma.orders.create
      .mockRejectedValueOnce(p2002Error) // Attempt 1: collision
      .mockRejectedValueOnce(p2002Error) // Attempt 2: collision
      .mockResolvedValueOnce(makeCreatedOrder("ORD-001-2026-3-C")) // Attempt 3: success

    const result = await confirmOrder(makeConfirmRequest())

    expect(result.success).toBe(true)
    expect(mockPrisma.orders.create).toHaveBeenCalledTimes(3)
  })

  it("re-throws non-P2002 errors without retrying", async () => {
    // RULE: Only P2002 (unique constraint) triggers a retry.
    // Other errors (e.g. DB connection failure) must propagate immediately.
    const dbError = Object.assign(new Error("Connection refused"), { code: "P1001" })

    mockPrisma.orders.create.mockRejectedValue(dbError)

    const result = await confirmOrder(makeConfirmRequest())

    // Should fail (caught by outer catch) and NOT retry
    expect(result.success).toBe(false)
    expect(mockPrisma.orders.create).toHaveBeenCalledTimes(1) // No retry
  })
})
