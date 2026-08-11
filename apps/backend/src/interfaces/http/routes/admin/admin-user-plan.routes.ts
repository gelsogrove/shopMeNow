import { Router, Request, Response } from "express"
import { prisma, PlanType } from "@echatbot/database"
import { authMiddleware } from "../../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../../middlewares/platform-admin.middleware"
import logger from "../../../../utils/logger"

const router = Router()

export const isValidPlanType = (value: unknown): value is PlanType =>
  typeof value === "string" &&
  (Object.values(PlanType) as string[]).includes(value)

export const buildPlanChangeUpdateData = (planType: PlanType, now: Date) => ({
  planType,
  planStartedAt: now,
  pendingPlanType: null,
  pendingPlanEffectiveDate: null,
})

export const isValidTaxRate = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1

router.post(
  "/admin/:userId/change-plan",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params
      const { planType, reason } = req.body as {
        planType?: string
        reason?: string
      }
      const adminUser = (req as any).user

      if (!isValidPlanType(planType)) {
        return res.status(400).json({
          success: false,
          error: `planType must be one of: ${Object.values(PlanType).join(", ")}`,
        })
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          planType: true,
          paypalSubscriptionStatus: true,
        },
      })

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        })
      }

      if (targetUser.planType === planType) {
        return res.status(400).json({
          success: false,
          error: `User is already on ${planType} plan`,
        })
      }

      const now = new Date()
      await prisma.user.update({
        where: { id: targetUser.id },
        data: buildPlanChangeUpdateData(planType, now),
      })

      const hasActivePaypalSubscription =
        targetUser.paypalSubscriptionStatus === "ACTIVE"

      logger.info(
        `📋 Admin ${adminUser.email} changed plan for user ${targetUser.email}: ` +
          `${targetUser.planType} → ${planType}. Reason: ${reason || "Not specified"}.` +
          (hasActivePaypalSubscription
            ? " ⚠️ User has an ACTIVE PayPal subscription that was NOT modified."
            : "")
      )

      res.json({
        success: true,
        data: {
          userId: targetUser.id,
          email: targetUser.email,
          previousPlanType: targetUser.planType,
          newPlanType: planType,
          planStartedAt: now.toISOString(),
          reason: reason || null,
          paypalWarning: hasActivePaypalSubscription
            ? "User has an ACTIVE PayPal subscription. The subscription was NOT modified — handle it separately."
            : null,
        },
      })
    } catch (error: any) {
      logger.error("Error changing user plan:", error)
      res.status(500).json({
        success: false,
        error: error.message || "Failed to change plan",
      })
    }
  }
)

router.patch(
  "/admin/:userId/tax-rate",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params
      const { taxRate } = req.body as { taxRate?: unknown }
      const adminUser = (req as any).user

      if (!isValidTaxRate(taxRate)) {
        return res.status(400).json({
          success: false,
          error: "taxRate must be a number between 0 and 1 (e.g. 0.22 for 22%)",
        })
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, taxRate: true },
      })

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        })
      }

      await prisma.user.update({
        where: { id: targetUser.id },
        data: { taxRate },
      })

      logger.info(
        `📋 Admin ${adminUser.email} changed tax rate for user ${targetUser.email}: ` +
          `${(Number(targetUser.taxRate) * 100).toFixed(2)}% → ${(taxRate * 100).toFixed(2)}%`
      )

      res.json({
        success: true,
        data: {
          userId: targetUser.id,
          email: targetUser.email,
          previousTaxRate: Number(targetUser.taxRate),
          newTaxRate: taxRate,
        },
      })
    } catch (error: any) {
      logger.error("Error changing user tax rate:", error)
      res.status(500).json({
        success: false,
        error: error.message || "Failed to change tax rate",
      })
    }
  }
)

export default router
