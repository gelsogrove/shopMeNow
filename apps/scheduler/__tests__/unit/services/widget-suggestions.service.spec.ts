import { buildWidgetSuggestions } from "../../../src/services/widget-suggestions.service"

describe("widget-suggestions.service", () => {
  it("returns up to 4 short, safe suggestions", async () => {
    const response =
      "Ciao! Posso aiutarti con ordini, resi, spedizioni o prodotti. Vuoi vedere le offerte? Hai bisogno di parlare con un umano?"

    const result = await buildWidgetSuggestions({
      workspaceId: "ws1",
      response,
      language: "it",
    } as any)

    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(4)
    expect(result.every((r) => r.length <= 80)).toBe(true)
    expect(result.some((r) => /ordini/i.test(r))).toBe(true)
  })
})
