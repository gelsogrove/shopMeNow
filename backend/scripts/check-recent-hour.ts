import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function checkRecentMessages() {
  try {
    // Get all OUTBOUND messages from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const messages = await prisma.message.findMany({
      where: {
        direction: "OUTBOUND",
        createdAt: {
          gte: oneHourAgo,
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
        chatSessionId: true,
      },
      take: 20,
    })

    console.log(`📨 Found ${messages.length} OUTBOUND messages in last hour\n`)

    messages.forEach((msg, index) => {
      console.log(`\n${index + 1}. Created: ${msg.createdAt.toISOString()}`)
      console.log(`   ChatSessionId: ${msg.chatSessionId}`)
      console.log(`   Content: ${msg.content?.substring(0, 80)}...`)

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

checkRecentMessages()
