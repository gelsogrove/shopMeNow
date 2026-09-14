// Audit READ-ONLY dei contenuti turistici — Andrea, 2026-09-14:
// "c'e' confusione nei dati tra escursioni e rifugi! sono due cose diverse!"
// "i dati devono essere allineati, abbiamo dati sballati nelle tabelle,
//  dati sono in disordine"
//
// 🚨 QUESTO SCRIPT NON SCRIVE NULLA. Legge, confronta e stampa una lista di
// righe da rivedere. Cosa spostare lo decide Andrea: spostare una riga fra
// due tabelle è irreversibile e la classificazione è una scelta sua.
//
// IL CRITERIO — non "cos'è" ma "a quale domanda risponde":
//   - un PERCORSO si percorre  → tourist_excursions (difficoltà, durata, stagione)
//   - una STRUTTURA si telefona → tourist_refuges  (telefono, apertura, salita)
// Il confine regge da solo: un rifugio ha un numero di telefono, un sentiero no.
//
// Le stesse due domande valgono per le altre coppie che si confondono:
// ristoranti/locali (si mangia / si beve), alberghi/appartamenti.

import { PrismaClient } from "./src/generated/prisma/index.js"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const WS = process.env.WORKSPACE_ID || "7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c"

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

// Parole che dichiarano una STRUTTURA nel nome. Unico punto in cui si guarda
// il testo, e serve solo a PROPORRE righe da rivedere a mano — non decide.
const STRUCTURE_WORDS =
  /\b(rifugio|rifugi|malga|malghe|bivacco|baita|casera|ristoro|agriturismo|albergo|hotel)\b/i

// Parole che dichiarano un PERCORSO nel nome.
const ROUTE_WORDS =
  /\b(sentiero|sentieri|anello|giro|percorso|traversata|via|salita|ciclabile|passeggiata|cammino|troi)\b/i

const short = (s, n = 65) =>
  !s ? "—" : s.replace(/\s+/g, " ").slice(0, n) + (s.length > n ? "…" : "")

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

// Ogni problema trovato finisce qui, così in fondo c'è una lista sola.
const issues = []
const flag = (severity, table, name, what) =>
  issues.push({ severity, table, name, what })

async function main() {
  const all = async (model) =>
    prisma[model].findMany({ where: { workspaceId: WS }, orderBy: { name: "asc" } })

  const [
    excursions, refuges, restaurants, venues, hotels,
    apartments, events, sports, ski, churches, castles, viewpoints,
  ] = await Promise.all([
    all("touristExcursion"), all("touristRefuge"), all("touristRestaurant"),
    all("touristVenue"), all("touristHotel"), all("touristApartment"),
    all("touristEvent"), all("touristSportsFacility"), all("touristSkiFacility"),
    all("touristChurch"), all("touristCastle"), all("touristViewpoint"),
  ])

  const TABLES = [
    ["Escursioni", excursions], ["Rifugi", refuges], ["Ristoranti", restaurants],
    ["Locali", venues], ["Alberghi", hotels], ["Appartamenti", apartments],
    ["Eventi", events], ["Strutture sportive", sports], ["Impianti sci", ski],
    ["Chiese", churches], ["Castelli", castles], ["Punti panoramici", viewpoints],
  ]

  console.log(`\n${"=".repeat(62)}\nAUDIT CONTENUTI TURISTICI — workspace ${WS}\n${"=".repeat(62)}\n`)
  console.log("CONSISTENZA")
  for (const [label, rows] of TABLES) {
    const off = rows.filter((r) => !r.isActive).length
    console.log(
      `  ${label.padEnd(20)} ${String(rows.length).padStart(4)} righe` +
        (off ? `   (${off} disattivate)` : "")
    )
  }

  // ── 1. Righe nella tabella sbagliata ────────────────────────────────────
  console.log(`\n${"─".repeat(62)}\n1. RIGHE CHE SEMBRANO NELLA TABELLA SBAGLIATA\n${"─".repeat(62)}`)

  for (const e of excursions) {
    // Una struttura fra i percorsi: il nome la dichiara, oppure ha un
    // telefono (un sentiero non si telefona).
    if (STRUCTURE_WORDS.test(e.name) && !ROUTE_WORDS.test(e.name))
      flag("ALTA", "Escursioni", e.name, "nome da STRUTTURA → probabilmente è un Rifugio")
  }
  for (const r of refuges) {
    // Un rifugio senza NESSUN dato da struttura è probabilmente un percorso.
    const structural = r.phone || r.email || r.openFrom || r.openTo || r.climbTime
    if (!structural)
      flag("MEDIA", "Rifugi", r.name, "nessun contatto/apertura/salita → forse è un'Escursione")
    if (ROUTE_WORDS.test(r.name) && !STRUCTURE_WORDS.test(r.name))
      flag("ALTA", "Rifugi", r.name, "nome da PERCORSO → probabilmente è un'Escursione")
  }
  // Bar/pub fra i ristoranti e viceversa: si beve vs si mangia.
  for (const v of venues)
    if (/\b(ristorante|pizzeria|trattoria|osteria|agriturismo)\b/i.test(v.name))
      flag("MEDIA", "Locali", v.name, "nome da RISTORANTE → forse va in Ristoranti")
  for (const r of restaurants)
    if (/\b(bar|pub|birreria|caffe|caffè)\b/i.test(r.name))
      flag("MEDIA", "Ristoranti", r.name, "nome da BAR/PUB → forse va in Locali")

  const byTable = {}
  for (const i of issues) (byTable[i.table] ||= []).push(i)
  if (issues.length === 0) console.log("  ✅ nessuna riga sospetta")
  for (const [table, list] of Object.entries(byTable)) {
    console.log(`\n  ${table}:`)
    for (const i of list) console.log(`    [${i.severity}] ${i.name}\n           ${i.what}`)
  }

  // ── 2. Duplicati ────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(62)}\n2. DUPLICATI\n${"─".repeat(62)}`)
  let dupFound = 0

  // Stesso nome DUE VOLTE nella stessa tabella.
  for (const [label, rows] of TABLES) {
    const seen = new Map()
    for (const r of rows) {
      const k = norm(r.name)
      if (!k) continue
      if (seen.has(k)) {
        console.log(`  ⚠️ ${label}: "${r.name}" presente ${seen.get(k) + 1} volte`)
        dupFound++
      }
      seen.set(k, (seen.get(k) || 0) + 1)
    }
  }

  // Stesso nome in DUE tabelle diverse.
  for (let i = 0; i < TABLES.length; i++) {
    for (let j = i + 1; j < TABLES.length; j++) {
      const [la, ra] = TABLES[i]
      const [lb, rb] = TABLES[j]
      const setB = new Map(rb.map((r) => [norm(r.name), r.name]))
      for (const a of ra) {
        const k = norm(a.name)
        if (k && setB.has(k)) {
          console.log(`  ⚠️ "${a.name}" è sia in ${la} che in ${lb}`)
          dupFound++
        }
      }
    }
  }
  if (dupFound === 0) console.log("  ✅ nessun duplicato")

  // ── 3. Campi vuoti che servono al chatbot ───────────────────────────────
  // Non è pignoleria: sono i campi su cui il bot filtra. Un'escursione senza
  // difficoltà non può essere proposta a chi ha i bambini; un rifugio senza
  // telefono non si può chiamare.
  console.log(`\n${"─".repeat(62)}\n3. CAMPI VUOTI CHE SERVONO AL CHATBOT\n${"─".repeat(62)}`)

  const missing = (rows, field) => rows.filter((r) => !r[field]).length
  const report = (label, rows, fields) => {
    const parts = fields
      .map((f) => [f, missing(rows, f)])
      .filter(([, n]) => n > 0)
      .map(([f, n]) => `${f}: ${n}/${rows.length}`)
    if (parts.length) console.log(`  ${label.padEnd(20)} ${parts.join("   ")}`)
  }
  report("Escursioni", excursions, ["difficulty", "duration", "season", "description"])
  report("Rifugi", refuges, ["phone", "openFrom", "climbTime", "description"])
  report("Ristoranti", restaurants, ["phone", "description"])
  report("Locali", venues, ["phone", "description"])
  report("Alberghi", hotels, ["phone", "description"])

  // ── 4. Riepilogo ────────────────────────────────────────────────────────
  const alta = issues.filter((i) => i.severity === "ALTA").length
  console.log(`\n${"=".repeat(62)}`)
  console.log(`Da rivedere: ${issues.length} righe (${alta} ad alta confidenza), ${dupFound} duplicati.`)
  console.log("Niente è stato modificato: questo script è di sola lettura.")
  console.log(`${"=".repeat(62)}\n`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
