/**
 * E2 — FlowClassifierService Unit Tests
 *
 * WHAT: Tests classifyInput() and normalizeInput() pure functions.
 * WHY: These are the decision gates of the entire flow engine.
 *      Wrong classification = wrong branch = broken customer experience.
 *
 * PRINCIPLE: Pure functions, zero mocks, fast execution.
 */

import { classifyInput, normalizeInput } from "../../../src/application/services/flow-classifier.service"

// ---------------------------------------------------------------------------
// classifyInput
// ---------------------------------------------------------------------------

describe("classifyInput › MATCH", () => {
  it("should classify single digits as MATCH", () => {
    // RULE: Digits 1-9 are valid list selections → MATCH
    expect(classifyInput("1")).toBe("MATCH")
    expect(classifyInput("3")).toBe("MATCH")
    expect(classifyInput("9")).toBe("MATCH")
  })

  it("should classify yes/no variants as MATCH", () => {
    // RULE: Explicit yes/no confirmations → MATCH (structural input)
    expect(classifyInput("yes")).toBe("MATCH")
    expect(classifyInput("no")).toBe("MATCH")
    expect(classifyInput("ok")).toBe("MATCH")
    expect(classifyInput("sì")).toBe("MATCH")
    expect(classifyInput("si")).toBe("MATCH")
    expect(classifyInput("nope")).toBe("MATCH")
  })
})

describe("classifyInput › HARD_BREAK", () => {
  it("should classify operator requests as HARD_BREAK", () => {
    // RULE: User wants human contact → immediate escalation, no node logic
    expect(classifyInput("operator")).toBe("HARD_BREAK")
    expect(classifyInput("operatore")).toBe("HARD_BREAK")
    expect(classifyInput("human")).toBe("HARD_BREAK")
    expect(classifyInput("umano")).toBe("HARD_BREAK")
    expect(classifyInput("I need help me please")).toBe("HARD_BREAK")
    expect(classifyInput("voglio parlare con una persona")).toBe("HARD_BREAK")
  })
})

describe("classifyInput › SOFT_BREAK", () => {
  it("should classify stop commands as SOFT_BREAK", () => {
    // RULE: User wants to pause/cancel the flow → PAUSED status, resumable
    expect(classifyInput("stop")).toBe("SOFT_BREAK")
    expect(classifyInput("basta")).toBe("SOFT_BREAK")
    expect(classifyInput("cancel")).toBe("SOFT_BREAK")
    expect(classifyInput("annulla")).toBe("SOFT_BREAK")
    expect(classifyInput("esci")).toBe("SOFT_BREAK")
    expect(classifyInput("quit")).toBe("SOFT_BREAK")
  })
})

describe("classifyInput › INTERRUPT_FAQ", () => {
  it("should classify off-topic questions as INTERRUPT_FAQ", () => {
    // RULE: Structural question words → off-topic FAQ interrupt (not full free-text)
    expect(classifyInput("quanto costa?")).toBe("INTERRUPT_FAQ")
    expect(classifyInput("how much is the repair?")).toBe("INTERRUPT_FAQ")
    expect(classifyInput("quali sono gli orari?")).toBe("INTERRUPT_FAQ")
    expect(classifyInput("dove si trova il negozio?")).toBe("INTERRUPT_FAQ")
  })
})

describe("classifyInput › AMBIGUOUS", () => {
  it("should classify unrecognised input as AMBIGUOUS", () => {
    // RULE: Everything that doesn't fit any structural pattern → AMBIGUOUS
    expect(classifyInput("blah blah")).toBe("AMBIGUOUS")
    expect(classifyInput("manda un tecnico")).toBe("AMBIGUOUS")
    expect(classifyInput("")).toBe("AMBIGUOUS")
    expect(classifyInput("12345")).toBe("AMBIGUOUS") // multi-digit → not MATCH
  })
})

// ---------------------------------------------------------------------------
// normalizeInput
// ---------------------------------------------------------------------------

describe("normalizeInput", () => {
  it("should normalise yes variants to 'YES'", () => {
    // RULE: normalizeInput maps confirmation words → canonical transition key
    expect(normalizeInput("yes")).toBe("YES")
    expect(normalizeInput("sì")).toBe("YES")
    expect(normalizeInput("si")).toBe("YES")
    expect(normalizeInput("ok")).toBe("YES")
    expect(normalizeInput("  sì  ")).toBe("YES") // trims whitespace
  })

  it("should normalise no variants to 'NO'", () => {
    expect(normalizeInput("no")).toBe("NO")
    expect(normalizeInput("nope")).toBe("NO")
  })

  it("should return digit as-is", () => {
    // RULE: Numeric choices pass through unchanged for transition table lookup
    expect(normalizeInput("1")).toBe("1")
    expect(normalizeInput("7")).toBe("7")
  })
})
