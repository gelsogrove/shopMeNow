import { prisma, Prisma } from '../config/database'
import logger from '../utils/logger'

/**
 * Billing Service for Scheduler
 * 
 * Handles credit deduction for WhatsApp messages processed by the queue
 * 
 * CRITICAL: All operations are atomic (using Prisma transactions)
 * SECURITY: Always validates workspaceId
 */
export class BillingService {
  
  /**
   * Deduct credit for a sent message
   * 
   * @param workspaceId - The workspace to deduct from
   * @param messageId - Optional message ID for transaction reference
   * @returns Result with success status and new balance
   */
  async deductMessageCredit(
    workspaceId: string,
    messageId?: string
  ): Promise<{ 
    success: boolean
    newBalance?: number
    amountDeducted?: number
    error?: string 
  }> {
    try {
      // Get plan configuration for message cost
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId, deletedAt: null }, // CRITICAL: Exclude soft-deleted workspaces
        select: { 
          creditBalance: true, 
          planType: true,
          name: true,
        },
      })

      if (!workspace) {
        return { success: false, error: 'Workspace not found or deleted' }
      }

      // Get message cost from plan configuration
      const planConfig = await prisma.planConfiguration.findUnique({
        where: { planType: workspace.planType },
        select: { messageCost: true },
      })

      if (!planConfig) {
        return { success: false, error: 'Plan configuration not found' }
      }

      const messageCost = Number(planConfig.messageCost)
      const currentBalance = Number(workspace.creditBalance)

      // Check if sufficient balance
      if (currentBalance < messageCost) {
        logger.warn(`[Billing] ⚠️ Insufficient credit for workspace ${workspace.name}: €${currentBalance.toFixed(2)} < €${messageCost.toFixed(2)}`)
        return { 
          success: false, 
          error: `Insufficient credit. Balance: €${currentBalance.toFixed(2)}, Required: €${messageCost.toFixed(2)}` 
        }
      }

      const newBalance = currentBalance - messageCost

      // Atomic transaction: update balance + create transaction record
      await prisma.$transaction(async (tx) => {
        // Update workspace balance
        await tx.workspace.update({
          where: { id: workspaceId },
          data: { creditBalance: new Prisma.Decimal(newBalance.toFixed(2)) },
        })

        // Create transaction record
        await tx.billingTransaction.create({
          data: {
            workspaceId,
            type: 'MESSAGE',
            amount: new Prisma.Decimal((-messageCost).toFixed(2)), // Negative for deductions
            balanceAfter: new Prisma.Decimal(newBalance.toFixed(2)),
            description: 'WhatsApp Message',
            referenceId: messageId,
            referenceType: 'message',
          },
        })
      })

      logger.info(`[Billing] 💰 Deducted €${messageCost.toFixed(2)} from "${workspace.name}": €${currentBalance.toFixed(2)} → €${newBalance.toFixed(2)}`)

      return { 
        success: true, 
        newBalance,
        amountDeducted: messageCost,
      }

    } catch (error) {
      logger.error('[Billing] ❌ Error deducting credit:', error)
      return { 
        success: false, 
        error: (error as Error).message 
      }
    }
  }
}
