/**
 * Script to enable Push Campaigns job in scheduler
 * Run with: npx ts-node scripts/enable-push-campaigns.ts
 */

import { prisma } from '../src/config/database'

async function main() {
  console.log('🔧 Enabling Push Campaigns job...')

  const result = await prisma.schedulerJobStatus.upsert({
    where: { jobName: 'push-campaigns' },
    create: {
      jobName: 'push-campaigns',
      isActive: true,
      lastStatus: 'IDLE',
      schedule: '0 * * * * *', // every minute
    },
    update: {
      isActive: true,
    },
  })

  console.log('✅ Push Campaigns job enabled:', result)

  await prisma.$disconnect()
}

main()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
