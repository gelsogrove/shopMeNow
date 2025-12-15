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
- Never invent categories/regions/certifications; if unknown, prefer text filter.
- If request is ambiguous, return: {"entity":"products","intent":"list","filters":[{"field":"text","op":"contains","value":"<user_terms>"}]}
- You MUST NOT include additional keys.`

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
const MODEL = "openai/gpt-4o-mini"
const MAX_RETRIES = 2

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

        const usage = data.usage
        const normalizedUsage = usage
          ? {
              promptTokens: usage.prompt_tokens ?? usage.promptTokens ?? 0,
              completionTokens: usage.completion_tokens ?? usage.completionTokens ?? 0,
              totalTokens: usage.total_tokens ?? usage.totalTokens ?? 0,
            }
          : undefined

        return {
          query: validation.data,
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
