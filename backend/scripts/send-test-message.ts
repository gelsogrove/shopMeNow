import { PrismaClient } from "@prisma/client"
import axios from "axios"

const prisma = new PrismaClient()

async function sendTestMessage() {
  try {
    const workspaceId = "cm9hjgq9v00014qk8fsdy4ujv" // Bell'Italia
    const customerId = "f6ee6033-465c-4342-98a2-f6ea5d674f71" // Mario Rossi

    console.log('📤 Sending test message: "avete dolci?"')

    // Send message to backend
    const response = await axios.post(
      "http://localhost:3001/api/whatsapp/webhook",
      {
        workspaceId,
        customerId,
        message: "avete dolci?",
        phoneNumber: "+393331234567",
      }
    )

    console.log("✅ Response received")
    console.log("Status:", response.status)

    // Wait a bit for message to be saved
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Check latest message in DB
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
      console.log("❌ No message found")
      return
    }

    console.log("\n📨 Latest Message:")
    console.log("   Created:", latestMessage.createdAt)
    console.log("   Content:", latestMessage.content?.substring(0, 100))

    const metadata = latestMessage.metadata as any
    console.log("\n📋 Debug Info:")
    console.log("   Has debugInfo:", !!metadata?.debugInfo)
    console.log("   Has steps:", !!metadata?.debugInfo?.steps)

    if (metadata?.debugInfo?.steps) {
      console.log("   Number of steps:", metadata.debugInfo.steps.length)

      metadata.debugInfo.steps.forEach((step: any, index: number) => {
        console.log(`\n   Step ${index + 1}: ${step.agentType || step.type}`)
        console.log("      Has systemPrompt:", !!step.systemPrompt)

        if (step.systemPrompt) {
          console.log("      ✅ systemPrompt length:", step.systemPrompt.length)
          console.log("      Preview:", step.systemPrompt.substring(0, 200))
        } else {
          console.log("      ❌ NO systemPrompt!")
        }
      })
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message)
    if (error.response) {
      console.error("   Status:", error.response.status)
      console.error("   Data:", error.response.data)
    }
  } finally {
    await prisma.$disconnect()
  }
}

sendTestMessage()
