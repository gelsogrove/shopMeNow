/**
 * Unit tests — Meta provider sendTypingIndicator.
 *
 * WHAT: while the LLM composes a reply the bot shows the WhatsApp "typing…"
 * indicator. On Meta Cloud API this is done by marking the inbound message as
 * read with a typing_indicator: POST /{phone-number-id}/messages with
 * { status:'read', message_id, typing_indicator:{type:'text'} }.
 * WHY: gives the customer immediate feedback that the bot is working, and the
 * same call delivers the blue read ticks. Must be fire-and-forget — it can
 * never throw or block the reply path.
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

describe("MetaWhatsAppProvider.sendTypingIndicator", () => {
  const provider = new MetaWhatsAppProvider({ phoneNumberId: "PN1", accessToken: "TKN" })

  beforeEach(() => jest.clearAllMocks())

  it("posts a read + typing_indicator request for the inbound wamid", async () => {
    mockedAxios.post.mockResolvedValue({ data: { success: true } })

    await provider.sendTypingIndicator("+39 333 1234567", "wamid.IN1")

    expect(mockedAxios.post).toHaveBeenCalledTimes(1)
    const [url, body] = mockedAxios.post.mock.calls[0]
    expect(url).toContain("/PN1/messages")
    expect(body).toEqual(
      expect.objectContaining({
        messaging_product: "whatsapp",
        status: "read",
        message_id: "wamid.IN1",
        typing_indicator: { type: "text" },
      })
    )
  })

  it("skips the API call when no inbound message id is provided", async () => {
    await provider.sendTypingIndicator("+393331234567")

    // Nothing to attach the indicator to → no HTTP call.
    expect(mockedAxios.post).not.toHaveBeenCalled()
  })

  it("never throws when the API call fails (fire-and-forget)", async () => {
    mockedAxios.post.mockRejectedValue({
      message: "Request failed",
      response: { data: { error: { message: "Invalid message_id" } } },
    })

    // Must resolve, not reject — the reply path must never be blocked.
    await expect(
      provider.sendTypingIndicator("+393331234567", "bad")
    ).resolves.toBeUndefined()
  })
})
