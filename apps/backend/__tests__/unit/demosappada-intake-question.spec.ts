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
import { knownFacts, parseDrops, renderIntakeQuestion, splitSentences } from "../../custom-demosappada/intake-question"
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

describe("demosappada splitSentences / parseDrops — the code edits, the model only chooses", () => {
  it("splits the constraints wording into its three questions", () => {
    expect(splitSentences(CONSTRAINTS)).toHaveLength(3)
  })

  it("parses only drops bound to a real sentence AND a real fact", () => {
    // sentence 9 does not exist; fact 0 does not exist; the plain one is kept.
    const drops = parseDrops('[{"sentence":3,"fact":1},{"sentence":9,"fact":1},{"sentence":2,"fact":0}]', 3, 1)
    expect(drops).toEqual([3])
  })

  it("malformed output drops nothing — the tenant's wording survives", () => {
    expect(parseDrops("Perfetto, tolgo la terza frase.", 3, 1)).toEqual([])
    expect(parseDrops('{"sentence":1}', 3, 1)).toEqual([])
  })

  it("tolerates a fenced code block around the JSON", () => {
    expect(parseDrops('```json\n[{"sentence":2,"fact":1}]\n```', 3, 1)).toEqual([2])
  })
})

describe("demosappada renderIntakeQuestion — the model chooses, the code deletes, then translates", () => {
  it("🚨 regression 2026-08-28: 'siamo senza macchina' known → only the car sentence goes", async () => {
    // The model binds sentence 2 ("Sarete senza macchina?") to fact 1.
    mockLLM.mockResolvedValue({ content: '[{"sentence":2,"fact":1}]' } as any)
    const out = await renderIntakeQuestion(CONSTRAINTS, { constraints: "senza macchina" }, "it", false, settings)
    expect(out).toBe("C'è qualcosa di particolare che vuoi segnalarci? Ci sono bambini o anziani?")
    // The facts reached the model as the code's numbered list.
    const system = String(mockLLM.mock.calls[0][0][0].content)
    expect(system).toContain("1. vincoli/esigenze già dichiarati: senza macchina")
  })

  it("🚨 sim 2026-08-28: the model cannot rewrite — words it invents never reach the guest", async () => {
    // The free-form first version let gpt-4o-mini drop the car sentence with
    // nothing about a car known and add a 🚗. Now free text is not a valid
    // answer: nothing is dropped, the wording goes out exactly as written.
    mockLLM.mockResolvedValue({
      content: "C'è qualcosa di particolare che vuoi segnalarci? Ci sono bambini o anziani? 🚗",
    } as any)
    const out = await renderIntakeQuestion(CONSTRAINTS, { adults: 2 }, "it", false, settings)
    expect(out).toBe(CONSTRAINTS)
  })

  it("nothing known → no rendering call: plain translation path, behaviour unchanged", async () => {
    mockTranslate.mockResolvedValue("Is there anything special we should know?")
    const out = await renderIntakeQuestion(CONSTRAINTS, {}, "en", true, settings)
    expect(mockLLM).not.toHaveBeenCalled()
    expect(mockTranslate).toHaveBeenCalledWith(CONSTRAINTS, "en", settings)
    expect(out).toBe("Is there anything special we should know?")
  })

  it("a single-sentence question is never sent for trimming — there is nothing to subtract", async () => {
    const out = await renderIntakeQuestion("E in quanti siete?", { departureDate: "2026-08-30" }, "it", false, settings)
    expect(mockLLM).not.toHaveBeenCalled()
    expect(out).toBe("E in quanti siete?")
  })

  it("dropping EVERY sentence is refused — a question must remain", async () => {
    mockLLM.mockResolvedValue({ content: '[{"sentence":1,"fact":1},{"sentence":2,"fact":1},{"sentence":3,"fact":1}]' } as any)
    const out = await renderIntakeQuestion(CONSTRAINTS, { children: 0 }, "it", false, settings)
    expect(out).toBe(CONSTRAINTS)
  })

  it("a failed call falls back to the tenant's wording — the intake never loses a question", async () => {
    mockLLM.mockRejectedValue(new Error("boom"))
    const out = await renderIntakeQuestion(CONSTRAINTS, { children: 0 }, "it", false, settings)
    expect(out).toBe(CONSTRAINTS)
  })

  it("the trimmed question is translated AFTER the cut, through the cached path", async () => {
    mockLLM.mockResolvedValue({ content: '[{"sentence":3,"fact":1}]' } as any)
    mockTranslate.mockResolvedValue("Anything special? No car?")
    const out = await renderIntakeQuestion(CONSTRAINTS, { children: 0, seniors: 0 }, "en", true, settings)
    expect(mockTranslate).toHaveBeenCalledWith(
      "C'è qualcosa di particolare che vuoi segnalarci? Sarete senza macchina?", "en", settings)
    expect(out).toBe("Anything special? No car?")
  })
})
