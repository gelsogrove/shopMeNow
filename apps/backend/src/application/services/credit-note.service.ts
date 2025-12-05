import { prisma } from "@echatbot/database"
import logger from "../../utils/logger"

// prisma imported

export interface CreateCreditNoteDto {
  orderId: string
  workspaceId: string
  amount: number
  reason: string
  createdById?: string
}

export interface CreditNoteWithOrder {
  id: string
  creditNoteCode: string
  orderId: string
  amount: number
  reason: string
  createdAt: Date
  createdById: string | null
  order: {
    id: string
    orderCode: string
    status: string
    totalAmount: number
    customer: {
      id: string
      name: string
      email: string | null
    }
  }
}

export class CreditNoteService {
  /**
   * Create a credit note for a delivered order (partial refund)
   * Business Rules:
   * - Only DELIVERED orders can have credit notes
   * - Amount must be positive and less than order total
   * - Credit note code format: NC-{orderCode}
   */
  async createCreditNote(data: CreateCreditNoteDto): Promise<CreditNoteWithOrder> {
    try {
      // 1. Validate order exists and belongs to workspace
      const order = await prisma.orders.findFirst({
        where: {
          id: data.orderId,
          workspaceId: data.workspaceId,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          creditNotes: true,
        },
      })

      if (!order) {
        throw new Error("Ordine non trovato")
      }

      // 2. Validate order is CONFIRMED or DELIVERED
      if (order.status !== "DELIVERED" && order.status !== "CONFIRMED") {
        throw new Error(
          `La nota di credito può essere emessa solo per ordini confermati o consegnati. Stato attuale: ${order.status}`
        )
      }

      // 3. Validate amount
      if (data.amount <= 0) {
        throw new Error("L'importo della nota di credito deve essere maggiore di zero")
      }

      // 4. Calculate total existing credit notes for this order
      const existingCreditNotesTotal = order.creditNotes.reduce(
        (sum, cn) => sum + cn.amount,
        0
      )

      // 5. Validate new credit note doesn't exceed remaining amount
      const remainingAmount = order.totalAmount - existingCreditNotesTotal
      if (data.amount > remainingAmount) {
        throw new Error(
          `L'importo supera il valore residuo dell'ordine. Massimo consentito: €${remainingAmount.toFixed(2)}`
        )
      }

      // 6. Generate credit note code
      // Format: NC-{orderCode} or NC-{orderCode}-2 for multiple credit notes
      const creditNoteNumber = order.creditNotes.length + 1
      const creditNoteCode =
        creditNoteNumber === 1
          ? `NC-${order.orderCode}`
          : `NC-${order.orderCode}-${creditNoteNumber}`

      // 7. Create credit note
      const creditNote = await prisma.creditNote.create({
        data: {
          creditNoteCode,
          orderId: data.orderId,
          amount: data.amount,
          reason: data.reason,
          createdById: data.createdById,
        },
        include: {
          order: {
            select: {
              id: true,
              orderCode: true,
              status: true,
              totalAmount: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      })

      logger.info("Credit note created:", {
        creditNoteId: creditNote.id,
        creditNoteCode: creditNote.creditNoteCode,
        orderId: data.orderId,
        orderCode: order.orderCode,
        amount: data.amount,
        reason: data.reason,
      })

      return creditNote
    } catch (error) {
      logger.error("Error creating credit note:", error)
      throw error
    }
  }

  /**
   * Get all credit notes for an order
   */
  async getCreditNotesByOrderId(
    orderId: string,
    workspaceId: string
  ): Promise<CreditNoteWithOrder[]> {
    try {
      // First verify order belongs to workspace
      const order = await prisma.orders.findFirst({
        where: {
          id: orderId,
          workspaceId,
        },
      })

      if (!order) {
        throw new Error("Ordine non trovato")
      }

      const creditNotes = await prisma.creditNote.findMany({
        where: {
          orderId,
        },
        include: {
          order: {
            select: {
              id: true,
              orderCode: true,
              status: true,
              totalAmount: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      return creditNotes
    } catch (error) {
      logger.error("Error fetching credit notes:", error)
      throw error
    }
  }

  /**
   * Get a single credit note by ID
   */
  async getCreditNoteById(
    creditNoteId: string,
    workspaceId: string
  ): Promise<CreditNoteWithOrder | null> {
    try {
      const creditNote = await prisma.creditNote.findFirst({
        where: {
          id: creditNoteId,
          order: {
            workspaceId,
          },
        },
        include: {
          order: {
            select: {
              id: true,
              orderCode: true,
              status: true,
              totalAmount: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      })

      return creditNote
    } catch (error) {
      logger.error("Error fetching credit note:", error)
      throw error
    }
  }

  /**
   * Get all credit notes for a workspace (for reporting)
   */
  async getAllCreditNotes(
    workspaceId: string,
    options?: {
      startDate?: Date
      endDate?: Date
      customerId?: string
    }
  ): Promise<CreditNoteWithOrder[]> {
    try {
      const where: Record<string, unknown> = {
        order: {
          workspaceId,
        },
      }

      if (options?.startDate || options?.endDate) {
        where.createdAt = {}
        if (options.startDate) {
          (where.createdAt as Record<string, Date>).gte = options.startDate
        }
        if (options.endDate) {
          (where.createdAt as Record<string, Date>).lte = options.endDate
        }
      }

      if (options?.customerId) {
        (where.order as Record<string, unknown>).customerId = options.customerId
      }

      const creditNotes = await prisma.creditNote.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderCode: true,
              status: true,
              totalAmount: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      return creditNotes
    } catch (error) {
      logger.error("Error fetching all credit notes:", error)
      throw error
    }
  }

  /**
   * Calculate total credit notes amount for an order
   */
  async getTotalCreditNotesForOrder(orderId: string): Promise<number> {
    const result = await prisma.creditNote.aggregate({
      where: { orderId },
      _sum: { amount: true },
    })
    return result._sum.amount || 0
  }

  /**
   * Delete a credit note
   */
  async deleteCreditNote(
    creditNoteId: string,
    workspaceId: string
  ): Promise<void> {
    try {
      // Verify credit note exists and belongs to workspace
      const creditNote = await prisma.creditNote.findFirst({
        where: {
          id: creditNoteId,
          order: {
            workspaceId,
          },
        },
      })

      if (!creditNote) {
        throw new Error("Nota di credito non trovata")
      }

      await prisma.creditNote.delete({
        where: { id: creditNoteId },
      })

      logger.info("Credit note deleted:", {
        creditNoteId,
        creditNoteCode: creditNote.creditNoteCode,
      })
    } catch (error) {
      logger.error("Error deleting credit note:", error)
      throw error
    }
  }
}
