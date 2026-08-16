import logger from "./logger"

export type PayPalEnvironment = "sandbox" | "live"

export type PayPalUserFlags = {
  isPlatformAdmin?: boolean | null
  isDeveloperUser?: boolean | null
}

export const resolvePayPalEnvironment = (
  user?: PayPalUserFlags | null
): PayPalEnvironment => {
  if (user?.isPlatformAdmin || user?.isDeveloperUser) {
    return "sandbox"
  }

  return "live"
}

// ⚠️ LIVE credentials are intentionally hardcoded (not read from process.env).
// This is Andrea's own platform PayPal account for subscription billing —
// NOT a per-customer/workspace setting. Customers receiving the Docker
// deploy package must NOT be able to override these via their own
// deploy/<client>/.env: docker-compose's env_file: always wins over a
// Dockerfile ENV, so hardcoding in source is the only lever that actually
// works. Sandbox credentials remain env-configurable since they're only
// used by Andrea himself (isPlatformAdmin/isDeveloperUser) for testing.
const PAYPAL_LIVE_CLIENT_ID =
  "Ad51HRvFl5ipoUW_3GaRH7G0sTH402kSsc6pj8e2nQgKATIRWRYTyI2dA72QDi9iJXRIwARU3eIIXJSg"
const PAYPAL_LIVE_CLIENT_SECRET =
  "EFkGMmnyjoNfBe0V3KEAPxjOUUMr0OYEAw_8E4Ot7pGAkH8Ie3Rf7nGXCo3hEd_IzEFfGd6ZVB_PKy_9"
const PAYPAL_LIVE_WEBHOOK_ID = "9R1354557F605890C"

export const loadPayPalConfigForEnv = (environment: PayPalEnvironment) => {
  const clientId =
    environment === "live"
      ? PAYPAL_LIVE_CLIENT_ID
      : process.env.PAYPAL_CLIENT_ID_SANDBOX
  const clientSecret =
    environment === "live"
      ? PAYPAL_LIVE_CLIENT_SECRET
      : process.env.PAYPAL_CLIENT_SECRET_SANDBOX
  const connectBaseUrl =
    environment === "live"
      ? "https://www.paypal.com"
      : "https://www.sandbox.paypal.com"
  const apiBaseUrl =
    environment === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com"
  const planId =
    environment === "live"
      ? undefined // live plan is auto-created on first subscription (see ensurePlanId)
      : process.env.PAYPAL_PLAN_ID_SANDBOX

  return {
    configured: Boolean(clientId && clientSecret),
    environment,
    clientId,
    clientSecret,
    connectBaseUrl,
    apiBaseUrl,
    planId,
  }
}

export const getWebhookId = (environment: PayPalEnvironment) => {
  return environment === "live"
    ? PAYPAL_LIVE_WEBHOOK_ID
    : process.env.PAYPAL_WEBHOOK_ID_SANDBOX
}

/**
 * Get PayPal app access token using client credentials.
 * Single implementation shared across paypal.routes.ts and paypal-billing.service.ts.
 */
export async function getPayPalAccessToken(
  paypalConfig: ReturnType<typeof loadPayPalConfigForEnv>
): Promise<string> {
  const response = await fetch(
    `${paypalConfig.apiBaseUrl}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${paypalConfig.clientId}:${paypalConfig.clientSecret}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
    }
  )

  if (!response.ok) {
    const text = await response.text()
    logger.error("[PAYPAL] Token error:", text)
    throw new Error(`PayPal token error: ${text}`)
  }

  const data = await response.json()
  return data.access_token as string
}
