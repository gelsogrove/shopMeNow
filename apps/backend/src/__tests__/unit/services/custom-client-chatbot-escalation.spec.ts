/**
 * Unit tests — applyEscalationSideEffects (custom-client-chatbot.service).
 *
 * WHAT: the ONE shared function that applies the host-side effects of a
 * module escalation (ChatbotOutput.shouldEscalate=true): dispatch the
 * operator notification and disable the chatbot for the customer.
 *
 * WHY: these effects used to be inlined only in the widget's ongoing-message
 * branch. An emergency escalated on a visitor's FIRST message (widget
 * registration branch) announced the hand-off and then silently dropped it —
 * no operator notification, chat still active (Andrea 2026-08-18, seen live,
 * demoam "the Robot cut my cat"). Every entry point now calls this function;
 * these tests pin its contract so no branch can drift again:
 *   - no escalation declared → nothing happens, returns false
 *   - escalation without a summary → nothing happens, returns false
 *   - escalation declared → chatbot disabled (workspace-scoped), returns true
 *
 * The injected PrismaClient is a mock: no real DB is touched. The notification
 * leg runs against a mock workspace with hasHumanSupport=false, so it exits
 * on its own guard — its delivery logic has its own coverage.
 */
import { applyEscalationSideEffects } from "../../../application/services/custom-client-chatbot.service"

const mockWorkspaceFindFirst = jest.fn()
const mockCustomersUpdate = jest.fn()

const db = {
  workspace: { findFirst: (...a: any[]) => mockWorkspaceFindFirst(...a) },
  customers: { update: (...a: any[]) => mockCustomersUpdate(...a) },
} as any

const baseParams = {
  workspaceId: "ws-1",
  customerId: "cust-1",
  customerName: "Luca Bianchi",
  history: [{ role: "user" as const, content: "il robot ha ferito il mio gatto" }],
}

describe("applyEscalationSideEffects", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // hasHumanSupport=false and no custom emails → the notification leg
    // exits on its own guard without attempting any delivery.
    mockWorkspaceFindFirst.mockResolvedValue({ hasHumanSupport: false })
    mockCustomersUpdate.mockResolvedValue({})
  })

  it("does nothing and returns false when the module did not escalate", async () => {
    const applied = await applyEscalationSideEffects(
      { ...baseParams, output: { shouldEscalate: false, escalationSummary: "ignored" } },
      db
    )

    expect(applied).toBe(false)
    expect(mockCustomersUpdate).not.toHaveBeenCalled()
    expect(mockWorkspaceFindFirst).not.toHaveBeenCalled()
  })

  it("does nothing and returns false when shouldEscalate=true but no summary was produced", async () => {
    // A summary is what the operator actually receives: without one there is
    // nothing to hand over, same condition the original inline branch used.
    const applied = await applyEscalationSideEffects(
      { ...baseParams, output: { shouldEscalate: true, escalationSummary: undefined } },
      db
    )

    expect(applied).toBe(false)
    expect(mockCustomersUpdate).not.toHaveBeenCalled()
  })

  it("disables the chatbot (workspace-scoped) and returns true on a real escalation", async () => {
    const applied = await applyEscalationSideEffects(
      { ...baseParams, output: { shouldEscalate: true, escalationSummary: "emergency: cat injured" } },
      db
    )

    expect(applied).toBe(true)
    // workspaceId in the where clause: workspace isolation (CLAUDE.md rule 2)
    // — a customerId from another tenant must never be silenced.
    expect(mockCustomersUpdate).toHaveBeenCalledWith({
      where: { id: "cust-1", workspaceId: "ws-1" },
      data: { activeChatbot: false },
    })
  })

  it("still reports the escalation as applied when the chatbot-disable write fails", async () => {
    // The customer reply must go out regardless: a DB hiccup on the disable
    // write must not crash the turn nor un-declare the escalation.
    mockCustomersUpdate.mockRejectedValue(new Error("db down"))

    const applied = await applyEscalationSideEffects(
      { ...baseParams, output: { shouldEscalate: true, escalationSummary: "emergency" } },
      db
    )

    expect(applied).toBe(true)
  })
})
