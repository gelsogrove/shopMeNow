/**
 * Fixes step C.2 of the AmRobots Main Prompt (Andrea, 2026-08-08).
 *
 * Seen live: "ho un errore 003, un strano rumore nella parte dietro" →
 * the bot asked for the serial, then asked WHEN it started, and only two
 * turns later asked the customer to describe the problem he had already
 * described in his very first message. Andrea: "dopo che ho detto il
 * problema me lo ha richiesto... non mi sembra naturale".
 *
 * Cause: C.2 said "Ask WHEN the problem started" but instructed the model to
 * save TWO fields from that one question — problemDescription never had a
 * question of its own. gate.ts's INTAKE_ORDER, however, is
 * [serialNumber, problemDescription, problemStartedWhen]: description comes
 * FIRST. The model followed the prompt, skipped the description, and the
 * gate then dictated its question late, out of context.
 *
 * The fix splits C.2 into two ordered steps matching INTAKE_ORDER, and makes
 * explicit that a description already given (an error code, a symptom) is
 * saved with remember, never asked for again. This is the prompt half; the
 * code half (gate.ts allowing remember on the intake hop) is what makes it a
 * guarantee rather than a request — CLAUDE.md §16.
 *
 * Rewrites ONLY section C, matched verbatim. Refuses if the current text is
 * not exactly what is expected, so it can never clobber a hand-edit.
 *
 * Run with:
 *   DATABASE_URL="$(heroku config:get DATABASE_URL -a echatbot-app)" npx tsx scripts/update-amrobots-intake-prompt.ts
 */
import { prisma } from "@echatbot/database"

const WORKSPACE_ID = "5870e678-e610-46d1-b85c-36f76f2de95a"

const OLD_STEPS = `1. Ask for the **serial number**. Save it with \`remember({key:'serialNumber', ...})\` — the tool itself validates the format and tells you if it's wrong; if the customer fails 3 times, stop asking and move to the pre-operator checks.
2. Ask **when the problem started**. Save it with \`remember({key:'problemDescription', ...})\` for what's wrong and \`remember({key:'problemStartedWhen', ...})\` for when.
3. Look for a flow in AVAILABLE FLOWS that matches the problem described.`

const NEW_STEPS = `1. Ask for the **serial number**. Save it with \`remember({key:'serialNumber', ...})\` — the tool itself validates the format and tells you if it's wrong; if the customer fails 3 times, stop asking and move to the pre-operator checks.
2. Make sure you have **what is wrong** — saved with \`remember({key:'problemDescription', ...})\`. Usually the customer has ALREADY told you in their first message: an error code, a noise, a light, the robot not moving. When they have, save it with \`remember\` as soon as a tool call is available and do NOT ask them to describe it again — re-asking something they just told you is the single thing that most makes this conversation feel robotic. Ask only when they truly said nothing about what is wrong.
3. Ask **when the problem started**. Save it with \`remember({key:'problemStartedWhen', ...})\`. This comes AFTER the description, never before it.
4. Look for a flow in AVAILABLE FLOWS that matches the problem described.`

async function main() {
  const w = await prisma.workspace.findUnique({
    where: { id: WORKSPACE_ID },
    select: { customChatbotSystemPrompt: true },
  })
  const current = w?.customChatbotSystemPrompt
  if (!current) throw new Error("no customChatbotSystemPrompt on workspace")

  if (current.includes(NEW_STEPS)) {
    console.log("ALREADY APPLIED — nothing to do")
    return
  }

  const occurrences = current.split(OLD_STEPS).length - 1
  if (occurrences !== 1) {
    throw new Error(
      `expected exactly 1 occurrence of the old C.1–C.3 block, found ${occurrences} — ` +
        "the prompt has been edited by hand; re-read it before running this again"
    )
  }

  const updated = current.replace(OLD_STEPS, NEW_STEPS)

  await prisma.workspace.update({
    where: { id: WORKSPACE_ID },
    data: { customChatbotSystemPrompt: updated },
  })

  console.log("UPDATED workspace:", WORKSPACE_ID)
  console.log("LEN", current.length, "→", updated.length)
}

main()
  .catch((err) => {
    console.error("ERR:", err?.message || err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
