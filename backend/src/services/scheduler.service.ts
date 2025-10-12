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
  private readonly CHAT_CLEANUP_INTERVAL = 12 * 60 * 60 * 1000 // 12 ore
  private readonly BILLING_CHECK_INTERVAL = 24 * 60 * 60 * 1000 // 24 ore
  private readonly MESSAGE_LIMIT = 50 // limite di messaggi per cliente

  constructor() {
    this.prisma = new PrismaClient()
    this.billingService = new BillingService(this.prisma)
    this.campaignScheduler = new CampaignScheduler(this.prisma)
  }

  /**
   * IMPORTANTE: NON eliminiamo più i messaggi vecchi perché servono per il calcolo del billing
   * Questa funzione è stata disattivata per garantire l'integrità dei dati di fatturazione
   *
   * @deprecated Non eliminare i messaggi perché necessari per il billing
   */
  private async cleanupChatHistory(): Promise<void> {
    // DISABILITATO: Non possiamo eliminare i messaggi vecchi perché necessari per il calcolo del billing
    logger.info(
      "📊 Chat history cleanup skipped: messages are required for billing calculations"
    )

    /* CODICE PRECEDENTE DISATTIVATO
    try {
      // Ottiene tutte le sessioni di chat attive
      const chatSessions = await this.prisma.chatSession.findMany({
        select: {
          id: true,
          customerId: true,
          messages: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      })

      for (const session of chatSessions) {
        // Se il cliente ha più di 50 messaggi, elimina i più vecchi
        if (session.messages.length > this.MESSAGE_LIMIT) {
          // Ottiene gli ID dei messaggi da eliminare
          const messagesToDelete = session.messages
            .slice(this.MESSAGE_LIMIT)
            .map((msg) => msg.id)

          // Elimina i messaggi più vecchi
          const result = await this.prisma.message.deleteMany({
            where: {
              id: {
                in: messagesToDelete,
              },
            },
          })

          if (result.count > 0) {
            logger.info(
              `🧹 Removed ${result.count} old messages for chat session ${session.id}`
            )
          }
        }
      }
    } catch (error) {
      logger.error("Error cleaning up chat history:", error)
    }
    */
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
   * Inizia il processo di aggiornamento periodico
   */
  public startScheduledTasks(): void {
    // Esegui immediatamente al primo avvio
    this.updateExpiredOffers()
    this.cleanupUrls()
    // this.cleanupChatHistory() // Disabilitato: i messaggi sono necessari per il billing
    this.trackMonthlyChannelCost() // Verifica se è necessario addebitare il costo mensile

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

    // Interval disabilitato: i messaggi sono necessari per il billing
    // setInterval(() => {
    //   this.cleanupChatHistory()
    // }, this.CHAT_CLEANUP_INTERVAL)

    // Start campaign scheduler (runs daily at 10:00 AM)
    this.campaignScheduler.start()

    logger.info(
      "Scheduler service started - managing offers, URLs cleanup, monthly billing, and campaign scheduler (chat history cleanup disabled for billing)"
    )
  }
}
