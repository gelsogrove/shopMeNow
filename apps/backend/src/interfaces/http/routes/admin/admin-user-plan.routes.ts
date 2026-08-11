/**
 * 📋 ADMIN USER PLAN ROUTES
 *
 * Manual plan change (FREE_TRIAL / BASIC / PREMIUM / ENTERPRISE) from backoffice.
 * Separate file from admin-user-subscription.routes.ts for file size compliance (<500 lines).
 */

import { Router, Request, Response } from "express"
import { prisma, PlanType } from "@echatbot/database"
import { authMiddleware } from "../../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../../middlewares/platform-admin.middleware"
import logger from "../../../../utils/logger"

const router = Router()

/**
 * Valid plan type check against the Prisma enum (no hardcoded list).
 * Exported for unit tests.
 */
export const isValidPlanType = (value: unknown): value is PlanType =>
  typeof value === "string" &&
  (Object.values(PlanType) as string[]).includes(value)

/**
 * Build the user update payload for a manual plan change.
 * - planStartedAt resets to now: FREE_TRIAL gets a fresh 14-day window,
 *   BASIC/PREMIUM get a fresh 30-day billing window.
 * - pending plan fields are cleared so a previously scheduled downgrade
 *   cannot silently override the admin's manual choice later.
 * Exported for unit tests.
 */
export const buildPlanChangeUpdateData = (planType: PlanType, now: Date) => ({
  planType,
  planStartedAt: now,
  pendingPlanType: null,
  pendingPlanEffectiveDate: null,
})

/**
 * @swagger
 * /api/users/admin/{userId}/change-plan:
 *   post:
 *     summary: Manually change a user's plan (admin)
 *     description: |
 *       Immediately sets the owner's planType and resets planStartedAt to now.
 *       Clears any pending scheduled plan change.
 *       Does NOT touch an active PayPal subscription — the response includes a
 *       warning when one exists so the admin can handle it separately.
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planType
 *             properties:
 *               planType:
 *                 type: string
 *                 enum: [FREE_TRIAL, BASIC, PREMIUM, ENTERPRISE]
 *               reason:
 *                 type: string
 *                 description: Optional reason for the change (logged)
 *     responses:
 *       200:
 *         description: Plan changed successfully
 *       400:
 *         description: Invalid planType or user already on this plan
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Platform admin access required
 *       404:
 *         description: User not found
 */
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

export default router
