import { prisma } from '../config/database'
import logger from '../utils/logger'
import { Decimal } from '../../generated/prisma/client/runtime/library'
import { PlanType } from '../../generated/prisma/client'

/**
 * Monthly Billing Job
 * Runs on the 1st of each month at 12:00
 * Charges monthly fee from workspace credit balance
 * 
 * Uses PlanConfiguration to get the monthlyFee for each plan type
 * Creates BillingTransaction records for audit trail
 */
export async function monthlyBillingJob(): Promise<void> {
  // Get all active workspaces (not free trial, not deleted)
  const workspaces = await prisma.workspace.findMany({
    where: {
      isActive: true,
      isDelete: false,
      planType: {
        not: 'FREE_TRIAL',
      },
    },
    select: {
      id: true,
      name: true,
      planType: true,
      creditBalance: true,
    },
  })

  if (workspaces.length === 0) {
    logger.info('No active paid workspaces found')
    return
  }

  // Get all plan configurations (cached once)
  const planConfigs = await prisma.planConfiguration.findMany({
    where: { isActive: true },
  })

  const planConfigMap = new Map(planConfigs.map(c => [c.planType, c]))

  let successCount = 0
  let failedCount = 0

  for (const workspace of workspaces) {
    try {
      // Get plan configuration for this workspace's plan
      const planConfig = planConfigMap.get(workspace.planType as PlanType)
      
      if (!planConfig) {
        logger.error(`No plan configuration found for plan type: ${workspace.planType}`)
        failedCount++
        continue
      }

      const monthlyFee = new Decimal(planConfig.monthlyFee)
      const currentBalance = new Decimal(workspace.creditBalance)

      // Check if sufficient balance
      if (currentBalance.lessThan(monthlyFee)) {
        logger.warn(`Workspace ${workspace.name} has insufficient balance: ${currentBalance} < ${monthlyFee}`)
        
        // Create failed transaction record
        await prisma.billingTransaction.create({
          data: {
            workspaceId: workspace.id,
            type: 'MONTHLY_FEE',
            amount: monthlyFee.negated(),
            balanceAfter: currentBalance, // Balance unchanged
            description: `Monthly fee - FAILED (insufficient balance)`,
          },
        })
        
        failedCount++
        continue
      }

      // Deduct monthly fee - atomic transaction
      const newBalance = currentBalance.minus(monthlyFee)

      await prisma.$transaction([
        prisma.workspace.update({
          where: { id: workspace.id },
          data: { creditBalance: newBalance },
        }),
        prisma.billingTransaction.create({
          data: {
            workspaceId: workspace.id,
            type: 'MONTHLY_FEE',
            amount: monthlyFee.negated(),
            balanceAfter: newBalance,
            description: `Monthly subscription fee - ${new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}`,
          },
        }),
      ])

      logger.info(`Charged ${monthlyFee}€ from workspace ${workspace.name}. New balance: ${newBalance}€`)
      successCount++

    } catch (error) {
      logger.error(`Failed to charge workspace ${workspace.name}:`, error)
      failedCount++
    }
  }

  logger.info(`Monthly billing complete. Success: ${successCount}, Failed: ${failedCount}`)
}
