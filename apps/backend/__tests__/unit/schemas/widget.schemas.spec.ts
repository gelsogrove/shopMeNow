import { WIDGET_MESSAGE_SCHEMA } from "../../../src/interfaces/http/schemas/widget.schemas"

describe("WIDGET_MESSAGE_SCHEMA", () => {
  it("should accept optional language and null sessionId", () => {
    const payload = {
      visitorId: "visitor_1726262000000_abc123",
      message: "Ciao",
      language: "it",
      sessionId: null,
    }

    const result = WIDGET_MESSAGE_SCHEMA.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it("should reject non-string sessionId", () => {
    const payload = {
      visitorId: "visitor_1726262000000_abc123",
      message: "Ciao",
      sessionId: 123,
    }

    const result = WIDGET_MESSAGE_SCHEMA.safeParse(payload)
    expect(result.success).toBe(false)
  })
})
