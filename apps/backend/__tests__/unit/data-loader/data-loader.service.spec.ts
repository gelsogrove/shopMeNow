import { DataLoaderService } from "../../../src/application/data-loader/data-loader.service"

describe("DataLoaderService.loadProductsByTransportType", () => {
  it("should query both inline and relational transport types and map relation name", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "p1",
        name: "Tortellini Bolognesi",
        sku: "PASTA-001",
        description: null,
        price: 7.02,
        stock: 12,
        imageUrl: [],
        region: "Emilia-Romagna",
        formato: "500g",
        transportType: null,
        certifications: [],
        allergens: [],
        productCertifications: [],
        productTransportTypes: [{ transportType: { name: "Trasporto refrigerato" } }],
        productCategories: [{ category: { id: "cat-1", name: "Pasta" } }],
      },
    ])

    const prismaMock = {
      products: { findMany },
    } as any

    const service = new DataLoaderService(prismaMock)

    const result = await (service as any).loadProductsByTransportType(
      "workspace-1",
      10,
      "Trasporto refrigerato"
    )

    expect(findMany).toHaveBeenCalledTimes(1)
    const callArgs = findMany.mock.calls[0][0]
    expect(callArgs.where).toMatchObject({
      workspaceId: "workspace-1",
      isActive: true,
      OR: [
        { transportType: { contains: "Trasporto refrigerato", mode: "insensitive" } },
        {
          productTransportTypes: {
            some: {
              transportType: {
                name: { contains: "Trasporto refrigerato", mode: "insensitive" },
              },
            },
          },
        },
      ],
    })

    expect(result.type).toBe("PRODUCTS")
    expect(result.products).toHaveLength(1)
    expect(result.products[0].transportType).toBe("Trasporto refrigerato")
  })
})

describe("DataLoaderService - category query shortcut", () => {
  const baseCategories = [
    {
      id: "cat-pasta",
      name: "Pasta",
      description: null,
      _count: { productCategories: 5 },
    },
    {
      id: "cat-formaggi",
      name: "Formaggi",
      description: null,
      _count: { productCategories: 7 },
    },
    {
      id: "cat-condimenti",
      name: "Condimenti",
      description: null,
      _count: { productCategories: 4 },
    },
  ]

  it("should return only matched categories when query tokens match known categories", async () => {
    const prismaMock = {
      categories: { findMany: jest.fn().mockResolvedValue(baseCategories) },
      products: { findMany: jest.fn() },
    } as any

    const service = new DataLoaderService(prismaMock)

    const result = await service.loadForIntent(
      { type: "SEARCH_PRODUCTS", query: "avete pasta o formaggi?" } as any,
      "workspace-123",
      "customer-1",
      0
    )

    expect(prismaMock.categories.findMany).toHaveBeenCalled()
    expect(result.type).toBe("CATEGORIES")
    expect(result.categories?.map((c) => c.name)).toEqual(["Pasta", "Formaggi"])
    expect(prismaMock.products.findMany).not.toHaveBeenCalled()
  })

  it("should fallback to product search when not all tokens match categories", async () => {
    const prismaMock = {
      categories: { findMany: jest.fn().mockResolvedValue(baseCategories.slice(0, 1)) },
    } as any

    const service = new DataLoaderService(prismaMock)
    const loadProductSearchSpy = jest
      .spyOn(service as any, "loadProductSearch")
      .mockResolvedValue({ type: "PRODUCTS", products: [] })

    const result = await service.loadForIntent(
      { type: "SEARCH_PRODUCTS", query: "pasta e dolci" } as any,
      "workspace-123",
      "customer-1",
      0
    )

    expect(loadProductSearchSpy).toHaveBeenCalledWith("workspace-123", 0, "pasta e dolci")
    expect(result.type).toBe("PRODUCTS")
  })
})
