import { prisma } from "@echatbot/database"

async function main() {
  // Get workspace
  const workspace = await prisma.workspace.findFirst({
    select: {
      id: true,
      name: true,
      operatorWhatsappNumber: true
    }
  })
  
  if (!workspace) {
    console.log('No workspace found')
    process.exit(1)
  }
  
  console.log('\nWorkspace:', workspace.name)
  console.log('operatorWhatsappNumber:', workspace.operatorWhatsappNumber || 'NOT SET')
  
  // If not set, update it
  if (!workspace.operatorWhatsappNumber) {
    console.log('\nUpdating operatorWhatsappNumber to +34654728753...')
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { operatorWhatsappNumber: '+34654728753' }
    })
    console.log('✅ Updated!')
  } else {
    console.log('✅ Already configured')
  }
  
  await prisma.$disconnect()
}

main().catch(console.error)
