import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function checkSystemPrompt() {
  const lastMessage = await prisma.message.findFirst({
    where: {
      direction: "OUTBOUND",
    },
    orderBy: { createdAt: "desc" },
  })

  if (!lastMessage) {
    console.log("❌ No messages found")
    return
  }

  console.log("📨 Last Message:", lastMessage.id)
  console.log("🕒 Created:", lastMessage.createdAt)

  if (!lastMessage.metadata) {
    console.log("❌ No metadata")
    return
  }

  const metadata =
    typeof lastMessage.metadata === "string"
      ? JSON.parse(lastMessage.metadata)
      : lastMessage.metadata

  console.log("✅ Has metadata")
  console.log("Has debugInfo:", !!metadata.debugInfo)

  if (!metadata.debugInfo?.steps) {
    console.log("❌ No debugInfo.steps")
    return
  }

  console.log("📊 Steps count:", metadata.debugInfo.steps.length)

  const subAgentStep = metadata.debugInfo.steps.find(
    (s: any) => s.type === "sub_agent"
  )

  if (!subAgentStep) {
    console.log("❌ No sub_agent step found")
    console.log(
      "Available steps:",
      metadata.debugInfo.steps.map((s: any) => s.type)
    )
    return
  }

  console.log("\n=== SUB-AGENT STEP ===")
  console.log("Agent:", subAgentStep.agent)
  console.log("Has systemPrompt:", !!subAgentStep.systemPrompt)

  if (subAgentStep.systemPrompt) {
    console.log("✅ SystemPrompt length:", subAgentStep.systemPrompt.length)
    console.log("\nFirst 500 chars:")
    console.log(subAgentStep.systemPrompt.substring(0, 500))
    console.log("...")
  } else {
    console.log("❌ NO systemPrompt field!")
  }

  await prisma.$disconnect()
}

checkSystemPrompt().catch(console.error)
