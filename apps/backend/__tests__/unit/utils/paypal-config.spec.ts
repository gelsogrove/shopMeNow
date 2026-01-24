import {
  loadPayPalConfigForEnv,
  resolvePayPalEnvironment,
} from "../../../src/utils/paypal-config"

describe("PayPal config", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("uses sandbox for developer or platform admin users", () => {
    expect(
      resolvePayPalEnvironment({ isDeveloperUser: true, isPlatformAdmin: false })
    ).toBe("sandbox")
    expect(
      resolvePayPalEnvironment({ isDeveloperUser: false, isPlatformAdmin: true })
    ).toBe("sandbox")
  })

  it("uses live for standard users", () => {
    expect(
      resolvePayPalEnvironment({ isDeveloperUser: false, isPlatformAdmin: false })
    ).toBe("live")
  })

  it("loads sandbox config correctly", () => {
    process.env.PAYPAL_CLIENT_ID_SANDBOX = "sandbox-id"
    process.env.PAYPAL_CLIENT_SECRET_SANDBOX = "sandbox-secret"

    const config = loadPayPalConfigForEnv("sandbox")
    expect(config.configured).toBe(true)
    expect(config.environment).toBe("sandbox")
    expect(config.apiBaseUrl).toBe("https://api-m.sandbox.paypal.com")
  })

  it("loads live config correctly", () => {
    process.env.PAYPAL_CLIENT_ID_LIVE = "live-id"
    process.env.PAYPAL_CLIENT_SECRET_LIVE = "live-secret"

    const config = loadPayPalConfigForEnv("live")
    expect(config.configured).toBe(true)
    expect(config.environment).toBe("live")
    expect(config.apiBaseUrl).toBe("https://api-m.paypal.com")
  })
})
