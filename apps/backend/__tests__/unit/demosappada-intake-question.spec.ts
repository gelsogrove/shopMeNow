/**
 * demosappada — the rendered intake question (intake-question.ts)
 *
 * WHAT: the dictated question goes out in the guest's language MINUS the
 * parts the profile already answers. Code owns the facts list and the shape
 * check; the model owns the rewording; a rendering that fails the shape
 * check falls back to the tenant's wording as written.
 *
 * WHY: the constraints wording bundles three facts ("qualcosa da segnalarci?
 * senza macchina? bambini o anziani?"). A guest who had just said "siamo
 * senza macchina" — or "no nessuna" about children — was read the whole
 * sentence back anyway, because the wording is dictated verbatim (Andrea,
 * 2026-08-28: "se ti dico siamo senza macchina non puoi chiedermi 'sarete
 * senza macchina?' ... questo è il minimo che un utente si aspetta da un
 * chatbot"). One rendering call, guarded, in one place — not a case list.
 */
import { knownFacts, renderIntakeQuestion, renderingAcceptable } from "../../custom-demosappada/intake-question"
import { callLLM } from "../../custom-demosappada/llm"
import { translateWelcome } from "../../custom-demosappada/welcome"

jest.mock("../../custom-demosappada/llm", () => ({ callLLM: jest.fn() }))
jest.mock("../../custom-demosappada/welcome", () => ({ translateWelcome: jest.fn() }))

const mockLLM = callLLM as jest.MockedFunction<typeof callLLM>
const mockTranslate = translateWelcome as jest.MockedFunction<typeof translateWelcome>
const settings = { model: "test", defaultLanguage: "it" } as any
const CONSTRAINTS =
  "C'è qualcosa di particolare che vuoi segnalarci? Sarete senza macchina? Ci sono bambini o anziani?"

beforeEach(() => {
  mockLLM.mockReset()
  mockTranslate.mockReset()
})

describe("demosappada knownFacts — what the code tells the model is already known", () => {
  it("lists nothing for an empty profile — so no rendering call is made", () => {
    expect(knownFacts(null)).toEqual([])
    expect(knownFacts({})).toEqual([])
  })

  it("zeros are facts: 'no bambini' is known, not missing", () => {
    // children:0 / seniors:0 are real answers (intake-machine.ts) and must
    // reach the model as known, or the question about them comes back.
    const facts = knownFacts({ adults: 2, children: 0, seniors: 0 })
    expect(facts.join("\n")).toContain("2 adulti, 0 bambini, 0 anziani")
  })

  it("carries the free-text facts verbatim", () => {
    const facts = knownFacts({ constraints: "senza macchina" })
    expect(facts.join("\n")).toContain("senza macchina")
  })
})

describe("demosappada renderingAcceptable — shape only, never meaning", () => {
  it("accepts a shorter question", () => {
    expect(renderingAcceptable("C'è qualcosa di particolare che vuoi segnalarci?", CONSTRAINTS)).toBe(true)
  })

  it("rejects an empty rendering, a non-question, and a rendering that grew", () => {
    expect(renderingAcceptable("", CONSTRAINTS)).toBe(false)
    expect(renderingAcceptable("Perfetto, grazie.", CONSTRAINTS)).toBe(false)
    expect(renderingAcceptable(CONSTRAINTS + " " + CONSTRAINTS + "?", CONSTRAINTS)).toBe(false)
  })
})

describe("demosappada renderIntakeQuestion — one guarded call, plain wording as fallback", () => {
  it("🚨 regression 2026-08-28: 'siamo senza macchina' known → the car part is gone", async () => {
    mockLLM.mockResolvedValue({ content: "C'è qualcosa di particolare che vuoi segnalarci? Ci sono bambini o anziani?" } as any)
    const out = await renderIntakeQuestion(CONSTRAINTS, { constraints: "senza macchina" }, "it", false, settings)
    expect(out).not.toContain("senza macchina")
    expect(out).toContain("?")
    // The facts reached the model as the code's list, not as prose it invented.
    const system = String(mockLLM.mock.calls[0][0][0].content)
    expect(system).toContain("senza macchina")
  })

  it("nothing known → no rendering call: plain translation path, behaviour unchanged", async () => {
    mockTranslate.mockResolvedValue("Is there anything special we should know?")
    const out = await renderIntakeQuestion(CONSTRAINTS, {}, "en", true, settings)
    expect(mockLLM).not.toHaveBeenCalled()
    expect(mockTranslate).toHaveBeenCalledWith(CONSTRAINTS, "en", settings)
    expect(out).toBe("Is there anything special we should know?")
  })

  it("a rendering that fails the shape check falls back to the tenant's wording", async () => {
    mockLLM.mockResolvedValue({ content: "Perfetto, grazie per le informazioni." } as any)
    const out = await renderIntakeQuestion(CONSTRAINTS, { children: 0 }, "it", false, settings)
    expect(out).toBe(CONSTRAINTS)
  })

  it("a failed call falls back to the tenant's wording — the intake never loses a question", async () => {
    mockLLM.mockRejectedValue(new Error("boom"))
    const out = await renderIntakeQuestion(CONSTRAINTS, { children: 0 }, "it", false, settings)
    expect(out).toBe(CONSTRAINTS)
  })

  it("when a translation is needed, the fallback is the translated wording", async () => {
    mockLLM.mockRejectedValue(new Error("boom"))
    mockTranslate.mockResolvedValue("Anything special?")
    const out = await renderIntakeQuestion(CONSTRAINTS, { children: 0 }, "en", true, settings)
    expect(out).toBe("Anything special?")
  })
})
