// Sappada searchSynonyms install (Andrea, 2026-09-01: "facciamo una tabella,
// cerchiamo di mettere il più possibile dei casi — piste rifugi ristoranti,
// celiaca, borgo, bosco... in più dobbiamo calcolare che abbiamo lingue
// diverse").
//
// Writes the word-equivalence groups into the demosappada workspace's
// `customChatbotAdvancedSettings.searchSynonyms`. Each group = ONE concept in
// every language/inflection; during FAQ selection all members count as the
// same word (faq-media.ts buildSynonymCanon). Extend from the app anytime —
// no deploy needed, the host rebuilds settings from the DB on every message.
//
// One-shot, idempotent, MERGING: preserves every other advanced-settings key.
// Usage:  node _set_sappada_search_synonyms.mjs
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

// First word of each group = the Italian base form (the cards' language).
const searchSynonyms = [
  ["pista", "piste", "pisten", "slope", "slopes", "pistes", "pistas"],
  ["nera", "nere", "black", "schwarz", "schwarze", "noire", "noires", "negra", "negras"],
  ["rossa", "rosse", "red", "rot", "rote", "rouge", "rouges", "roja", "rojas"],
  ["blu", "blue", "blau", "blaue", "bleue", "bleues", "azul", "azules"],
  ["rifugio", "rifugi", "hut", "huts", "hütte", "hütten", "refuge", "refuges", "refugio", "refugios", "refúgio", "refúgios"],
  ["malga", "malghe", "alm", "almen"],
  ["ristorante", "ristoranti", "restaurant", "restaurants", "restaurante", "restaurantes", "restauranter"],
  ["celiaci", "celiaco", "celiaca", "celiache", "celiachia", "glutine", "gluten", "glutenfrei", "celiac", "coeliac", "celíaco", "celíaca"],
  ["borgata", "borgate", "borgo", "borghi", "village", "villages", "dorf", "dörfer", "pueblo", "pueblos", "aldeia", "aldeias"],
  ["bosco", "boschi", "forest", "forests", "woods", "wald", "wälder", "forêt", "forêts", "bosque", "bosques", "floresta", "florestas", "skov", "bos"],
  ["eventi", "evento", "event", "events", "veranstaltung", "veranstaltungen", "festa", "feste", "sagra", "sagre", "manifestazione", "manifestazioni", "festival", "fête", "fêtes", "fiesta", "fiestas"],
  ["escursione", "escursioni", "hike", "hikes", "hiking", "wanderung", "wanderungen", "randonnée", "randonnées", "excursión", "excursiones", "excursão", "excursões", "sentiero", "sentieri", "trail", "trails", "camminata", "camminate", "passeggiata", "passeggiate", "wandeling", "wandelingen", "vandretur", "vandreture"],
  ["albergo", "alberghi", "hotel", "hotels", "hôtel", "hôtels", "hotéis", "hoteles", "hoteller"],
  ["appartamento", "appartamenti", "apartment", "apartments", "wohnung", "wohnungen", "appartement", "appartements", "apartamento", "apartamentos"],
  ["impianti", "impianto", "lift", "lifts", "seggiovia", "seggiovie", "skilift", "skilifte", "funivia", "funivie"],
  ["sciare", "ski", "skiing", "skifahren", "esquí", "esquiar", "esqui", "skiën"],
  ["bambini", "bambino", "bimbo", "bimbi", "kid", "kids", "child", "children", "kinder", "niño", "niños", "enfant", "enfants", "criança", "crianças", "børn", "kinderen"],
  ["famiglia", "famiglie", "family", "families", "familie", "familien", "familia", "familias", "famille", "familles", "família", "famílias"],
  ["neve", "snow", "schnee", "neige", "nieve", "sne", "sneeuw"],
  ["ciaspole", "ciaspolata", "ciaspolate", "snowshoe", "snowshoes", "schneeschuh", "schneeschuhe", "raquette", "raquettes"],
  ["cascatelle", "cascata", "cascate", "waterfall", "waterfalls", "wasserfall", "wasserfälle", "cascade", "cascades", "cascada", "cascadas"],
  ["lago", "laghi", "lake", "lakes", "see", "seen", "lac", "lacs", "lagos", "søer"],
  ["chiesa", "chiese", "church", "churches", "kirche", "kirchen", "église", "églises", "iglesia", "iglesias", "igreja", "igrejas", "kerk", "kerken"],
  ["museo", "musei", "museum", "museums", "musée", "musées", "museu", "museus"],
  ["mercatino", "mercatini", "mercato", "mercati", "market", "markets", "markt", "märkte", "marché", "marchés", "mercado", "mercados"],
  ["estate", "estivo", "estiva", "estivi", "estive", "summer", "sommer", "été", "verano", "verão", "zomer", "sommer"],
  ["inverno", "invernale", "invernali", "winter", "hiver", "invierno", "vinter"],
  ["slittino", "slittini", "slitta", "sled", "sledding", "schlitten", "rodeln", "luge", "trineo"],
  ["parcheggio", "parcheggi", "parking", "parkplatz", "parkplätze", "aparcamiento", "estacionamento", "parkering", "parkeren"],
  ["mangiare", "eat", "essen", "manger", "comer", "eten", "spise"],
  ["alloggio", "alloggi", "dormire", "sleep", "schlafen", "dormir", "accommodation", "unterkunft", "unterkünfte", "logement", "alojamiento", "overnatning"],
]

async function main() {
  const ws = await prisma.workspace.findUnique({
    where: { id: WS },
    select: { name: true, customChatbotAdvancedSettings: true },
  })
  if (!ws) throw new Error(`Workspace ${WS} not found`)

  const current =
    ws.customChatbotAdvancedSettings &&
    typeof ws.customChatbotAdvancedSettings === "object" &&
    !Array.isArray(ws.customChatbotAdvancedSettings)
      ? ws.customChatbotAdvancedSettings
      : {}
  console.log(`Workspace: ${ws.name}`)
  console.log(`Existing advanced-settings keys (preserved): ${Object.keys(current).join(", ") || "(none)"}`)

  await prisma.workspace.update({
    where: { id: WS },
    data: { customChatbotAdvancedSettings: { ...current, searchSynonyms } },
  })

  const words = searchSynonyms.reduce((n, g) => n + g.length, 0)
  console.log(`✅ searchSynonyms written: ${searchSynonyms.length} groups, ${words} words. Live from the next message.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => pool.end())
