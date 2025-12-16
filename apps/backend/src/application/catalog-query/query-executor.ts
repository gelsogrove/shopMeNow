import { ProductData } from "../data-loader/data-loader.service"
import { CatalogQuery } from "./catalog-query.schema"

export type CatalogQueryResult =
  | { type: "LIST"; items: ProductData[] }
  | { type: "GROUPED"; groups: Array<{ key: string; count: number; ids: string[] }> }
  | { type: "AGGREGATE"; aggregate: { type: "min" | "max" | "count"; field: "price"; value: number } }
  | { type: "EMPTY" }

export function executeCatalogQuery(
  products: ProductData[],
  query: CatalogQuery
): CatalogQueryResult {
  if (query.entity !== "products") {
    return { type: "EMPTY" }
  }

  let list = [...products]

  for (const filter of query.filters ?? []) {
    if (filter.field === "price") {
      list = list.filter((p) => applyPriceFilter(p.price, filter.op, filter.value))
      continue
    }

    if (filter.field === "category") {
      const allowed = new Set(filter.value.map((v) => v.toLowerCase()))
      list = list.filter((p) => {
        const category = p.categoryName?.toLowerCase() || ""
        return category && allowed.has(category)
      })
      continue
    }

    if (filter.field === "region") {
      const allowed = new Set(filter.value.map((v) => v.toLowerCase()))
      list = list.filter((p) => {
        const region = p.region?.toLowerCase() || ""
        return region && allowed.has(region)
      })
      continue
    }

    if (filter.field === "certification") {
      const allowed = new Set(filter.value.map((v) => v.toLowerCase()))
      list = list.filter((p) => {
        return (p.certifications || []).some((cert) =>
          allowed.has(cert.toLowerCase())
        )
      })
      continue
    }

    if (filter.field === "transport") {
      const term = filter.value.toLowerCase()
      list = list.filter((p) => (p.transportType || "").toLowerCase().includes(term))
      continue
    }

    if (filter.field === "text") {
      const term = filter.value.toLowerCase()
      list = list.filter((p) => {
        // ONLY search in product name - per Andrea's request
        return p.name.toLowerCase().includes(term)
      })
    }
  }

  if (list.length === 0) {
    return { type: "EMPTY" }
  }

  if (query.intent === "aggregate" && query.aggregate) {
    const prices = list.map((p) => p.price)
    const aggregate = computeAggregate(prices, query.aggregate.type)
    return {
      type: "AGGREGATE",
      aggregate: {
        type: query.aggregate.type,
        field: "price",
        value: aggregate,
      },
    }
  }

  if (query.intent === "grouped_list" && query.groupBy?.length) {
    const field = query.groupBy[0]
    const groupMap = new Map<string, string[]>()

    for (const product of list) {
      const keys = getGroupKeys(product, field)
      if (keys.length === 0) {
        appendGroupKey(groupMap, "Altro", product.id)
      } else {
        for (const key of keys) {
          appendGroupKey(groupMap, key, product.id)
        }
      }
    }

    const groups = Array.from(groupMap.entries())
      .map(([key, ids]) => ({ key, ids, count: ids.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)

    if (groups.length === 0) {
      return { type: "EMPTY" }
    }

    return { type: "GROUPED", groups }
  }

  if (query.sort?.field === "price") {
    list.sort((a, b) =>
      query.sort!.direction === "asc" ? a.price - b.price : b.price - a.price
    )
  }

  if (query.limit) {
    list = list.slice(0, query.limit)
  }

  return { type: "LIST", items: list }
}

function applyPriceFilter(
  price: number,
  op: "gt" | "gte" | "lt" | "lte" | "eq",
  value: number
): boolean {
  switch (op) {
    case "gt":
      return price > value
    case "gte":
      return price >= value
    case "lt":
      return price < value
    case "lte":
      return price <= value
    case "eq":
      return price === value
    default:
      return true
  }
}

function computeAggregate(
  prices: number[],
  type: "min" | "max" | "count"
): number {
  switch (type) {
    case "min":
      return Math.min(...prices)
    case "max":
      return Math.max(...prices)
    case "count":
      return prices.length
    default:
      return prices.length
  }
}

function getGroupKeys(
  product: ProductData,
  field: "category" | "region" | "certification" | "transport"
): string[] {
  if (field === "category") {
    return product.categoryName ? [product.categoryName] : []
  }

  if (field === "region") {
    return product.region ? [product.region] : []
  }

  if (field === "certification") {
    return product.certifications?.length ? product.certifications : []
  }

  if (field === "transport") {
    return product.transportType ? [product.transportType] : []
  }

  return []
}

function appendGroupKey(map: Map<string, string[]>, key: string, id: string) {
  const normalized = key?.trim() || "Altro"
  if (!map.has(normalized)) {
    map.set(normalized, [])
  }
  map.get(normalized)!.push(id)
}
