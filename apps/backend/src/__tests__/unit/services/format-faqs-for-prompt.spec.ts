/**
 * Unit tests for formatFaqsForPrompt
 *
 * WHAT: verifies the text block injected into the chatbot prompt via the
 * {{faqs}} variable when FAQs carry the optional `category` field.
 *
 * WHY: FAQs can be grouped by category (DB column `faqs.category`). The
 * chatbot must receive them grouped by topic so the LLM can navigate the
 * knowledge base, while FAQs without a category must still be listed —
 * with NO invented header (category names are tenant data; hardcoding a
 * "General" label in code would violate the database-first rule).
 */
import { formatFaqsForPrompt } from "../../../utils/format-faqs-for-prompt"

describe("formatFaqsForPrompt", () => {
  it("formats a single uncategorized FAQ as a plain Q/A pair", () => {
    // WHY: the historical format was `Q: ...\nA: ...` — workspaces that
    // never set a category must see zero change in their prompt.
    const result = formatFaqsForPrompt([
      { question: "How long does delivery take?", answer: "2-5 days." },
    ])

    expect(result).toBe("Q: How long does delivery take?\nA: 2-5 days.")
  })

  it("groups categorized FAQs under a [Category] header", () => {
    // WHY: the header lets the LLM answer "what do you know about orders?"
    // by scanning topic blocks instead of every Q/A pair.
    const result = formatFaqsForPrompt([
      { question: "Where is my order?", answer: "Check My Orders.", category: "Orders" },
      { question: "Can I cancel?", answer: "Yes, within 24h.", category: "Orders" },
    ])

    expect(result).toBe(
      "[Orders]\n" +
        "Q: Where is my order?\nA: Check My Orders.\n\n" +
        "Q: Can I cancel?\nA: Yes, within 24h."
    )
  })

  it("lists uncategorized FAQs first, then categorized blocks", () => {
    // WHY: uncategorized FAQs must never be hidden inside a made-up
    // category; they lead the block so nothing is lost for tenants that
    // only categorize part of their FAQs.
    const result = formatFaqsForPrompt([
      { question: "Q-orders", answer: "A-orders", category: "Orders" },
      { question: "Q-plain", answer: "A-plain", category: null },
      { question: "Q-shipping", answer: "A-shipping", category: "Shipping" },
    ])

    expect(result).toBe(
      "Q: Q-plain\nA: A-plain\n\n" +
        "[Orders]\nQ: Q-orders\nA: A-orders\n\n" +
        "[Shipping]\nQ: Q-shipping\nA: A-shipping"
    )
  })

  it("treats blank/whitespace categories as uncategorized", () => {
    // WHY: the DB column is free text — an empty string saved from the form
    // must not create an empty "[]" header in the prompt.
    const result = formatFaqsForPrompt([
      { question: "Q1", answer: "A1", category: "   " },
      { question: "Q2", answer: "A2", category: "" },
    ])

    expect(result).toBe("Q: Q1\nA: A1\n\nQ: Q2\nA: A2")
  })

  it("trims category names so ' Orders' and 'Orders' merge into one block", () => {
    // WHY: categories are typed by hand in the backoffice; accidental
    // whitespace must not split one topic into two prompt blocks.
    const result = formatFaqsForPrompt([
      { question: "Q1", answer: "A1", category: " Orders" },
      { question: "Q2", answer: "A2", category: "Orders " },
    ])

    expect(result).toBe("[Orders]\nQ: Q1\nA: A1\n\nQ: Q2\nA: A2")
  })

  it("returns an empty string for an empty FAQ list", () => {
    // WHY: callers decide the fallback text ("No FAQs available") — the
    // formatter itself must not invent content.
    expect(formatFaqsForPrompt([])).toBe("")
  })
})
