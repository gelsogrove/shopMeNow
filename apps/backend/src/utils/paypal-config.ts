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

export const loadPayPalConfigForEnv = (environment: PayPalEnvironment) => {
  const clientId =
    environment === "live"
      ? process.env.PAYPAL_CLIENT_ID_LIVE
      : process.env.PAYPAL_CLIENT_ID_SANDBOX
  const clientSecret =
    environment === "live"
      ? process.env.PAYPAL_CLIENT_SECRET_LIVE
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
      ? process.env.PAYPAL_PLAN_ID_LIVE
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
