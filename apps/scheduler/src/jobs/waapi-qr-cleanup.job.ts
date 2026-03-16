import { prisma } from '../config/database'
import logger from '../utils/logger'

const QR_TTL_MINUTES = parseInt(process.env.WAAPI_QR_TTL_MINUTES || '15')

/**
 * WaAPI QR Code Cleanup Job
 * Runs every 5 minutes
 * Clears stale base64 QR codes to avoid storing sensitive data long-term.
 *
 * LOGIC:
 * - Clear waapiQrCodeData older than TTL (default 15 minutes)
 * - Only clear if instance is NOT 'ready' (keep null if already connected)
 * - Security: QR codes can be misused if leaked; don't keep them around
 */
export async function waapiQrCleanupJob(): Promise<void> {
  logger.info('[WAAPI-QR-CLEANUP] Starting job')

  try {
    const ttlDate = new Date(Date.now() - QR_TTL_MINUTES * 60 * 1000)

    const result = await prisma.workspace.updateMany({
      where: {
        waapiQrCodeData: { not: null },
        waapiQrGeneratedAt: { lt: ttlDate },
        waapiInstanceStatus: { not: 'ready' }, // Don't clear if already connected
      },
      data: {
        waapiQrCodeData: null,
      },
    })

    logger.info(`[WAAPI-QR-CLEANUP] Cleared ${result.count} stale QR codes`)
  } catch (error) {
    logger.error('[WAAPI-QR-CLEANUP] Failed:', error)
    throw error
  }
}
