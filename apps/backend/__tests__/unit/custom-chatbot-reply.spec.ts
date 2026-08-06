/**
 * Tests for the custom-chatbot reply utilities (custom-chatbot-reply.ts).
 *
 * WHAT: splitCustomChatbotReply separates the customer-facing text from the
 * internal operator briefing; ensureCustomerFacingReply guarantees the
 * escalation turn never reaches the customer empty.
 *
 * WHY: seen live in the widget (2026-08-06, AmRobots): on the escalation
 * turn the model wrote ONLY the operator briefing — the split left
 * customerReply empty, the customer answered the last gate question and got
 * pure silence before the chat flipped to operator mode. The fallback to the
 * configured hand-off message (workspace.humanSupportMessage) is what stands
 * between that bug and the customer; these tests pin it.
 */
import {
  ensureCustomerFacingReply,
  splitCustomChatbotReply,
} from "../../src/utils/custom-chatbot-reply"

const MARKER = "**👤 Human Support message**"
const BRIEFING = `${MARKER}\n\n**Customer**\n• Name: Paolo\n\n**Summary**\nWants an operator.`
const HANDOFF = "Paolo, ti metto in contatto con un operatore."

describe("splitCustomChatbotReply", () => {
  it("returns the whole reply as customer-facing when there is no marker", () => {
    const result = splitCustomChatbotReply("Ciao, come posso aiutarti?")
    expect(result.customerReply).toBe("Ciao, come posso aiutarti?")
    expect(result.operatorBlock).toBeNull()
  })

  it("splits customer text from the operator briefing at the marker", () => {
    const result = splitCustomChatbotReply(`${HANDOFF}\n\n${BRIEFING}`)
    expect(result.customerReply).toBe(HANDOFF)
    expect(result.operatorBlock).toBe(BRIEFING)
    // The briefing must NEVER leak into the customer-facing half.
    expect(result.customerReply).not.toContain(MARKER)
  })
})

describe("ensureCustomerFacingReply", () => {
  it("leaves a reply with customer text untouched", () => {
    const reply = `${HANDOFF}\n\n${BRIEFING}`
    expect(ensureCustomerFacingReply(reply, "configured hand-off")).toBe(reply)
  })

  it("leaves a normal (non-escalation) reply untouched even without hand-off config", () => {
    expect(ensureCustomerFacingReply("Ciao!", null)).toBe("Ciao!")
  })

  it("prepends the configured hand-off when the model wrote ONLY the briefing (the live bug)", () => {
    const fixed = ensureCustomerFacingReply(BRIEFING, HANDOFF)
    expect(splitCustomChatbotReply(fixed).customerReply).toBe(HANDOFF)
    // The briefing survives intact for the backoffice orange balloon.
    expect(splitCustomChatbotReply(fixed).operatorBlock).toBe(BRIEFING)
  })

  it("treats whitespace-only customer text as empty", () => {
    const fixed = ensureCustomerFacingReply(`   \n${BRIEFING}`, HANDOFF)
    expect(splitCustomChatbotReply(fixed).customerReply).toBe(HANDOFF)
  })

  it("returns the reply unchanged when no hand-off is configured — silence over hardcoded copy (CLAUDE.md §1A)", () => {
    expect(ensureCustomerFacingReply(BRIEFING, null)).toBe(BRIEFING)
    expect(ensureCustomerFacingReply(BRIEFING, "   ")).toBe(BRIEFING)
  })
})
