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

type GroupField = "category" | "region" | "certification"
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
}

export class CatalogQueryService {
  private builder: CatalogQueryBuilder

  constructor(private prisma: PrismaClient) {
    this.builder = new CatalogQueryBuilder()
  }

  async process(options: ProcessOptions): Promise<CatalogQueryProcessingResult> {
    const { workspaceId, message, customerDiscount = 0, intentType, customerLanguage = "it" } = options

    const builderResult = await this.builder.build(message)
    const products = await this.loadProducts(workspaceId, customerDiscount)

    if (products.length === 0) {
      return {
        loadedData: {
          type: "CATALOG_QUERY_RESULT",
          resultType: "EMPTY",
        },
        structuredResponse: this.buildNoResultsResponse(customerLanguage, intentType, customerDiscount),
        query: builderResult.query,
        model: builderResult.model,
        tokenUsage: builderResult.usage,
        resultType: "EMPTY",
      }
    }

    const result = executeCatalogQuery(products, builderResult.query)

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
          query: builderResult.query,
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
          query: builderResult.query,
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
          query: builderResult.query,
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
          query: builderResult.query,
          model: builderResult.model,
          tokenUsage: builderResult.usage,
          resultType: "EMPTY",
        }
      }
    }
  }

  private async loadProducts(workspaceId: string, customerDiscount: number): Promise<ProductData[]> {
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
          productCategories: {
            select: { category: { select: { id: true, name: true } } },
          },
          productCertifications: {
            select: { certification: { select: { name: true } } },
          },
          certifications: true,
          allergens: true,
        },
        orderBy: { name: "asc" },
      })

      return products.map((product) => this.mapProduct(product, customerDiscount))
    } catch (error) {
      logger.error("❌ [CatalogQueryService] Failed to load products", { error })
      return []
    }
  }

  private mapProduct(product: any, customerDiscount: number): ProductData {
    const discount = customerDiscount > 0 ? product.price * (1 - customerDiscount / 100) : undefined
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
      price: product.price,
      priceWithDiscount: discount,
      stock: product.stock,
      imageUrl: Array.isArray(product.imageUrl) && product.imageUrl.length > 0 ? String(product.imageUrl[0]) : undefined,
      categoryId: product.productCategories?.[0]?.category?.id,
      categoryName: product.productCategories?.[0]?.category?.name,
      region: product.region || undefined,
      formato: product.formato || undefined,
      certifications: certs,
      allergens,
      isAvailable: product.stock > 0,
    }
  }

  private buildListResponse(
    products: ProductData[],
    intentType: string,
    customerLanguage: string,
    customerDiscount: number,
    groupByField?: GroupField
  ): StructuredResponse {
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
      formatting: { ...RESPONSE_DEFAULT_FORMATTING },
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
      },
      context,
    }
  }

  private buildGroupsByField(products: ProductData[], field: GroupField): GroupDescriptor[] {
    const fallbackLabels: Record<GroupField, string> = {
      category: "Altre categorie",
      region: "Altre regioni",
      certification: "Altre certificazioni",
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
