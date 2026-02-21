import { buildWidgetSuggestions } from "../../../src/interfaces/http/controllers/widget-chat.controller"

describe("buildWidgetSuggestions", () => {
  it("returns quickReplies when provided", () => {
    const result = buildWidgetSuggestions("any", ["One", "Two", "Two", "Three", "Four", "Five"])
    expect(result).toEqual(["One", "Two", "Three", "Four"])
  })

  it("builds heuristic suggestions from a question", () => {
    const result = buildWidgetSuggestions("Vuoi continuare? Il prezzo è corretto?")
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(4)
  })

  it("returns empty array for very short responses", () => {
    expect(buildWidgetSuggestions("Hi")).toEqual([])
  })
})
