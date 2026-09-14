// Riordino dei contenuti turistici — Andrea, 2026-09-14 ("ok riordina i dati").
//
// Sposta fra tabelle le righe finite nel posto sbagliato, con le loro FOTO.
//
// 🚨 DI DEFAULT NON SCRIVE NULLA: stampa il piano e si ferma. Scrive solo con
//    --apply, dentro UNA transazione (o tutto, o niente).
//
// IL CRITERIO (lo stesso dell'audit):
//   - un PERCORSO si percorre  → tourist_excursions (difficoltà, durata, stagione)
//   - una STRUTTURA si telefona → tourist_refuges  (telefono, apertura, salita)
//
// 🚨 PERCHÉ LE FOTO SONO LA PARTE DELICATA
// tourist_photos è polimorfa (contentType + contentId) e NON ha una FK verso
// la riga che descrive. Spostare una riga significa cancellarla da una tabella
// e ricrearla nell'altra: cambia l'id E il contentType, quindi le foto
// restano ORFANE — invisibili nell'app, ma ancora in tabella. Qui vengono
// riagganciate nella stessa transazione dello spostamento.
//
// COSA NON FA, DI PROPOSITO
// Non decide da solo cosa spostare. Le righe da spostare si elencano in
// MOVES, a mano, dopo aver letto l'audit: se "Rifugio Monte Siera" sia la
// struttura o il sentiero che ci porta lo sa Andrea, non un'euristica.

import { PrismaClient } from "./src/generated/prisma/index.js"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const WS = process.env.WORKSPACE_ID || "7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c"
const APPLY = process.argv.includes("--apply")

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

// ─────────────────────────────────────────────────────────────────────────
// DA COMPILARE DOPO L'AUDIT — una riga per spostamento.
//
//   { name: "<nome esatto come in tabella>", from: "excursion", to: "refuge" }
//
// Direzioni ammesse: excursion→refuge, refuge→excursion,
//                    restaurant→venue,  venue→restaurant
// ─────────────────────────────────────────────────────────────────────────
const MOVES = [
  // esempio, da sostituire con l'esito dell'audit:
  // { name: "Rifugio Sorgenti del Piave", from: "excursion", to: "refuge" },
]

// Come si traduce una riga da un tipo all'altro. I campi che non esistono
// nella tabella di destinazione NON si inventano e NON si perdono in
// silenzio: finiscono in coda alla descrizione, così il dato resta leggibile
// (CLAUDE.md §1 — mai inventare, mai buttare).
const KINDS = {
  excursion: { model: "touristExcursion", photo: "EXCURSION", label: "Escursioni" },
  refuge: { model: "touristRefuge", photo: "REFUGE", label: "Rifugi" },
  restaurant: { model: "touristRestaurant", photo: "RESTAURANT", label: "Ristoranti" },
  venue: { model: "touristVenue", photo: "VENUE", label: "Locali" },
}

const appendix = (pairs) => {
  const kept = pairs.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)
  return kept.length ? `\n\n(${kept.join(" · ")})` : ""
}

// Ogni traduzione mappa i campi comuni e preserva gli altri nel testo.
function translate(row, from, to) {
  const base = {
    workspaceId: WS,
    name: row.name,
    location: row.location ?? null,
    link: row.link ?? null,
    videoUrl: row.videoUrl ?? null,
    order: row.order ?? 0,
    isActive: row.isActive ?? true,
  }
  const desc = row.description ?? ""

  if (from === "excursion" && to === "refuge")
    return {
      ...base,
      // "durata" di un percorso ≠ "tempo di salita" a un rifugio: non li
      // equiparo, la durata resta nel testo e climbTime va compilato a mano.
      difficulty: row.difficulty ?? null,
      description: desc + appendix([["durata", row.duration], ["stagione", row.season]]),
    }

  if (from === "refuge" && to === "excursion")
    return {
      ...base,
      difficulty: row.difficulty ?? null,
      duration: row.climbTime ?? null, // tempo di salita = durata del percorso
      description:
        desc +
        appendix([
          ["aperto", [row.openFrom, row.openTo].filter(Boolean).join("→")],
          ["tel", row.phone],
          ["email", row.email],
        ]),
    }

  if (from === "restaurant" && to === "venue")
    return { ...base, phone: row.phone ?? null, description: desc }

  if (from === "venue" && to === "restaurant")
    return { ...base, phone: row.phone ?? null, description: desc }

  throw new Error(`traduzione non prevista: ${from} → ${to}`)
}

async function main() {
  if (MOVES.length === 0) {
    console.log(
      "\nMOVES è vuoto: non c'è niente da spostare.\n" +
        "Lancia prima _audit_sappada_excursions_refuges.mjs, poi elenca qui le\n" +
        "righe da spostare e rilancia.\n"
    )
    return
  }

  console.log(`\nworkspace ${WS}`)
  console.log(APPLY ? "MODALITÀ: --apply (SCRIVE)\n" : "MODALITÀ: prova a secco (non scrive)\n")

  const plan = []
  for (const mv of MOVES) {
    const src = KINDS[mv.from]
    const dst = KINDS[mv.to]
    if (!src || !dst) throw new Error(`tipo sconosciuto in ${JSON.stringify(mv)}`)

    const rows = await prisma[src.model].findMany({
      where: { workspaceId: WS, name: mv.name },
    })
    if (rows.length === 0) {
      console.log(`  ❌ "${mv.name}" non trovata in ${src.label} — salto`)
      continue
    }
    if (rows.length > 1) {
      console.log(`  ❌ "${mv.name}" compare ${rows.length} volte in ${src.label} — salto (ambiguo)`)
      continue
    }
    const row = rows[0]

    // La destinazione ha già lo stesso nome? Allora è un duplicato, non uno
    // spostamento: fermarsi è meglio che creare la seconda copia.
    const clash = await prisma[dst.model].count({ where: { workspaceId: WS, name: mv.name } })
    if (clash > 0) {
      console.log(`  ❌ "${mv.name}" esiste GIÀ in ${dst.label} — salto (sarebbe un duplicato)`)
      continue
    }

    const photos = await prisma.touristPhoto.count({
      where: { workspaceId: WS, contentType: src.photo, contentId: row.id },
    })

    console.log(`  → "${mv.name}"   ${src.label} → ${dst.label}` + (photos ? `   (${photos} foto)` : ""))
    plan.push({ mv, src, dst, row, photos, fromKey: mv.from, toKey: mv.to })
  }

  if (plan.length === 0) {
    console.log("\nNiente da fare.\n")
    return
  }

  if (!APPLY) {
    console.log(`\n${plan.length} spostamenti pronti. Rilancia con --apply per eseguirli.\n`)
    return
  }

  // Tutto in UNA transazione: se una foto non si riaggancia, si annulla
  // l'intero riordino invece di lasciare i dati a metà.
  await prisma.$transaction(async (tx) => {
    for (const { src, dst, row, photos, fromKey, toKey } of plan) {
      const created = await tx[dst.model].create({
        data: translate(row, fromKey, toKey),
      })
      if (photos > 0) {
        await tx.touristPhoto.updateMany({
          where: { workspaceId: WS, contentType: src.photo, contentId: row.id },
          data: { contentType: dst.photo, contentId: created.id },
        })
      }
      await tx[src.model].delete({ where: { id: row.id } })
      console.log(`  ✅ "${row.name}" spostata` + (photos ? ` con ${photos} foto` : ""))
    }
  })

  console.log(`\n${plan.length} righe spostate.\n`)
}

main()
  .catch((e) => {
    console.error("\n❌ ERRORE — nessuna modifica applicata (transazione annullata):\n", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
