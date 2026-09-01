// Sappada — REMOVE the searchSynonyms table from the workspace.
//
// WHY (Andrea, 2026-09-01): the synonym table existed to prop up FAQ selection,
// and selection is gone. A guest wrote "la mia bimba ha la febbre"; the health
// entry carrying 116117 scored 0.000, finished 27th of 82 and missed the
// 24-entry budget, so the model answered from its own knowledge and offered
// "Guardia medica — 118" — the ambulance line — for a child with a fever.
//
// Synonyms were tried as the fix and made it worse: mapping "bimba" onto
// "bambini" handed the win to "Cosa faccio a Sappada con i bambini?" at 0.818.
// The word "febbre" appears in no question and no answer of all 82 entries, so
// no word-equivalence table could ever have connected them.
//
// Every active entry is now sent on every turn (faq-media.ts
// selectRelevantFaqs), so nothing reads this key any more. Andrea: "se escludi
// i sinonimi devi ripulire tutto il codice il db e lasciarlo libero e limpio".
//
// One-shot, idempotent, MERGING: every other advanced-settings key is
// preserved. Writes a timestamped JSON backup of the removed groups next to
// this script BEFORE touching the row.
//
// Usage:  node _remove_sappada_search_synonyms.mjs
import { PrismaClient } from "./src/generated/prisma/index.js"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"

const WS = process.env.WORKSPACE_ID || "7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c"
const DB_URL =
  process.env.DATABASE_URL ||
  execFileSync("heroku", ["config:get", "DATABASE_URL", "-a", "echatbot-app"], { encoding: "utf8" }).trim()
const pool = new Pool({
  connectionString: DB_URL,
  ssl: DB_URL.includes("localhost") ? undefined : { rejectUnauthorized: false },
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const ws = await prisma.workspace.findUnique({
  where: { id: WS },
  select: { customChatbotAdvancedSettings: true },
})
if (!ws) {
  console.error(`workspace ${WS} not found`)
  process.exit(1)
}

const adv =
  ws.customChatbotAdvancedSettings && typeof ws.customChatbotAdvancedSettings === "object"
    ? { ...ws.customChatbotAdvancedSettings }
    : {}

if (!("searchSynonyms" in adv)) {
  console.log("searchSynonyms already absent — nothing to do.")
  console.log("keys:", Object.keys(adv).join(", ") || "(none)")
  await prisma.$disconnect()
  await pool.end()
  process.exit(0)
}

const groups = Array.isArray(adv.searchSynonyms) ? adv.searchSynonyms : []
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const backup = `_sappada_search_synonyms_backup_${stamp}.json`
writeFileSync(backup, JSON.stringify({ workspaceId: WS, removedAt: stamp, searchSynonyms: groups }, null, 2))
console.log(`backup written: ${backup} (${groups.length} groups)`)

delete adv.searchSynonyms
await prisma.workspace.update({ where: { id: WS }, data: { customChatbotAdvancedSettings: adv } })

console.log(`OK — searchSynonyms removed. Remaining keys: ${Object.keys(adv).join(", ") || "(none)"}`)
await prisma.$disconnect()
await pool.end()
