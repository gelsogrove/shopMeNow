// Sappada sports facilities + ski facilities import (Andrea, 2026-09-01:
// "strutture sportive per esempio il golf di sappada... e poi anche impianti
// di sci" → "update sul db").
// Sources, transcribed facts only (no invented content):
//   https://www.sappadadolomiti.com/attivita/golf/
//   https://www.sappadadolomiti.com/attivita/tennis/
//   https://www.sappadadolomiti.com/attivita/sci-alpino/
//   https://www.sappadadolomiti.com/tipo-attivita/sport-sappada/
//   https://www.sappadaski.it/
//   https://www.golfclubsappada.com/
//
// One-shot, idempotent (skips rows already present by name).
// Usage:
//   WORKSPACE_ID=<id> DATABASE_URL=<url> node _seed_sappada_sports_ski.mjs
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

// [name, sport, season, location, description, link]
const STRUTTURE_SPORTIVE = [
  [
    "Golf Club Sappada",
    "golf",
    "estiva",
    "Borgata Bach 96",
    "Campo a 9 buche (giocabile anche su 18) a 1.250 metri di quota, tra prati ondulati e boschi con vista sulle Dolomiti. Par 30, 1.428 metri totali. Area pratica, putting green, noleggio sacche, spogliatoi e club house in una tipica casa sappadina in legno con bar-ristorante. Aperto da maggio a ottobre. Tel: 0435 469585 — info@golfclubsappada.com",
    "https://www.golfclubsappada.com",
  ],
  [
    "Tennis Eiben – Pista Nera",
    "tennis",
    "estiva",
    "Località Eiben / Pista Nera",
    "Campo da tennis in località Eiben/Pista Nera. Prenotazioni sul posto o presso Punto Sport Kratter, borgata Bach — tel 0435 469102.",
    "https://www.sappadadolomiti.com/attivita/tennis/",
  ],
  [
    "Campo polivalente Cima Sappada",
    "tennis, calcetto, pallavolo",
    "estiva",
    "Cima Sappada",
    "Campo polivalente per tennis, calcetto e pallavolo. Info e prenotazioni presso Alimentari Ciotti, borgata Cima — tel 0435 469208 / 338 8472028.",
    "https://www.sappadadolomiti.com/attivita/tennis/",
  ],
  [
    "Pista di sci nordico",
    "sci di fondo",
    "invernale",
    "Sappada",
    "Anello di sci nordico di circa 15 km che si snoda nella valle soleggiata e nei boschi. Sappada è terra di campioni del fondo e del biathlon — 13 medaglie olimpiche, da Silvio Fauner a Pietro Piller Cottrer e Lisa Vittozzi — e lo stadio del fondo ospita eventi internazionali.",
    "https://www.sappadadolomiti.com/tipo-attivita/sport-sappada/",
  ],
]

// [name, slopeType, location, description, link]
const IMPIANTI_SCI = [
  [
    "Seggiovia Pian dei Nidi",
    null,
    "Pian dei Nidi / Monte Siera",
    "Seggiovia del comprensorio Monte Siera–Pian dei Nidi, sempre perfettamente innevato: il passo successivo ideale per chi ha appena iniziato a sciare. Skipass: tel 0435 469122 — skipass@travelone.it",
    "https://www.sappadaski.it",
  ],
  [
    "Seggiovia Monte Siera",
    null,
    "Monte Siera",
    "Seggiovia che sale verso il Monte Siera e le piste del suo comprensorio.",
    "https://www.sappadaski.it",
  ],
  [
    "Sappada 2000 – Seggiovie Miravalle e Hochbolt",
    "rossa, nera",
    "Sappada 2000",
    "Comprensorio in quota sempre soleggiato e con panorama strepitoso, raggiungibile con il bus-navetta gratuito (per chi ha lo skipass) da Pian dei Nidi. Le due seggiovie Miravalle e Hochbolt servono le piste più impegnative, rosse e nere.",
    "https://www.sappadaski.it",
  ],
  [
    "Pista Eiben – Col dei Mughi",
    "nera",
    "Centro paese, accanto a Nevelandia",
    "Pista nera in centro paese, servita dalla seggiovia Eiben–Col dei Mughi.",
    "https://www.sappadaski.it",
  ],
  [
    "Campetti scuola – Sciovia Campetto",
    "blu",
    "Centro paese",
    "Vasti campi scuola in centro paese, ideali per principianti e famiglie.",
    "https://www.sappadaski.it",
  ],
  [
    "Nevelandia",
    null,
    "Centro paese",
    "Baby park sulla neve gestito dalla scuola sci locale: piste per slittini, tubing, pattinaggio su ghiaccio e attività per bambini.",
    "https://www.sappadaski.it",
  ],
]

async function main() {
  let createdSports = 0
  let skippedSports = 0
  for (let i = 0; i < STRUTTURE_SPORTIVE.length; i++) {
    const [name, sport, season, location, description, link] = STRUTTURE_SPORTIVE[i]
    const existing = await prisma.touristSportsFacility.findFirst({
      where: { workspaceId: WS, name },
    })
    if (existing) {
      skippedSports++
      continue
    }
    await prisma.touristSportsFacility.create({
      data: { workspaceId: WS, name, sport, season, location, description, link, order: i, isActive: true },
    })
    createdSports++
  }

  let createdSki = 0
  let skippedSki = 0
  for (let i = 0; i < IMPIANTI_SCI.length; i++) {
    const [name, slopeType, location, description, link] = IMPIANTI_SCI[i]
    const existing = await prisma.touristSkiFacility.findFirst({
      where: { workspaceId: WS, name },
    })
    if (existing) {
      skippedSki++
      continue
    }
    await prisma.touristSkiFacility.create({
      data: { workspaceId: WS, name, slopeType, location, description, link, order: i, isActive: true },
    })
    createdSki++
  }

  console.log(
    `Sports facilities: ${createdSports} created, ${skippedSports} skipped. ` +
      `Ski facilities: ${createdSki} created, ${skippedSki} skipped. Workspace: ${WS}`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
