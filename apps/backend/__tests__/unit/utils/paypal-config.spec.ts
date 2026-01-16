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

  it("uses environment-specific redirect uri when provided", () => {
    process.env.PAYPAL_CLIENT_ID_SANDBOX = "sandbox-id"
    process.env.PAYPAL_CLIENT_SECRET_SANDBOX = "sandbox-secret"
    process.env.PAYPAL_REDIRECT_URI_SANDBOX = "http://sandbox.local/callback"

    const config = loadPayPalConfigForEnv("sandbox")
    expect(config.redirectUri).toBe("http://sandbox.local/callback")
  })

  it("falls back to PAYPAL_REDIRECT_URI when env-specific value is missing", () => {
    process.env.PAYPAL_CLIENT_ID_LIVE = "live-id"
    process.env.PAYPAL_CLIENT_SECRET_LIVE = "live-secret"
    process.env.PAYPAL_REDIRECT_URI_LIVE = ""
    process.env.PAYPAL_REDIRECT_URI = "http://global.local/callback"

    const config = loadPayPalConfigForEnv("live")
    expect(config.redirectUri).toBe("http://global.local/callback")
  })
})
