import { BillingType, PrismaClient } from "@prisma/client"
import { BillingService } from "../application/services/billing.service"
import logger from "../utils/logger"

import { CampaignScheduler } from "./campaign-scheduler.service"

export class SchedulerService {
  private prisma: PrismaClient
  private billingService: BillingService
  private campaignScheduler: CampaignScheduler
  private readonly CHECK_INTERVAL = 5 * 60 * 1000 // 5 minuti
  private readonly URL_CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 ora
  private readonly BILLING_CHECK_INTERVAL = 24 * 60 * 60 * 1000 // 24 ore
  private readonly ANALYTICS_CLEANUP_INTERVAL = 7 * 24 * 60 * 60 * 1000 // 7 giorni (weekly cleanup)

  constructor() {
    this.prisma = new PrismaClient()
    this.billingService = new BillingService(this.prisma)
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
   * Verifica se è necessario addebitare il costo mensile del canale per i workspace attivi
   * L'addebito di €19 viene effettuato una volta al mese per ogni workspace
   */
  private async trackMonthlyChannelCost(): Promise<void> {
    try {
      // Ottiene tutti i workspace attivi
      const workspaces = await this.prisma.workspace.findMany({
        where: {
          isActive: true,
        },
      })

      const today = new Date()
      const currentMonth = today.getMonth()
      const currentYear = today.getFullYear()

      // Verifica se è già stato effettuato un addebito questo mese per ogni workspace
      for (const workspace of workspaces) {
        // Controlla se esiste già un addebito per questo mese
        const existingCharge = await this.prisma.billing.findFirst({
          where: {
            workspaceId: workspace.id,
            type: BillingType.MONTHLY_CHANNEL,
            createdAt: {
              gte: new Date(currentYear, currentMonth, 1),
              lt: new Date(currentYear, currentMonth + 1, 1),
            },
          },
        })

        // Se non esiste un addebito per questo mese, effettua l'addebito
        if (!existingCharge) {
          await this.billingService.chargeMonthlyChannelCost(workspace.id)
          logger.info(
            `Monthly channel cost charged for workspace ${workspace.id}`
          )
        }
      }
    } catch (error) {
      logger.error("Error tracking monthly channel cost:", error)
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
    this.trackMonthlyChannelCost()
    this.cleanupOldAnalytics() // 🆕 Cleanup analytics on startup

    // Imposta gli intervalli per le esecuzioni successive
    setInterval(() => {
      this.updateExpiredOffers()
    }, this.CHECK_INTERVAL)

    setInterval(() => {
      this.cleanupUrls()
    }, this.URL_CLEANUP_INTERVAL)

    // Verifica giornaliera per l'addebito mensile
    setInterval(() => {
      this.trackMonthlyChannelCost()
    }, this.BILLING_CHECK_INTERVAL)

    // 📊 Cleanup analytics settimanale (ogni 7 giorni)
    setInterval(() => {
      this.cleanupOldAnalytics()
    }, this.ANALYTICS_CLEANUP_INTERVAL)

    // Start campaign scheduler (runs daily at 10:00 AM)
    this.campaignScheduler.start()

    logger.info(
      "Scheduler service started - managing offers, URLs cleanup, monthly billing, analytics cleanup (6 months), and campaign scheduler"
    )
  }
}
