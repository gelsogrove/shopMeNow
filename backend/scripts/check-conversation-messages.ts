import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function checkConversationMessages() {
  try {
    // Get all messages from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const messages = await prisma.conversationMessage.findMany({
      where: {
        role: "assistant",
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
        debugInfo: true,
        conversationId: true,
        role: true,
      },
      take: 20,
    })

    console.log(`📨 Found ${messages.length} assistant messages in last hour\n`)

    messages.forEach((msg, index) => {
      console.log(`\n${index + 1}. Created: ${msg.createdAt.toISOString()}`)
      console.log(`   ConversationId: ${msg.conversationId}`)
      console.log(`   Content: ${msg.content?.substring(0, 80)}...`)

      const debugInfo = msg.debugInfo
        ? JSON.parse(msg.debugInfo as string)
        : null
      const hasDebugInfo = !!debugInfo
      const hasSteps = !!debugInfo?.steps

      console.log(`   debugInfo: ${hasDebugInfo ? "✅" : "❌"}`)

      if (hasSteps) {
        const stepsCount = debugInfo.steps.length
        console.log(`   Steps: ${stepsCount}`)

        let hasSystemPrompt = false
        debugInfo.steps.forEach((step: any) => {
          console.log(`      Step: ${step.agentType || step.type}`)
          if (step.systemPrompt) {
            hasSystemPrompt = true
            console.log(
              `         ✅ systemPrompt: ${step.systemPrompt.substring(0, 100)}...`
            )
          } else {
            console.log(`         ❌ NO systemPrompt`)
          }
        })

        console.log(
          `   HAS SYSTEM PROMPT: ${hasSystemPrompt ? "✅ YES!" : "❌ NO"}`
        )
      }
    })
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkConversationMessages()
