import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function checkLatest10Messages() {
  try {
    const messages = await prisma.message.findMany({
      where: {
        direction: "OUTBOUND",
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
      take: 10,
    })

    console.log(`📨 Latest 10 OUTBOUND messages:\n`)

    messages.forEach((msg, index) => {
      console.log(`\n${index + 1}. Created: ${msg.createdAt.toISOString()}`)
      console.log(`   ID: ${msg.id.substring(0, 20)}...`)
      console.log(`   Content: ${msg.content?.substring(0, 60)}...`)

      const metadata = msg.metadata as any
      const hasDebugInfo = !!metadata?.debugInfo
      const hasSteps = !!metadata?.debugInfo?.steps

      console.log(`   debugInfo: ${hasDebugInfo ? "✅" : "❌"}`)

      if (hasSteps) {
        const stepsCount = metadata.debugInfo.steps.length
        console.log(`   Steps: ${stepsCount}`)

        let hasSystemPrompt = false
        metadata.debugInfo.steps.forEach((step: any) => {
          if (step.systemPrompt) {
            hasSystemPrompt = true
          }
        })

        console.log(
          `   systemPrompt: ${hasSystemPrompt ? "✅ FOUND!" : "❌ MISSING"}`
        )
      }
    })
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkLatest10Messages()
