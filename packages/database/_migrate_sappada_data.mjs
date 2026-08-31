// Sappada data migration, step 2 (Andrea, 2026-08-31: "FAI INSERT DELETE
// UPDATE NEL DB METTI I CAMPI GIUSTI", "SE ABBIAMO ALBERGO ALLORA TOGLIAMO
// LA FAQ"): activate the 88 tourist content rows, deactivate the FAQs whose
// content is now fully migrated, reduce the restaurant index FAQ to the
// zones/rules context that did not migrate.
import { readFileSync } from "node:fs"
import { PrismaClient } from "./src/generated/prisma/index.js"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const WS = "7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c"
const seed = JSON.parse(readFileSync(process.env.SEED_FILE, "utf8"))
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// 1. Activate all tourist content drafts
const a1 = await prisma.touristRestaurant.updateMany({ where: { workspaceId: WS }, data: { isActive: true } })
const a2 = await prisma.touristHotel.updateMany({ where: { workspaceId: WS }, data: { isActive: true } })
const a3 = await prisma.touristExcursion.updateMany({ where: { workspaceId: WS }, data: { isActive: true } })
const a4 = await prisma.touristRefuge.updateMany({ where: { workspaceId: WS }, data: { isActive: true } })
const a5 = await prisma.touristEvent.updateMany({ where: { workspaceId: WS }, data: { isActive: true } })
console.log(`Activated: restaurants ${a1.count}, hotels ${a2.count}, excursions ${a3.count}, refuges ${a4.count}, events ${a5.count}`)

// 2. Deactivate migrated FAQs (soft, reversible). The restaurant INDEX FAQ
//    keeps living with a reduced answer (step 3) because its zones/rules
//    context did not move into the per-restaurant rows.
const KEEP_REDUCED = "f2da7c7f-8f55-4ba8-a3fb-394a6db68ee5"
const ids = new Set([
  ...seed.sourceFaqIds.restaurants,
  ...seed.sourceFaqIds.hotels,
  ...seed.sourceFaqIds.excursions,
  ...seed.sourceFaqIds.refuges,
  ...seed.sourceFaqIds.events,
])
ids.delete(KEEP_REDUCED)
const d1 = await prisma.fAQ.updateMany({
  where: { workspaceId: WS, id: { in: [...ids] } },
  data: { isActive: false },
})
console.log(`Deactivated ${d1.count} migrated FAQs (of ${ids.size} ids)`)

// 3. Reduce the restaurant index FAQ to the non-migrated context.
const reducedAnswer = `ZONE — Sappada è divisa in tre zone lungo la valle, lontane tra loro: CENTRO (Borgate Bach, Palù, Granvilla, Lerpa — dove c'è l'InfoPoint), SAPPADA VECCHIA (Borgate Pill, Mühlbach, Cottern, Hoffe, Fontana, Kratten, Soravia, Ecche, Puiche — nucleo storico), CIMA SAPPADA/VAL SESIS (Cima Sappada e le Sorgenti del Piave — isolata, la più lontana dalle altre due). Quando abbini un pasto a un'attività del giorno, scegli un locale nella STESSA zona: un ristorante in un'altra zona significa spostarsi apposta, non è "vicino". La ZONA non va mai letta al cliente a voce ("zona centro") — serve solo a te per scegliere bene: usala per dire "vicino a dove siete stati oggi" o "a due passi dal centro", mai il nome tecnico della zona.

I singoli locali sono nelle schede RISTORANTI del contenuto approvato: ogni scheda ha nome, fascia di prezzo, zona, indirizzo, telefono, descrizione e — quando esiste — il sito (usalo come link al menu). Mostra il sito/menu SOLO se il cliente lo chiede o quando rispondi nel dettaglio su UN locale, mai nella prima lista.

IN QUOTA
I rifugi della Val Sesis servono cucina di montagna a pranzo — sono in zona CIMA SAPPADA/VAL SESIS. Apertura stagionale: chiama sempre prima di salire.

Orari e giorni di chiusura cambiano con la stagione: telefona prima, soprattutto la sera e nei weekend.

Elenco ufficiale: https://www.visitsappada.it/sappada-dove-mangiare.php

Diversi locali di Sappada sono abituati a gestire celiachia e intolleranze, ma la disponibilità cambia da giorno a giorno e dipende dalla cucina. La cosa giusta da fare è una sola: chiamare il locale prima di andare e dire chiaramente di cosa hai bisogno. Così ti confermano se possono garantirlo quella sera. Non posso garantire l'assenza di allergeni in un piatto: quella conferma può darla solo il ristorante.

Se ti serve una mano a scegliere, l'InfoPoint di Sappada (0435 469131) sa quali locali sono più attrezzati in questo periodo.`

const u = await prisma.fAQ.updateMany({
  where: { workspaceId: WS, id: KEEP_REDUCED },
  data: { answer: reducedAnswer },
})
console.log(`Reduced restaurant index FAQ: ${u.count} row updated`)

// 4. Enrich hotels with real Sappada structures found online (2026-08-31 web
//    research: albergocavallino.it, corona-ferrea.it, sappadadolomiti.com).
//    Facts kept minimal and verifiable — name, short description, official
//    site where known. No invented stars/phones (anti-invention rule).
const newHotels = [
  {
    name: "Albergo Cavallino",
    description:
      "Albergo storico in centro a Sappada, gestito dalla stessa famiglia da quattro generazioni. Posizione comoda per raggiungere a piedi le principali attrazioni del paese. Camere e appartamenti.",
    location: "Borgata Bach 31 (Centro)",
    link: "https://www.albergocavallino.it/",
  },
  {
    name: "Hotel Corona Ferrea",
    description:
      "Hotel nel cuore di Sappada, a pochi passi dalle borgate antiche e vicino alle seggiovie Sappada 2000 e Pian dei Nidi.",
    location: "Centro",
    link: "https://www.corona-ferrea.it/hotel",
  },
  {
    name: "Wellness Hotel Bladen",
    description:
      "Hotel con area wellness, camere di design tradizionale con dotazioni moderne e vista sulle Dolomiti Carniche.",
    location: "Sappada",
    link: null,
  },
  {
    name: "Hotel Cristina",
    description:
      "Hotel ricavato dalla ristrutturazione di un antico fienile, di cui conserva i tratti architettonici. Ambiente familiare e tranquillo.",
    location: "Sappada",
    link: null,
  },
  {
    name: "Hotel Ristorante Sport",
    description:
      "Hotel a gestione familiare in posizione panoramica, vicino agli impianti di risalita. Ristorante interno.",
    location: "Sappada",
    link: null,
  },
]
const existingHotels = await prisma.touristHotel.findMany({
  where: { workspaceId: WS },
  select: { name: true },
})
const existingNames = new Set(existingHotels.map((h) => h.name.toLowerCase()))
const toInsert = newHotels.filter((h) => !existingNames.has(h.name.toLowerCase()))
if (toInsert.length > 0) {
  const ins = await prisma.touristHotel.createMany({
    data: toInsert.map((h, i) => ({
      ...h,
      workspaceId: WS,
      order: existingHotels.length + i,
      isActive: true,
    })),
  })
  console.log(`Enriched hotels: inserted ${ins.count} new (skipped ${newHotels.length - toInsert.length} duplicates)`)
} else {
  console.log("Enriched hotels: all already present, nothing inserted")
}

const activeFaqs = await prisma.fAQ.count({ where: { workspaceId: WS, isActive: true } })
console.log(`Active FAQs remaining: ${activeFaqs}`)
await prisma.$disconnect()
