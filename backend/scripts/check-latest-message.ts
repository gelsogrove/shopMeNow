import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function checkLatestMessage() {
  try {
    // Get the latest OUTBOUND message
    const latestMessage = await prisma.message.findFirst({
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
    })

    if (!latestMessage) {
      console.log("❌ No messages found")
      return
    }

    console.log("📨 Latest OUTBOUND Message:")
    console.log("   ID:", latestMessage.id)
    console.log("   Created:", latestMessage.createdAt)
    console.log("   Content preview:", latestMessage.content?.substring(0, 100))
    console.log("\n📋 Metadata:")

    const metadata = latestMessage.metadata as any
    console.log("   Has metadata:", !!metadata)
    console.log("   Has debugInfo:", !!metadata?.debugInfo)
    console.log("   Has steps:", !!metadata?.debugInfo?.steps)

    if (metadata?.debugInfo?.steps) {
      console.log("\n🔍 Debug Steps:")
      metadata.debugInfo.steps.forEach((step: any, index: number) => {
        console.log(`\n   Step ${index + 1}:`)
        console.log("      agentType:", step.agentType)
        console.log("      action:", step.action)
        console.log("      Has input:", !!step.input)
        console.log("      Has output:", !!step.output)
        console.log("      Has systemPrompt:", !!step.systemPrompt)

        if (step.systemPrompt) {
          console.log("      systemPrompt length:", step.systemPrompt.length)
          console.log(
            "      systemPrompt preview:",
            step.systemPrompt.substring(0, 150)
          )
        }
      })
    }
  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkLatestMessage()
