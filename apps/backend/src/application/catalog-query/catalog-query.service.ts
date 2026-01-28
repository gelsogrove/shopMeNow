import { PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"
import {
  ListItem,
  GroupedItems,
  StructuredResponse,
  ResponseContext,
  RESPONSE_DEFAULT_FORMATTING,
} from "../response-builder/response-builder.service"
import { ProductData } from "../data-loader/data-loader.service"
import { CatalogQueryBuilder } from "./query-builder.service"
import { CatalogQuery } from "./catalog-query.schema"
import { executeCatalogQuery, CatalogQueryResult } from "./query-executor"

type GroupField = "category" | "region" | "certification" | "transport"
type GroupDescriptor = {
  key: string
  ids: string[]
  count: number
  isFallback?: boolean
}

export interface CatalogQueryLoadedData {
  type: "CATALOG_QUERY_RESULT"
  resultType: CatalogQueryResult["type"]
  products?: ProductData[]
  groups?: Array<GroupDescriptor>
}

export interface CatalogQueryProcessingResult {
  loadedData: CatalogQueryLoadedData
  structuredResponse: StructuredResponse
  query: CatalogQuery
  model: string
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  resultType: CatalogQueryResult["type"]
}

interface ProcessOptions {
  workspaceId: string
  message: string
  customerDiscount?: number
  intentType: string
  customerLanguage?: string
  customerIsActive?: boolean // 🔒 Feature 174: For price visibility control
}

export class CatalogQueryService {
  private builder: CatalogQueryBuilder

  constructor(private prisma: PrismaClient) {
    this.builder = new CatalogQueryBuilder()
  }

  async process(options: ProcessOptions): Promise<CatalogQueryProcessingResult> {
    const { workspaceId, message, customerDiscount = 0, intentType, customerLanguage = "it", customerIsActive = false } = options

    // 🔒 DEBUG: Log customerIsActive per tracking Rule #4
    logger.info("🔒 CatalogQueryService.process() - Rule #4 Debug", {
      workspaceId,
      message: message.substring(0, 50),
      customerIsActive,
      intentType,
      timestamp: new Date().toISOString()
    })

    const builderResult = await this.builder.build(message)
    const finalQuery: CatalogQuery = { ...builderResult.query }
    const trimmedMessage = message.trim()
    const hasFilters = Array.isArray(finalQuery.filters) && finalQuery.filters.length > 0
    const hasGroupBy = Array.isArray(finalQuery.groupBy) && finalQuery.groupBy.length > 0

    // For SEARCH_PRODUCTS, enforce a text filter when the builder returns a plain list.
    if (intentType === "SEARCH_PRODUCTS" && trimmedMessage.length > 1 && !hasFilters && !hasGroupBy) {
      finalQuery.filters = [
        {
          field: "text",
          op: "contains",
          value: trimmedMessage,
        },
      ]
    }
    const products = await this.loadProducts(workspaceId, customerDiscount, customerIsActive)

    if (products.length === 0) {
      return {
        loadedData: {
          type: "CATALOG_QUERY_RESULT",
          resultType: "EMPTY",
        },
        structuredResponse: this.buildNoResultsResponse(customerLanguage, intentType, customerDiscount),
        query: finalQuery,
        model: builderResult.model,
        tokenUsage: builderResult.usage,
        resultType: "EMPTY",
      }
    }

    const result = executeCatalogQuery(products, finalQuery)

    if (
      result.type === "EMPTY" &&
      intentType === "SEARCH_PRODUCTS" &&
      trimmedMessage.length > 0
    ) {
      const llmMatches = await this.selectProductsWithLLM(products, trimmedMessage)
      if (llmMatches.length > 0) {
        const structuredResponse = this.buildListResponse(
          llmMatches,
          intentType,
          customerLanguage,
          customerDiscount,
          finalQuery.groupBy?.[0]
        )

        return {
          loadedData: {
            type: "CATALOG_QUERY_RESULT",
            resultType: "LIST",
            products: llmMatches,
          },
          structuredResponse,
          query: finalQuery,
          model: "openai/gpt-4o-mini",
          resultType: "LIST",
        }
      }
    }

    switch (result.type) {
      case "LIST": {
        const structuredResponse = this.buildListResponse(
          result.items,
          intentType,
          customerLanguage,
          customerDiscount,
          builderResult.query.groupBy?.[0]
        )

        return {
          loadedData: {
            type: "CATALOG_QUERY_RESULT",
            resultType: "LIST",
            products: result.items,
          },
          structuredResponse,
          query: finalQuery,
          model: builderResult.model,
          tokenUsage: builderResult.usage,
          resultType: "LIST",
        }
      }
      case "GROUPED": {
        const structuredResponse = this.buildGroupedResponse(
          result.groups,
          products,
          intentType,
          customerLanguage,
          customerDiscount
        )

        return {
          loadedData: {
            type: "CATALOG_QUERY_RESULT",
            resultType: "GROUPED",
            groups: result.groups,
          },
          structuredResponse,
          query: finalQuery,
          model: builderResult.model,
          tokenUsage: builderResult.usage,
          resultType: "GROUPED",
        }
      }
      case "AGGREGATE": {
        const structuredResponse = this.buildAggregateResponse(
          result.aggregate.type,
          result.aggregate.value,
          intentType,
          customerLanguage,
          customerDiscount
        )

        return {
          loadedData: {
            type: "CATALOG_QUERY_RESULT",
            resultType: "AGGREGATE",
          },
          structuredResponse,
          query: finalQuery,
          model: builderResult.model,
          tokenUsage: builderResult.usage,
          resultType: "AGGREGATE",
        }
      }
      default: {
        return {
          loadedData: {
            type: "CATALOG_QUERY_RESULT",
            resultType: "EMPTY",
          },
          structuredResponse: this.buildNoResultsResponse(customerLanguage, intentType, customerDiscount),
          query: finalQuery,
          model: builderResult.model,
          tokenUsage: builderResult.usage,
          resultType: "EMPTY",
        }
      }
    }
  }

  private async loadProducts(workspaceId: string, customerDiscount: number, customerIsActive: boolean = false): Promise<ProductData[]> {
    try {
      const products = await this.prisma.products.findMany({
        where: { workspaceId, isActive: true },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
          region: true,
          formato: true,
          type: true,
          productCategories: {
            select: { category: { select: { id: true, name: true } } },
          },
          productCertifications: {
            select: { certification: { select: { name: true } } },
          },
          productTypes: {
            select: { type: { select: { name: true } } },
          },
          certifications: true,
          allergens: true,
        },
        orderBy: { name: "asc" },
      })

      return products.map((product) => this.mapProduct(product, customerDiscount, customerIsActive))
    } catch (error) {
      logger.error("❌ [CatalogQueryService] Failed to load products", { error })
      return []
    }
  }

  private mapProduct(product: any, customerDiscount: number, customerIsActive: boolean = false): ProductData {
    // 🔒 Feature 174: Hide prices for non-registered users
    const discount = customerDiscount > 0 ? product.price * (1 - customerDiscount / 100) : undefined
    const finalPrice = customerIsActive ? (discount || product.price) : null // Hide price if not registered
    
    // 🔒 DEBUG: Log price hiding logic
    if (product.name.toLowerCase().includes('mozzarella')) {
      logger.info("🔒 CatalogQueryService.mapProduct() - Price Hiding Debug", {
        productName: product.name,
        originalPrice: product.price,
        customerIsActive,
        finalPrice,
        discount,
        priceHidden: !customerIsActive
      })
    }
    
    const certs = Array.isArray(product.productCertifications)
      ? product.productCertifications
          .map((pc: any) => pc.certification?.name)
          .filter(Boolean)
      : Array.isArray(product.certifications)
        ? product.certifications.map(String)
        : []
    const allergens = Array.isArray(product.allergens) ? product.allergens.map(String) : []
    return {
      id: product.id,
      name: product.name,
      sku: product.sku || undefined,
      description: product.description || undefined,
      price: finalPrice, // 🔒 Feature 174: null if user not registered
      priceWithDiscount: customerIsActive ? discount : null, // 🔒 Feature 174: null if user not registered
      stock: product.stock,
      imageUrl: Array.isArray(product.imageUrl) && product.imageUrl.length > 0 ? String(product.imageUrl[0]) : undefined,
      categoryId: product.productCategories?.[0]?.category?.id,
      categoryName: product.productCategories?.[0]?.category?.name,
      region: product.region || undefined,
      formato: product.formato || undefined,
      certifications: certs,
      allergens,
      type:
        product.type ||
        product.productTypes?.[0]?.type?.name ||
        undefined,
      isAvailable: product.stock > 0,
    }
  }

  private async selectProductsWithLLM(
    products: ProductData[],
    query: string
  ): Promise<ProductData[]> {
    try {
      const apiKey = process.env.OPENROUTER_API_KEY || ""
      if (!apiKey) {
        logger.warn("⚠️ [CatalogQueryService] OPENROUTER_API_KEY not set - LLM fallback skipped")
        return []
      }

      const trimmedQuery = query.trim()
      if (!trimmedQuery) {
        return []
      }

      const systemPrompt = `You are a product matcher.
Given a user query and a list of products, return the products that match the query.
Rules:
- Use semantic understanding and handle typos in any language.
- Match based on meaning from product title, description, category, region, format, transport, and certifications.
- If the query term appears (or a simple singular/plural variant appears) in any product field, you MUST include that product.
- For each match, provide an evidence snippet that appears verbatim in the provided product fields.
- Do NOT invent products or IDs.
- Return at most 20 matches ordered by relevance.
- Use ONLY the numeric field "n" to refer to products (do not return any IDs).
- Output ONLY valid JSON in this format:
  {"matches":[{"n":1,"evidence":"exact snippet"},{"n":2,"evidence":"exact snippet"}]}`

      const byId = new Map(products.map((p) => [p.id, p]))
      const allIds: string[] = []
      const batchSize = 200
      const maxIds = 20

      for (let start = 0; start < products.length; start += batchSize) {
        const batch = products.slice(start, start + batchSize)
        const batchCandidates = batch.map((product, index) => ({
          n: index + 1,
          name: product.name,
          description: product.description || "",
          category: product.categoryName || "",
          region: product.region || "",
          formato: product.formato || "",
          transport: product.type || "",
          certifications: product.certifications || [],
        }))

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini",
            temperature: 0,
            max_tokens: 400,
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: JSON.stringify({
                  query: trimmedQuery,
                  products: batchCandidates,
                }),
              },
            ],
          }),
        })

        if (!response.ok) {
          logger.warn("⚠️ [CatalogQueryService] LLM fallback error", {
            status: response.status,
            batchStart: start,
          })
          continue
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content
        if (!content || typeof content !== "string") {
          continue
        }

        const parsed = this.parseJsonObject(content, {
          logContext: { batchStart: start },
        })
        if (!parsed) {
          continue
        }

        const ids = this.extractMatchedIds(parsed, batch, byId)
        for (const id of ids) {
          if (!allIds.includes(id)) {
            allIds.push(id)
          }
        }
      }

      if (allIds.length === 0) {
        return []
      }

      let finalIds = allIds.slice(0, maxIds)

      if (allIds.length > maxIds) {
        const refinementCandidates = finalIds
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((product, index) => ({
            n: index + 1,
            name: product!.name,
            description: product!.description || "",
            category: product!.categoryName || "",
            region: product!.region || "",
            formato: product!.formato || "",
            transport: product!.type || "",
            certifications: product!.certifications || [],
          }))

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini",
            temperature: 0,
            max_tokens: 400,
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: JSON.stringify({
                  query: trimmedQuery,
                  products: refinementCandidates,
                }),
              },
            ],
          }),
        })

        if (response.ok) {
          const data = await response.json()
          const content = data.choices?.[0]?.message?.content
          if (content && typeof content === "string") {
            const parsed = this.parseJsonObject(content, {
              logPrefix: "LLM refinement",
            })
            const ids = this.extractMatchedIds(parsed, refinementCandidates.map((entry) => ({
              id: finalIds[entry.n - 1],
              name: entry.name,
              description: entry.description,
              categoryName: entry.category,
              region: entry.region,
              formato: entry.formato,
              type: entry.transport,
              certifications: entry.certifications,
            })) as ProductData[], byId)
            if (ids.length > 0) {
              finalIds = ids.slice(0, maxIds)
            }
          }
        }
      }

      const matched = finalIds.map((id) => byId.get(id)).filter(Boolean) as ProductData[]
      const directMatches = this.findDirectMatches(products, trimmedQuery)
      const combined = [
        ...matched,
        ...directMatches.filter((item) => !matched.some((m) => m.id === item.id)),
      ]

      logger.info("🧠 [CatalogQueryService] LLM fallback matches", {
        query: trimmedQuery,
        matched: combined.length,
        directMatches: directMatches.length,
      })

      return combined
    } catch (error) {
      logger.error("❌ [CatalogQueryService] LLM fallback failed", { error })
      return []
    }
  }

  private parseJsonObject(
    content: string,
    options?: {
      logPrefix?: string
      logContext?: Record<string, unknown>
    }
  ): any | null {
    const prefix = options?.logPrefix || "LLM fallback"
    const context = options?.logContext || {}
    const trimmed = content.trim()
    const cleaned = this.stripCodeFence(trimmed)
    const direct = this.tryParseJson(cleaned)
    if (direct) {
      return direct
    }

    const firstObject = this.extractFirstJsonObject(cleaned)
    const parsed = firstObject ? this.tryParseJson(firstObject) : null
    if (!parsed) {
      logger.warn(`⚠️ [CatalogQueryService] ${prefix} returned invalid JSON`, {
        ...context,
      })
    }
    return parsed
  }

  private stripCodeFence(input: string): string {
    let sanitized = input.trim()
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

  private tryParseJson(input: string): any | null {
    if (!input) return null
    try {
      return JSON.parse(input)
    } catch {
      return null
    }
  }

  private extractFirstJsonObject(input: string): string | null {
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

  private extractMatchedIds(
    parsed: any,
    batch: ProductData[],
    byId: Map<string, ProductData>
  ): string[] {
    const matches = Array.isArray(parsed?.matches) ? parsed.matches : []
    const idsFromMatches = matches
      .map((entry: any) => {
        const index = typeof entry?.n === "number" ? entry.n : null
        const evidence = typeof entry?.evidence === "string" ? entry.evidence : ""
        if (!index || index < 1 || index > batch.length) return null
        const product = batch[index - 1]
        if (!product) return null
        if (!this.hasEvidence(product, evidence)) return null
        return product.id
      })
      .filter(Boolean) as string[]

    if (idsFromMatches.length > 0) {
      return idsFromMatches
    }

    const legacyIds = Array.isArray(parsed?.ids) ? parsed.ids : []
    return legacyIds.filter((id: any) => typeof id === "string" && byId.has(id))
  }

  private hasEvidence(product: ProductData, evidence: string): boolean {
    const needle = evidence.trim().toLowerCase()
    if (!needle) return false
    const haystack = [
      product.name,
      product.description,
      product.categoryName,
      product.region,
      product.formato,
      product.type,
      ...(product.certifications || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return haystack.includes(needle)
  }

  private findDirectMatches(products: ProductData[], query: string): ProductData[] {
    const normalizedQuery = this.normalizeText(query)
    if (!normalizedQuery) return []
    const tokens = normalizedQuery.split(" ").filter((token) => token.length >= 4)
    if (tokens.length === 0) return []

    const stems = tokens.map((token) => token.replace(/[aeiou]$/i, ""))
    const searchTokens = Array.from(new Set([...tokens, ...stems].filter(Boolean)))

    return products.filter((product) => {
      const text = this.normalizeText(this.buildSearchText(product))
      return searchTokens.some((token) => text.includes(token))
    })
  }

  private buildSearchText(product: ProductData): string {
    return [
      product.name,
      product.description,
      product.categoryName,
      product.region,
      product.formato,
      product.type,
      ...(product.certifications || []),
    ]
      .filter(Boolean)
      .join(" ")
  }

  private normalizeText(input: string): string {
    return input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  private buildListResponse(
    products: ProductData[],
    intentType: string,
    customerLanguage: string,
    customerDiscount: number,
    groupByField?: GroupField
  ): StructuredResponse {
    if (products.length === 1) {
      const context = this.buildResponseContext(intentType, customerLanguage, customerDiscount)
      return {
        type: "PRODUCT_DETAIL",
        data: {
          product: products[0],
        },
        formatting: { ...RESPONSE_DEFAULT_FORMATTING },
        context,
      }
    }
    const listItems: ListItem[] = products.map((product, index) => ({
      number: index + 1,
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      priceWithDiscount: product.priceWithDiscount,
      stock: product.stock,
      extra: product.categoryName || product.region || undefined,
    }))

    const context = this.buildResponseContext(intentType, customerLanguage, customerDiscount)

    const shouldGroup =
      !!groupByField || listItems.length > RESPONSE_DEFAULT_FORMATTING.maxItemsBeforeGroup

    if (shouldGroup) {
      const preferredField: GroupField = groupByField || "category"
      const groupedResponse = this.tryBuildGroupedResponse(
        products,
        preferredField,
        intentType,
        customerLanguage,
        customerDiscount,
        Boolean(groupByField)
      )
      if (groupedResponse) {
        return groupedResponse
      }
    }

    return {
      type: "PRODUCT_LIST",
      data: {
        items: listItems,
        count: products.length,
      },
      formatting: { ...RESPONSE_DEFAULT_FORMATTING, showTotal: false },
      context,
    }
  }

  private tryBuildGroupedResponse(
    products: ProductData[],
    field: GroupField,
    intentType: string,
    customerLanguage: string,
    customerDiscount: number,
    forceField: boolean
  ): StructuredResponse | null {
    let meta = this.buildGroupsByField(products, field)

    if (!this.hasValidGroups(meta)) {
      return null
    }

    if (!forceField && this.shouldFallbackGroupedResult(meta)) {
      if (field === "category") {
        return null
      }
      meta = this.buildGroupsByField(products, "category")
      if (!this.hasValidGroups(meta) || this.shouldFallbackGroupedResult(meta)) {
        return null
      }
    }

    return this.buildGroupedResponse(meta, products, intentType, customerLanguage, customerDiscount)
  }

  private buildGroupedResponse(
    groups: GroupDescriptor[],
    products: ProductData[],
    intentType: string,
    customerLanguage: string,
    customerDiscount: number
  ): StructuredResponse {
    const productMap = new Map(products.map((p) => [p.id, p]))
    let numberCounter = 1

    const groupedItems: GroupedItems[] = groups.map((group) => {
      const items: ListItem[] = group.ids
        .map((id) => productMap.get(id))
        .filter(Boolean)
        .map((product) => ({
          number: numberCounter++,
          id: product!.id,
          name: product!.name,
          sku: product!.sku,
          price: product!.price,
          priceWithDiscount: product!.priceWithDiscount,
          stock: product!.stock,
          extra: product!.region || product!.formato,
        }))

      return {
        groupName: group.key,
        variantCount: group.count,
        items,
      }
    })

    const limitedGroups = groupedItems
      .sort((a, b) => b.variantCount - a.variantCount)
      .slice(0, 4)

    const groupMapping: Record<string, { nome: string; skus: string[] }> = {}
    limitedGroups.forEach((group, index) => {
      groupMapping[String(index + 1)] = {
        nome: group.groupName,
        skus: group.items
          .map((item) => item.sku)
          .filter((sku): sku is string => Boolean(sku)),
      }
    })

    const context = this.buildResponseContext(intentType, customerLanguage, customerDiscount)

    return {
      type: "PRODUCT_GROUPED",
      data: {
        groups: limitedGroups,
        count: limitedGroups.reduce((sum, group) => sum + group.variantCount, 0),
        groupMapping,
      },
      formatting: {
        ...RESPONSE_DEFAULT_FORMATTING,
        groupByCategory: true,
        showTotal: false,
      },
      context,
    }
  }

  private buildGroupsByField(products: ProductData[], field: GroupField): GroupDescriptor[] {
    const fallbackLabels: Record<GroupField, string> = {
      category: "Altre categorie",
      region: "Altre regioni",
      certification: "Altre certificazioni",
      transport: "Altri trasporti",
    }

    const map = new Map<
      string,
      {
        ids: string[]
        isFallback: boolean
      }
    >()

    const pushKey = (productId: string, rawKey: string | null | undefined, fallbackLabel: string) => {
      const trimmed = rawKey?.trim()
      const key = trimmed && trimmed.length > 0 ? trimmed : fallbackLabel
      const usedFallback = !trimmed || trimmed.length === 0

      const existing = map.get(key)
      if (!existing) {
        map.set(key, { ids: [productId], isFallback: usedFallback })
        return
      }

      existing.ids.push(productId)
      existing.isFallback = existing.isFallback && usedFallback
    }

    for (const product of products) {
      if (field === "category") {
        pushKey(product.id, product.categoryName, fallbackLabels.category)
        continue
      }
      if (field === "region") {
        pushKey(product.id, product.region, fallbackLabels.region)
        continue
      }
      if (field === "certification") {
        if (!product.certifications || product.certifications.length === 0) {
          pushKey(product.id, null, fallbackLabels.certification)
          continue
        }
        for (const cert of product.certifications) {
          pushKey(product.id, cert, fallbackLabels.certification)
        }
      }
    }

    return Array.from(map.entries())
      .map(([key, entry]) => ({
        key,
        ids: entry.ids,
        count: entry.ids.length,
        isFallback: entry.isFallback,
      }))
      .filter((group) => group.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
  }

  private buildAggregateResponse(
    aggregateType: "min" | "max" | "count",
    value: number,
    intentType: string,
    customerLanguage: string,
    customerDiscount: number
  ): StructuredResponse {
    const context = this.buildResponseContext(intentType, customerLanguage, customerDiscount)
    return {
      type: "CATALOG_AGGREGATE",
      data: {
        aggregateResult: {
          type: aggregateType,
          field: "price",
          value,
        },
      },
      formatting: {
        ...RESPONSE_DEFAULT_FORMATTING,
        showNumbers: false,
        showPrices: true,
      },
      context,
    }
  }

  private buildNoResultsResponse(
    customerLanguage: string,
    intentType: string,
    customerDiscount: number
  ): StructuredResponse {
    const context = this.buildResponseContext(intentType, customerLanguage, customerDiscount)
    return {
      type: "NO_RESULTS",
      data: {
        errorMessage: "Nessun prodotto trovato per questa ricerca",
      },
      formatting: { ...RESPONSE_DEFAULT_FORMATTING, showNumbers: false },
      context,
    }
  }

  private buildResponseContext(
    intentType: string,
    customerLanguage: string,
    customerDiscount: number
  ): ResponseContext {
    return {
      intentType,
      customerLanguage,
      hasDiscount: (customerDiscount || 0) > 0,
      discountPercent: customerDiscount || 0,
    }
  }

  private hasValidGroups(groups: GroupDescriptor[]): boolean {
    if (!groups || groups.length < 2) {
      return false
    }
    return groups.some((group) => group.count > 0)
  }

  private shouldFallbackGroupedResult(groups: GroupDescriptor[]): boolean {
    if (!groups || groups.length === 0) {
      return true
    }
    const total = groups.reduce((sum, group) => sum + group.count, 0)
    if (total === 0) {
      return true
    }
    const [largest] = groups
    if (!largest) {
      return true
    }
    const ratio = largest.count / total
    return !!largest.isFallback && ratio >= 0.7
  }
}
