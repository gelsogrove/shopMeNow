import { prisma } from "@echatbot/database"

async function main() {
  const all = await prisma.workspace.findMany({
    select: { id: true, name: true, customChatbotId: true, customChatbotSystemPrompt: true },
  })
  console.log("total workspaces:", all.length)
  for (const w of all) {
    const sp = w.customChatbotSystemPrompt
    console.log({
      id: w.id,
      name: w.name,
      chatbot: w.customChatbotId,
      active: w.isActive,
      promptLen: sp?.length ?? null,
      hasLabel: sp ? sp.includes("re-check the label") : null,
      hasSerialSection: sp ? sp.includes("# SERIAL NUMBERS") : null,
    })
  }
}

main().finally(() => prisma.$disconnect())
