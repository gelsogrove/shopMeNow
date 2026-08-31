// Sappada FAQ-ranking diagnosis (Andrea, 2026-09-01: bot says it has no
// Carnevale details although the event is in the DB).
//
// READ-ONLY one-shot: replicates, byte-for-byte on the QUESTION side, the
// entry construction of custom-client-chatbot.service.ts (getFaqs +
// getTouristContentAsFaqs) and the ranking of custom-demosappada/faq-media.ts
// (wordsOf / distinctiveTerms / termWeight / subjectScore / FAQ_BUDGET), then
// prints which entries win the 24 slots for a given guest message — and where
// the losers ranked. No LLM call, no writes, only SELECTs.
//
// Usage (Andrea launches it — DATABASE_URL is never read from .env by Claude):
//   DATABASE_URL=<prod url> node _diag_sappada_faq_ranking.mjs "quando è il carnevale?"
//   DATABASE_URL=<url> node _diag_sappada_faq_ranking.mjs "domanda" "msg storia -1" "msg storia -2"
// Extra args replicate faq-context = message + last 4 history entries, joined
// with a space, exactly as agent.ts:1130 does.
// WORKSPACE_ID defaults to the production demosappada workspace.
import { PrismaClient } from "./src/generated/prisma/index.js"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const WS = process.env.WORKSPACE_ID || "7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c"
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? undefined : { rejectUnauthorized: false },
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// ── copies of faq-media.ts (kept identical; this is a throwaway diagnostic) ──
const FAQ_BUDGET = 24

const GENERIC_QUESTION_WORDS = new Set([
  'sappada', 'cosa', 'come', 'dove', 'quali', 'quando', 'quanto', 'sono', 'sono?', 'posso',
  'arrivo', 'ci', 'si', 'che', 'per', 'del', 'della', 'delle', 'dei', 'con', 'una', 'uno',
  'gli', 'le', 'la', 'il', 'lo', 'un', 'and', 'the', 'what', 'where', 'how', 'there',
])

function wordsOf(text) {
  return new Set(
    text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean),
  )
}

function distinctiveTerms(question) {
  return Array.from(
    new Set(
      question
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !GENERIC_QUESTION_WORDS.has(w)),
    ),
  )
}

function termWeight(term, faqs) {
  let documents = 0
  for (const faq of faqs) {
    if (wordsOf(faq.question).has(term)) documents++
  }
  return documents <= 1 ? 1 : 1 / documents
}

function subjectScore(faq, text, faqs) {
  const words = wordsOf(text)
  const terms = distinctiveTerms(faq.question)
  if (terms.length === 0) return 0
  let total = 0
  let matched = 0
  for (const term of terms) {
    const weight = termWeight(term, faqs)
    total += weight
    if (words.has(term)) matched += weight
  }
  return total === 0 ? 0 : matched / total
}

// ── copies of custom-client-chatbot.service.ts question builders ──
const searchableQuestion = (parts) => parts.filter(Boolean).join(" — ")

async function loadEntries() {
  const [faqs, restaurants, hotels, excursions, refuges, apartments, events, sports, ski] =
    await Promise.all([
      prisma.fAQ.findMany({ where: { workspaceId: WS, isActive: true }, orderBy: { order: "asc" }, select: { question: true } }),
      prisma.touristRestaurant.findMany({ where: { workspaceId: WS, isActive: true }, orderBy: { order: "asc" } }),
      prisma.touristHotel.findMany({ where: { workspaceId: WS, isActive: true }, orderBy: { order: "asc" } }),
      prisma.touristExcursion.findMany({ where: { workspaceId: WS, isActive: true }, orderBy: { order: "asc" } }),
      prisma.touristRefuge.findMany({ where: { workspaceId: WS, isActive: true }, orderBy: { order: "asc" } }),
      prisma.touristApartment.findMany({ where: { workspaceId: WS, isActive: true }, orderBy: { order: "asc" } }),
      prisma.touristEvent.findMany({ where: { workspaceId: WS, isActive: true }, orderBy: { order: "asc" } }),
      prisma.touristSportsFacility.findMany({ where: { workspaceId: WS, isActive: true }, orderBy: { order: "asc" } }),
      prisma.touristSkiFacility.findMany({ where: { workspaceId: WS, isActive: true }, orderBy: { order: "asc" } }),
    ])

  return [
    ...faqs.map((f) => ({ cat: "FAQ", question: f.question })),
    ...restaurants.map((r) => ({
      cat: "Ristorante",
      question: searchableQuestion([
        `Ristoranti: ${r.name}`,
        r.celiacFriendly ? "adatto a celiaci, senza glutine" : null,
      ]),
    })),
    ...hotels.map((h) => ({ cat: "Albergo", question: searchableQuestion([`Alberghi: ${h.name}`]) })),
    ...excursions.map((e) => ({ cat: "Escursione", question: searchableQuestion([`Escursioni: ${e.name}`]) })),
    ...refuges.map((r) => ({ cat: "Rifugio", question: searchableQuestion([`Rifugi: ${r.name}`]) })),
    ...apartments.map((a) => ({
      cat: "Appartamento",
      question: searchableQuestion([`${a.category || "Case e appartamenti"}: ${a.name}`]),
    })),
    ...events.map((e) => ({
      cat: "Evento",
      question: searchableQuestion([`Eventi: ${e.title}`]),
      hasDates: !!(e.startDate || e.endDate),
    })),
    ...sports.map((s) => ({
      cat: "Sport",
      question: searchableQuestion([`Strutture sportive: ${s.name}`, s.sport]),
    })),
    ...ski.map((s) => ({
      cat: "Sci",
      question: searchableQuestion([`Impianti di sci: ${s.name}`, s.slopeType ? `pista ${s.slopeType}` : null]),
    })),
  ]
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('Serve la domanda del turista: node _diag_sappada_faq_ranking.mjs "quando è il carnevale?"')
    process.exit(1)
  }
  const context = args.join(" ")

  const entries = await loadEntries()
  console.log(`\nCatalogo: ${entries.length} schede totali (budget: ${FAQ_BUDGET})`)
  const byCat = {}
  for (const e of entries) byCat[e.cat] = (byCat[e.cat] || 0) + 1
  console.log(Object.entries(byCat).map(([c, n]) => `${c}: ${n}`).join(" | "))
  console.log(`\nContesto valutato: "${context}"\n`)

  if (entries.length <= FAQ_BUDGET) {
    console.log("Sotto budget: TUTTE le schede vengono inviate — il ranking non taglia nulla.")
    return
  }

  const ranked = entries
    .map((faq) => ({ faq, score: subjectScore(faq, context, entries) }))
    .sort((a, b) => b.score - a.score)

  console.log(`── Le ${FAQ_BUDGET} schede che ENTRANO nel prompt ──`)
  ranked.slice(0, FAQ_BUDGET).forEach((r, i) => {
    console.log(`${String(i + 1).padStart(2)}. [${r.score.toFixed(3)}] (${r.faq.cat}) ${r.faq.question.slice(0, 90)}`)
  })

  const zeroCount = ranked.filter((r) => r.score === 0).length
  console.log(`\nSchede a punteggio zero: ${zeroCount}/${entries.length} (tra loro l'ordine è arbitrario)`)

  console.log(`\n── Dove finiscono gli EVENTI ──`)
  ranked.forEach((r, i) => {
    if (r.faq.cat !== "Evento") return
    const inBudget = i < FAQ_BUDGET ? "✅ DENTRO" : "❌ FUORI"
    const dates = r.faq.hasDates ? "" : "  (senza date nel DB)"
    console.log(`#${String(i + 1).padStart(3)} [${r.score.toFixed(3)}] ${inBudget} ${r.faq.question.slice(0, 80)}${dates}`)
  })
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => pool.end())
