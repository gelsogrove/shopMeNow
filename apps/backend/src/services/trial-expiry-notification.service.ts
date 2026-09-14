/**
 * Trial-expiry warnings.
 *
 * Until this existed, a free trial simply lapsed: the owner got no warning,
 * and the first sign anything had happened was the chatbot going silent for
 * their customers (whatsapp-inbound.pipeline.ts blocks TRIAL_EXPIRED without
 * replying, by design). Andrea, 2026-09-14: the trial must announce itself
 * before it ends.
 *
 * Runs daily. For every FREE_TRIAL owner whose trial ends within the
 * configured warning window, sends ONE email and stamps
 * users.trialExpiringNotifiedAt so the next day's run stays quiet — the same
 * throttle lowBalanceNotifiedAt provides for the low-credit alert.
 *
 * The warning threshold is NOT hardcoded: it is read from PlatformConfig
 * (TRIAL_WARNING_DAYS), editable from the backoffice. If the key is absent
 * the job logs and does nothing, rather than inventing a default.
 */

import { prisma } from "@echatbot/database"
import logger from "../utils/logger"
import { EmailService } from "../application/services/email.service"

const emailService = new EmailService()

export const TRIAL_WARNING_DAYS_KEY = "TRIAL_WARNING_DAYS"

export interface TrialExpiryNotificationSummary {
  ownersChecked: number
  emailsSent: number
  errors: number
}

/**
 * Whole days from `now` until `trialEndsAt`, rounded up: an owner whose trial
 * ends in 6 hours is "1 day remaining", not 0.
 */
export const daysUntil = (trialEndsAt: Date, now: Date): number =>
  Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

/**
 * Read the warning window from PlatformConfig. Returns null when unset, so
 * the caller can skip the run instead of guessing a value.
 */
export const resolveWarningDays = async (): Promise<number | null> => {
  const row = await prisma.platformConfig.findFirst({
    where: { key: TRIAL_WARNING_DAYS_KEY, isActive: true },
    select: { value: true },
  })

  if (!row) return null

  const parsed = Number(row.value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    logger.error(
      `[TRIAL-EXPIRY] ${TRIAL_WARNING_DAYS_KEY} is not a positive number: "${row.value}"`
    )
    return null
  }

  return Math.floor(parsed)
}

export async function runTrialExpiryNotifications(
  reference: Date = new Date()
): Promise<TrialExpiryNotificationSummary> {
  const summary: TrialExpiryNotificationSummary = {
    ownersChecked: 0,
    emailsSent: 0,
    errors: 0,
  }

  const warningDays = await resolveWarningDays()
  if (warningDays === null) {
    logger.warn(
      `[TRIAL-EXPIRY] Skipped: ${TRIAL_WARNING_DAYS_KEY} is not configured in PlatformConfig`
    )
    return summary
  }

  // Window: trials ending from now up to `warningDays` ahead. Already-expired
  // trials are excluded — warning someone after the fact is noise, and the
  // month-end run is what pauses them.
  const windowEnd = new Date(
    reference.getTime() + warningDays * 24 * 60 * 60 * 1000
  )

  const owners = await prisma.user.findMany({
    where: {
      deletedAt: null,
      planType: "FREE_TRIAL",
      subscriptionStatus: { not: "PAUSED" },
      trialEndsAt: { gt: reference, lte: windowEnd },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      trialEndsAt: true,
      trialExpiringNotifiedAt: true,
    },
  })

  for (const owner of owners) {
    summary.ownersChecked++

    try {
      if (!owner.trialEndsAt || !owner.email) continue

      // Already warned about THIS trial: the stamp is later than the moment
      // the owner entered the warning window. A trial that gets extended
      // pushes trialEndsAt out, moving the window and re-arming the warning.
      const windowOpenedAt = new Date(
        owner.trialEndsAt.getTime() - warningDays * 24 * 60 * 60 * 1000
      )
      if (
        owner.trialExpiringNotifiedAt &&
        owner.trialExpiringNotifiedAt >= windowOpenedAt
      ) {
        continue
      }

      const sent = await emailService.sendTrialExpiringAlert({
        to: owner.email,
        firstName: owner.firstName || "there",
        daysRemaining: daysUntil(owner.trialEndsAt, reference),
        trialEndsAt: owner.trialEndsAt,
      })

      // Only stamp on a successful send, so a transient SMTP failure is
      // retried by tomorrow's run instead of being silently swallowed.
      if (sent) {
        await prisma.user.update({
          where: { id: owner.id },
          data: { trialExpiringNotifiedAt: reference },
        })
        summary.emailsSent++
      } else {
        summary.errors++
      }
    } catch (error) {
      summary.errors++
      logger.error(
        `[TRIAL-EXPIRY] Failed to notify owner ${owner.email}:`,
        error
      )
    }
  }

  logger.info(
    `[TRIAL-EXPIRY] Run finished: ${summary.ownersChecked} owners in the ` +
      `${warningDays}-day window — ${summary.emailsSent} warned, ${summary.errors} errors`
  )

  return summary
}
