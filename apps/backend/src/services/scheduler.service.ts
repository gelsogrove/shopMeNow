import { prisma, PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"

import { CampaignScheduler } from "./campaign-scheduler.service"

export class SchedulerService {
  private prisma: PrismaClient
  private campaignScheduler: CampaignScheduler
  private readonly CHECK_INTERVAL = 5 * 60 * 1000 // 5 minuti
  private readonly URL_CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 ora
  private readonly ANALYTICS_CLEANUP_INTERVAL = 7 * 24 * 60 * 60 * 1000 // 7 giorni (weekly cleanup)

  constructor() {
    this.prisma = prisma
    this.campaignScheduler = new CampaignScheduler(this.prisma)
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
   * 📊 Cleanup old product search analytics data (older than 6 months)
   *
   * Runs weekly to maintain database performance and comply with data retention policy.
   * Deletes ProductSearch records older than 6 months while maintaining workspace isolation.
   */
  private async cleanupOldAnalytics(): Promise<void> {
    try {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

      const result = await this.prisma.productSearch.deleteMany({
        where: {
          createdAt: {
            lt: sixMonthsAgo,
          },
        },
      })

      if (result.count > 0) {
        logger.info(
          `📊 Analytics cleanup: removed ${result.count} product search records older than 6 months`
        )
      } else {
        logger.debug("📊 Analytics cleanup: no old records to remove")
      }
    } catch (error) {
      logger.error("❌ Error cleaning up old analytics data:", error)
    }
  }

  /**
   * Inizia il processo di aggiornamento periodico
   */
  public startScheduledTasks(): void {
    // Esegui immediatamente al primo avvio
    this.updateExpiredOffers()
    this.cleanupUrls()
    this.cleanupOldAnalytics() // 🆕 Cleanup analytics on startup

    // Imposta gli intervalli per le esecuzioni successive
    setInterval(() => {
      this.updateExpiredOffers()
    }, this.CHECK_INTERVAL)

    setInterval(() => {
      this.cleanupUrls()
    }, this.URL_CLEANUP_INTERVAL)

    // 📊 Cleanup analytics settimanale (ogni 7 giorni)
    setInterval(() => {
      this.cleanupOldAnalytics()
    }, this.ANALYTICS_CLEANUP_INTERVAL)

    // Start campaign scheduler (runs daily at 11:30 AM)
    this.campaignScheduler.start()

    logger.info(
      "Scheduler service started - managing offers, URLs cleanup, analytics cleanup (6 months), and campaign scheduler"
    )
  }
}
