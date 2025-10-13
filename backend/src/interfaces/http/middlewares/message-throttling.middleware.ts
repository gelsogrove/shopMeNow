/**
 * 🔒 MESSAGE THROTTLING MIDDLEWARE
 *
 * Previene:
 * - Spam abuse (troppi messaggi allo stesso customer)
 * - Message flooding (troppi messaggi totali)
 * - Resource exhaustion (DoS)
 * - Cost abuse (WhatsApp API costs)
 *
 * Limiti:
 * - Max 10 messaggi per customer al minuto
 * - Max 100 messaggi per workspace all'ora
 * - Max 1000 messaggi per workspace al giorno
 *
 * @author Andrea Gelso
 * @date 2025-01-13
 */

import { PrismaClient } from "@prisma/client"
import { NextFunction, Request, Response } from "express"
import logger from "../../../utils/logger"

const prisma = new PrismaClient()

// In-memory rate limiting (TODO: Move to Redis for production)
interface ThrottleData {
  count: number
  firstRequest: Date
  lastRequest: Date
}

const throttleByCustomer = new Map<string, ThrottleData>() // customerId -> data
const throttleByWorkspace = new Map<string, ThrottleData>() // workspaceId -> data
const throttleByWorkspaceDaily = new Map<string, ThrottleData>() // workspaceId -> daily data

// Cleanup old entries every 5 minutes
setInterval(
  () => {
    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Cleanup per-customer (1 minute window)
    for (const [key, data] of throttleByCustomer.entries()) {
      if (data.lastRequest < oneMinuteAgo) {
        throttleByCustomer.delete(key)
      }
    }

    // Cleanup per-workspace hourly (1 hour window)
    for (const [key, data] of throttleByWorkspace.entries()) {
      if (data.lastRequest < oneHourAgo) {
        throttleByWorkspace.delete(key)
      }
    }

    // Cleanup per-workspace daily (24 hour window)
    for (const [key, data] of throttleByWorkspaceDaily.entries()) {
      if (data.lastRequest < oneDayAgo) {
        throttleByWorkspaceDaily.delete(key)
      }
    }
  },
  5 * 60 * 1000
) // Every 5 minutes

// Configuration
const LIMITS = {
  PER_CUSTOMER_PER_MINUTE: 10,
  PER_WORKSPACE_PER_HOUR: 100,
  PER_WORKSPACE_PER_DAY: 1000,
}

/**
 * Check if customer rate limit exceeded
 */
function checkCustomerLimit(customerId: string): {
  allowed: boolean
  remaining: number
  resetAt: Date
} {
  const now = new Date()
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)

  const existing = throttleByCustomer.get(customerId)

  if (!existing || existing.firstRequest < oneMinuteAgo) {
    // New window or expired - reset
    throttleByCustomer.set(customerId, {
      count: 1,
      firstRequest: now,
      lastRequest: now,
    })
    return {
      allowed: true,
      remaining: LIMITS.PER_CUSTOMER_PER_MINUTE - 1,
      resetAt: new Date(now.getTime() + 60 * 1000),
    }
  }

  // Within window - check limit
  if (existing.count >= LIMITS.PER_CUSTOMER_PER_MINUTE) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(existing.firstRequest.getTime() + 60 * 1000),
    }
  }

  // Increment count
  existing.count++
  existing.lastRequest = now

  return {
    allowed: true,
    remaining: LIMITS.PER_CUSTOMER_PER_MINUTE - existing.count,
    resetAt: new Date(existing.firstRequest.getTime() + 60 * 1000),
  }
}

/**
 * Check if workspace hourly rate limit exceeded
 */
function checkWorkspaceHourlyLimit(workspaceId: string): {
  allowed: boolean
  remaining: number
  resetAt: Date
} {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  const existing = throttleByWorkspace.get(workspaceId)

  if (!existing || existing.firstRequest < oneHourAgo) {
    // New window or expired - reset
    throttleByWorkspace.set(workspaceId, {
      count: 1,
      firstRequest: now,
      lastRequest: now,
    })
    return {
      allowed: true,
      remaining: LIMITS.PER_WORKSPACE_PER_HOUR - 1,
      resetAt: new Date(now.getTime() + 60 * 60 * 1000),
    }
  }

  // Within window - check limit
  if (existing.count >= LIMITS.PER_WORKSPACE_PER_HOUR) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(existing.firstRequest.getTime() + 60 * 60 * 1000),
    }
  }

  // Increment count
  existing.count++
  existing.lastRequest = now

  return {
    allowed: true,
    remaining: LIMITS.PER_WORKSPACE_PER_HOUR - existing.count,
    resetAt: new Date(existing.firstRequest.getTime() + 60 * 60 * 1000),
  }
}

/**
 * Check if workspace daily rate limit exceeded
 */
function checkWorkspaceDailyLimit(workspaceId: string): {
  allowed: boolean
  remaining: number
  resetAt: Date
} {
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const existing = throttleByWorkspaceDaily.get(workspaceId)

  if (!existing || existing.firstRequest < oneDayAgo) {
    // New window or expired - reset
    throttleByWorkspaceDaily.set(workspaceId, {
      count: 1,
      firstRequest: now,
      lastRequest: now,
    })
    return {
      allowed: true,
      remaining: LIMITS.PER_WORKSPACE_PER_DAY - 1,
      resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    }
  }

  // Within window - check limit
  if (existing.count >= LIMITS.PER_WORKSPACE_PER_DAY) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(existing.firstRequest.getTime() + 24 * 60 * 60 * 1000),
    }
  }

  // Increment count
  existing.count++
  existing.lastRequest = now

  return {
    allowed: true,
    remaining: LIMITS.PER_WORKSPACE_PER_DAY - existing.count,
    resetAt: new Date(existing.firstRequest.getTime() + 24 * 60 * 60 * 1000),
  }
}

/**
 * Middleware: Check message throttling limits
 * Apply to all WhatsApp send endpoints
 */
export async function messageThrottlingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { customerId, workspaceId } = req.body

    if (!customerId || !workspaceId) {
      logger.warn("[THROTTLE] Missing customerId or workspaceId in request")
      res.status(400).json({
        error: "Missing required fields",
        message: "customerId and workspaceId are required",
      })
      return
    }

    // CHECK 1: Per-customer limit (10 per minute)
    const customerLimit = checkCustomerLimit(customerId)
    if (!customerLimit.allowed) {
      logger.warn("🚨 [THROTTLE] Customer rate limit exceeded", {
        customerId,
        limit: LIMITS.PER_CUSTOMER_PER_MINUTE,
        resetAt: customerLimit.resetAt,
      })

      res.status(429).json({
        error: "Too many messages to this customer",
        message: `Maximum ${LIMITS.PER_CUSTOMER_PER_MINUTE} messages per minute per customer`,
        remaining: 0,
        resetAt: customerLimit.resetAt.toISOString(),
        retryAfter: Math.ceil(
          (customerLimit.resetAt.getTime() - Date.now()) / 1000
        ),
      })
      return
    }

    // CHECK 2: Per-workspace hourly limit (100 per hour)
    const workspaceHourlyLimit = checkWorkspaceHourlyLimit(workspaceId)
    if (!workspaceHourlyLimit.allowed) {
      logger.warn("🚨 [THROTTLE] Workspace hourly rate limit exceeded", {
        workspaceId,
        limit: LIMITS.PER_WORKSPACE_PER_HOUR,
        resetAt: workspaceHourlyLimit.resetAt,
      })

      res.status(429).json({
        error: "Too many messages from this workspace",
        message: `Maximum ${LIMITS.PER_WORKSPACE_PER_HOUR} messages per hour per workspace`,
        remaining: 0,
        resetAt: workspaceHourlyLimit.resetAt.toISOString(),
        retryAfter: Math.ceil(
          (workspaceHourlyLimit.resetAt.getTime() - Date.now()) / 1000
        ),
      })
      return
    }

    // CHECK 3: Per-workspace daily limit (1000 per day)
    const workspaceDailyLimit = checkWorkspaceDailyLimit(workspaceId)
    if (!workspaceDailyLimit.allowed) {
      logger.error("🚨 [THROTTLE] Workspace daily rate limit exceeded!", {
        workspaceId,
        limit: LIMITS.PER_WORKSPACE_PER_DAY,
        resetAt: workspaceDailyLimit.resetAt,
      })

      // Log to database for admin review
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          metadata: {
            lastRateLimitExceeded: new Date().toISOString(),
            dailyMessageLimit: LIMITS.PER_WORKSPACE_PER_DAY,
          },
        },
      })

      res.status(429).json({
        error: "Daily message limit exceeded",
        message: `Maximum ${LIMITS.PER_WORKSPACE_PER_DAY} messages per day per workspace`,
        remaining: 0,
        resetAt: workspaceDailyLimit.resetAt.toISOString(),
        retryAfter: Math.ceil(
          (workspaceDailyLimit.resetAt.getTime() - Date.now()) / 1000
        ),
      })
      return
    }

    // ✅ All limits passed - add rate limit headers
    res.setHeader(
      "X-RateLimit-Limit-Customer",
      LIMITS.PER_CUSTOMER_PER_MINUTE.toString()
    )
    res.setHeader(
      "X-RateLimit-Remaining-Customer",
      customerLimit.remaining.toString()
    )
    res.setHeader(
      "X-RateLimit-Reset-Customer",
      customerLimit.resetAt.toISOString()
    )

    res.setHeader(
      "X-RateLimit-Limit-Workspace-Hourly",
      LIMITS.PER_WORKSPACE_PER_HOUR.toString()
    )
    res.setHeader(
      "X-RateLimit-Remaining-Workspace-Hourly",
      workspaceHourlyLimit.remaining.toString()
    )

    res.setHeader(
      "X-RateLimit-Limit-Workspace-Daily",
      LIMITS.PER_WORKSPACE_PER_DAY.toString()
    )
    res.setHeader(
      "X-RateLimit-Remaining-Workspace-Daily",
      workspaceDailyLimit.remaining.toString()
    )

    logger.info("[THROTTLE] ✅ Rate limits passed", {
      customerId,
      workspaceId,
      customerRemaining: customerLimit.remaining,
      workspaceHourlyRemaining: workspaceHourlyLimit.remaining,
      workspaceDailyRemaining: workspaceDailyLimit.remaining,
    })

    next()
  } catch (error: any) {
    logger.error("[THROTTLE] Error checking rate limits:", {
      error: error.message,
      stack: error.stack,
    })

    // On error, allow request but log warning
    logger.warn("[THROTTLE] Rate limit check failed - allowing request")
    next()
  }
}

/**
 * Get current rate limit status for a customer/workspace
 * (for debugging/monitoring)
 */
export function getRateLimitStatus(
  customerId: string,
  workspaceId: string
): {
  customer: { count: number; remaining: number; resetAt: Date }
  workspaceHourly: { count: number; remaining: number; resetAt: Date }
  workspaceDaily: { count: number; remaining: number; resetAt: Date }
} {
  const customerLimit = checkCustomerLimit(customerId)
  const workspaceHourlyLimit = checkWorkspaceHourlyLimit(workspaceId)
  const workspaceDailyLimit = checkWorkspaceDailyLimit(workspaceId)

  return {
    customer: {
      count: LIMITS.PER_CUSTOMER_PER_MINUTE - customerLimit.remaining,
      remaining: customerLimit.remaining,
      resetAt: customerLimit.resetAt,
    },
    workspaceHourly: {
      count: LIMITS.PER_WORKSPACE_PER_HOUR - workspaceHourlyLimit.remaining,
      remaining: workspaceHourlyLimit.remaining,
      resetAt: workspaceHourlyLimit.resetAt,
    },
    workspaceDaily: {
      count: LIMITS.PER_WORKSPACE_PER_DAY - workspaceDailyLimit.remaining,
      remaining: workspaceDailyLimit.remaining,
      resetAt: workspaceDailyLimit.resetAt,
    },
  }
}
