import { ProductData } from "../../../data-loader/data-loader.service"
import { executeCatalogQuery } from "../../catalog-query/query-executor"

const baseProduct = (overrides: Partial<ProductData> = {}): ProductData => ({
  id: overrides.id || "prod-1",
  name: overrides.name || "Prodotto",
  price: overrides.price ?? 10,
  priceWithDiscount: overrides.priceWithDiscount,
  stock: overrides.stock ?? 10,
  imageUrl: overrides.imageUrl,
  categoryId: overrides.categoryId,
  categoryName: overrides.categoryName,
  region: overrides.region,
  formato: overrides.formato,
  certifications: overrides.certifications || [],
  allergens: overrides.allergens || [],
  type: overrides.type,
  isAvailable: overrides.isAvailable ?? true,
  sku: overrides.sku,
  description: overrides.description,
})

describe("CatalogQuery executeCatalogQuery", () => {
  const products: ProductData[] = [
    baseProduct({
      id: "ambient",
      name: "Pane Carasau",
      type: "Temperatura ambiente",
    }),
    baseProduct({
      id: "cold",
      name: "Mozzarella",
      type: "Trasporto refrigerato",
    }),
    baseProduct({
      id: "frozen",
      name: "Arancini Surgelati",
      type: "Trasporto congelato",
    }),
  ]

  it("filters list by transport type", () => {
    const result = executeCatalogQuery(products, {
      entity: "products",
      intent: "list",
      filters: [
        { field: "transport", op: "eq", value: "trasporto refrigerato" },
      ],
    } as any)

    expect(result.type).toBe("LIST")
    if (result.type === "LIST") {
      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe("cold")
    }
  })

  it("groups products by transport type", () => {
    const result = executeCatalogQuery(products, {
      entity: "products",
      intent: "grouped_list",
      groupBy: ["transport"],
    } as any)

    expect(result.type).toBe("GROUPED")
    if (result.type === "GROUPED") {
      const keys = result.groups.map((g) => g.key)
      expect(keys).toEqual(
        expect.arrayContaining([
          "Temperatura ambiente",
          "Trasporto refrigerato",
          "Trasporto congelato",
        ])
      )
    }
  })
})
