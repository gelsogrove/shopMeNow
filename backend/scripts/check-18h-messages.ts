import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function checkMessageAt18() {
  try {
    // Get messages around 18:02
    const messages = await prisma.message.findMany({
      where: {
        direction: "OUTBOUND",
        createdAt: {
          gte: new Date("2025-11-13T18:00:00Z"),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        createdAt: true,
        content: true,
        metadata: true,
      },
      take: 5,
    })

    console.log(`Found ${messages.length} messages after 18:00\n`)

    messages.forEach((msg, index) => {
      console.log(`\n📨 Message ${index + 1}:`)
      console.log("   ID:", msg.id)
      console.log("   Created:", msg.createdAt)
      console.log("   Content:", msg.content?.substring(0, 80))

      const metadata = msg.metadata as any
      console.log("   Has debugInfo:", !!metadata?.debugInfo)
      console.log("   Has steps:", !!metadata?.debugInfo?.steps)

      if (metadata?.debugInfo?.steps) {
        console.log(`   Steps count: ${metadata.debugInfo.steps.length}`)

        metadata.debugInfo.steps.forEach((step: any, i: number) => {
          console.log(`   Step ${i + 1}: ${step.agentType || step.type}`)
          console.log(`      Has systemPrompt: ${!!step.systemPrompt}`)
        })
      }
    })
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkMessageAt18()
