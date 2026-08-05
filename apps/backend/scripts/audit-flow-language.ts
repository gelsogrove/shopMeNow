/**
 * Audits every flow's customer-facing text for non-English content
 * (Andrea, 2026-08-06: "tutti i flussi nel db devono essere in inglese").
 *
 * READ-ONLY. It reports; it never writes. Translating is a separate,
 * reviewed step — flow questions are the tenant's own copy, and some were
 * edited from the UI, so nothing gets rewritten without Andrea seeing the
 * list first.
 *
 * Detection is deliberately crude: a wordlist of high-frequency Italian
 * function words that essentially never appear in English text. This is a
 * triage aid to shortlist rows for a human to read, NOT a language
 * classifier — it flags candidates, and the report prints the full string
 * so the call is made by eye.
 *
 * Run from apps/backend with a DATABASE_URL pointing at the target DB:
 *   npx dotenv -e ../../.env -- tsx scripts/audit-flow-language.ts
 */
import { prisma } from "@echatbot/database"

// Function words, not content words: "robot" and "wifi" are identical in both
// languages, whereas "il/che/una" cannot occur in an English sentence.
const ITALIAN_MARKERS = [
  "il", "lo", "la", "gli", "le", "un", "uno", "una",
  "che", "chi", "cui", "non", "per", "con", "sul", "sulla", "nel", "nella",
  "del", "della", "dei", "delle", "dal", "dalla", "al", "alla", "ai", "alle",
  "sono", "sei", "siamo", "siete", "essere", "stato", "questa", "questo",
  "quale", "quali", "come", "dove", "quando", "perche", "perché",
  "tuo", "tua", "suo", "sua", "mio", "mia", "nostro", "vostra",
  "puoi", "posso", "vuoi", "voglio", "devi", "devo", "adesso", "ora",
  "grazie", "prego", "ciao", "salve", "attiva", "attivo", "acceso", "accesa",
  "spento", "spenta", "batteria", "carica", "prima", "dopo", "ancora",
]

const MARKER_SET = new Set(ITALIAN_MARKERS)

function italianMarkersIn(text: string | null | undefined): string[] {
  if (!text) return []
  const words = text.toLowerCase().match(/[a-zàèéìòóù]+/g) ?? []
  return Array.from(new Set(words.filter((w) => MARKER_SET.has(w))))
}

type Suspect = { flow: string; field: string; text: string; markers: string[] }

async function main() {
  const url = process.env.DATABASE_URL ?? ""
  console.log("DB:", url.replace(/\/\/[^@]*@/, "//***@").split("?")[0])

  const flows = await prisma.flow.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      keywords: true,
      workspace: { select: { name: true } },
      nodes: {
        select: {
          id: true,
          question: true,
          outgoingEdges: { select: { id: true, label: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  console.log(`\nScanned ${flows.length} flow(s).\n`)

  const suspects: Suspect[] = []
  for (const f of flows) {
    const where = `${f.workspace?.name ?? "?"} / ${f.title}`
    const check = (field: string, text: string | null | undefined) => {
      const markers = italianMarkersIn(text)
      if (markers.length) suspects.push({ flow: where, field, text: text!, markers })
    }

    check("flow.title", f.title)
    check("flow.description", f.description)
    for (const k of f.keywords) check("flow.keyword", k)
    for (const n of f.nodes) {
      check(`node[${n.id}].question`, n.question)
      for (const e of n.outgoingEdges) check(`edge[${e.id}].label`, e.label)
    }
  }

  if (!suspects.length) {
    console.log("No non-English candidates found.")
    return
  }

  console.log(`${suspects.length} candidate(s) to review:\n`)
  let current = ""
  for (const s of suspects) {
    if (s.flow !== current) {
      console.log(`\n── ${s.flow}`)
      current = s.flow
    }
    console.log(`  ${s.field}`)
    console.log(`     "${s.text}"`)
    console.log(`     markers: ${s.markers.join(", ")}`)
  }
}

main()
  .catch((err) => {
    console.error("ERR:", err?.message || err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
