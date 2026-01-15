import { Router, Request, Response } from "express"
import jwt from "jsonwebtoken"
import { prisma, PayPalStatus } from "@echatbot/database"
import { authMiddleware } from "../middlewares/auth.middleware"
import { config } from "../../../config"
import logger from "../../../utils/logger"
import { encryptSecret } from "../../../utils/encryption"

export const paypalRoutes = Router()

type PayPalEnv = "sandbox" | "live"

const loadPayPalConfig = () => {
  const isProduction = process.env.NODE_ENV === "production"
  const environment: PayPalEnv = isProduction ? "live" : "sandbox"
  const clientId = isProduction
    ? process.env.PAYPAL_CLIENT_ID_LIVE
    : process.env.PAYPAL_CLIENT_ID_SANDBOX
  const clientSecret = isProduction
    ? process.env.PAYPAL_CLIENT_SECRET_LIVE
    : process.env.PAYPAL_CLIENT_SECRET_SANDBOX
  const connectBaseUrl = isProduction
    ? "https://www.paypal.com"
    : "https://www.sandbox.paypal.com"
  const apiBaseUrl = isProduction
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com"
  const redirectUri =
    process.env.PAYPAL_REDIRECT_URI ||
    `${config.appUrl}/api/v1/paypal/callback`

  return {
    configured: Boolean(clientId && clientSecret),
    environment,
    clientId,
    clientSecret,
    connectBaseUrl,
    apiBaseUrl,
    redirectUri,
  }
}

const ensureOwner = async (userId: string, res: Response): Promise<boolean> => {
  const ownerRole = await prisma.userWorkspace.findFirst({
    where: { userId, role: "SUPER_ADMIN" },
    select: { role: true },
  })

  if (!ownerRole) {
    res.status(403).json({
      success: false,
      error: "Only workspace owners can manage PayPal settings",
    })
    return false
  }

  return true
}

const buildStateToken = (userId: string) =>
  jwt.sign({ userId }, config.jwt.secret, { expiresIn: "10m" })

const parseStateToken = (state: string): { userId: string } => {
  const decoded = jwt.verify(state, config.jwt.secret) as { userId: string }
  return decoded
}

const PAYPAL_SCOPES = [
  "openid",
  "profile",
  "email",
  "https://uri.paypal.com/services/paypalattributes",
  "https://uri.paypal.com/services/payments/payouts",
]

const getWebhookId = (environment: PayPalEnv) => {
  return environment === "live"
    ? process.env.PAYPAL_WEBHOOK_ID_LIVE
    : process.env.PAYPAL_WEBHOOK_ID_SANDBOX
}

const getAppAccessToken = async (
  paypalConfig: ReturnType<typeof loadPayPalConfig>
) => {
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
    throw new Error(`PayPal token error: ${text}`)
  }

  const data = await response.json()
  return data.access_token as string
}

paypalRoutes.post("/webhook", async (req: Request, res: Response) => {
  try {
    const paypalConfig = loadPayPalConfig()
    if (!paypalConfig.configured) {
      return res.status(400).json({
        success: false,
        error: "PayPal credentials are not configured",
      })
    }

    const webhookId = getWebhookId(paypalConfig.environment)
    if (!webhookId) {
      return res.status(400).json({
        success: false,
        error: "PayPal webhook ID is not configured",
      })
    }

    const headers = req.headers
    const verificationPayload = {
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: webhookId,
      webhook_event: req.body,
    }

    const accessToken = await getAppAccessToken(paypalConfig)
    const verifyResponse = await fetch(
      `${paypalConfig.apiBaseUrl}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(verificationPayload),
      }
    )

    if (!verifyResponse.ok) {
      const text = await verifyResponse.text()
      logger.error("[PAYPAL] Webhook verification failed:", text)
      return res.status(400).json({ success: false })
    }

    const verifyData = await verifyResponse.json()
    if (verifyData.verification_status !== "SUCCESS") {
      logger.warn("[PAYPAL] Webhook signature invalid", verifyData)
      return res.status(400).json({ success: false })
    }

    logger.info("[PAYPAL] Webhook verified", {
      eventType: req.body?.event_type,
      resourceType: req.body?.resource_type,
    })

    res.status(200).json({ success: true })
  } catch (error) {
    logger.error("[PAYPAL] Webhook error:", error)
    res.status(500).json({ success: false })
  }
})

paypalRoutes.get("/status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    if (!(await ensureOwner(userId, res))) {
      return
    }

    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        paypalStatus: true,
        paypalEmail: true,
        paypalMerchantId: true,
        paypalEnvironment: true,
        paypalConnectedAt: true,
      },
    })

    if (!owner) {
      return res.status(404).json({ success: false, error: "User not found" })
    }

    res.json({ success: true, data: owner })
  } catch (error) {
    logger.error("[PAYPAL] Error fetching status:", error)
    res.status(500).json({ success: false, error: "Failed to fetch status" })
  }
})

paypalRoutes.get("/config", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    if (!(await ensureOwner(userId, res))) {
      return
    }

    const paypalConfig = loadPayPalConfig()
    res.json({
      success: true,
      data: {
        configured: paypalConfig.configured,
        environment: paypalConfig.environment,
        redirectUri: paypalConfig.redirectUri,
      },
    })
  } catch (error) {
    logger.error("[PAYPAL] Error fetching config:", error)
    res.status(500).json({ success: false, error: "Failed to fetch config" })
  }
})

paypalRoutes.post(
  "/connect-url",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
      }

      if (!(await ensureOwner(userId, res))) {
        return
      }

      const paypalConfig = loadPayPalConfig()
      if (!paypalConfig.configured) {
        return res.status(400).json({
          success: false,
          error: "PayPal credentials are not configured",
          code: "PAYPAL_NOT_CONFIGURED",
          environment: paypalConfig.environment,
        })
      }

      const state = buildStateToken(userId)
      const scope = PAYPAL_SCOPES.join(" ")
      const url = `${paypalConfig.connectBaseUrl}/connect?flowEntry=static&client_id=${encodeURIComponent(
        paypalConfig.clientId
      )}&response_type=code&scope=${encodeURIComponent(
        scope
      )}&redirect_uri=${encodeURIComponent(
        paypalConfig.redirectUri
      )}&state=${encodeURIComponent(state)}`

      res.json({
        success: true,
        data: {
          url,
          environment: paypalConfig.environment,
        },
      })
    } catch (error) {
      logger.error("[PAYPAL] Error creating connect url:", error)
      res.status(500).json({
        success: false,
        error: "Failed to create PayPal connect URL",
      })
    }
  }
)

paypalRoutes.get("/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query as {
      code?: string
      state?: string
      error?: string
    }

    if (error || !code || !state) {
      const redirectUrl = `${config.frontendUrl}/workspace-selection?paypal=error`
      return res.redirect(redirectUrl)
    }

    const { userId } = parseStateToken(state)
    const paypalConfig = loadPayPalConfig()
    if (!paypalConfig.configured) {
      logger.error("[PAYPAL] Callback received but config missing")
      const redirectUrl = `${config.frontendUrl}/workspace-selection?paypal=missing_config`
      return res.redirect(redirectUrl)
    }

    const tokenResponse = await fetch(
      `${paypalConfig.apiBaseUrl}/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${paypalConfig.clientId}:${paypalConfig.clientSecret}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: paypalConfig.redirectUri,
        }).toString(),
      }
    )

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text()
      logger.error("[PAYPAL] Token exchange failed:", errText)
      const redirectUrl = `${config.frontendUrl}/workspace-selection?paypal=error`
      return res.redirect(redirectUrl)
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token as string
    const refreshToken = tokenData.refresh_token as string | undefined
    const expiresIn = Number(tokenData.expires_in || 0)
    const scope = tokenData.scope as string | undefined

    const userInfoResponse = await fetch(
      `${paypalConfig.apiBaseUrl}/v1/identity/oauth2/userinfo?schema=paypalv1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    let paypalEmail: string | null = null
    let paypalMerchantId: string | null = null

    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json()
      paypalEmail =
        userInfo.email || userInfo.email_address || userInfo.emails?.[0]?.value
      paypalMerchantId = userInfo.payer_id || userInfo.user_id || null
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        paypalStatus: PayPalStatus.CONNECTED,
        paypalClientId: paypalConfig.clientId,
        paypalMerchantId,
        paypalEmail,
        paypalEnvironment: paypalConfig.environment,
        paypalConnectedAt: new Date(),
        paypalAccessTokenEncrypted: encryptSecret(accessToken),
        paypalRefreshTokenEncrypted: refreshToken
          ? encryptSecret(refreshToken)
          : null,
        paypalTokenExpiresAt: expiresIn
          ? new Date(Date.now() + expiresIn * 1000)
          : null,
        paypalTokenScope: scope || null,
      },
    })

    const redirectUrl = `${config.frontendUrl}/workspace-selection?paypal=connected`
    return res.redirect(redirectUrl)
  } catch (error) {
    logger.error("[PAYPAL] OAuth callback error:", error)
    const redirectUrl = `${config.frontendUrl}/workspace-selection?paypal=error`
    return res.redirect(redirectUrl)
  }
})

paypalRoutes.post(
  "/disconnect",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
      }

      if (!(await ensureOwner(userId, res))) {
        return
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          paypalStatus: PayPalStatus.DISCONNECTED,
          paypalMerchantId: null,
          paypalEmail: null,
          paypalEnvironment: null,
          paypalConnectedAt: null,
          paypalAccessTokenEncrypted: null,
          paypalRefreshTokenEncrypted: null,
          paypalTokenExpiresAt: null,
          paypalTokenScope: null,
        },
      })

      res.json({ success: true })
    } catch (error) {
      logger.error("[PAYPAL] Error disconnecting:", error)
      res.status(500).json({
        success: false,
        error: "Failed to disconnect PayPal",
      })
    }
  }
)
