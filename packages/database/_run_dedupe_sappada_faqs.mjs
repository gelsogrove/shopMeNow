// FAQ dedupe for demosappada (Andrea, 2026-09-01: "non voglio doppioni" +
// "ma lancialo tu").
//
// The reviewed SQL's predicate (record name anywhere in question OR answer)
// over-matched on the dry-run: 96/145 FAQs, including safety, history and
// culture entries that merely MENTION a place in their answer. Refined rule:
//
//   DELETE when the FAQ's SUBJECT is a structured record — the record's name
//   appears in the QUESTION ("Com'è l'escursione al Passo Elbel?") — these
//   are true duplicates of tourist_* detail cards;
//   DELETE the category-index FAQs now replaced by the generated index cards
//   ("Quali eventi ci sono?", "Quali rifugi?", ...);
//   KEEP everything that matches only in the ANSWER (safety, history,
//   culture), plus two by-hand exceptions where a record name sits in the
//   question but the subject is something else (the "Sorgenti del Piave"
//   CHOIR concert; the Palco Vaia in Val Visdende).
//
// Deleted rows are dumped to _sappada_faqs_deleted_backup.json BEFORE the
// delete, so the operation is reversible.
//
// Usage:
//   node _run_dedupe_sappada_faqs.mjs            # dry-run
//   node _run_dedupe_sappada_faqs.mjs --apply    # backup + delete
import { writeFileSync } from "node:fs"
import { PrismaClient } from "./src/generated/prisma/index.js"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const WS = process.env.WORKSPACE_ID || "7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c"
// DATABASE_URL, or the production one from Heroku when unset (never printed).
const { execFileSync } = await import("node:child_process")
const DB_URL =
  process.env.DATABASE_URL ||
  execFileSync("heroku", ["config:get", "DATABASE_URL", "-a", "echatbot-app"], { encoding: "utf8" }).trim()
const pool = new Pool({
  connectionString: DB_URL,
  ssl: DB_URL.includes("localhost") ? undefined : { rejectUnauthorized: false },
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// FAQs whose question contains one of these stay, even though a record name
// appears in it: the subject is NOT the record.
const KEEP_EXCEPTIONS = ["concerto del coro", "palco vaia"]

// Index FAQs replaced by the generated per-category index cards
// (tourist-index-cards.ts) — kept in the DB they would be doppioni of those.
const INDEX_REPLACED = [
  "quali eventi e manifestazioni ci sono",
  "quali rifugi ci sono a sappada",
  "dove posso mangiare a sappada",
  "che escursioni e sentieri posso fare",
  "si può sciare a sappada",
  "c'è un campo da golf a sappada",
]

async function main() {
  const [restaurants, hotels, excursions, refuges, apartments, events, sports, ski] =
    await Promise.all([
      prisma.touristRestaurant.findMany({ where: { workspaceId: WS }, select: { name: true } }),
      prisma.touristHotel.findMany({ where: { workspaceId: WS }, select: { name: true } }),
      prisma.touristExcursion.findMany({ where: { workspaceId: WS }, select: { name: true } }),
      prisma.touristRefuge.findMany({ where: { workspaceId: WS }, select: { name: true } }),
      prisma.touristApartment.findMany({ where: { workspaceId: WS }, select: { name: true } }),
      prisma.touristEvent.findMany({ where: { workspaceId: WS }, select: { title: true } }),
      prisma.touristSportsFacility.findMany({ where: { workspaceId: WS }, select: { name: true } }),
      prisma.touristSkiFacility.findMany({ where: { workspaceId: WS }, select: { name: true } }),
    ])
  const names = [
    ...restaurants, ...hotels, ...excursions, ...refuges, ...apartments,
    ...events.map((e) => ({ name: e.title })), ...sports, ...ski,
  ]
    .map((r) => r.name.trim().toLowerCase())
    .filter((n) => n.length >= 5)

  const faqs = await prisma.fAQ.findMany({
    where: { workspaceId: WS },
    select: { id: true, question: true, answer: true },
  })

  const toDelete = []
  const keptDespiteMatch = []
  for (const f of faqs) {
    const q = f.question.toLowerCase()
    if (KEEP_EXCEPTIONS.some((k) => q.includes(k))) {
      keptDespiteMatch.push(`(eccezione) ${f.question}`)
      continue
    }
    if (INDEX_REPLACED.some((k) => q.includes(k))) {
      toDelete.push({ ...f, reason: "indice sostituito dalle schede generate" })
      continue
    }
    const hit = names.find((n) => q.includes(n))
    if (hit) {
      toDelete.push({ ...f, reason: `soggetto = record "${hit}"` })
      continue
    }
    if (names.some((n) => f.answer.toLowerCase().includes(n))) {
      keptDespiteMatch.push(`(solo answer) ${f.question}`)
    }
  }

  console.log(`FAQ totali: ${faqs.length} | da eliminare: ${toDelete.length} | tenute pur matchando: ${keptDespiteMatch.length}\n`)
  console.log("── DA ELIMINARE ──")
  for (const f of toDelete) console.log(`- ${f.question.slice(0, 85)}  [${f.reason}]`)
  console.log("\n── TENUTE (matchano solo nella risposta, o eccezioni) ──")
  for (const k of keptDespiteMatch) console.log(`- ${k.slice(0, 95)}`)

  if (!process.argv.includes("--apply")) {
    console.log("\nDry-run: nessuna cancellazione. Rilancia con --apply per eliminare (con backup).")
    return
  }

  const backupPath = new URL("./_sappada_faqs_deleted_backup.json", import.meta.url).pathname
  writeFileSync(backupPath, JSON.stringify(toDelete, null, 2))
  const result = await prisma.fAQ.deleteMany({
    where: { workspaceId: WS, id: { in: toDelete.map((f) => f.id) } },
  })
  const remaining = await prisma.fAQ.count({ where: { workspaceId: WS } })
  console.log(`\n✅ Eliminate ${result.count} FAQ (backup: ${backupPath}). Rimaste: ${remaining}.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => pool.end())
