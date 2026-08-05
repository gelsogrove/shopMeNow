/**
 * Tests the channelActive → wipMessage gate the way it actually runs in
 * production: through CustomClientChatbotService.invoke(), not chatbotFn
 * directly (run-scenarios.ts/runtime.ts call chatbotFn in isolation, which
 * skips this gate entirely — see 02-wip-message/01-wip-message.json).
 *
 * Flips workspace.channelStatus to false on the real AmRobots row, sends one
 * turn, asserts wipMessage came back and chatbotFn was never reached, then
 * restores channelStatus to its original value — always, even on failure.
 *
 * DATABASE_URL/OPENROUTER_API_KEY MUST come from Heroku (Andrea's CONTRACT.md):
 *   DATABASE_URL="$(heroku config:get DATABASE_URL -a echatbot-app)" \
 *   OPENROUTER_API_KEY="$(heroku config:get OPENROUTER_API_KEY -a echatbot-app)" \
 *     npx tsx --tsconfig custom-demoam/tsconfig.json custom-demoam/cli/run-wip-message-test.ts
 */
import { prisma } from "@echatbot/database"
import { createRequire } from "module"
import { AMROBOTS_WORKSPACE_ID } from "./runtime.js"

// custom-demoam is pure ESM ("type": "module"); the backend proper
// (custom-client-chatbot.service.ts) compiles to CommonJS — a static import
// across that boundary fails at runtime ("does not provide an export named
// ..."). createRequire interops the same way ts-node/CJS consumers already
// load this file elsewhere in the backend.
const require = createRequire(import.meta.url)
const { CustomClientChatbotService } = require("../../src/application/services/custom-client-chatbot.service.ts")

const TEST_PHONE = "+391110000201"

async function main() {
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: AMROBOTS_WORKSPACE_ID },
    select: { channelStatus: true, wipMessage: true, customChatbotId: true },
  })
  const originalChannelStatus = workspace.channelStatus

  console.log(`Original channelStatus: ${originalChannelStatus} — flipping to false`)
  await prisma.workspace.update({
    where: { id: AMROBOTS_WORKSPACE_ID },
    data: { channelStatus: false },
  })

  try {
    const service = new CustomClientChatbotService()
    const result = await service.invoke({
      workspaceId: AMROBOTS_WORKSPACE_ID,
      customChatbotId: workspace.customChatbotId,
      userMessage: "ciao, il robot non parte",
      userName: "Test User",
      channel: "whatsapp",
      welcomeMessage: "",
      wipMessage: workspace.wipMessage ?? "",
      channelActive: false,
      debugChannel: true,
      isPlayground: false,
      sessionId: `wip-test-${Date.now()}`,
      phoneNumber: TEST_PHONE,
      history: [],
    })

    console.log("\nresult:", JSON.stringify(result, null, 2))

    const checks = [
      { name: "handled === true", ok: result.handled === true },
      { name: "output.reply === null (no LLM call)", ok: result.output?.reply === null },
      { name: "output.wipMessage is set", ok: !!result.output?.wipMessage },
      { name: "output.wipMessage matches workspace.wipMessage", ok: result.output?.wipMessage === workspace.wipMessage },
    ]

    console.log("\nchecks:")
    for (const c of checks) console.log(`  ${c.ok ? "✓" : "✗"} ${c.name}`)

    const allOk = checks.every((c) => c.ok)
    console.log(`\n${allOk ? "PASS" : "FAIL"}`)
    if (!allOk) process.exitCode = 1
  } finally {
    console.log(`\nRestoring channelStatus to ${originalChannelStatus}`)
    await prisma.workspace.update({
      where: { id: AMROBOTS_WORKSPACE_ID },
      data: { channelStatus: originalChannelStatus },
    })
  }
}

main()
  .catch((err) => {
    console.error("FATAL:", err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
