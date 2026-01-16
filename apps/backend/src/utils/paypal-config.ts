import { config } from "../config"

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

const getRedirectUriForEnv = (environment: PayPalEnvironment): string => {
  const envSpecific =
    environment === "live"
      ? process.env.PAYPAL_REDIRECT_URI_LIVE
      : process.env.PAYPAL_REDIRECT_URI_SANDBOX

  return (
    envSpecific ||
    process.env.PAYPAL_REDIRECT_URI ||
    `${config.appUrl}/api/v1/paypal/callback`
  )
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
  const redirectUri = getRedirectUriForEnv(environment)
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
    redirectUri,
    planId,
  }
}
