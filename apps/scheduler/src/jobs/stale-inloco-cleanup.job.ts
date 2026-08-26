import { prisma } from '../config/database'
import logger from '../utils/logger'
// Relative on purpose, not @shared: this file must resolve both from source
// (tsx, Heroku Scheduler one-off) and compiled (dist/apps/scheduler/src/...,
// where ../../../../shared lands on dist/shared) — the scheduler has no
// runtime module-alias mapping like the backend's index.ts.
import { TAG_IN_LOCO, isCurrentlyInTown } from '../../../../shared/stay-inloco'
import type { InLocoStayDates } from '../../../../shared/stay-inloco'

/**
 * Stale INLOCO Cleanup Job
 * Run daily via Heroku Scheduler: npx tsx src/scripts/run-job.ts stale-inloco-cleanup
 *
 * INLOCO is the "guest is in town right now" campaign segment, derived from
 * the stay dates by shared/stay-inloco.ts. The chatbot keeps it in sync on
 * every turn — but only for guests who write. A guest who departs and never
 * writes again keeps the tag forever, and a "tonight in town" campaign would
 * reach someone who went home weeks ago. This job closes that hole: it
 * re-derives the same rule for every customer still carrying the tag and
 * removes it from those no longer in town.
 *
 * It only ever REMOVES the tag. Adding it stays with the chatbot turn, which
 * has the conversation context; and `isCurrentlyInTown === null` (unreadable
 * dates) removes nothing — an unknown stay must not strip a tag someone may
 * have set by hand.
 */
export async function staleInlocoCleanupJob(): Promise<void> {
  const now = new Date()

  const tagged = await prisma.customers.findMany({
    where: {
      deletedAt: null,
      tags: { has: TAG_IN_LOCO },
    },
    select: { id: true, workspaceId: true, tags: true, stayProfile: true },
  })

  logger.info(`🧹 [STALE-INLOCO-CLEANUP] Starting — ${tagged.length} customers carry ${TAG_IN_LOCO}`)

  let removed = 0
  for (const customer of tagged) {
    const raw = customer.stayProfile
    const profile =
      raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as InLocoStayDates) : null

    if (isCurrentlyInTown(profile, now) !== false) continue

    // Case-insensitive removal, same semantics as the backend's
    // setCustomerTags: "inloco" and "INLOCO" are the same tag.
    const kept = (customer.tags ?? []).filter(
      (tag) => tag.trim().toUpperCase() !== TAG_IN_LOCO
    )
    await prisma.customers.updateMany({
      where: { id: customer.id, workspaceId: customer.workspaceId },
      data: { tags: kept },
    })
    removed += 1
  }

  if (removed > 0) {
    logger.info(`✅ [STALE-INLOCO-CLEANUP] Completed: ${TAG_IN_LOCO} removed from ${removed} departed customers`)
  } else {
    logger.info(`✅ [STALE-INLOCO-CLEANUP] No stale ${TAG_IN_LOCO} tags found`)
  }
}
