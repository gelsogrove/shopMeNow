import { prisma } from "@echatbot/database"

async function main() {
  const result = await prisma.workspace.update({
    where: { id: 'f807c095-aa97-4d68-9003-235bbe6d04a0' },
    data: { operatorWhatsappNumber: '+34654728753' }
  })
  
  console.log('✅ Workspace updated:')
  console.log('   ID:', result.id)
  console.log('   Name:', result.name)
  console.log('   operatorWhatsappNumber:', result.operatorWhatsappNumber)
  
  await prisma.$disconnect()
}

main().catch(console.error)
