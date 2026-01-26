import { buildPhoneVariants } from "../../../src/utils/phone"

describe("buildPhoneVariants", () => {
  it("returns trimmed, +digits, digits", () => {
    const variants = buildPhoneVariants(" +39 348 1234567 ")
    expect(variants).toContain("+393481234567")
    expect(variants).toContain("393481234567")
    expect(variants).toContain("+39 348 1234567".trim())
  })

  it("handles already normalized numbers", () => {
    const variants = buildPhoneVariants("+15551234567")
    expect(variants).toEqual(["+15551234567", "15551234567"])
  })

  it("returns empty array for falsy input", () => {
    expect(buildPhoneVariants(undefined)).toEqual([])
    expect(buildPhoneVariants("")).toEqual([])
  })
})
