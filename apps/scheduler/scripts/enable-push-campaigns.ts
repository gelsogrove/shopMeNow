import { prisma } from '../src/config/database'

async function main() {
  console.log('🔧 Enabling Push Campaigns job...')

  const result = await prisma.schedulerJobStatus.upsert({
    where: { jobName: 'push-campaigns' },
    create: {
      jobName: 'push-campaigns',
      isActive: true,
      lastStatus: 'IDLE',
    },
    update: {
      isActive: true,
    },
  })

  console.log('✅ Push Campaigns enabled:', {
    jobName: result.jobName,
    isActive: result.isActive,
    lastStatus: result.lastStatus,
  })

  // Also check the campaign status
  const campaigns = await prisma.pushCampaign.findMany({
    where: { status: 'SCHEDULED' },
    select: {
      id: true,
      name: true,
      status: true,
      sendAt: true,
      nextRunAt: true,
      isActive: true,
    },
  })

  console.log(`\n📋 Found ${campaigns.length} SCHEDULED campaigns:`)
  campaigns.forEach(c => {
    console.log(`  - ${c.name} (${c.id})`)
    console.log(`    Status: ${c.status}, Active: ${c.isActive}`)
    console.log(`    SendAt: ${c.sendAt}, NextRun: ${c.nextRunAt}`)
  })

  await prisma.$disconnect()
}

main().catch(console.error)
