import { PrismaClient } from "@echatbot/database"
import { NextFunction, Request, Response } from "express"
import logger from "../../../utils/logger"

/**
 * WhatsApp Rate Limiting Middleware
 *
 * Single Responsibility: Prevent spam and abuse
 *
 * Limits:
 * - 100 messages/minute per workspace (configurable via ENV)
 * - 10 messages/minute per customer (configurable via ENV)
 *
 * SECURITY:
 * - Protegge da spam
 * - Protegge da attacchi DDoS
 * - Salva rate limit violations nel log
 */

const prisma = new PrismaClient()

interface RateLimitCache {
  [key: string]: {
    count: number
    resetAt: number
  }
}

// In-memory cache per rate limiting (production: usa Redis!)
const rateLimitCache: RateLimitCache = {}

const WORKSPACE_LIMIT = parseInt(
  process.env.WHATSAPP_MAX_MESSAGES_PER_MINUTE_WORKSPACE || "100"
)
const CUSTOMER_LIMIT = parseInt(
  process.env.WHATSAPP_MAX_MESSAGES_PER_MINUTE_CUSTOMER || "10"
)
const WINDOW_MS = 60 * 1000 // 1 minute

/**
 * Check if rate limit is exceeded
 */
function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now()
  const entry = rateLimitCache[key]

  // Reset if window expired
  if (!entry || now > entry.resetAt) {
    rateLimitCache[key] = {
      count: 1,
      resetAt: now + WINDOW_MS,
    }
    return false // Not exceeded
  }

  // Increment count
  entry.count++

  // Check if exceeded
  return entry.count > limit
}

/**
 * Rate limit middleware for WhatsApp endpoints
 */
export async function whatsappRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract identifiers based on endpoint
    let workspaceId: string | undefined
    let customerId: string | undefined
    let phoneNumber: string | undefined

    // For webhook (inbound)
    if (req.path.includes("/webhook") && req.method === "POST") {
      const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
      phoneNumber = message?.from ? `+${message.from}` : undefined

      if (phoneNumber) {
        // Find customer to get workspaceId
        const customer = await prisma.customers.findFirst({
          where: { phone: phoneNumber },
          select: { id: true, workspaceId: true },
        })

        if (customer) {
          workspaceId = customer.workspaceId
          customerId = customer.id
        }
      }
    }

    // For send endpoint (outbound)
    if (req.path.includes("/send") && req.method === "POST") {
      workspaceId = req.body?.workspaceId
      customerId = req.body?.customerId
      phoneNumber = req.body?.phoneNumber
    }

    // 🔒 RATE LIMIT 1: Workspace limit
    if (workspaceId) {
      const workspaceKey = `workspace:${workspaceId}`
      const workspaceExceeded = checkRateLimit(workspaceKey, WORKSPACE_LIMIT)

      if (workspaceExceeded) {
        logger.warn("[RATE-LIMIT] ❌ Workspace limit exceeded", {
          workspaceId,
          limit: WORKSPACE_LIMIT,
          window: "1 minute",
        })

        res.status(429).json({
          error: "Rate limit exceeded",
          message: `Workspace message limit exceeded (${WORKSPACE_LIMIT}/minute)`,
          retryAfter: 60,
        })
        return
      }
    }

    // 🔒 RATE LIMIT 2: Customer limit
    if (customerId) {
      const customerKey = `customer:${customerId}`
      const customerExceeded = checkRateLimit(customerKey, CUSTOMER_LIMIT)

      if (customerExceeded) {
        logger.warn("[RATE-LIMIT] ❌ Customer limit exceeded", {
          customerId,
          phoneNumber,
          limit: CUSTOMER_LIMIT,
          window: "1 minute",
        })

        res.status(429).json({
          error: "Rate limit exceeded",
          message: `Too many messages from this customer (${CUSTOMER_LIMIT}/minute)`,
          retryAfter: 60,
        })
        return
      }
    }

    // ✅ Rate limits not exceeded
    next()
  } catch (error: any) {
    logger.error("[RATE-LIMIT] Error checking rate limits:", {
      error: error.message,
      path: req.path,
    })

    // On error, allow request (fail open for availability)
    next()
  }
}

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now()
  Object.keys(rateLimitCache).forEach((key) => {
    if (rateLimitCache[key].resetAt < now) {
      delete rateLimitCache[key]
    }
  })
}, WINDOW_MS)
