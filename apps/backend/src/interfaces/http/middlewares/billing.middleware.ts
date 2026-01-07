/**
 * Billing Middleware
 * Feature 185: Subscription & Billing System
 *
 * Middleware for:
 * - checkCredit: Verify sufficient credit before operations
 * - checkPlanLimits: Verify workspace is within plan limits
 * - checkTrialValid: Verify trial is not expired
 *
 * SECURITY: All middleware validate workspaceId from authenticated request
 */

import { NextFunction, Request, Response } from "express"
import { prisma } from "@echatbot/database"
import { SubscriptionBillingService } from "../../../application/services/subscription-billing.service"
import logger from "../../../utils/logger"

// prisma imported
const billingService = new SubscriptionBillingService(prisma)

/**
 * Factory function to create credit check middleware
 * @param operation - Type of operation to check credit for
 */
export const checkCredit = (operation: "message" | "order" | "push") => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const workspaceId = (req as any).workspaceId || req.params.workspaceId

      if (!workspaceId) {
        res.status(400).json({
          error: "Workspace ID required",
          code: "WORKSPACE_REQUIRED",
        })
        return
      }

      // Get operation cost
      const cost = await billingService.getOperationCost(workspaceId, operation)

      // Check credit
      const creditCheck = await billingService.checkCredit(workspaceId, cost)

      if (!creditCheck.hasSufficientCredit) {
        logger.warn(
          `[BILLING] ⚠️ Credit check failed for ${operation}: $${creditCheck.currentBalance.toFixed(2)} < $${cost.toFixed(2)} (workspace: ${workspaceId})`
        )

        res.status(402).json({
          error: "Credito insufficiente",
          code: "INSUFFICIENT_CREDIT",
          details: {
            currentBalance: creditCheck.currentBalance,
            requiredAmount: creditCheck.requiredAmount,
            deficit: creditCheck.deficit,
            operation,
          },
          message: `Credito insufficiente. Saldo attuale: $${creditCheck.currentBalance.toFixed(2)}, Richiesto: $${cost.toFixed(2)}. Ricarica il tuo credito per continuare.`,
        })
        return
      }

      // Store cost in request for later deduction
      ;(req as any).operationCost = cost
      ;(req as any).operationType = operation

      next()
    } catch (error) {
      logger.error("[BILLING] Error in checkCredit middleware:", error)
      res.status(500).json({
        error: "Errore verifica credito",
        code: "CREDIT_CHECK_ERROR",
      })
    }
  }
}

/**
 * Factory function to create plan limits check middleware
 * @param limitType - Type of limit to check
 */
export const checkPlanLimits = (
  limitType: "customers" | "channels" | "teamMembers"
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const workspaceId = (req as any).workspaceId || req.params.workspaceId

      if (!workspaceId) {
        res.status(400).json({
          error: "Workspace ID required",
          code: "WORKSPACE_REQUIRED",
        })
        return
      }

      const limitCheck = await billingService.checkPlanLimits(
        workspaceId,
        limitType
      )

      if (!limitCheck.withinLimits) {
        const limitMessages: Record<string, string> = {
          customers: "clienti",
          channels: "canali",
          teamMembers: "membri team",
        }

        logger.warn(
          `[BILLING] ⚠️ Plan limit reached for ${limitType}: ${limitCheck.current}/${limitCheck.max} (workspace: ${workspaceId})`
        )

        res.status(403).json({
          error: "Limite piano raggiunto",
          code: "PLAN_LIMIT_REACHED",
          details: {
            limitType,
            current: limitCheck.current,
            max: limitCheck.max,
          },
          message: `Hai raggiunto il limite massimo di ${limitMessages[limitType]} per il tuo piano (${limitCheck.current}/${limitCheck.max}). Passa a un piano superiore per aumentare i limiti.`,
        })
        return
      }

      next()
    } catch (error) {
      logger.error("[BILLING] Error in checkPlanLimits middleware:", error)
      res.status(500).json({
        error: "Errore verifica limiti piano",
        code: "PLAN_LIMITS_CHECK_ERROR",
      })
    }
  }
}

/**
 * Middleware to check if trial is valid (not expired)
 * Blocks access for FREE_TRIAL users with expired trial
 */
export const checkTrialValid = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const workspaceId = (req as any).workspaceId || req.params.workspaceId

    if (!workspaceId) {
      res.status(400).json({
        error: "Workspace ID required",
        code: "WORKSPACE_REQUIRED",
      })
      return
    }

    const trialStatus = await billingService.isTrialValid(workspaceId)

    if (trialStatus.isTrialPlan && !trialStatus.isValid) {
      logger.warn(
        `[BILLING] ⚠️ Trial expired for workspace: ${workspaceId} (expired: ${trialStatus.expiredAt?.toISOString()})`
      )

      res.status(403).json({
        error: "Trial scaduto",
        code: "TRIAL_EXPIRED",
        details: {
          expiredAt: trialStatus.expiredAt,
        },
        message:
          "Il tuo periodo di prova è scaduto. Scegli un piano per continuare ad usare eChatbot.",
      })
      return
    }

    // Add trial info to request for potential UI hints
    ;(req as any).trialInfo = trialStatus

    next()
  } catch (error) {
    logger.error("[BILLING] Error in checkTrialValid middleware:", error)
    res.status(500).json({
      error: "Errore verifica trial",
      code: "TRIAL_CHECK_ERROR",
    })
  }
}

/**
 * Middleware to check both trial validity AND credit before an operation
 * Combines checkTrialValid + checkCredit for protected operations
 */
export const checkBillingRequirements = (
  operation: "message" | "order" | "push"
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const workspaceId = (req as any).workspaceId || req.params.workspaceId

      if (!workspaceId) {
        res.status(400).json({
          error: "Workspace ID required",
          code: "WORKSPACE_REQUIRED",
        })
        return
      }

      // 1. Check trial validity
      const trialStatus = await billingService.isTrialValid(workspaceId)

      if (trialStatus.isTrialPlan && !trialStatus.isValid) {
        res.status(403).json({
          error: "Trial scaduto",
          code: "TRIAL_EXPIRED",
          message:
            "Il tuo periodo di prova è scaduto. Scegli un piano per continuare.",
        })
        return
      }

      // 2. Check credit
      const cost = await billingService.getOperationCost(workspaceId, operation)
      const creditCheck = await billingService.checkCredit(workspaceId, cost)

      if (!creditCheck.hasSufficientCredit) {
        res.status(402).json({
          error: "Credito insufficiente",
          code: "INSUFFICIENT_CREDIT",
          details: {
            currentBalance: creditCheck.currentBalance,
            requiredAmount: creditCheck.requiredAmount,
            deficit: creditCheck.deficit,
          },
          message: `Credito insufficiente. Ricarica per continuare.`,
        })
        return
      }

      // Store for later use
      ;(req as any).operationCost = cost
      ;(req as any).operationType = operation
      ;(req as any).trialInfo = trialStatus

      next()
    } catch (error) {
      logger.error(
        "[BILLING] Error in checkBillingRequirements middleware:",
        error
      )
      res.status(500).json({
        error: "Errore verifica billing",
        code: "BILLING_CHECK_ERROR",
      })
    }
  }
}

/**
 * Middleware to require Owner role for billing operations
 * Uses the existing workspace-auth middleware pattern
 */
export const requireOwnerForBilling = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user
    const workspaceId = (req as any).workspaceId || req.params.workspaceId

    if (!user || !workspaceId) {
      res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      })
      return
    }

    // Check user role in workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: user.id,
        workspaceId,
      },
      select: {
        role: true,
      },
    })

    if (!userWorkspace) {
      res.status(403).json({
        error: "Non hai accesso a questo workspace",
        code: "NO_WORKSPACE_ACCESS",
      })
      return
    }

    // Only SUPER_ADMIN (Owner) can modify billing
    if (userWorkspace.role !== "SUPER_ADMIN") {
      logger.warn(
        `[BILLING] ⚠️ Non-owner attempted billing operation: user ${user.id}, role ${userWorkspace.role}, workspace ${workspaceId}`
      )

      res.status(403).json({
        error: "Solo il proprietario può modificare le impostazioni di billing",
        code: "OWNER_REQUIRED",
        message:
          "Questa operazione richiede i permessi di proprietario del canale.",
      })
      return
    }

    next()
  } catch (error) {
    logger.error("[BILLING] Error in requireOwnerForBilling middleware:", error)
    res.status(500).json({
      error: "Errore verifica permessi",
      code: "PERMISSION_CHECK_ERROR",
    })
  }
}
