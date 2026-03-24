import { prisma, PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"

export class SchedulerService {
  private prisma: PrismaClient
  private readonly CHECK_INTERVAL = 5 * 60 * 1000 // 5 minuti
  private readonly URL_CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 ora
  private readonly ANALYTICS_CLEANUP_INTERVAL = 7 * 24 * 60 * 60 * 1000 // 7 giorni (weekly cleanup)

  constructor() {
    this.prisma = prisma
  }

  /**
   * Aggiorna lo stato delle offerte scadute
   */
  private async updateExpiredOffers(): Promise<void> {
    const now = new Date()

    try {
      // Trova e aggiorna tutte le offerte scadute che sono ancora attive
      const result = await this.prisma.offers.updateMany({
        where: {
          isActive: true,
          endDate: { lt: now },
        },
        data: {
          isActive: false,
        },
      })

      if (result.count > 0) {
        logger.info(`Updated ${result.count} expired offers`)
      }
    } catch (error) {
      logger.error("Error updating expired offers:", error)
    }
  }

  /**
   * Pulisce le URL scadute e vecchie
   */
  private async cleanupUrls(): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000) // 1 ora fa

      const result = await this.prisma.shortUrls.deleteMany({
        where: {
          OR: [
            // Elimina URL scadute
            {
              expiresAt: {
                lt: new Date(),
              },
            },
            // Elimina URL più vecchie di 1 ora
            {
              createdAt: {
                lt: oneHourAgo,
              },
            },
          ],
        },
      })

      if (result.count > 0) {
        logger.info(
          `🧹 Scheduled cleanup: removed ${result.count} old/expired short URLs`
        )
      }
    } catch (error) {
      logger.error("Error cleaning up URLs:", error)
    }
  }

  /**
   * Inizia il processo di aggiornamento periodico
   */
  public startScheduledTasks(): void {
    // Esegui immediatamente al primo avvio
    this.updateExpiredOffers()
    this.cleanupUrls()

    // Imposta gli intervalli per le esecuzioni successive
    setInterval(() => {
      this.updateExpiredOffers()
    }, this.CHECK_INTERVAL)

    setInterval(() => {
      this.cleanupUrls()
    }, this.URL_CLEANUP_INTERVAL)

    // 📊 Cleanup analytics settimanale (ogni 7 giorni)
    setInterval(() => {
    }, this.ANALYTICS_CLEANUP_INTERVAL)

    logger.info(
      "Scheduler service started - managing offers, URLs cleanup, analytics cleanup (6 months)"
    )
  }
}
