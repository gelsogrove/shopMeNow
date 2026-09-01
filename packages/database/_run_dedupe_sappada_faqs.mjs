// Runner for _dedupe_sappada_faqs.sql (Andrea, 2026-09-01: "ma lancialo tu").
// Same predicate as the reviewed SQL, verbatim: a FAQ is a duplicate when the
// NAME of a record in one of the 8 structured tables (length >= 5) appears
// case-insensitively in the FAQ's question or answer.
//
// Usage:
//   node _run_dedupe_sappada_faqs.mjs            # dry-run: list matches + pending migrations check
//   APPLY=1 node _run_dedupe_sappada_faqs.mjs    # delete the matched FAQs
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

const RECORDS_CTE = `
  SELECT 'Ristoranti' AS tabella, name AS record_name
    FROM tourist_restaurants WHERE "workspaceId" = $1
  UNION ALL SELECT 'Alberghi', name FROM tourist_hotels WHERE "workspaceId" = $1
  UNION ALL SELECT 'Escursioni', name FROM tourist_excursions WHERE "workspaceId" = $1
  UNION ALL SELECT 'Rifugi', name FROM tourist_refuges WHERE "workspaceId" = $1
  UNION ALL SELECT 'Case e appartamenti', name FROM tourist_apartments WHERE "workspaceId" = $1
  UNION ALL SELECT 'Eventi', title FROM tourist_events WHERE "workspaceId" = $1
  UNION ALL SELECT 'Strutture sportive', name FROM tourist_sports_facilities WHERE "workspaceId" = $1
  UNION ALL SELECT 'Impianti di sci', name FROM tourist_ski_facilities WHERE "workspaceId" = $1
`

async function main() {
  // Sanity: no half-applied migrations after the deploy's `migrate deploy`.
  const pending = await prisma.$queryRawUnsafe(
    `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 5`
  )
  console.log(
    pending.length === 0
      ? "Migrations: OK, none pending/unfinished."
      : `⚠️ Unfinished migrations: ${pending.map((m) => m.migration_name).join(", ")}`
  )

  const matches = await prisma.$queryRawUnsafe(
    `WITH records AS (${RECORDS_CTE})
     SELECT DISTINCT f.id, f.question, r.tabella, r.record_name
     FROM faqs f
     JOIN records r
       ON length(r.record_name) >= 5
      AND (lower(f.question) LIKE '%' || lower(r.record_name) || '%'
        OR lower(f.answer)   LIKE '%' || lower(r.record_name) || '%')
     WHERE f."workspaceId" = $1
     ORDER BY r.tabella, f.question`,
    WS
  )

  const totalFaqs = await prisma.fAQ.count({ where: { workspaceId: WS } })
  const uniqueIds = new Set(matches.map((m) => m.id))
  console.log(`\nFAQ totali nel workspace: ${totalFaqs}`)
  console.log(`FAQ duplicate da rimuovere: ${uniqueIds.size} (${matches.length} match)\n`)
  for (const m of matches) {
    console.log(`- [${m.tabella}] "${m.record_name}" → FAQ: ${m.question.slice(0, 90)}`)
  }

  if (process.env.APPLY !== "1") {
    console.log("\nDry-run: nessuna cancellazione. Rilancia con APPLY=1 per eliminare.")
    return
  }

  const result = await prisma.$executeRawUnsafe(
    `WITH records AS (${RECORDS_CTE})
     DELETE FROM faqs f
     WHERE f."workspaceId" = $1
       AND EXISTS (
         SELECT 1 FROM records r
         WHERE length(r.record_name) >= 5
           AND (lower(f.question) LIKE '%' || lower(r.record_name) || '%'
             OR lower(f.answer)   LIKE '%' || lower(r.record_name) || '%')
       )`,
    WS
  )
  const remaining = await prisma.fAQ.count({ where: { workspaceId: WS } })
  console.log(`\n✅ Eliminate ${result} FAQ. Rimaste: ${remaining}.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => pool.end())
