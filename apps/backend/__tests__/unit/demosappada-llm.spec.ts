/**
 * demosappada — llm.ts request shaping (no network: pure helpers only)
 *
 * WHAT: (1) the system string is split at CACHE_BREAK into content blocks
 * that each carry a cache breakpoint — stable tenant prompt first, volatile
 * turn data second; (2) operator notes injected mid-conversation travel as
 * `role: "system"`, never as user text.
 *
 * WHY: (1) Andrea, 2026-08-28: "ho messo un modello che costa di più, cerca
 * di ottimizzare i costi con cache" — every guest message costs 2–4 model
 * calls with the same ~10k-token system; a breakpoint at the stable boundary
 * makes the tools + tenant prompt a cache read on every turn, and one at the
 * end of the system makes every hop after the first a cache read. (2) Live
 * 16:30, 2026-08-28: a "[SYSTEM]" guard sent as user text was ANSWERED by
 * the model, in Italian, to a Spanish speaker ("non hai fornito informazioni
 * — era solo un saluto"). The operator channel is the system role.
 */
import { CACHE_BREAK, systemBlocks, toAnthropicPayload } from "../../custom-demosappada/llm"

describe("demosappada systemBlocks — a breakpoint at the stable boundary and at the end", () => {
  it("splits at CACHE_BREAK into two cacheable blocks, in order", () => {
    const blocks = systemBlocks(`TENANT PROMPT\nRULES${CACHE_BREAK}FAQ\nRUNTIME`)
    // The tenant block is shared by every guest → cached for an hour; the
    // per-turn block keeps the 5-minute default.
    expect(blocks).toEqual([
      { type: "text", text: "TENANT PROMPT\nRULES", cache_control: { type: "ephemeral", ttl: "1h" } },
      { type: "text", text: "FAQ\nRUNTIME", cache_control: { type: "ephemeral" } },
    ])
  })

  it("a system without the marker is one cached block — nothing breaks", () => {
    expect(systemBlocks("plain")).toEqual([{ type: "text", text: "plain", cache_control: { type: "ephemeral" } }])
  })
})

describe("demosappada toAnthropicPayload — operator notes are system, not user", () => {
  const messages = [
    { role: "system" as const, content: "MAIN" },
    { role: "user" as const, content: "hola que tal?" },
    { role: "assistant" as const, content: "…" },
    { role: "system" as const, content: "[SYSTEM] salva le preferenze" },
  ]

  it("🚨 live 16:30: the mid-conversation note keeps the system role", () => {
    const { system, messages: out } = toAnthropicPayload(messages)
    expect(system).toBe("MAIN")
    expect(out[out.length - 1]).toEqual({ role: "system", content: "[SYSTEM] salva le preferenze" })
  })

  it("falls back to user text only when asked (models without a mid-conversation system role)", () => {
    const { messages: out } = toAnthropicPayload(messages, "user")
    expect(out[out.length - 1].role).toBe("user")
  })
})
