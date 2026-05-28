/**
 * Pre-generate disk-cached translations of custom-<slug>/usecases.md.
 *
 * Mirrors the on-the-fly translation logic in
 * `apps/backend/src/interfaces/http/controllers/playground.controller.ts`
 * (translateUsecasesMarkdown + getUsecasesMarkdownForLang), but runs
 * eagerly so the playground first-click in IT/EN/FR/PT/CA/DE returns the
 * file immediately instead of waiting for OpenRouter.
 *
 * Output: writes `usecases.<lang>.md` next to the source file.
 *
 * Usage (from project root):
 *   dotenv -e .env -- tsx apps/backend/scripts/translate-usecases.ts
 *   dotenv -e .env -- tsx apps/backend/scripts/translate-usecases.ts --force
 *   dotenv -e .env -- tsx apps/backend/scripts/translate-usecases.ts --slug demowash --langs it,en
 *
 * Flags:
 *   --slug <slug>     Custom chatbot slug (default: demowash)
 *   --langs <list>    Comma-separated target langs (default: it,en,fr,pt,ca,de)
 *   --force           Re-translate even if the cached file already exists
 */

import axios from "axios"
import * as fs from "fs"
import * as path from "path"

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
function flag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`)
  if (idx === -1) return undefined
  return args[idx + 1]
}
const SLUG = flag("slug") || "demowash"
const FORCE = args.includes("--force")
const SUPPORTED = ["it", "en", "fr", "pt", "ca", "de"] as const
type Lang = (typeof SUPPORTED)[number]
const requested = (flag("langs") || SUPPORTED.join(","))
  .split(",")
  .map((s) => s.trim().toLowerCase())
const LANGS = requested.filter((l): l is Lang =>
  (SUPPORTED as readonly string[]).includes(l)
)
if (LANGS.length === 0) {
  console.error(`No valid target langs. Supported: ${SUPPORTED.join(", ")}`)
  process.exit(1)
}

const LANG_FULL_NAME: Record<Lang, string> = {
  it: "Italian",
  en: "English",
  fr: "French",
  pt: "Portuguese",
  ca: "Catalan",
  de: "German",
}

// ---------------------------------------------------------------------------
// Resolve source file (custom-<slug>/usecases.md)
// ---------------------------------------------------------------------------
const sourcePath = path.resolve(
  __dirname,
  "..",
  `custom-${SLUG}`,
  "usecases.md"
)
if (!fs.existsSync(sourcePath)) {
  console.error(`Source file not found: ${sourcePath}`)
  process.exit(1)
}
const source = fs.readFileSync(sourcePath, "utf-8")
console.log(`📖 Source: ${sourcePath}  (${source.length} chars)`)

// ---------------------------------------------------------------------------
// OpenRouter call (same prompt as the controller — keep them in sync)
// ---------------------------------------------------------------------------
const apiKey = process.env.OPENROUTER_API_KEY
if (!apiKey) {
  console.error("OPENROUTER_API_KEY missing in env. Aborting.")
  process.exit(1)
}
const model =
  process.env.OPENROUTER_TRANSLATION_MODEL || "openai/gpt-4o-mini"
console.log(`🤖 Model: ${model}`)

async function translate(targetLang: Lang): Promise<string> {
  const prompt = `You are a professional translator. Translate the following Markdown document from Spanish to ${LANG_FULL_NAME[targetLang]}.

STRICT RULES:
- Preserve ALL markdown syntax exactly: headings (#, ##, ###), bullets (-), bold (**...**), italics (*...*), code (\`...\`), blockquotes (>), tables, horizontal rules (---), links [text](url), images, emoji.
- Keep code blocks, URLs, anchor hrefs (#caso-...), file paths, JSON keys, regex, command/keyword tokens (WAIT, SELECT, OPEN, ERR-01, ALERT, BLOCK, ERR-12, etc.), placeholders like {{var}} or [LINK_x] EXACTLY as they are — do NOT translate them.
- Keep speaker labels exactly: "**Usuario:**" → translate the label to the target language ("**User:**" in en, "**Utente:**" in it, "**Usuari:**" in ca, "**Utilisateur:**" in fr, "**Utilizador:**" in pt, "**Benutzer:**" in de). "**Bot:**" stays as "**Bot:**".
- Keep proper nouns and brand names unchanged (Demowash, DemoWash, Mataró, Eixample, Rubí, Sant Cugat, Gràcia, Terrassa).
- Output ONLY the translated markdown, no preamble, no fences, no explanation.

DOCUMENT TO TRANSLATE:
${source}`

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a professional markdown translator. Output only the translated markdown.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 180_000,
    }
  )
  const translated: string | undefined =
    response.data?.choices?.[0]?.message?.content
  if (!translated || translated.trim().length < 20) {
    throw new Error(`Empty / too-short response from OpenRouter for ${targetLang}`)
  }
  return translated
}

// ---------------------------------------------------------------------------
// Main: translate sequentially (avoid rate limits) and write to disk
// ---------------------------------------------------------------------------
async function main() {
  const dir = path.dirname(sourcePath)
  const base = path.basename(sourcePath, ".md")
  let written = 0
  let skipped = 0
  let failed = 0
  for (const lang of LANGS) {
    const outPath = path.join(dir, `${base}.${lang}.md`)
    if (!FORCE && fs.existsSync(outPath)) {
      console.log(`⏭  ${lang}: cache exists, skipping (${outPath})`)
      skipped++
      continue
    }
    const started = Date.now()
    process.stdout.write(`🌍 ${lang}: translating... `)
    try {
      const translated = await translate(lang)
      fs.writeFileSync(outPath, translated, "utf-8")
      const ms = Date.now() - started
      console.log(`✅ ${ms}ms → ${outPath} (${translated.length} chars)`)
      written++
    } catch (err: any) {
      const reason =
        err?.response?.data?.error?.message ||
        err?.response?.data ||
        err?.message ||
        err
      console.log(`❌ ${lang}: ${reason}`)
      failed++
    }
  }
  console.log(
    `\nDone. written=${written}  skipped=${skipped}  failed=${failed}`
  )
  if (failed > 0) process.exit(2)
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
