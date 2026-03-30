import { prisma } from '../config/database'
import logger from '../utils/logger'

/**
 * Wasender QR Code Cleanup Job
 * Runs every 10 minutes
 * 
 * Clears expired QR codes from workspaces
 * Wasender QR codes expire after 5 minutes of generation
 * This job removes stale QR codes to clean up the UI and DB
 */
const QR_CODE_TTL_MINUTES = 5

export async function wasenderQrCleanupJob(): Promise<void> {
  const expiryTime = new Date()
  expiryTime.setMinutes(expiryTime.getMinutes() - QR_CODE_TTL_MINUTES)

  try {
    // Find workspaces with expired QR codes
    const expiredQrWorkspaces = await prisma.workspace.findMany({
      where: {
        wasenderQrString: {
          not: null, // Has QR code
        },
        wasenderQrGeneratedAt: {
          lt: expiryTime, // Older than TTL
        },
      },
      select: {
        id: true,
        name: true,
        wasenderQrGeneratedAt: true,
      },
    })

    if (expiredQrWorkspaces.length === 0) {
      logger.info('[Wasender QR Cleanup] No expired QR codes to clean')
      return
    }

    // Clear expired QR codes in batch
    const result = await prisma.workspace.updateMany({
      where: {
        id: {
          in: expiredQrWorkspaces.map((w) => w.id),
        },
      },
      data: {
        wasenderQrString: null,
        wasenderQrGeneratedAt: null,
      },
    })

    logger.info(
      `🔄 [Wasender QR Cleanup] Cleared ${result.count} expired QR codes (older than ${QR_CODE_TTL_MINUTES} minutes)`
    )

    // Log which workspaces were cleaned
    if (expiredQrWorkspaces.length <= 10) {
      logger.debug(
        '[Wasender QR Cleanup] Cleared QR codes for:',
        expiredQrWorkspaces.map((w) => `${w.name} (${w.id})`).join(', ')
      )
    }
  } catch (error) {
    logger.error('[Wasender QR Cleanup] Error during cleanup:', error)
    throw error
  }
}
