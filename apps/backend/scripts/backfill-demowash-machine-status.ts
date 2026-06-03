/**
 * Backfill: inject the internal "machine status" line into EXISTING demowash
 * conversations, so old chats also show it (not only new ones).
 *
 * For each conversation of the demowash workspace, we try to read from the
 * dialogue: location (sede), machine type (lavadora/secadora), machine number,
 * and the display code the customer reported. We then append an internal
 * operator block to the assistant turn that immediately FOLLOWS the user's
 * machine-number message:
 *
 *     **👤 Human Support message**
 *     📟 Estado máquina: <sede> > <lavadora|secadora> > Núm <N> = <CODE>
 *
 * The frontend already splits assistant content on the `👤 Human Support
 * message` marker and renders the part after it as the internal orange balloon
 * (never delivered to the customer).
 *
 * SAFE BY DEFAULT: dry-run. It only prints what it would change.
 * Pass --apply to actually write. Idempotent: skips messages that already
 * contain the 📟 line.
 *
 * Run (from project root):
 *   dotenv -e .env -- tsx apps/backend/scripts/backfill-demowash-machine-status.ts
 *   dotenv -e .env -- tsx apps/backend/scripts/backfill-demowash-machine-status.ts --apply
 *   dotenv -e .env -- tsx apps/backend/scripts/backfill-demowash-machine-status.ts --slug demowash --apply
 */

import { prisma } from "@echatbot/database"

const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? undefined : args[i + 1]
}
const CHATBOT_ID = flag("slug") || "demowash"

const HUMAN_SUPPORT_MARKER = "**👤 Human Support message**"

// Canonical sedes (latin, with accents). Matched case-insensitively + accent-insensitively.
const LOCATIONS = ["Mataró", "Eixample", "Gràcia", "Sant Cugat", "Rubí", "Terrassa"]
// Display codes — ORDER MATTERS: check the longer/specific ones first so
// "OPEN ERROR"/"OPEN DOOR" are not swallowed by "OPEN".
const CODES = ["OPEN ERROR", "OPEN DOOR", "ALERT OPEN", "ERR-01", "ALERT", "BLOCK", "OPEN", "OFF"]

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

function findLocation(text: string): string | null {
  const t = norm(text)
  for (const loc of LOCATIONS) if (t.includes(norm(loc))) return loc
  return null
}
function findMachineType(text: string): "lavadora" | "secadora" | null {
  const t = norm(text)
  if (/\b(secadora|asciugatrice|dryer|s[eè]che)/.test(t)) return "secadora"
  if (/\b(lavadora|lavatrice|washer|machine[ -]?(?:a|à) laver|wasch)/.test(t)) return "lavadora"
  return null
}
function findCode(text: string): string | null {
  const up = text.toUpperCase()
  for (const c of CODES) if (up.includes(c)) return c
  return null
}
// Machine number: a bare number, "la 5", "lavadora 5", "número 5", "la nº 5"...
function findMachineNumber(text: string): number | null {
  const m =
    text.match(/\b(?:n[ºo°.]?\s*|la\s+|num(?:ero|ber)?\s+|máquina\s+|machine\s+)?(\d{1,2})\b/i)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) && n > 0 && n < 100 ? n : null
}

async function main() {
  const ws = await (prisma as any).workspace.findFirst({
    where: { customChatbotId: CHATBOT_ID },
    select: { id: true, name: true, slug: true },
  })
  if (!ws) {
    console.error(`❌ No workspace with customChatbotId="${CHATBOT_ID}". Try --slug.`)
    process.exit(1)
  }
  console.log(`🏢 Workspace: ${ws.name || ws.slug} (${ws.id})  apply=${APPLY}`)

  const msgs = await prisma.conversationMessage.findMany({
    where: { workspaceId: ws.id, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, conversationId: true, role: true, content: true },
  })

  // Group by conversation, preserving chronological order.
  const byConv = new Map<string, typeof msgs>()
  for (const m of msgs) {
    const arr = byConv.get(m.conversationId)
    if (arr) arr.push(m)
    else byConv.set(m.conversationId, [m])
  }

  let touched = 0
  let skipped = 0

  for (const [convId, turns] of byConv) {
    // Aggregate facts across the whole conversation (later mentions win).
    let location: string | null = null
    let machineType: "lavadora" | "secadora" | null = null
    let code: string | null = null
    for (const t of turns) {
      location = findLocation(t.content) || location
      machineType = findMachineType(t.content) || machineType
      code = findCode(t.content) || code
    }

    // Find the user message giving the machine number, and the assistant turn
    // that immediately follows it (our injection target).
    let machine: number | null = null
    let target: (typeof turns)[number] | null = null
    for (let i = 0; i < turns.length; i++) {
      if (turns[i].role !== "user") continue
      const n = findMachineNumber(turns[i].content)
      if (n == null) continue
      // next assistant turn after this user message
      const next = turns.slice(i + 1).find((x) => x.role === "assistant")
      if (next) {
        machine = n
        target = next
      }
    }

    if (!location || !machine || !target) {
      skipped++
      continue
    }
    if (target.content.includes("📟 Estado máquina")) {
      skipped++
      continue // already backfilled
    }

    const label = machineType || "lavadora"
    const status = code || "OPEN"
    const line = `📟 Estado máquina: ${location} > ${label} > Núm ${machine} = ${status}`

    // If the target already has a Human Support block, insert the line right
    // after the marker; otherwise append a fresh block.
    let newContent: string
    if (target.content.includes(HUMAN_SUPPORT_MARKER)) {
      newContent = target.content.replace(
        HUMAN_SUPPORT_MARKER,
        `${HUMAN_SUPPORT_MARKER}\n${line}`
      )
    } else {
      newContent = `${target.content.trimEnd()}\n\n${HUMAN_SUPPORT_MARKER}\n${line}`
    }

    console.log(`\n• conv ${convId.slice(0, 8)}  →  ${line}`)
    if (APPLY) {
      await prisma.conversationMessage.update({
        where: { id: target.id },
        data: { content: newContent },
      })
    }
    touched++
  }

  console.log(
    `\n${APPLY ? "✅ Applied" : "🔎 Dry-run"}: ${touched} conversations to update, ${skipped} skipped.`
  )
  if (!APPLY && touched > 0) console.log("Re-run with --apply to write the changes.")
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error("Backfill failed:", e)
  await prisma.$disconnect()
  process.exit(1)
})
