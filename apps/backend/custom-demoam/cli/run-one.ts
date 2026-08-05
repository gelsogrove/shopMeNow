/**
 * In-process CLI runner for custom-demoam — calls chatbotFn directly, never
 * WhatsApp (CLAUDE.md §8). Lets Andrea script phone+message scenarios and see
 * the real reply, against the real AmRobots data on Supabase, without
 * spending WhatsApp-channel token budget to find out whether a fix actually
 * worked.
 *
 * For a single turn. For a full scripted scenario (multiple turns with
 * expectations), see run-scenarios.ts and scenarios/.
 *
 * Usage:
 *   DATABASE_URL=... OPENROUTER_API_KEY=... npx tsx --tsconfig custom-demoam/tsconfig.json \
 *     custom-demoam/cli/run-one.ts --phone +391112223 --message "ciao non parte il robot"
 *
 *   --new              start a fresh conversation for this phone (wipes its saved session)
 *   --name "Mario"     simulates a known host-side customer name (e.g. returning customer)
 *   --lang it          seeds config.language (simulates the customer's profile language)
 *   --show-state       prints the full session state after the turn (debugging)
 */
import { prisma } from "@echatbot/database"
import { runTurn, wipeSession } from "./runtime.js"

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("--")) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith("--")) {
      out[key] = true
    } else {
      out[key] = next
      i++
    }
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const phone = typeof args.phone === "string" ? args.phone : null
  const message = typeof args.message === "string" ? args.message : null

  if (!phone || !message) {
    console.error("Usage: run-one.ts --phone <number> --message <text> [--new] [--name <name>] [--lang <xx>] [--show-state]")
    process.exit(1)
  }

  if (args.new) {
    wipeSession(phone)
    console.log(`[cli] wiped saved session for ${phone}`)
  }

  const { output, elapsedMs } = await runTurn({
    phone,
    message,
    userName: typeof args.name === "string" ? args.name : undefined,
    language: typeof args.lang === "string" ? args.lang : undefined,
  })

  console.log("")
  console.log(`━━━ ${phone} → "${message}" ━━━`)
  if (output.error) {
    console.log(`[ERROR] ${output.error}`)
  } else {
    console.log(output.reply ?? "(empty reply)")
  }
  console.log("")
  console.log(
    `[meta] tokens=${output.meta.tokensUsed} elapsedMs=${elapsedMs} escalate=${output.shouldEscalate} closeChat=${output.closeChat}` +
      (output.escalationSummary ? ` escalationSummary="${output.escalationSummary}"` : ""),
  )
  if (output.patches?.length) {
    console.log(`[patches] ${JSON.stringify(output.patches)}`)
  }

  if (args["show-state"]) {
    console.log("[persistedState]", JSON.stringify(output.persistedState, null, 2))
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
