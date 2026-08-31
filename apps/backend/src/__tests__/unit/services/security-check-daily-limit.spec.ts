/**
 * SecurityCheckService — Step 1b, the per-customer daily cap.
 *
 * WHAT: after Workspace.messageLimit user messages in a rolling 24h window
 * (default 50, editable in backoffice, <= 0 disables), further messages are
 * refused with a retryAfter — BEFORE any LLM call is made.
 *
 * WHY (Andrea, 2026-09-01: "dopo 50 messaggi al giorno c'è un blocco"): every
 * turn costs real money, and the per-minute limits cannot stop a slow but
 * endless conversation. DB-first: the number lives on the workspace row,
 * never in code (CLAUDE.md rule 1).
 */
import { SecurityCheckService } from "../../../application/services/security-check.service"
import { prisma } from "@echatbot/database"

jest.mock("@echatbot/database", () => ({
  prisma: {
    workspace: { findUnique: jest.fn() },
    conversationMessage: { count: jest.fn() },
    whatsAppQueue: { count: jest.fn() },
  },
}))

const mockPrisma = prisma as unknown as {
  workspace: { findUnique: jest.Mock }
  conversationMessage: { count: jest.Mock }
  whatsAppQueue: { count: jest.Mock }
}

const CONTEXT = {
  workspaceId: "ws-1",
  visitorId: "visitor_123",
  message: "Ciao, un'altra domanda!",
  channel: "widget" as const,
}

describe("SecurityCheckService — daily message limit (step 1b)", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    // Workspace row serves BOTH the daily-limit read (messageLimit) and the
    // business-rules read (deletedAt/debugMode) — one mock covers both.
    mockPrisma.workspace.findUnique.mockResolvedValue({
      messageLimit: 50,
      deletedAt: null,
      debugMode: false,
    })
  })

  it("passes under the cap and lets the pipeline continue", async () => {
    mockPrisma.conversationMessage.count
      .mockResolvedValueOnce(2) // step 1: last minute
      .mockResolvedValueOnce(10) // step 1b: last 24h
      .mockResolvedValueOnce(0) // step 5: anti-spam window

    const results = await SecurityCheckService.validateMessage(CONTEXT)

    const daily = results.find((r) => r.step === "DAILY_LIMIT")
    expect(daily?.passed).toBe(true)
    // The pipeline went past it (content safety etc. present).
    expect(results.some((r) => r.step === "CONTENT_SAFETY")).toBe(true)
  })

  it("🚨 blocks the 51st message of the day, fail-fast, with a retryAfter", async () => {
    mockPrisma.conversationMessage.count
      .mockResolvedValueOnce(2) // step 1: last minute — fine
      .mockResolvedValueOnce(50) // step 1b: cap reached

    const results = await SecurityCheckService.validateMessage(CONTEXT)

    const daily = results.find((r) => r.step === "DAILY_LIMIT")
    expect(daily?.passed).toBe(false)
    expect(daily?.reason).toContain("50/50")
    expect(daily?.retryAfter).toBeGreaterThan(0)
    // Fail fast: nothing after it ran — no LLM money spent.
    expect(results[results.length - 1].step).toBe("DAILY_LIMIT")
  })

  it("messageLimit <= 0 disables the cap entirely", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue({
      messageLimit: 0,
      deletedAt: null,
      debugMode: false,
    })
    mockPrisma.conversationMessage.count
      .mockResolvedValueOnce(2) // step 1
      .mockResolvedValueOnce(0) // step 5 (daily skipped — no 24h count call)

    const results = await SecurityCheckService.validateMessage(CONTEXT)

    const daily = results.find((r) => r.step === "DAILY_LIMIT")
    expect(daily?.passed).toBe(true)
  })

  it("covers WhatsApp too — same cap, counted on the whatsapp queue", async () => {
    mockPrisma.whatsAppQueue.count
      .mockResolvedValueOnce(0) // step 1
      .mockResolvedValueOnce(80) // step 1b: over the cap
    const results = await SecurityCheckService.validateMessage({
      ...CONTEXT,
      channel: "whatsapp",
    })

    const daily = results.find((r) => r.step === "DAILY_LIMIT")
    expect(daily?.passed).toBe(false)
  })

  it("is skipped for page-access validation (no message involved)", async () => {
    mockPrisma.conversationMessage.count.mockResolvedValue(0)
    const results = await SecurityCheckService.validateMessage({
      ...CONTEXT,
      accessValidationOnly: true,
    })
    expect(results.some((r) => r.step === "DAILY_LIMIT")).toBe(false)
  })
})
