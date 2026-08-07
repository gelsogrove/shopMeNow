import { prisma } from "@echatbot/database"

const WORKSPACE_ID = "5870e678-e610-46d1-b85c-36f76f2de95a"

async function main() {
  const w = await prisma.workspace.findUnique({
    where: { id: WORKSPACE_ID },
    select: { customChatbotSystemPrompt: true },
  })
  const s = w?.customChatbotSystemPrompt
  if (!s) throw new Error("no customChatbotSystemPrompt on workspace")

  const i = s.indexOf("### C — Troubleshooting")
  const j = s.indexOf("## Pre-operator checks")
  console.log("LEN", s.length, "IDX_C", i, "IDX_PRE", j)
  console.log("---SECTION C---")
  console.log(s.slice(i, j))
}

main()
  .catch((err) => {
    console.error("ERR:", err?.message || err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
