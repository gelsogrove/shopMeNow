/**
 * E0b — Session Reset Timeout Tests
 *
 * Tests the `checkAndResetExpiredSession` logic embedded in workspace strategies.
 * We test the logic by instantiating the strategies directly with a mock prisma client.
 *
 * BUSINESS RULE:
 *   When a chat is escalated to a human operator, `chatSession.escalatedAt` is set.
 *   On every subsequent customer message the strategy checks:
 *     - if (now - escalatedAt) > workspace.sessionResetTimeout → reset session
 *       • ECOMMERCE:    clear cart + context + escalatedAt=null
 *       • INFORMATIONAL: clear context + escalatedAt=null (no cart)
 *   If `escalatedAt` is null → skip (never escalated / already reset)
 *   If within timeout → skip (operator still presumably engaged)
 */

import { EcommerceWorkspaceStrategy } from "../../../src/strategies/ecommerce-workspace.strategy"
import { InformationalWorkspaceStrategy } from "../../../src/strategies/informational-workspace.strategy"

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    chatSession: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    carts: {
      deleteMany: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        chatSession: {
          update: jest.fn().mockResolvedValue({}),
        },
        carts: {
          deleteMany: jest.fn().mockResolvedValue({}),
        },
      }
      const result = await fn(tx)
      return result
    }),
    ...overrides,
  }
}

function makeWorkspace(sessionResetTimeout = 3600) {
  return {
    id: "ws-1",
    sessionResetTimeout,
    operatorEmail: "op@test.com",
    name: "Test Workspace",
    agentConfigs: [],
  } as any
}

function makeContext(sessionId = "sess-1") {
  return {
    workspaceId: "ws-1",
    customerId: "cust-1",
    sessionId,
    message: "hello",
    customerLanguage: "en",
    channelMode: "WHATSAPP",
  } as any
}

const SECONDS_AGO = (n: number) => new Date(Date.now() - n * 1000)

// ─── Ecommerce Strategy ──────────────────────────────────────────────────────

describe("E0b - EcommerceWorkspaceStrategy.checkAndResetExpiredSession", () => {
  it("does nothing when chatSession has no escalatedAt (never escalated)", async () => {
    // SCENARIO: Normal session, customer was never escalated to operator
    // RULE: escalatedAt===null → skip entirely, no reset
    const prisma = makePrisma()
    prisma.chatSession.findUnique.mockResolvedValue({
      id: "sess-1",
      customerId: "cust-1",
      escalatedAt: null,
      context: { step: "cart" },
    })

    const strategy = new EcommerceWorkspaceStrategy(prisma as any, {} as any)
    await (strategy as any).checkAndResetExpiredSession(makeContext(), makeWorkspace(3600))

    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.chatSession.update).not.toHaveBeenCalled()
  })

  it("does nothing when sessionId is missing in context", async () => {
    // SCENARIO: Context built before session was established (edge case)
    // RULE: no sessionId → skip check (nothing to reset)
    const prisma = makePrisma()
    const contextWithoutSession = { ...makeContext(), sessionId: undefined }

    const strategy = new EcommerceWorkspaceStrategy(prisma as any, {} as any)
    await (strategy as any).checkAndResetExpiredSession(contextWithoutSession, makeWorkspace(3600))

    expect(prisma.chatSession.findUnique).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("does NOT reset when escalatedAt is within timeout window", async () => {
    // SCENARIO: Operator was contacted 10 minutes ago, timeout is 1 hour (3600s)
    // RULE: timeSinceEscalation (600s) ≤ sessionResetTimeout (3600s) → skip
    const prisma = makePrisma()
    prisma.chatSession.findUnique.mockResolvedValue({
      id: "sess-1",
      customerId: "cust-1",
      escalatedAt: SECONDS_AGO(600), // 10 minutes ago
      context: { step: "waiting" },
    })

    const strategy = new EcommerceWorkspaceStrategy(prisma as any, {} as any)
    await (strategy as any).checkAndResetExpiredSession(makeContext(), makeWorkspace(3600))

    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("RESETS session (cart + context) when escalatedAt exceeds timeout", async () => {
    // SCENARIO: Operator was contacted 2 hours ago, timeout is 1 hour → reset triggered
    // RULE: timeSinceEscalation (7200s) > sessionResetTimeout (3600s) → RESET
    // ECOMMERCE reset must: deleteMany carts + update chatSession (context={}, escalatedAt=null)
    const prisma = makePrisma()
    prisma.chatSession.findUnique.mockResolvedValue({
      id: "sess-1",
      customerId: "cust-1",
      escalatedAt: SECONDS_AGO(7200), // 2 hours ago
      context: { step: "waiting", cart: ["item1"] },
    })

    const strategy = new EcommerceWorkspaceStrategy(prisma as any, {} as any)
    await (strategy as any).checkAndResetExpiredSession(makeContext(), makeWorkspace(3600))

    // Verify transaction was used (atomic reset)
    expect(prisma.$transaction).toHaveBeenCalled()

    // Verify cart was cleared
    const txFn = prisma.$transaction.mock.calls[0][0] as (tx: any) => any
    const txMock = {
      chatSession: { update: jest.fn().mockResolvedValue({}) },
      carts: { deleteMany: jest.fn().mockResolvedValue({}) },
    }
    await txFn(txMock)

    expect(txMock.carts.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ customerId: "cust-1", workspaceId: "ws-1" }),
      })
    )
    expect(txMock.chatSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sess-1" },
        data: expect.objectContaining({ context: {}, escalatedAt: null }),
      })
    )
  })

  it("resets immediately when sessionResetTimeout is 0", async () => {
    // SCENARIO: Admin sets timeout to 0 — any escalated session should reset on next message
    // RULE: sessionResetTimeout===0 → any positive timeSinceEscalation triggers reset
    const prisma = makePrisma()
    prisma.chatSession.findUnique.mockResolvedValue({
      id: "sess-1",
      customerId: "cust-1",
      escalatedAt: SECONDS_AGO(1), // 1 second ago
      context: {},
    })

    const strategy = new EcommerceWorkspaceStrategy(prisma as any, {} as any)
    await (strategy as any).checkAndResetExpiredSession(makeContext(), makeWorkspace(0))

    expect(prisma.$transaction).toHaveBeenCalled()
  })
})

// ─── Informational Strategy ──────────────────────────────────────────────────

describe("E0b - InformationalWorkspaceStrategy.checkAndResetExpiredSession", () => {
  it("does nothing when chatSession has no escalatedAt", async () => {
    // SCENARIO: Normal informational session (never escalated)
    // RULE: escalatedAt===null → skip
    const prisma = makePrisma()
    prisma.chatSession.findUnique.mockResolvedValue({
      id: "sess-1",
      customerId: "cust-1",
      escalatedAt: null,
      context: {},
    })

    const strategy = new InformationalWorkspaceStrategy(prisma as any, {} as any, {} as any, {} as any, {} as any)
    await (strategy as any).checkAndResetExpiredSession(makeContext(), makeWorkspace(3600))

    expect(prisma.chatSession.update).not.toHaveBeenCalled()
  })

  it("does NOT reset when within timeout window", async () => {
    // SCENARIO: 5 minutes since escalation, 1 hour timeout
    const prisma = makePrisma()
    prisma.chatSession.findUnique.mockResolvedValue({
      id: "sess-1",
      customerId: "cust-1",
      escalatedAt: SECONDS_AGO(300), // 5 minutes ago
      context: {},
    })

    const strategy = new InformationalWorkspaceStrategy(prisma as any, {} as any, {} as any, {} as any, {} as any)
    await (strategy as any).checkAndResetExpiredSession(makeContext(), makeWorkspace(3600))

    expect(prisma.chatSession.update).not.toHaveBeenCalled()
  })

  it("RESETS session (context only, NO cart) when timeout exceeded", async () => {
    // SCENARIO: 2 hours since escalation, 1 hour timeout → reset
    // RULE: INFORMATIONAL reset = context={} + escalatedAt=null (NO cart.deleteMany — no cart in info workspace)
    const prisma = makePrisma()
    prisma.chatSession.findUnique.mockResolvedValue({
      id: "sess-1",
      customerId: "cust-1",
      escalatedAt: SECONDS_AGO(7200),
      context: { agent: "support" },
    })

    const strategy = new InformationalWorkspaceStrategy(prisma as any, {} as any, {} as any, {} as any, {} as any)
    await (strategy as any).checkAndResetExpiredSession(makeContext(), makeWorkspace(3600))

    // No transaction needed (informational uses direct update, no cart)
    expect(prisma.carts.deleteMany).not.toHaveBeenCalled()
    expect(prisma.chatSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sess-1" },
        data: expect.objectContaining({ context: {}, escalatedAt: null }),
      })
    )
  })

  it("respects a 2-hour timeout boundary exactly", async () => {
    // SCENARIO: 7200s elapsed, timeout is 7200s → NOT yet exceeded (≤ boundary)
    // RULE: timeSinceEscalation <= sessionResetTimeout → no reset
    const prisma = makePrisma()
    prisma.chatSession.findUnique.mockResolvedValue({
      id: "sess-1",
      customerId: "cust-1",
      escalatedAt: SECONDS_AGO(7200),
      context: {},
    })

    const strategy = new InformationalWorkspaceStrategy(prisma as any, {} as any, {} as any, {} as any, {} as any)
    await (strategy as any).checkAndResetExpiredSession(makeContext(), makeWorkspace(7200))

    // At exact boundary: condition is timeSinceEscalation > timeout, so no reset
    expect(prisma.chatSession.update).not.toHaveBeenCalled()
  })
})
