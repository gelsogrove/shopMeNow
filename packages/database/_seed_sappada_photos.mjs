// Sappada gallery seeding (Andrea, 2026-08-31: "TROVA FOTO ... RIEMPIRE IL
// DATABASE", "IMMAGINI DENTRO BASE64"): downloads freely-licensed photos of
// Sappada landmarks from Wikimedia Commons, converts them to base64 and
// attaches them to the matching tourist content rows as TouristPhoto entries.
// Idempotent: a content row that already has photos is skipped.
import { PrismaClient } from "./src/generated/prisma/index.js"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const WS = "7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c"
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// commonsFile → which content row it belongs to (matched by name substring,
// case-insensitive, within ONE table). Captions credit Commons as source.
const PHOTOS = [
  { file: "Sappada Cascatelle di Mühlbach.jpg", table: "excursion", match: "cascatelle", caption: "Le Cascatelle di Mühlbach (foto: Wikimedia Commons)" },
  { file: "Le Cascatelle (81021189).jpeg", table: "excursion", match: "cascatelle", caption: "Le Cascatelle (foto: Wikimedia Commons)" },
  { file: "Orrido acquatona gorge sappada.jpg", table: "excursion", match: "acquatona", caption: "La Forra dell'Acquatona (foto: Wikimedia Commons)" },
  { file: "Sappada - rifugio 2000 - panoramio.jpg", table: "refuge", match: "sappada 2000", caption: "Rifugio Sappada 2000 (foto: Wikimedia Commons)" },
  { file: "Sappada Laghid'Olbe.jpg", table: "excursion", match: "laghi d'olbe", caption: "I Laghi d'Olbe (foto: Wikimedia Commons)" },
  { file: "Cartello sorgenti Piave.jpg", table: "refuge", match: "sorgenti del piave", caption: "Le Sorgenti del Piave (foto: Wikimedia Commons)" },
  { file: "Peralba Sesis.JPG", table: "excursion", match: "passo dell'oregone", caption: "Il Monte Peralba dalla Val Sesis (foto: Wikimedia Commons)" },
  { file: "Borgate Kratten e Soravia - Sappada.jpg", table: "event", match: "carnevale", caption: "Le borgate di Sappada (foto: Wikimedia Commons)" },
]

const finders = {
  excursion: (m) => prisma.touristExcursion.findFirst({ where: { workspaceId: WS, name: { contains: m, mode: "insensitive" } }, select: { id: true, name: true } }),
  refuge: (m) => prisma.touristRefuge.findFirst({ where: { workspaceId: WS, name: { contains: m, mode: "insensitive" } }, select: { id: true, name: true } }),
  event: (m) => prisma.touristEvent.findFirst({ where: { workspaceId: WS, title: { contains: m, mode: "insensitive" } }, select: { id: true, title: true } }).then((r) => (r ? { id: r.id, name: r.title } : null)),
}
const contentTypeOf = { excursion: "EXCURSION", refuge: "REFUGE", event: "EVENT" }

let inserted = 0
for (const p of PHOTOS) {
  const row = await finders[p.table](p.match)
  if (!row) {
    console.log(`skip (no content match): ${p.file} → ${p.match}`)
    continue
  }
  const contentType = contentTypeOf[p.table]
  const existing = await prisma.touristPhoto.count({
    where: { workspaceId: WS, contentType, contentId: row.id },
  })
  if (existing > 0) {
    console.log(`skip (already has ${existing} photos): ${row.name}`)
    continue
  }

  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p.file)}?width=800`
  const res = await fetch(url, { redirect: "follow" })
  if (!res.ok) {
    console.log(`skip (download failed ${res.status}): ${p.file}`)
    continue
  }
  const mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg"
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > 2_000_000) {
    console.log(`skip (too large ${buf.length}B): ${p.file}`)
    continue
  }
  const dataUri = `data:${mime};base64,${buf.toString("base64")}`

  await prisma.touristPhoto.create({
    data: { workspaceId: WS, contentType, contentId: row.id, imageBase64: dataUri, caption: p.caption, order: 0 },
  })
  inserted++
  console.log(`added photo (${Math.round(buf.length / 1024)}KB) → [${contentType}] ${row.name}`)
}

console.log(`Done: ${inserted} photos inserted`)
await prisma.$disconnect()
