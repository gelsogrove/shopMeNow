// Import from shared database package
import { prisma, Prisma, PlanType, CampaignFrequency } from '@echatbot/database'

export { prisma, Prisma, PlanType, CampaignFrequency }

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect()
    console.log('✅ Database connected')
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    process.exit(1)
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
  console.log('Database disconnected')
}
