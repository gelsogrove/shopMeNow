import {
  CampaignFrequency,
  PushCampaignRecipientStatus,
  PushCampaignStatus,
  prisma,
} from '../config/database'
import logger from '../utils/logger'
import { minutesUntilSendWindow } from './push-campaigns.job'

/**
 * End-of-stay feedback: ask the guest how the holiday went, the day after
 * they left (Andrea, 2026-09-14).
 *
 * WHY THIS IS A SEPARATE JOB FROM push-campaigns
 * Every other frequency answers "is this campaign due?" against one date the
 * campaign owns. ON_STAY_END has no such date: it is due once per GUEST, on
 * THEIR departure. The generic runner is excluded from these campaigns by a
 * `frequency: { not: ON_STAY_END }` filter, and this job owns them instead.
 *
 * WHAT IT DOES — one pass per eligible guest:
 *   1. enqueue the feedback message (through the ordinary recipient rows, so
 *      the existing sender, send window, throttling and audit trail all apply)
 *   2. nothing else. The INLOCO tag and the stay archive are already handled
 *      by stale-inloco-cleanup.job.ts and by the module's own rolloverStay —
 *      duplicating either here would create a second authority on when a stay
 *      ends, which is exactly the drift shared/stay-inloco.ts warns against.
 *
 * 🚨 THE TWO MISTAKES THIS MUST NOT MAKE (Andrea's own words)
 *   "non possiamo permetterci di mandare messaggi a chi li ha già ricevuti"
 *   "ma attenzione, perché se fa una seconda vacanza il feedback lo dobbiamo
 *    inviare"
 * Both are the same rule once dedup is keyed on the STAY rather than the
 * customer: `stayKey` is the departure date, and the unique index
 * (campaignId, customerId, stayKey) is enforced by Postgres, so a re-run, a
 * second process or a manual launch cannot double-message anyone — while a
 * different holiday is a different key and goes out normally.
 */

/** The slice of stayProfile this job reads. */
interface StayProfileSlice {
  departureDate?: string
  feedbackGiven?: boolean
}

/** Today in the workspace's timezone as YYYY-MM-DD — not the dyno's UTC date. */
export function localDateKey(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

/** The departure date a guest must have to be asked today. */
export function targetDepartureDate(now: Date, timeZone: string, delayDays: number): string {
  const today = localDateKey(now, timeZone)
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - Math.max(0, delayDays))
  return d.toISOString().slice(0, 10)
}

/**
 * Is this guest due for the feedback message?
 *
 * Exported and pure so the rules can be tested without a database: these
 * predicates are the difference between messaging the right person once and
 * messaging the wrong person twice.
 */
export function isDueForFeedback(
  profile: StayProfileSlice | null | undefined,
  targetDeparture: string
): boolean {
  if (!profile?.departureDate) return false
  // Already answered THIS stay. Read from the stay profile, never from
  // customers.feedbackAt: that column keeps the first holiday's timestamp for
  // ever and would silence every later stay. rolloverStay clears this one.
  if (profile.feedbackGiven === true) return false
  return profile.departureDate === targetDeparture
}

export async function stayEndFeedbackJob(): Promise<void> {
  const now = new Date()

  const campaigns = await prisma.pushCampaign.findMany({
    where: {
      frequency: CampaignFrequency.ON_STAY_END,
      isActive: true,
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' },
  })

  if (campaigns.length === 0) return
  logger.info(`[STAY-END] ${campaigns.length} active end-of-stay campaign(s)`)

  for (const campaign of campaigns) {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: campaign.workspaceId },
        select: { timezone: true, enableWhatsapp: true },
      })

      // No WhatsApp channel means nothing can be delivered: enqueueing would
      // only pile up messages that fail one by one.
      if (!workspace?.enableWhatsapp) {
        logger.info(`[STAY-END] ${campaign.id}: WhatsApp disabled, skipped`)
        continue
      }

      const timeZone = workspace.timezone || 'Europe/Rome'

      // The hour the tenant chose, still inside the campaign's send window —
      // a guest must never be messaged in the middle of the night.
      const hourNow = Number(
        new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hour12: false })
          .format(now)
          .replace(/\D/g, '')
      )
      if (hourNow !== campaign.stayEndSendHour) continue
      if (minutesUntilSendWindow(now, timeZone, campaign.sendWindowStart, campaign.sendWindowEnd) > 0) {
        logger.info(`[STAY-END] ${campaign.id}: outside send window, skipped`)
        continue
      }

      const targetDeparture = targetDepartureDate(now, timeZone, campaign.stayEndDelayDays)

      // Same eligibility as every other campaign — consent above all. These
      // are unsolicited messages from a real WhatsApp number: sending without
      // consent risks the number itself, not just an unhappy guest.
      const candidates = await prisma.customers.findMany({
        where: {
          workspaceId: campaign.workspaceId,
          isActive: true,
          activeChatbot: true,
          isBlacklisted: false,
          push_notifications_consent: true,
          deletedAt: null,
          phone: { not: null },
        },
        select: { id: true, phone: true, stayProfile: true },
      })

      let queued = 0
      let alreadySent = 0

      for (const customer of candidates) {
        const profile = (customer.stayProfile ?? null) as StayProfileSlice | null
        if (!isDueForFeedback(profile, targetDeparture)) continue
        if (!customer.phone) continue

        try {
          await prisma.pushCampaignRecipient.create({
            data: {
              campaignId: campaign.id,
              workspaceId: campaign.workspaceId,
              customerId: customer.id,
              phone: customer.phone,
              status: PushCampaignRecipientStatus.PENDING,
              stayKey: targetDeparture,
            },
          })
          queued++
        } catch (error) {
          // P2002 = the unique (campaignId, customerId, stayKey) already
          // exists: this guest was already asked for THIS stay. Expected, not
          // an error — it is the guarantee working.
          if ((error as { code?: string }).code === 'P2002') {
            alreadySent++
            continue
          }
          throw error
        }
      }

      if (queued > 0) {
        // Hand the queued recipients to the ordinary sender: it owns
        // throttling, credit, delivery status and the audit trail.
        await prisma.pushCampaign.update({
          where: { id: campaign.id },
          data: {
            status: PushCampaignStatus.SCHEDULED,
            nextRunAt: now,
            lastRunAt: now,
          },
        })
      }

      logger.info(
        `[STAY-END] ${campaign.id}: departure ${targetDeparture} — ${queued} queued, ${alreadySent} already asked`
      )
    } catch (error) {
      // One workspace failing must not stop the others.
      logger.error(`[STAY-END] campaign ${campaign.id} failed:`, error)
    }
  }
}
