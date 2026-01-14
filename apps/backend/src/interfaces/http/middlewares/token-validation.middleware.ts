import { NextFunction, Request, Response } from "express"
import { SecureTokenService } from "../../../application/services/secure-token.service"
import { SecurityCheckService } from "../../../application/services/security-check.service"
import { prisma } from "../../../lib/prisma"
import logger from "../../../utils/logger"

const secureTokenService = new SecureTokenService()

/**
 * Middleware for validating secure tokens in public endpoints
 *
 * Extracts token from request (body, query, or params), validates it,
 * and attaches customerId, workspaceId, and tokenData to request object.
 *
 * @middleware
 * @security Validates token expiry and signature
 * @security Implements workspace isolation
 * @security Falls back to phone number lookup if customerId missing
 *
 * @example
 * ```typescript
 * router.post("/endpoint",
 *   publicOrdersLimiter,
 *   tokenValidationMiddleware,
 *   async (req, res) => {
 *     const { customerId, workspaceId } = req as any
 *     // ... business logic with validated data
 *   }
 * )
 * ```
 *
 * @throws {400} If token is missing from request
 * @throws {401} If token is invalid or expired
 * @throws {401} If token doesn't contain valid customer information
 */
export const tokenValidationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. Extract token from multiple possible locations
    const token = req.body.token || req.query.token || req.params.token || null

    // 🔒 SECURITY: Token is required
    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Token is required",
      })
    }

    logger.info("[TOKEN-VALIDATION-MIDDLEWARE] Validating token")

    // 2. Validate token with SecureTokenService
    const validation = await secureTokenService.validateToken(token as string)

    if (!validation.valid) {
      logger.warn("[TOKEN-VALIDATION-MIDDLEWARE] Invalid or expired token")
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      })
    }

    // 3. Extract customer and workspace information from validated token
    const tokenData = validation.data
    const payload = validation.payload as any

    // Try to get customerId from multiple sources (payload has priority)
    let customerId =
      payload?.customerId || tokenData?.customerId || tokenData?.userId
    const workspaceId = tokenData?.workspaceId

    // 4. ULTIMATE FALLBACK: If no customerId, try to find customer by phone number
    if (!customerId && tokenData?.phoneNumber && workspaceId) {
      logger.info(
        "[TOKEN-VALIDATION-MIDDLEWARE] Attempting phone number fallback"
      )

      const customer = await prisma.customers.findFirst({
        where: {
          phone: tokenData.phoneNumber,
          workspaceId: workspaceId,
        },
      })

      if (customer) {
        customerId = customer.id
        logger.info(
          `[TOKEN-VALIDATION-MIDDLEWARE] Found customer by phone: ${customerId}`
        )
      }
    }

    // 5. Verify we have all required information
    if (!customerId || !workspaceId) {
      logger.error(
        "[TOKEN-VALIDATION-MIDDLEWARE] Token missing required information",
        {
          hasCustomerId: !!customerId,
          hasWorkspaceId: !!workspaceId,
        }
      )

      return res.status(401).json({
        success: false,
        error: "Token does not contain valid customer information",
      })
    }

    // 6. ✅ SUCCESS: Attach validated data to request object
    ;(req as any).customerId = customerId
    ;(req as any).workspaceId = workspaceId
    ;(req as any).tokenData = tokenData
    ;(req as any).tokenPayload = payload

    logger.info(
      "[TOKEN-VALIDATION-MIDDLEWARE] ✅ Token validated successfully",
      {
        customerId,
        workspaceId,
      }
    )

    // 7. 🔒 SECURITY CHECK: Rate limiting and abuse detection for public endpoints
    logger.info("[TOKEN-VALIDATION-MIDDLEWARE] 🔍 Running security validation", {
      customerId,
      workspaceId,
    })

    try {
      const securityResults = await SecurityCheckService.validateMessage({
        workspaceId,
        visitorId: customerId, // Use customerId as visitorId
        message: "", // Empty message for access validation only
        channel: "whatsapp", // Public API uses whatsapp channel for security checks
      })

      // Check if any security step failed
      const failedStep = securityResults.find((result) => !result.passed)
      if (failedStep) {
        logger.warn("[TOKEN-VALIDATION-MIDDLEWARE] 🚨 Security check failed", {
          customerId,
          workspaceId,
          step: failedStep.step,
          reason: failedStep.reason,
        })

        return res.status(429).json({
          success: false,
          error: failedStep.step,
          message: failedStep.reason || "Security check failed",
          retryAfter: failedStep.retryAfter,
        })
      }

      logger.info("[TOKEN-VALIDATION-MIDDLEWARE] ✅ Security validation passed", {
        customerId,
        workspaceId,
      })
    } catch (securityError) {
      logger.error("[TOKEN-VALIDATION-MIDDLEWARE] ❌ Security check error", {
        error: securityError instanceof Error ? securityError.message : String(securityError),
        customerId,
        workspaceId,
      })
      
      return res.status(500).json({
        success: false,
        error: "Security validation failed",
      })
    }

    next()
  } catch (error) {
    logger.error(
      "[TOKEN-VALIDATION-MIDDLEWARE] Unexpected error during validation:",
      error
    )
    return res.status(500).json({
      success: false,
      error: "Error validating token",
    })
  }
}
