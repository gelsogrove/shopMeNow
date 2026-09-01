/**
 * Dialogue simulator for custom-demosappada — the CLI runner this module
 * lacked (demoam and demorobot have one; not having it cost half a night of
 * "fix → restart the backend → retest by hand", 2026-08-28).
 *
 * Runs the REAL module (agent.ts, loaded from source) against the REAL LLM,
 * with in-memory stand-ins for every host handler: no backend process, no
 * database, no restarts — an edit here is live on the next run.
 *
 *   npx tsx sim.ts                     # scripted default dialogue
 *   npx tsx sim.ts "msg1" "msg2" ...   # your own dialogue, one arg per turn
 *
 * 💶 Every turn calls the real model configured in settings.json — declare
 * the run to Andrea before launching big scripts (CLAUDE.md §16A applies in
 * spirit: a default run is ~6 turns of gpt-4o-mini, well under €0.05).
 *
 * The FAQ/catalogue fixtures below are TEST DATA for the harness, not
 * content anyone ships: production content lives in the workspace DB
 * (CLAUDE.md §1 untouched — nothing here reaches a customer).
 */
import { config as loadEnv } from 'dotenv'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ChatbotInput, HistoryEntry } from './index.js'
import type { FaqEntry, CatalogueEntry, StayProfile } from './agent.js'

// Repo-root .env, loaded the way the backend loads it (values never printed).
// The MODULE is imported dynamically below, AFTER this runs: llm.ts snapshots
// OPENROUTER_API_KEY at import time, and static imports are hoisted above
// this call — the first sim run died exactly that way.
loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

const HERE = dirname(fileURLToPath(import.meta.url))
const settings = JSON.parse(readFileSync(join(HERE, 'settings.json'), 'utf8'))

// A/B harness override, in memory only: settings.json is GENERATED from the
// DB (CLAUDE.md §1D) and is never edited by hand — the real model is chosen
// in the backoffice. SIM_MODEL exists so two sim runs can compare models
// before Andrea commits to one there.
if (process.env.SIM_MODEL) settings.model = process.env.SIM_MODEL
// SIM_TURN_ENGINE=v2 runs the four-step turn (turn.ts) instead of the loop.
if (process.env.SIM_TURN_ENGINE) settings.turnEngine = process.env.SIM_TURN_ENGINE

// ── In-memory host stand-ins ───────────────────────────────────────────────

/**
 * SIM_FAQ_FILE=<path.json> replaces the fixtures below with a real catalogue
 * dumped from a workspace ([{question, answer}, ...]).
 *
 * WHY (Andrea, 2026-09-01): the fixtures are eight entries and contain no
 * health content, so they cannot reproduce a retrieval failure that only
 * appears against the tenant's real 82. Verifying the "bimba ha la febbre"
 * regression needs the entry that actually carries 116117. The dump is test
 * input, never shipped content (CLAUDE.md §1 untouched).
 */
const faqOverridePath = process.env.SIM_FAQ_FILE
const FAQ_OVERRIDE: FaqEntry[] | null = faqOverridePath
  ? (JSON.parse(readFileSync(faqOverridePath, 'utf8')) as FaqEntry[])
  : null

const FAQS: FaqEntry[] = [
  {
    question: 'Dove si buttano i rifiuti? Raccolta differenziata a Sappada',
    answer:
      'Raccolta differenziata con i contenitori nelle borgate: umido (marrone), carta (giallo), ' +
      'plastica e lattine (blu), vetro (verde), secco (grigio). Ecocentro in via Bach aperto il ' +
      'sabato 9-12. Info: 0435 469131.',
  },
  {
    question: 'Cascatelle del Mühlbach: come si arriva?',
    answer:
      'Percorso facile di 20 minuti a/r, dislivello 91 m, partenza dal ponte di legno sul rio ' +
      'Mühlbach vicino al Piccolo Museo della Grande Guerra. Passerelle tra le rocce. ' +
      'Info: https://www.visitsappada.it/cascatelle.php',
  },
  {
    question: 'Sorgenti del Piave: escursione e rifugio',
    answer:
      'Dal piazzale in Val Sesis, 30 minuti a/r, dislivello minimo, adatta a tutti. Al Rifugio ' +
      'Sorgenti del Piave cucina alpina semplice. Tel. 334 7799175.',
  },
  {
    question: 'Rifugio Piani del Cristo: orari e cucina',
    answer:
      'Raggiungibile in circa 2 ore e mezza a/r, dislivello 300 m. Cucina tipica. Tel. 0435 469120.',
  },
  {
    question: 'Dove mangiare prodotti tipici a Sappada?',
    answer:
      'Latteria di Sappada Plodarkelder, prodotti locali e piatti tipici. Tel. 0435 469833.',
  },
  {
    question: 'Dove dormire a Sappada? Elenco strutture',
    answer:
      'Elenco completo delle strutture: https://www.visitsappada.it/dove-dormire.php — InfoPoint 0435 469131.',
  },
]

const CATALOGUE: CatalogueEntry[] = [
  { name: 'Agriturismo Zaine', description: 'Agriturismo in Borgata Soravia 32.', link: 'https://www.visitsappada.it/dove-dormire.php', type: 'hotel' },
  { name: 'Bach Boutique Hotel', description: 'Hotel in Borgata Bach 26, con ristorante.', link: 'https://www.visitsappada.it/dove-dormire.php', type: 'hotel' },
]

// The host's merge, faithfully: empty values never overwrite, "RISOLTO"
// deletes (custom-client-chatbot.service.ts saveStayProfile).
let stayProfile: Record<string, unknown> | null = null
function mergeProfile(patch: StayProfile): void {
  const merged: Record<string, unknown> = { ...(stayProfile ?? {}) }
  for (const [k, v] of Object.entries(patch)) {
    if (v === 'RISOLTO') {
      delete merged[k]
      continue
    }
    if (v !== undefined && v !== null && v !== '') merged[k] = v
  }
  stayProfile = merged
}

// ── The dialogue ───────────────────────────────────────────────────────────

const DEFAULT_DIALOGUE = [
  'prossimo weekend a Sappada. Suggeriscimi per favore un paio di escursioni di massimo 4 ore a/r di camminata, massimo 500 mt di dislivello, con possibilitá di pranzo in un rifugio',
  'fino a domenica',
  'siamo in due',
  'sono ciliaco e non ho la macchina',
  'no',
  'si',
  'andrea',
]

async function main(): Promise<void> {
  // Dynamic, so the env above is loaded before llm.ts snapshots the API key.
  const { chatbotFn } = await import('./index.js')
  // The built-in tools reach the module as WorkspaceCallingFunction rows via
  // getCustomTools in production; the manifest is their single source, so the
  // sim serves it directly.
  const { MODULE_TOOLS } = await import('./tools.manifest.js')
  // SIM_WITHOUT_TOOLS="save_preferences,remember": switch tools off for a
  // run, the way an admin can in Settings → Custom Tools. Used to prove the
  // code's own paths — with save_preferences gone, the only way a fact can
  // reach the state is the deterministic capture (2026-08-28).
  const withoutTools = new Set((process.env.SIM_WITHOUT_TOOLS ?? '').split(',').map((t) => t.trim()).filter(Boolean))
  const customTools = MODULE_TOOLS.filter((t) => !withoutTools.has(t.functionName)).map((t) => ({
    name: t.functionName,
    description: t.description,
    parameters: t.parameters,
    responseInstructions: t.responseInstructions,
  }))

  const turns = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_DIALOGUE
  const history: HistoryEntry[] = []
  let persistedState: unknown

  for (const userMessage of turns) {
    console.log(`\n🧑 ${userMessage}`)
    const input: ChatbotInput = {
      userMessage,
      userName: process.env.SIM_NO_NAME ? '' : 'Sim',
      channel: 'widget',
      config: {
        workspaceId: 'sim-workspace',
        debugChannel: false,
        isPlayground: false,
        settings,
        messages: null,
        handlers: {
          getFaqs: async () => FAQ_OVERRIDE ?? FAQS,
          getCatalogue: async () => CATALOGUE,
          getCustomTools: async () => customTools,
          getStayProfile: async () => (stayProfile ? ({ ...stayProfile } as StayProfile) : null),
          saveStayProfile: async ({ profile }) => {
            mergeProfile(profile)
            return true
          },
          saveFeedback: async () => true,
          savePushConsent: async () => true,
          setCustomerTags: async () => true,
        },
      },
      context: {
        sessionId: 'sim-session',
        customerId: 'sim-customer',
        history: [...history],
        persistedState,
      },
    }

    const out = await chatbotFn(input)
    persistedState = out.persistedState ?? persistedState

    console.log(`🤖 ${out.reply ?? `(nessuna risposta${out.error ? ` — ${out.error}` : ''})`}`)
    history.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() })
    if (out.reply) {
      history.push({ role: 'assistant', content: out.reply, timestamp: new Date().toISOString() })
    }
  }

  console.log('\n═══ stayProfile finale ═══')
  console.log(JSON.stringify(stayProfile, null, 2))
}

main().catch((e) => {
  console.error('SIM ERROR:', e instanceof Error ? e.message : e)
  process.exit(1)
})
