process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  moduleResolution: "NodeNext",
})
require("ts-node/register/transpile-only")

const loadPrisma = () => {
  const pkg = require("@echatbot/database")
  return pkg.prisma || pkg.default
}

const SYSTEM_PROMPT = `You are a product matcher.
Given a user query and a list of products, return the products that match the query.
Rules:
- Use semantic understanding and handle typos in any language.
- Match based on meaning from product title, description, category, region, format, transport, and certifications.
- If the query term appears (or a simple singular/plural variant appears) in any product field, you MUST include that product.
- For each match, provide an evidence snippet that appears verbatim in the provided product fields.
- Do NOT invent products or IDs.
- Return at most 20 matches ordered by relevance.
- Output ONLY valid JSON in this format:
  {"matches":[{"n":1,"evidence":"exact snippet"},{"n":2,"evidence":"exact snippet"}]}`

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
const MODEL = "openai/gpt-4o-mini"
const BATCH_SIZE = 200
const MAX_IDS = 20
const MAX_TOKENS = 400

const parseArgs = () => {
  const args = process.argv.slice(2)
  const out = {}
  for (let i = 0; i < args.length; i++) {
    const key = args[i]
    const value = args[i + 1]
    if (key === "--workspace") out.workspaceId = value
    if (key === "--query") out.query = value
  }
  return out
}

const sanitizeJson = (content) => {
  let sanitized = (content || "").trim()
  if (sanitized.startsWith("```")) {
    const lines = sanitized.split("\n")
    lines.shift()
    if (lines.length > 0 && lines[lines.length - 1].trim().startsWith("```")) {
      lines.pop()
    }
    sanitized = lines.join("\n").trim()
  }
  return sanitized
}

const extractFirstJsonObject = (input) => {
  const start = input.indexOf("{")
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < input.length; i++) {
    const char = input[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === "\\") {
      escaped = true
      continue
    }
    if (char === "\"") {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === "{") depth += 1
    if (char === "}") depth -= 1
    if (depth === 0) {
      return input.slice(start, i + 1)
    }
  }
  return null
}

const parseJsonObject = (content) => {
  const cleaned = sanitizeJson(content || "")
  try {
    return JSON.parse(cleaned)
  } catch {}
  const first = extractFirstJsonObject(cleaned)
  if (!first) return null
  try {
    return JSON.parse(first)
  } catch {
    return null
  }
}

const callLLM = async (apiKey, query, candidates) => {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            query,
            products: candidates,
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    return { ids: [], error: `HTTP ${response.status}` }
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content || typeof content !== "string") {
    return { ids: [], error: "empty_response" }
  }

  const parsed = parseJsonObject(content)
  if (!parsed) {
    return { ids: [], error: "invalid_json", raw: content }
  }

  const matches = Array.isArray(parsed?.matches) ? parsed.matches : []
  const ids = matches
    .map((entry) => (typeof entry?.n === "number" ? entry.n : null))
    .filter(Boolean)
  return { ids, raw: content }
}

const main = async () => {
  const { workspaceId, query } = parseArgs()
  if (!workspaceId || !query) {
    console.error("Usage: node scripts/test-llm-search.cjs --workspace <id> --query \"text\"")
    process.exit(1)
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY not set")
    process.exit(1)
  }

  const prisma = loadPrisma()

  try {
    const products = await prisma.products.findMany({
      where: { workspaceId, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        region: true,
        formato: true,
        transportType: true,
        productCategories: { select: { category: { select: { name: true } } } },
        productCertifications: { select: { certification: { select: { name: true } } } },
        certifications: true,
      },
      orderBy: { name: "asc" },
    })

    console.log(`Loaded products: ${products.length}`)

    const candidates = products.map((product, index) => ({
      n: index + 1,
      name: product.name,
      description: product.description || "",
      category: product.productCategories?.[0]?.category?.name || "",
      region: product.region || "",
      formato: product.formato || "",
      transport: product.transportType || "",
      certifications: Array.isArray(product.certifications)
        ? product.certifications.map(String)
        : Array.isArray(product.productCertifications)
          ? product.productCertifications
              .map((pc) => pc.certification?.name)
              .filter(Boolean)
          : [],
    }))

    const byId = new Map(products.map((p) => [p.id, p]))
    const allIds = []

    for (let start = 0; start < candidates.length; start += BATCH_SIZE) {
      const batch = candidates.slice(start, start + BATCH_SIZE)
      const batchProducts = products.slice(start, start + BATCH_SIZE)
      const { ids, error, raw } = await callLLM(apiKey, query, batch)
      if (error) {
        console.warn(`Batch ${start}-${start + batch.length}: ${error}`)
        if (raw) {
          const preview = String(raw).replace(/\s+/g, " ").slice(0, 400)
          console.warn(`Raw response preview: ${preview}`)
        }
        continue
      }
      if (ids.length === 0 && raw) {
        const preview = String(raw).replace(/\s+/g, " ").slice(0, 400)
        console.warn(`Batch ${start}-${start + batch.length}: empty ids`)
        console.warn(`Raw response preview: ${preview}`)
      }
      if (start === 0 && raw) {
        const preview = String(raw).replace(/\s+/g, " ").slice(0, 400)
        console.log(`Raw response preview (batch 0): ${preview}`)
      }
      for (const n of ids) {
        if (typeof n !== "number") continue
        if (n < 1 || n > batchProducts.length) continue
        const id = batchProducts[n - 1].id
        if (!allIds.includes(id)) {
          allIds.push(id)
        }
      }
    }

    let finalIds = allIds.slice(0, MAX_IDS)
    if (allIds.length > MAX_IDS) {
      const refinementCandidates = finalIds.map((id, index) => {
        const product = byId.get(id)
        return {
          n: index + 1,
          name: product?.name || "",
          description: product?.description || "",
          category: product?.productCategories?.[0]?.category?.name || "",
          region: product?.region || "",
          formato: product?.formato || "",
          transport: product?.transportType || "",
          certifications: Array.isArray(product?.certifications)
            ? product.certifications.map(String)
            : [],
        }
      })

      const { ids } = await callLLM(apiKey, query, refinementCandidates)
      if (ids.length > 0) {
        const refined = []
        for (const n of ids) {
          if (typeof n !== "number") continue
          if (n < 1 || n > finalIds.length) continue
          refined.push(finalIds[n - 1])
        }
        finalIds = refined.slice(0, MAX_IDS)
      }
    }

    const matched = finalIds.map((id) => byId.get(id)).filter(Boolean)
    console.log(`Query: ${query}`)
    console.log(`Matches: ${matched.length}`)
    matched.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} (${product.id})`)
    })
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
