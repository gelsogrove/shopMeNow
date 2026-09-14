// Aggiorna il prezzo per messaggio e per push su TUTTI i piani
// (Andrea, 2026-09-14: "il prezzo del push è di 0.50 centesimi, il prezzo del
// messaggio 0.05").
//
// 🚨 DI DEFAULT NON SCRIVE NULLA: stampa il prima/dopo e si ferma. Scrive solo
//    con --apply.
//
// Questi valori sono quelli su cui il sistema FATTURA davvero: la home legge
// gli stessi numeri da /api/subscription/plans, così non può mostrare un
// prezzo diverso da quello addebitato.

import { PrismaClient } from "./src/generated/prisma/index.js"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const APPLY = process.argv.includes("--apply")

const MESSAGE_COST = 0.05
const PUSH_COST = 0.5

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  console.error("DATABASE_URL non impostata — passala tu al lancio.")
  process.exit(1)
}
const pool = new Pool({
  connectionString: DB_URL,
  ssl: DB_URL.includes("localhost") ? undefined : { rejectUnauthorized: false },
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const plans = await prisma.planConfiguration.findMany({
    orderBy: { monthlyFee: "asc" },
  })

  console.log(`\n${APPLY ? "MODALITÀ: --apply (SCRIVE)" : "MODALITÀ: prova a secco"}\n`)
  console.log("piano         canone   messaggio        push")
  console.log("─".repeat(52))
  for (const p of plans) {
    console.log(
      `${p.planType.padEnd(12)} ${String(p.monthlyFee).padStart(7)}   ` +
        `${String(p.messageCost).padStart(5)} → ${MESSAGE_COST}   ` +
        `${String(p.pushCost).padStart(5)} → ${PUSH_COST}`
    )
  }

  if (!APPLY) {
    console.log("\nRilancia con --apply per scrivere.\n")
    return
  }

  const updated = await prisma.planConfiguration.updateMany({
    data: { messageCost: MESSAGE_COST, pushCost: PUSH_COST },
  })
  console.log(`\n✅ ${updated.count} piani aggiornati.\n`)
}

main()
  .catch((e) => {
    console.error("\n❌ ERRORE — nessuna modifica applicata:\n", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
