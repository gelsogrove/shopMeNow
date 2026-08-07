/**
 * Runs every scenario file in scenarios/ against the real chatbotFn,
 * in-process, against the real AmRobots data on Supabase — never WhatsApp
 * (CLAUDE.md §8). Prints every turn's reply plus a final PASS/FAIL report
 * per scenario, checked against explicit expectations declared in each
 * scenario file (never inferred, never hardcoded per-tenant copy — checks
 * are structural: "a greeting was sent", "escalation happened", "the reply
 * is non-empty", not string-matching a specific sentence).
 *
 * Every scenario's `contractRule` names the exact CONTRACT.md line(s) it
 * exists to verify — a scenario with no traceable rule is not a real test,
 * it's a guess at what might matter.
 *
 * DATABASE_URL/OPENROUTER_API_KEY MUST come from Heroku, never a local DB
 * (Andrea's CONTRACT.md: "never change the DB IN LOCAL always su heroku"):
 *   DATABASE_URL="$(heroku config:get DATABASE_URL -a echatbot-app)" \
 *   OPENROUTER_API_KEY="$(heroku config:get OPENROUTER_API_KEY -a echatbot-app)" \
 *     npx tsx --tsconfig custom-demoam/tsconfig.json custom-demoam/cli/run-scenarios.ts
 *   ...same... custom-demoam/cli/run-scenarios.ts 06-problem-present-in-flow
 *
 * The only thing that stays local is the per-phone session JSON under
 * cli/.demoam-sessions/ — a stand-in for the real host's session
 * store/Redis, never the workspace's FAQs/flows/settings, which always come
 * live from Supabase through the same handlers a real host would use.
 */
import { prisma } from "@echatbot/database"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { runTurn, wipeSession, forceSessionStale } from "./runtime.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCENARIOS_DIR = path.join(__dirname, "scenarios")

interface ScenarioTurn {
  message: string
}

interface Scenario {
  description: string
  /** The exact CONTRACT.md rule(s) this scenario exists to verify — quoted or line-referenced, never paraphrased into something looser. */
  contractRule: string
  phone: string
  /** Host-provided customer name (e.g. WhatsApp profile name), as a real host would pass it — distinct from a name the customer states in chat. Omit to simulate an anonymous/unknown customer. */
  userName?: string
  turns: ScenarioTurn[]
  newSession?: boolean
  reuseSessionFrom?: string
  forceStaleSeconds?: number
  /** After `turns` runs, backdate the session by this many seconds, then run `secondSessionTurns` as a genuinely later conversation on the same phone (staleness/welcome-back testing without needing a second scenario file). */
  thenForceStaleSecondsAndContinue?: number
  secondSessionTurns?: ScenarioTurn[]
  skip?: boolean
  skipReason?: string
  /**
   * Declarative assertions on the FINAL turn's output — checked in addition
   * to the always-on structural checks (non-empty reply, no error). Kept
   * narrow and structural on purpose: `language` reads output.language (the
   * ⟦LANG:xx⟧ tag, already filtered through resolveEnabledLanguage), never a
   * string match on translated text. `replyContains`/`replyExcludes` are for
   * TEST DATA that must appear verbatim regardless of language (a customer
   * name we passed in, an anonymous-visitor placeholder that must never leak
   * to the customer) — not for asserting configured copy (CLAUDE.md §1A).
   */
  expect?: {
    /** output.language on the final turn must equal this ISO 639-1 code. */
    language?: string
    /** Every one of these substrings must appear somewhere in the final turn's reply. */
    replyContains?: string[]
    /** None of these substrings may appear anywhere in the final turn's reply. */
    replyExcludes?: string[]
    /**
     * Every one of these substrings must appear in AT LEAST ONE reply of the
     * whole scenario. For events whose exact turn is not deterministic (the
     * escalation ticket can land one turn earlier or later depending on how
     * the model orders name/flow) — final-turn-only checks made those greens
     * unreliable.
     */
    anyReplyContains?: string[]
  }
}

interface ScenarioOutcome {
  file: string
  description: string
  contractRule: string
  status: "PASS" | "FAIL" | "SKIP"
  checks: Array<{ name: string; ok: boolean; detail?: string }>
  lastReply?: string
}

/** Recursively collects .json scenario paths, relative to SCENARIOS_DIR, so scenarios can be grouped into subfolders (e.g. 01-welcome/, 02-wip-message/). */
function listScenarioFiles(dir: string, prefix = ""): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...listScenarioFiles(path.join(dir, entry.name), relPath))
    } else if (entry.name.endsWith(".json")) {
      files.push(relPath)
    }
  }
  return files
}

async function loadScenarios(filter?: string): Promise<Array<{ file: string; scenario: Scenario }>> {
  const files = listScenarioFiles(SCENARIOS_DIR)
    .filter((f) => !filter || f.includes(filter))
    .sort()
  return files.map((file) => ({
    file,
    scenario: JSON.parse(fs.readFileSync(path.join(SCENARIOS_DIR, file), "utf8")),
  }))
}

/**
 * Structural checks only — never string-matches a specific configured
 * sentence (that would break the moment Andrea edits settings.json/DB copy,
 * CLAUDE.md §1A). Each check inspects OUTPUT SHAPE and STATE, the same
 * things the runtime itself guarantees deterministically.
 */
function checkNoEmptyReply(replies: string[]): { name: string; ok: boolean; detail?: string } {
  const empties = replies.filter((r) => !r || !r.trim()).length
  return { name: "no empty reply on any turn", ok: empties === 0, detail: empties > 0 ? `${empties} empty reply(ies)` : undefined }
}

function checkNoErrorField(errors: Array<string | undefined>): { name: string; ok: boolean; detail?: string } {
  const withError = errors.filter(Boolean)
  return { name: "no chatbotFn error", ok: withError.length === 0, detail: withError.join("; ") || undefined }
}

function checkLanguage(actual: string | undefined, expected: string): { name: string; ok: boolean; detail?: string } {
  return {
    name: `output.language is "${expected}"`,
    ok: actual === expected,
    detail: actual !== expected ? `got "${actual ?? "(unset)"}"` : undefined,
  }
}

function checkReplyContains(reply: string, needle: string): { name: string; ok: boolean; detail?: string } {
  return {
    name: `reply contains "${needle}"`,
    ok: reply.includes(needle),
    detail: reply.includes(needle) ? undefined : "not found in final reply",
  }
}

function checkAnyReplyContains(replies: string[], needle: string): { name: string; ok: boolean; detail?: string } {
  const ok = replies.some((r) => r.includes(needle))
  return {
    name: `some reply contains "${needle}"`,
    ok,
    detail: ok ? undefined : "not found in any reply of the scenario",
  }
}

function checkReplyExcludes(reply: string, needle: string): { name: string; ok: boolean; detail?: string } {
  return {
    name: `reply does not contain "${needle}"`,
    ok: !reply.includes(needle),
    detail: reply.includes(needle) ? "found in final reply" : undefined,
  }
}

async function runScenario(file: string, scenario: Scenario): Promise<ScenarioOutcome> {
  const group = path.dirname(file) !== "." ? path.dirname(file) : undefined
  if (scenario.skip) {
    return {
      file,
      description: scenario.description,
      contractRule: scenario.contractRule,
      status: "SKIP",
      checks: [{ name: scenario.skipReason ?? "skipped", ok: true }],
    }
  }

  if (scenario.newSession) wipeSession(scenario.phone, group)

  if (scenario.forceStaleSeconds) {
    forceSessionStale(scenario.phone, scenario.forceStaleSeconds, group)
  }

  const replies: string[] = []
  const errors: Array<string | undefined> = []
  let lastOutput: Awaited<ReturnType<typeof runTurn>>["output"] | undefined

  for (const turn of scenario.turns) {
    const { output } = await runTurn({ phone: scenario.phone, message: turn.message, userName: scenario.userName, group })
    lastOutput = output
    replies.push(output.reply ?? "")
    errors.push(output.error)
    console.log(`  [${scenario.phone}] "${turn.message}"`)
    console.log(`    -> ${(output.reply ?? "(empty)").split("\n").join("\n       ")}`)
    if (output.error) console.log(`    !! error: ${output.error}`)
  }

  if (scenario.thenForceStaleSecondsAndContinue && scenario.secondSessionTurns?.length) {
    forceSessionStale(scenario.phone, scenario.thenForceStaleSecondsAndContinue, group)
    console.log(`  [${scenario.phone}] — session backdated ${scenario.thenForceStaleSecondsAndContinue}s, continuing as a later conversation —`)
    for (const turn of scenario.secondSessionTurns) {
      const { output } = await runTurn({ phone: scenario.phone, message: turn.message, userName: scenario.userName, group })
      lastOutput = output
      replies.push(output.reply ?? "")
      errors.push(output.error)
      console.log(`  [${scenario.phone}] "${turn.message}"`)
      console.log(`    -> ${(output.reply ?? "(empty)").split("\n").join("\n       ")}`)
      if (output.error) console.log(`    !! error: ${output.error}`)
    }
  }

  const checks = [checkNoEmptyReply(replies), checkNoErrorField(errors)]

  if (scenario.expect) {
    const finalReply = lastOutput?.reply ?? ""
    if (scenario.expect.language) {
      checks.push(checkLanguage(lastOutput?.language, scenario.expect.language))
    }
    for (const needle of scenario.expect.replyContains ?? []) {
      checks.push(checkReplyContains(finalReply, needle))
    }
    for (const needle of scenario.expect.replyExcludes ?? []) {
      checks.push(checkReplyExcludes(finalReply, needle))
    }
    for (const needle of scenario.expect.anyReplyContains ?? []) {
      checks.push(checkAnyReplyContains(replies, needle))
    }
  }

  const status: ScenarioOutcome["status"] = checks.every((c) => c.ok) ? "PASS" : "FAIL"

  return {
    file,
    description: scenario.description,
    contractRule: scenario.contractRule,
    status,
    checks,
    lastReply: lastOutput?.reply ?? undefined,
  }
}

async function main() {
  const filter = process.argv[2]
  const scenarios = await loadScenarios(filter)
  if (scenarios.length === 0) {
    console.error(filter ? `No scenario file matches "${filter}"` : "No scenario files found")
    process.exit(1)
  }

  console.log(`Running ${scenarios.length} demoam scenario(s) against AmRobots (real DB, real LLM, in-process — no WhatsApp)\n`)

  const outcomes: ScenarioOutcome[] = []
  for (const { file, scenario } of scenarios) {
    console.log(`\n═══ ${file} — ${scenario.description} ═══`)
    console.log(`  contract: ${scenario.contractRule}`)
    const outcome = await runScenario(file, scenario)
    outcomes.push(outcome)
    console.log(`  [${outcome.status}] ${outcome.checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.name}${c.detail ? ` (${c.detail})` : ""}`).join(", ")}`)
  }

  console.log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("SCENARIO REPORT — mapped to CONTRACT.md")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  for (const o of outcomes) {
    const icon = o.status === "PASS" ? "✅" : o.status === "SKIP" ? "⏭️ " : "❌"
    console.log(`${icon} ${o.file} — ${o.status}`)
    console.log(`   contract: ${o.contractRule}`)
  }
  const passed = outcomes.filter((o) => o.status === "PASS").length
  const failed = outcomes.filter((o) => o.status === "FAIL").length
  const skipped = outcomes.filter((o) => o.status === "SKIP").length
  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped (of ${outcomes.length})`)

  if (failed > 0) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
