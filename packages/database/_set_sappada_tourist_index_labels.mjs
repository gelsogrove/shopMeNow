// Sappada touristIndexLabels install (Andrea, 2026-09-01: "puoi farlo tu?" —
// labels approved verbatim by him in chat).
//
// Writes the multilingual index-card labels into the demosappada workspace's
// `customChatbotAdvancedSettings` (the source of truth: the runtime reads this
// column directly in getTouristContentAsFaqs; settings.json picks the key up
// at the next backoffice save via the normal merge).
//
// One-shot, idempotent, MERGING: every existing advanced-settings key is
// preserved; only `touristIndexLabels` is (re)written. Prints before/after.
// Usage:
//   DATABASE_URL=<prod url> node _set_sappada_tourist_index_labels.mjs
// WORKSPACE_ID defaults to the production demosappada workspace.
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

// Approved by Andrea in chat, 2026-09-01 — category keys match
// TouristIndexInput in apps/backend/src/application/services/tourist-index-cards.ts.
const touristIndexLabels = {
  en: { events: "Events", restaurants: "Restaurants", hotels: "Hotels", excursions: "Excursions", refuges: "Mountain huts", sportsFacilities: "Sports facilities", skiFacilities: "Ski slopes" },
  de: { events: "Veranstaltungen", restaurants: "Restaurants", hotels: "Hotels", excursions: "Wanderungen", refuges: "Hütten", sportsFacilities: "Sportanlagen", skiFacilities: "Skipisten" },
  fr: { events: "Événements", restaurants: "Restaurants", hotels: "Hôtels", excursions: "Randonnées", refuges: "Refuges", sportsFacilities: "Installations sportives", skiFacilities: "Pistes de ski" },
  es: { events: "Eventos", restaurants: "Restaurantes", hotels: "Hoteles", excursions: "Excursiones", refuges: "Refugios", sportsFacilities: "Instalaciones deportivas", skiFacilities: "Pistas de esquí" },
  pt: { events: "Eventos", restaurants: "Restaurantes", hotels: "Hotéis", excursions: "Excursões", refuges: "Refúgios", sportsFacilities: "Instalações desportivas", skiFacilities: "Pistas de esqui" },
  da: { events: "Begivenheder", restaurants: "Restauranter", hotels: "Hoteller", excursions: "Vandreture", refuges: "Hytter", sportsFacilities: "Sportsfaciliteter", skiFacilities: "Skipister" },
  nl: { events: "Evenementen", restaurants: "Restaurants", hotels: "Hotels", excursions: "Wandelingen", refuges: "Hutten", sportsFacilities: "Sportfaciliteiten", skiFacilities: "Skipistes" },
}

async function main() {
  const ws = await prisma.workspace.findUnique({
    where: { id: WS },
    select: { name: true, enabledLanguages: true, defaultLanguage: true, customChatbotAdvancedSettings: true },
  })
  if (!ws) throw new Error(`Workspace ${WS} not found`)

  console.log(`Workspace: ${ws.name} (${WS})`)
  console.log(`enabledLanguages: ${JSON.stringify(ws.enabledLanguages)} | default: ${ws.defaultLanguage}`)

  const current =
    ws.customChatbotAdvancedSettings &&
    typeof ws.customChatbotAdvancedSettings === "object" &&
    !Array.isArray(ws.customChatbotAdvancedSettings)
      ? ws.customChatbotAdvancedSettings
      : {}
  const existingKeys = Object.keys(current)
  console.log(`Existing advanced-settings keys (preserved): ${existingKeys.length ? existingKeys.join(", ") : "(none)"}`)
  if (current.touristIndexLabels) {
    console.log("touristIndexLabels already present — will be overwritten with the approved version.")
  }

  await prisma.workspace.update({
    where: { id: WS },
    data: { customChatbotAdvancedSettings: { ...current, touristIndexLabels } },
  })

  const langs = Object.keys(touristIndexLabels)
  console.log(`✅ touristIndexLabels written: ${langs.length} languages (${langs.join(", ")}), 7 categories each.`)
  console.log("Note: settings.json will pick the key up at the next backoffice save; the chatbot reads the DB column directly, so the cards are live from the next message.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => pool.end())
