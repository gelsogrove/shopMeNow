/**
 * Unit tests — UltraMsg provider sendReaction.
 *
 * WHAT: the operator reacting to a customer message sends an UltraMsg reaction
 * via POST /{instance}/messages/reaction with form-urlencoded { token, msgId,
 * emoji }. An empty emoji removes the reaction. On API failure the result is
 * { success:false }.
 * WHY: the official UltraMsg API DOES support reactions (an earlier audit
 * assumed it didn't); this pins the implementation to the documented contract.
 * Docs: https://docs.ultramsg.com/api/post/messages/reaction
 */

import axios from "axios"
import querystring from "querystring"
import { UltraMsgWhatsAppProvider } from "../../../services/whatsapp/ultramsg-whatsapp-provider"

jest.mock("axios")
jest.mock("../../../utils/logger", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

const mockedAxios = axios as jest.Mocked<typeof axios>

describe("UltraMsgWhatsAppProvider.sendReaction", () => {
  const provider = new UltraMsgWhatsAppProvider({ instanceId: "instance123", token: "TKN" })

  beforeEach(() => jest.clearAllMocks())

  it("posts to /messages/reaction with token, msgId and emoji (form-urlencoded)", async () => {
    mockedAxios.post.mockResolvedValue({ data: { id: "ultra-out-1" } })

    const res = await provider.sendReaction("+34600123123", "ultra-msg-1", "👍")

    expect(res.success).toBe(true)
    expect(res.messageId).toBe("ultra-out-1")

    const [url, body, cfg] = mockedAxios.post.mock.calls[0]
    expect(url).toContain("/instance123/messages/reaction")
    // form-urlencoded content type
    expect((cfg as any).headers["content-type"]).toBe("application/x-www-form-urlencoded")
    // body carries token + msgId + emoji
    const parsed = querystring.parse(body as string)
    expect(parsed.token).toBe("TKN")
    expect(parsed.msgId).toBe("ultra-msg-1")
    expect(parsed.emoji).toBe("👍")
  })

  it("supports removing a reaction with an empty emoji", async () => {
    mockedAxios.post.mockResolvedValue({ data: { id: "ultra-out-2" } })

    await provider.sendReaction("+34600123123", "ultra-msg-1", "")

    const parsed = querystring.parse(mockedAxios.post.mock.calls[0][1] as string)
    expect(parsed.msgId).toBe("ultra-msg-1")
    expect(parsed.emoji).toBe("") // empty → removes the reaction
  })

  it("fails fast (no HTTP call) when messageId is missing", async () => {
    const res = await provider.sendReaction("+34600123123", "", "👍")
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/messageId is required/i)
    expect(mockedAxios.post).not.toHaveBeenCalled()
  })

  it("returns success:false with the API error on failure", async () => {
    mockedAxios.post.mockRejectedValue({
      message: "Request failed",
      response: { data: { error: "invalid msgId" } },
    })

    const res = await provider.sendReaction("+34600123123", "bad", "👍")

    expect(res.success).toBe(false)
    expect(res.error).toBe("invalid msgId")
  })
})
