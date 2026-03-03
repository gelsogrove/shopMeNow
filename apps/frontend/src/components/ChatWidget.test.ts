import { describe, expect, it } from "vitest"
import { shouldShowWhatsappNumber } from "./ChatWidget"

describe("shouldShowWhatsappNumber", () => {
  it("returns true when channelStatus is true and number exists", () => {
    expect(
      shouldShowWhatsappNumber({ channelStatus: true, whatsappPhoneNumber: "+123" })
    ).toBe(true)
  })

  it("returns false when channelStatus is false", () => {
    expect(
      shouldShowWhatsappNumber({ channelStatus: false, whatsappPhoneNumber: "+123" })
    ).toBe(false)
  })

  it("returns false when phone number is missing", () => {
    expect(shouldShowWhatsappNumber({ channelStatus: true })).toBe(false)
  })
})
