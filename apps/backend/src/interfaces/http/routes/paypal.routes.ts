import { Router, Request, Response } from "express"
import jwt from "jsonwebtoken"
import { prisma, PayPalStatus } from "@echatbot/database"
import { authMiddleware } from "../middlewares/auth.middleware"
import { config } from "../../../config"
import logger from "../../../utils/logger"
import { encryptSecret } from "../../../utils/encryption"
import {
  loadPayPalConfigForEnv,
  resolvePayPalEnvironment,
  PayPalEnvironment,
} from "../../../utils/paypal-config"
import { Prisma } from "@echatbot/database"

export const paypalRoutes = Router()

const getUserPayPalConfig = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlatformAdmin: true, isDeveloperUser: true },
  })

  if (!user) {
    return null
  }

  const environment = resolvePayPalEnvironment(user)
  return {
    user,
    paypalConfig: loadPayPalConfigForEnv(environment),
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

const getWebhookId = (environment: PayPalEnvironment) => {
  return environment === "live"
    ? process.env.PAYPAL_WEBHOOK_ID_LIVE
    : process.env.PAYPAL_WEBHOOK_ID_SANDBOX
}

const getAppAccessToken = async (
  paypalConfig: ReturnType<typeof loadPayPalConfigForEnv>
): Promise<string> => {
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

const inMemoryPlanCache = new Map<PayPalEnvironment, string>()

const ensurePlanId = async (
  paypalConfig: ReturnType<typeof loadPayPalConfigForEnv>
): Promise<string> => {
  if (paypalConfig.planId) return paypalConfig.planId
  const cached = inMemoryPlanCache.get(paypalConfig.environment)
  if (cached) return cached

  const appToken = await getAppAccessToken(paypalConfig)

  // Create a minimal product
  const productResponse = await fetch(
    `${paypalConfig.apiBaseUrl}/v1/catalogs/products`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "eChatbot Subscription",
        description:
          "Monthly platform subscription (anchor $1, variable charges via outstanding balance).",
        type: "SERVICE",
        category: "SOFTWARE",
      }),
    }
  )

  if (!productResponse.ok) {
    const err = await productResponse.text()
    throw new Error(`PayPal product create failed: ${err}`)
  }

  const product = await productResponse.json()
  const productId = product.id

  // Create a minimal monthly plan with $1 anchor price
  const planResponse = await fetch(`${paypalConfig.apiBaseUrl}/v1/billing/plans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: productId,
      name: "eChatbot Monthly Anchor Plan",
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: "1.00", currency_code: "USD" },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: "0", currency_code: "USD" },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
      taxes: { percentage: "0", inclusive: false },
    }),
  })

  if (!planResponse.ok) {
    const err = await planResponse.text()
    throw new Error(`PayPal plan create failed: ${err}`)
  }

  const plan = await planResponse.json()
  const planId = plan.id as string
  inMemoryPlanCache.set(paypalConfig.environment, planId)
  logger.info(`[PAYPAL] Auto-created plan ${planId} (${paypalConfig.environment})`)
  return planId
}

const createSubscription = async ({
  paypalConfig,
  payerId,
  email,
  userId,
}: {
  paypalConfig: ReturnType<typeof loadPayPalConfigForEnv>
  payerId: string | null
  email: string | null
  userId: string
}): Promise<{ 
  id: string
  status: string
  planId: string
  approveLink: string | null
}> => {
  const appToken = await getAppAccessToken(paypalConfig)
  const planId = await ensurePlanId(paypalConfig)

  const body: any = {
    plan_id: planId,
    application_context: {
      brand_name: "eChatbot",
      shipping_preference: "NO_SHIPPING",
      user_action: "SUBSCRIBE_NOW",
      payment_method: {
        payer_selected: "PAYPAL",
        payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
      },
      return_url: `${config.appUrl}/api/paypal/subscription/callback`,
      cancel_url: `${config.frontendUrl}/paypal-result?paypal=cancelled`,
    },
    quantity: "1",
    custom_id: userId,
  }

  if (payerId || email) {
    body.subscriber = {
      email_address: email || undefined,
      payer_id: payerId || undefined,
    }
  }

  const subResponse = await fetch(
    `${paypalConfig.apiBaseUrl}/v1/billing/subscriptions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  )

  if (!subResponse.ok) {
    const err = await subResponse.text()
    throw new Error(`PayPal subscription create failed: ${err}`)
  }

  const sub = await subResponse.json()
  const approveLink = sub.links?.find((l: any) => l.rel === 'approve')?.href || null
  
  return {
    id: sub.id as string,
    status: (sub.status as string) || "UNKNOWN",
    planId,
    approveLink,
  }
}

const captureOutstandingBalance = async ({
  paypalConfig,
  subscriptionId,
  amount,
  note,
}: {
  paypalConfig: ReturnType<typeof loadPayPalConfigForEnv>
  subscriptionId: string
  amount: number
  note?: string
}): Promise<{ success: boolean; transactionId?: string; status?: string }> => {
  const appToken = await getAppAccessToken(paypalConfig)
  const captureResponse = await fetch(
    `${paypalConfig.apiBaseUrl}/v1/billing/subscriptions/${subscriptionId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        note: note || "Monthly invoice charge",
        capture_type: "OUTSTANDING_BALANCE",
        amount: {
          currency_code: "USD",
          value: amount.toFixed(2),
        },
      }),
    }
  )

  if (!captureResponse.ok) {
    const err = await captureResponse.text()
    logger.warn("[PAYPAL] Capture failed:", err)
    return { success: false }
  }

  const capture = await captureResponse.json()
  const status = capture.status || capture.capture_status || "UNKNOWN"
  const transactionId = capture.id || capture.capture_id
  const success = status === "COMPLETED" || status === "COMPLETED_WITH_PAYMENT"
  return { success, transactionId, status }
}


const verifyWebhookSignature = async (
  paypalConfig: ReturnType<typeof loadPayPalConfigForEnv>,
  headers: Request["headers"],
  webhookEvent: unknown
): Promise<boolean> => {
  if (!paypalConfig.configured) {
    return false
  }

  const webhookId = getWebhookId(paypalConfig.environment)
  if (!webhookId) {
    return false
  }

  const verificationPayload = {
    auth_algo: headers["paypal-auth-algo"],
    cert_url: headers["paypal-cert-url"],
    transmission_id: headers["paypal-transmission-id"],
    transmission_sig: headers["paypal-transmission-sig"],
    transmission_time: headers["paypal-transmission-time"],
    webhook_id: webhookId,
    webhook_event: webhookEvent,
  }

  try {
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
      logger.warn("[PAYPAL] Webhook verification failed:", text)
      return false
    }

    const verifyData = await verifyResponse.json()
    return verifyData.verification_status === "SUCCESS"
  } catch (error) {
    logger.warn("[PAYPAL] Webhook verification error:", error)
    return false
  }
}

paypalRoutes.post("/webhook", async (req: Request, res: Response) => {
  try {
    const configs = [
      loadPayPalConfigForEnv("live"),
      loadPayPalConfigForEnv("sandbox"),
    ].filter((config) => config.configured)

    if (configs.length === 0) {
      return res.status(400).json({
        success: false,
        error: "PayPal credentials are not configured",
      })
    }

    const headers = req.headers
    let verified = false
    let verifiedEnvironment: PayPalEnvironment | null = null

    for (const paypalConfig of configs) {
      const success = await verifyWebhookSignature(
        paypalConfig,
        headers,
        req.body
      )
      if (success) {
        verified = true
        verifiedEnvironment = paypalConfig.environment
        break
      }
    }

    if (!verified) {
      return res.status(400).json({ success: false })
    }

    const eventType = req.body?.event_type as string | undefined
    const resource = req.body?.resource || {}
    const subscriptionId =
      resource.id ||
      resource.subscription_id ||
      resource.billing_agreement_id ||
      resource?.supplementary_data?.related_ids?.subscription_id ||
      resource?.supplementary_data?.related_ids?.billing_agreement_id

    logger.info("[PAYPAL] Webhook received", {
      eventType,
      resourceType: req.body?.resource_type,
      environment: verifiedEnvironment,
      subscriptionId,
    })

    // Handle subscription events
    if (subscriptionId && eventType?.startsWith("BILLING.SUBSCRIPTION.")) {
      const user = await prisma.user.findFirst({
        where: { paypalSubscriptionId: subscriptionId },
      })

      if (user) {
        const updateData: any = {}

        switch (eventType) {
          case "BILLING.SUBSCRIPTION.ACTIVATED":
            updateData.paypalSubscriptionStatus = "ACTIVE"
            updateData.paypalSubscriptionApprovedAt = new Date()
            
            // Auto-upgrade FREE_TRIAL users to BASIC when they connect PayPal
            if (user.planType === "FREE_TRIAL") {
              updateData.planType = "BASIC"
              logger.info("[PAYPAL] Auto-upgrading FREE_TRIAL user to BASIC:", { 
                userId: user.id, 
                subscriptionId 
              })
            }
            
            logger.info("[PAYPAL] Subscription activated:", subscriptionId)
            break

          case "BILLING.SUBSCRIPTION.CANCELLED":
            updateData.paypalSubscriptionStatus = "CANCELLED"
            logger.info("[PAYPAL] Subscription cancelled:", subscriptionId)
            break

          case "BILLING.SUBSCRIPTION.SUSPENDED":
            updateData.paypalSubscriptionStatus = "SUSPENDED"
            logger.warn("[PAYPAL] Subscription suspended:", subscriptionId)
            break

          case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
            updateData.paypalFailedPaymentsCount = (user.paypalFailedPaymentsCount || 0) + 1
            updateData.lastPaymentFailedAt = new Date()
            
            // 🆕 Record failed payment in PayPalTransaction table
            try {
              const failedAmount = resource.billing_info?.outstanding_balance?.value
                ? parseFloat(resource.billing_info.outstanding_balance.value)
                : 0
              
              await prisma.payPalTransaction.create({
                data: {
                  userId: user.id,
                  amount: failedAmount,
                  currency: "USD",
                  status: "FAILED",
                  notes: `Webhook PAYMENT.FAILED - Subscription: ${subscriptionId}`,
                },
              })
            } catch (txError) {
              logger.error("[PAYPAL] Error creating failed transaction record:", txError)
            }
            
            logger.warn("[PAYPAL] Payment failed:", {
              subscriptionId,
              failureCount: updateData.paypalFailedPaymentsCount,
            })
            break

          case "BILLING.SUBSCRIPTION.PAYMENT.SUCCESS":
            updateData.paypalFailedPaymentsCount = 0
            updateData.paypalLastPaymentTime = new Date()
            updateData.paypalCyclesCompleted = (user.paypalCyclesCompleted || 0) + 1
            
            // Update next billing time from resource if available
            if (resource.billing_info?.next_billing_time) {
              updateData.paypalNextBillingTime = new Date(resource.billing_info.next_billing_time)
            }
            
            // Update outstanding balance
            if (resource.billing_info?.outstanding_balance?.value) {
              updateData.paypalOutstandingBalance = parseFloat(resource.billing_info.outstanding_balance.value)
            }
            
            // 🆕 Handle invoice payment - mark PENDING invoices as PAID
            try {
              const { handlePaymentSuccess } = await import("../../../services/paypal-billing.service")
              const paymentAmount = resource.billing_info?.last_payment?.amount?.value
                ? parseFloat(resource.billing_info.last_payment.amount.value)
                : 0
              const paymentTime = resource.billing_info?.last_payment?.time
                ? new Date(resource.billing_info.last_payment.time)
                : new Date()
              
              await handlePaymentSuccess(
                subscriptionId,
                paymentAmount,
                paymentTime,
                resource.billing_info
              )
            } catch (invoiceError) {
              logger.error("[PAYPAL] Error handling invoice payment:", invoiceError)
              // Don't fail webhook - invoice handling is secondary
            }
            
            logger.info("[PAYPAL] Payment successful:", {
              subscriptionId,
              cyclesCompleted: updateData.paypalCyclesCompleted,
            })
            break

          case "BILLING.SUBSCRIPTION.UPDATED":
            // Handle subscription updates (plan change, etc.)
            if (resource.billing_info?.next_billing_time) {
              updateData.paypalNextBillingTime = new Date(resource.billing_info.next_billing_time)
            }
            if (resource.status) {
              updateData.paypalSubscriptionStatus = resource.status
            }
            logger.info("[PAYPAL] Subscription updated:", subscriptionId)
            break
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          })
        }
      } else {
        logger.warn("[PAYPAL] Webhook received for unknown subscription:", subscriptionId)
      }
    }

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
        isPaymentConnected: true,
        paypalEmail: true,
        paypalMerchantId: true,
        paypalEnvironment: true,
        paypalConnectedAt: true,
      },
    })

    if (!owner) {
      return res.status(404).json({ success: false, error: "User not found" })
    }

    // Safety: consider connected ONLY if status is CONNECTED AND flag is true
    const isConnected =
      owner.paypalStatus === PayPalStatus.CONNECTED &&
      owner.isPaymentConnected === true

    // 🔧 FIX: Always compute isPaymentConnected from paypalStatus to avoid DB inconsistencies
    const responseData = {
      ...owner,
      isPaymentConnected: owner.paypalStatus === PayPalStatus.CONNECTED
    }

    res.json({ success: true, data: responseData })
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

    const userConfig = await getUserPayPalConfig(userId)
    if (!userConfig) {
      return res.status(404).json({ success: false, error: "User not found" })
    }

    const paypalConfig = userConfig.paypalConfig
    res.json({
      success: true,
      data: {
        configured: paypalConfig.configured,
        environment: paypalConfig.environment,
      },
    })
  } catch (error) {
    logger.error("[PAYPAL] Error fetching config:", error)
    res.status(500).json({ success: false, error: "Failed to fetch config" })
  }
})

// 🆕 Create PayPal Subscription (NEW FLOW - replaces OAuth Connect)
paypalRoutes.post(
  "/subscriptions",
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

      const userConfig = await getUserPayPalConfig(userId)
      if (!userConfig) {
        return res.status(404).json({ success: false, error: "User not found" })
      }

      const paypalConfig = userConfig.paypalConfig
      if (!paypalConfig.configured) {
        return res.status(400).json({
          success: false,
          error: "PayPal credentials are not configured",
          code: "PAYPAL_NOT_CONFIGURED",
          environment: paypalConfig.environment,
        })
      }

      // Create subscription
      const subscription = await createSubscription({
        paypalConfig,
        payerId: null,
        email: null,
        userId,
      })

      if (!subscription.approveLink) {
        return res.status(500).json({
          success: false,
          error: "Failed to get approval link from PayPal",
        })
      }

      // Save subscription ID to user
      await prisma.user.update({
        where: { id: userId },
        data: {
          paypalSubscriptionId: subscription.id,
          paypalPlanId: subscription.planId,
          paypalSubscriptionStatus: subscription.status,
          paypalEnvironment: paypalConfig.environment as any, // CRITICAL: Save environment for callback
        },
      })

      logger.info("[PAYPAL] Subscription created:", {
        userId,
        subscriptionId: subscription.id,
        status: subscription.status,
      })

      res.json({
        success: true,
        data: {
          approveLink: subscription.approveLink,
          subscriptionId: subscription.id,
          environment: paypalConfig.environment,
        },
      })
    } catch (error) {
      logger.error("[PAYPAL] Error creating subscription:", error)
      res.status(500).json({
        success: false,
        error: "Failed to create PayPal subscription",
      })
    }
  }
)

// DEPRECATED: Old OAuth Connect flow - kept for backwards compatibility
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

      const userConfig = await getUserPayPalConfig(userId)
      if (!userConfig) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" })
      }

      const paypalConfig = userConfig.paypalConfig
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

// 🆕 Subscription Approval Callback
// Called by PayPal after user approves subscription
// URL: /api/v1/paypal/subscription/callback?subscription_id=I-XXX&ba_token=BA-YYY
// 🔓 PUBLIC - No auth required (called by PayPal, not user)
// ⚠️ PayPal adds token=XXX param - don't confuse with JWT auth!
paypalRoutes.get("/subscription/callback", async (req: Request, res: Response) => {
  logger.info("[PAYPAL] 🎯 Callback received:", {
    subscription_id: req.query.subscription_id,
    ba_token: req.query.ba_token,
    has_token_param: !!req.query.token,
  })
  
  try {
    const { subscription_id, ba_token } = req.query as {
      subscription_id?: string
      ba_token?: string
    }

    if (!subscription_id) {
      logger.error("[PAYPAL] Subscription callback missing subscription_id")
      const redirectUrl = `${config.frontendUrl}/workspace-selection?paypal=error`
      return res.redirect(redirectUrl)
    }

    logger.info("[PAYPAL] Finding user for subscription:", subscription_id)
    
    // Find user by subscriptionId
    const user = await prisma.user.findFirst({
      where: { paypalSubscriptionId: subscription_id },
      select: { 
        id: true, 
        isPlatformAdmin: true, 
        isDeveloperUser: true,
        paypalEnvironment: true,
      },
    })

    if (!user || !user.paypalEnvironment) {
      logger.error("[PAYPAL] User not found for subscription:", subscription_id)
      const redirectUrl = `${config.frontendUrl}/workspace-selection?paypal=error`
      return res.redirect(redirectUrl)
    }

    const paypalConfig = loadPayPalConfigForEnv(user.paypalEnvironment as PayPalEnvironment)
    const appToken = await getAppAccessToken(paypalConfig)

    // Fetch subscription details from PayPal
    const subResponse = await fetch(
      `${paypalConfig.apiBaseUrl}/v1/billing/subscriptions/${subscription_id}`,
      {
        headers: {
          Authorization: `Bearer ${appToken}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (!subResponse.ok) {
      const err = await subResponse.text()
      logger.error("[PAYPAL] Failed to fetch subscription:", err)
      const redirectUrl = `${config.frontendUrl}/workspace-selection?paypal=error`
      return res.redirect(redirectUrl)
    }

    const subscription = await subResponse.json()

    // Update user with subscription details
    await prisma.user.update({
      where: { id: user.id },
      data: {
        paypalSubscriptionStatus: subscription.status,
        paypalSubscriptionApprovedAt: new Date(),
        paypalNextBillingTime: subscription.billing_info?.next_billing_time
          ? new Date(subscription.billing_info.next_billing_time)
          : null,
        paypalLastPaymentTime: subscription.billing_info?.last_payment?.time
          ? new Date(subscription.billing_info.last_payment.time)
          : null,
        paypalFailedPaymentsCount: subscription.billing_info?.failed_payments_count || 0,
        paypalCyclesCompleted: 
          subscription.billing_info?.cycle_executions?.find((c: any) => c.tenure_type === 'REGULAR')?.cycles_completed || 0,
        paypalOutstandingBalance: parseFloat(
          subscription.billing_info?.outstanding_balance?.value || '0'
        ),
      },
    })

    logger.info("[PAYPAL] Subscription approved:", {
      userId: user.id,
      subscriptionId: subscription_id,
      status: subscription.status,
    })

    const redirectUrl = `${config.frontendUrl}/workspace-selection?paypal=subscription_approved`
    return res.redirect(redirectUrl)
  } catch (error) {
    logger.error("[PAYPAL] Subscription callback error:", error)
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
          isPaymentConnected: false,
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
