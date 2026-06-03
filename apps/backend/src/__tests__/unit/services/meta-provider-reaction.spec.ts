/**
 * Unit tests — Meta provider sendReaction.
 *
 * WHAT: the operator reacting to a customer message sends a WhatsApp Cloud API
 * "reaction" message (type=reaction, reaction={message_id, emoji}). An empty
 * emoji removes the reaction. On API failure the result is { success:false }.
 * WHY: this is the backbone for operator→customer reactions.
 */

import axios from "axios"
import { MetaWhatsAppProvider } from "../../../services/whatsapp/meta-whatsapp-provider"

jest.mock("axios")
jest.mock("../../../utils/logger", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

const mockedAxios = axios as jest.Mocked<typeof axios>

describe("MetaWhatsAppProvider.sendReaction", () => {
  const provider = new MetaWhatsAppProvider({ phoneNumberId: "PN1", accessToken: "TKN" })

  beforeEach(() => jest.clearAllMocks())

  it("posts a reaction message with message_id + emoji", async () => {
    mockedAxios.post.mockResolvedValue({ data: { messages: [{ id: "wamid.OUT1" }] } })

    const res = await provider.sendReaction("+39 333 1234567", "wamid.IN1", "👍")

    expect(res.success).toBe(true)
    expect(res.messageId).toBe("wamid.OUT1")

    const [url, body] = mockedAxios.post.mock.calls[0]
    expect(url).toContain("/PN1/messages")
    expect(body).toEqual(
      expect.objectContaining({
        messaging_product: "whatsapp",
        to: "393331234567", // spaces and + stripped
        type: "reaction",
        reaction: { message_id: "wamid.IN1", emoji: "👍" },
      })
    )
  })

  it("supports removing a reaction with an empty emoji", async () => {
    mockedAxios.post.mockResolvedValue({ data: { messages: [{ id: "wamid.OUT2" }] } })

    await provider.sendReaction("+393331234567", "wamid.IN1", "")

    const [, body] = mockedAxios.post.mock.calls[0]
    expect((body as any).reaction).toEqual({ message_id: "wamid.IN1", emoji: "" })
  })

  it("returns success:false with the API error on failure", async () => {
    mockedAxios.post.mockRejectedValue({
      message: "Request failed",
      response: { data: { error: { message: "Invalid message_id" } } },
    })

    const res = await provider.sendReaction("+393331234567", "bad", "👍")

    expect(res.success).toBe(false)
    expect(res.error).toBe("Invalid message_id")
  })
})
