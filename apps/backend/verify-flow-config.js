const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
  const configs = await prisma.flowNodeConfig.findMany({
    where: { workspaceId: "cmo03x08v0036vhnghklms44e" },
    select: {
      id: true,
      flowKey: true,
      flowLabel: true,
      isActive: true,
    },
  })

  if (configs.length === 0) {
    console.log("❌ No FlowNodeConfigs found!")
    process.exit(1)
  }

  console.log(`✅ Found ${configs.length} FlowNodeConfigs in Ecolaundry:\n`)
  configs.forEach((c) => {
    console.log(`   ✓ ${c.flowKey}`)
    console.log(`     Label: ${c.flowLabel}`)
    console.log(`     Status: ${c.isActive ? "ACTIVE" : "INACTIVE"}\n`)
  })

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("❌ Error:", e.message)
  process.exit(1)
})
