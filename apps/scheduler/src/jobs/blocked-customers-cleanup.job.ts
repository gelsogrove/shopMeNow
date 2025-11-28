import { prisma } from '../config/database'
import logger from '../utils/logger'

/**
 * Blocked Customers Cleanup Job
 * Runs every 3 days at 23:01
 * Deletes conversations of blacklisted customers
 */
export async function blockedCustomersCleanupJob(): Promise<void> {
  // Find all blacklisted customers
  const blockedCustomers = await prisma.customers.findMany({
    where: {
      isBlacklisted: true,
    },
    select: {
      id: true,
      workspaceId: true,
    },
  })

  if (blockedCustomers.length === 0) {
    logger.info('No blocked customers found')
    return
  }

  let totalDeleted = 0

  for (const customer of blockedCustomers) {
    // Delete chat sessions and related data
    const deletedSessions = await prisma.chatSession.deleteMany({
      where: {
        customerId: customer.id,
        workspaceId: customer.workspaceId,
      },
    })

    totalDeleted += deletedSessions.count
  }

  logger.info(`Deleted ${totalDeleted} chat sessions from ${blockedCustomers.length} blocked customers`)
}
