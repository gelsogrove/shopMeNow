// Use shared Prisma client from database package (includes auto-retry Proxy)
import { prisma, Prisma, PlanType, CampaignFrequency, CampaignTargetType, PushCampaignStatus, PushCampaignRecipientStatus, SubscriptionStatus } from '@echatbot/database'

// Re-export for use in scheduler jobs
export { prisma, Prisma, PlanType, CampaignFrequency, CampaignTargetType, PushCampaignStatus, PushCampaignRecipientStatus, SubscriptionStatus }

/**
 * Connects to the database with retry logic.
 * This actually tests the connection by running a query, not just calling $connect().
 * Critical for Docker environments where PostgreSQL may start after the scheduler.
 */
export async function connectDatabase(): Promise<void> {
  const MAX_RETRIES = 10
  const RETRY_DELAY_MS = 3000
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Actually test the connection with a real query
      await prisma.$queryRaw(Prisma.sql`SELECT 1 as healthcheck`)
      console.log('✅ Database connected')
      return
    } catch (error: any) {
      const errorCode = error?.code || 'UNKNOWN'
      const isConnectionError = errorCode === 'ECONNREFUSED' || 
                                errorCode === 'ENOTFOUND' ||
                                errorCode === 'ETIMEDOUT' ||
                                error?.message?.includes('ECONNREFUSED')
      
      if (isConnectionError && attempt < MAX_RETRIES) {
        console.log(`⏳ Database not ready (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS/1000}s...`)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      } else if (attempt === MAX_RETRIES) {
        console.error(`❌ Database connection failed after ${MAX_RETRIES} attempts:`, error)
        process.exit(1)
      } else {
        // Non-connection error, fail immediately
        console.error('❌ Database connection failed:', error)
        process.exit(1)
      }
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
  console.log('Database disconnected')
}
