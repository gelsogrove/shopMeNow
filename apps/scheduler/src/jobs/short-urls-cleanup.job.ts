import { prisma } from '../config/database'
import logger from '../utils/logger'

/**
 * Short URLs Cleanup Job
 * Runs daily at 23:00
 * Deletes expired short URLs
 */
export async function shortUrlsCleanupJob(): Promise<void> {
  const result = await prisma.shortUrls.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })

  logger.info(`Deleted ${result.count} expired short URLs`)
}
