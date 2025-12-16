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
