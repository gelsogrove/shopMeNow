/**
 * Unit tests — Wasender provider sendTypingIndicator.
 *
 * WHAT: while the bot composes a reply, show the customer the WhatsApp "typing…"
 * indicator. WasenderAPI exposes this via POST /api/send-presence-update with
 * presence "composing" and the recipient JID.
 * WHY: parity with Meta so the customer sees the bot is working regardless of
 * provider. Must be fire-and-forget — never throws, never blocks the reply.
 */

import axios from "axios"
import { WasenderWhatsAppProvider } from "../../../services/whatsapp/wasender-whatsapp-provider"

jest.mock("axios")
jest.mock("../../../utils/logger", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

const mockedAxios = axios as jest.Mocked<typeof axios>

describe("WasenderWhatsAppProvider.sendTypingIndicator", () => {
  const provider = new WasenderWhatsAppProvider({ sessionApiKey: "SESS_KEY" })

  beforeEach(() => jest.clearAllMocks())

  it("posts a composing presence update to the JID", async () => {
    mockedAxios.post.mockResolvedValue({ data: { success: true } })

    await provider.sendTypingIndicator("+393331234567")

    expect(mockedAxios.post).toHaveBeenCalledTimes(1)
    const [url, body, config] = mockedAxios.post.mock.calls[0]
    expect(url).toContain("/api/send-presence-update")
    expect(body).toEqual(
      expect.objectContaining({
        to: "393331234567@s.whatsapp.net",
        presence: "composing",
      })
    )
    // Per-session bearer auth.
    expect((config as any)?.headers?.Authorization).toBe("Bearer SESS_KEY")
  })

  it("skips the call when no phone is provided", async () => {
    await provider.sendTypingIndicator("")
    expect(mockedAxios.post).not.toHaveBeenCalled()
  })

  it("never throws when the API call fails (fire-and-forget)", async () => {
    mockedAxios.post.mockRejectedValue({ message: "Request failed" })
    await expect(provider.sendTypingIndicator("+393331234567")).resolves.toBeUndefined()
  })
})
