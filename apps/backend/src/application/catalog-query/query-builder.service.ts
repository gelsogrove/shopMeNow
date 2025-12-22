import logger from "../../utils/logger"
import { CatalogQuery, CatalogQuerySchema } from "./catalog-query.schema"

interface BuildResult {
  query: CatalogQuery
  rawResponse: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

const QUERY_BUILDER_SYSTEM = `You are QueryBuilder.
Your job: convert the user message into a JSON object that matches the CatalogQuery schema.

Rules:
- Output ONLY valid JSON. No prose.
- Do NOT use markdown.
- When the user asks to group items (e.g., "raggruppati per regione", "group by category", "divisi per certificazione"), set the \`groupBy\` array with the requested field ("region", "category", or "certification").
- If the user asks to group by transport / spedizione / catena del freddo, set \`groupBy\` to ["transport"].
- Never invent categories/regions/certifications; if unknown, prefer text filter.
- If the user simply wants to browse the catalog (e.g., "che prodotti avete?", "fammi vedere i prodotti", "mostra cosa vendete") return a plain list with NO filters: {"entity":"products","intent":"list"}
- Use text filters ONLY when the user clearly specifies a keyword to search (e.g., "prodotti con pistacchio", "offerte sul tartufo").
- When the user mentions a transport type (e.g., "prodotti congelati", "trasporto refrigerato", "temperatura ambiente"), add a transport filter: {"field":"transport","op":"eq","value":"<user transport term>"} using the same language/term provided by the user.
- You MUST NOT include additional keys.

Examples:
- "Che prodotti avete?" → {"entity":"products","intent":"list"}
- "Mostra i prodotti raggruppati per categoria" → {"entity":"products","intent":"list","groupBy":["category"]}
- "Lista prodotti raggruppati per regione d'Italia" → {"entity":"products","intent":"list","groupBy":["region"]}
- "Prodotti divisi per certificazioni" → {"entity":"products","intent":"list","groupBy":["certification"]}
- "Raggruppa i prodotti per trasporto" → {"entity":"products","intent":"list","groupBy":["transport"]}
- "Mostra prodotti temperatura ambiente" → {"entity":"products","intent":"list","filters":[{"field":"transport","op":"eq","value":"temperatura ambiente"}]}`

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
const MODEL = "openai/gpt-4o-mini"
const MAX_RETRIES = 2

type GroupField = "category" | "region" | "certification"

function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function detectGroupByField(message: string): GroupField | undefined {
  const normalized = normalizeForMatch(message)

  const groupingMarkers = ["raggrupp", "divisi", "divise", "gruppate", "group", "organizza", "ordina"]
  const hasGroupingIntent = groupingMarkers.some((marker) => normalized.includes(marker))

  const regionKeywords = ["regione", "regione ditalia", "regioni", "region"]
  const categoryKeywords = ["categoria", "categorie", "category", "categories"]
  const certificationKeywords = ["certific", "dop", "igp", "docg", "igt", "organic certification"]

  if (regionKeywords.some((kw) => normalized.includes(kw)) && (hasGroupingIntent || normalized.includes("per regione"))) {
    return "region"
  }

  if (categoryKeywords.some((kw) => normalized.includes(kw)) && (hasGroupingIntent || normalized.includes("per categoria"))) {
    return "category"
  }

  // Allow certification grouping even without explicit "raggruppa" marker
  if (certificationKeywords.some((kw) => normalized.includes(kw))) {
    return "certification"
  }

  return undefined
}

function detectCertificationFilters(message: string): string[] {
  const normalized = normalizeForMatch(message)
  const matches: Set<string> = new Set()
  const mapping: Array<{ kw: string; value: string }> = [
    { kw: "dop", value: "DOP" },
    { kw: "igp", value: "IGP" },
    { kw: "docg", value: "DOCG" },
    { kw: "doc", value: "DOC" },
    { kw: "igt", value: "IGT" },
    { kw: "bio", value: "BIO" },
    { kw: "organic", value: "BIO" },
  ]

  for (const entry of mapping) {
    if (normalized.includes(entry.kw)) {
      matches.add(entry.value)
    }
  }

  if (normalized.includes("certific")) {
    matches.add("DOP") // default to most common when generic "certificato" is asked
  }

  return Array.from(matches)
}

function sanitizeJsonPayload(content: string): string {
  const trimmed = content.trim()
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim()
  }
  return trimmed
}

export class CatalogQueryBuilder {
  private apiKey: string

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || ""
    if (!this.apiKey) {
      logger.warn("⚠️ [CatalogQueryBuilder] OPENROUTER_API_KEY not set - QueryBuilder will fail")
    }
  }

  async build(userMessage: string): Promise<BuildResult> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            temperature: 0,
            max_tokens: 200,
            messages: [
              { role: "system", content: QUERY_BUILDER_SYSTEM },
              { role: "user", content: userMessage },
            ],
          }),
        })

        if (!response.ok) {
          throw new Error(`OpenRouter error ${response.status}`)
        }

        const data = await response.json()
        const rawContent = data.choices?.[0]?.message?.content
        if (!rawContent || typeof rawContent !== "string") {
          throw new Error("QueryBuilder returned empty response")
        }

        const sanitized = sanitizeJsonPayload(rawContent)
        let parsed: unknown
        try {
          parsed = JSON.parse(sanitized)
        } catch (error) {
          throw new Error(`Invalid JSON output: ${(error as Error).message}`)
        }

        const validation = CatalogQuerySchema.safeParse(parsed)
        if (!validation.success) {
          throw new Error(`Schema validation failed: ${validation.error.message}`)
        }

        const enrichedQuery = { ...validation.data }
        if (!enrichedQuery.groupBy || enrichedQuery.groupBy.length === 0) {
          const inferredGroup = detectGroupByField(userMessage)
          if (inferredGroup) {
            enrichedQuery.groupBy = [inferredGroup]
          }
        }

        // Auto-apply certification filters when the user asks for DOP/IGP/BIO etc.
        const detectedCerts = detectCertificationFilters(userMessage)
        const hasCertFilter = enrichedQuery.filters?.some(
          (f) => f.field === "certification" && Array.isArray((f as any).value) && (f as any).value.length > 0
        )
        if (!hasCertFilter && detectedCerts.length > 0) {
          enrichedQuery.filters = enrichedQuery.filters || []
          enrichedQuery.filters.push({
            field: "certification",
            op: "in",
            value: detectedCerts,
          })
        }

        const usage = data.usage
        const normalizedUsage = usage
          ? {
              promptTokens: usage.prompt_tokens ?? usage.promptTokens ?? 0,
              completionTokens: usage.completion_tokens ?? usage.completionTokens ?? 0,
              totalTokens: usage.total_tokens ?? usage.totalTokens ?? 0,
            }
          : undefined

        return {
          query: enrichedQuery,
          rawResponse: sanitized,
          model: data.model || MODEL,
          usage: normalizedUsage,
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        logger.warn("⚠️ [CatalogQueryBuilder] Attempt failed", {
          attempt,
          error: lastError.message,
        })
      }
    }

    throw lastError || new Error("QueryBuilder failed")
  }
}

export type CatalogQueryBuilderResult = Awaited<ReturnType<CatalogQueryBuilder["build"]>>
