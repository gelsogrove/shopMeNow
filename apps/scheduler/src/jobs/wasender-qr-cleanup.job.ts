import { prisma } from '../config/database'
import logger from '../utils/logger'

const QR_TTL_MINUTES = parseInt(process.env.WASENDER_QR_TTL_MINUTES || '5')

/**
 * WasenderAPI QR String Cleanup Job
 * Runs every 5 minutes
 * Clears stale QR strings to avoid storing sensitive data long-term.
 *
 * LOGIC:
 * - Clear wasenderQrString older than TTL (default 5 minutes — Wasender QR expires fast)
 * - Only clear if session is NOT 'connected' (keep null if already paired)
 * - Security: QR strings can be misused if leaked; don't keep them around
 */
export async function wasenderQrCleanupJob(): Promise<void> {
  logger.info('[WASENDER-QR-CLEANUP] Starting job')

  try {
    const ttlDate = new Date(Date.now() - QR_TTL_MINUTES * 60 * 1000)

    const result = await prisma.workspace.updateMany({
      where: {
        wasenderQrString: { not: null },
        wasenderQrGeneratedAt: { lt: ttlDate },
        wasenderSessionStatus: { not: 'connected' }, // Don't clear if already paired
      },
      data: {
        wasenderQrString: null,
        wasenderQrGeneratedAt: null,
      },
    })

    logger.info(`[WASENDER-QR-CLEANUP] Cleared ${result.count} stale QR strings`)
  } catch (error) {
    logger.error('[WASENDER-QR-CLEANUP] Failed:', error)
    throw error
  }
}
