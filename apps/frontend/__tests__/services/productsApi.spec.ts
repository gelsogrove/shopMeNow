import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { api } from "@/services/api"
import { productsApi } from "@/services/productsApi"

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe("productsApi", () => {
  const workspaceId = "workspace-123"

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("gets products with query params", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] })

    const result = await productsApi.getAllForWorkspace(workspaceId, {
      page: 2,
      limit: 25,
      search: "olio",
      categoryId: "cat-1",
    })

    expect(api.get).toHaveBeenCalledWith(
      "/workspaces/workspace-123/products?page=2&limit=25&search=olio&categoryId=cat-1"
    )
    expect(result).toEqual({
      products: [],
      total: 0,
      page: 2,
      totalPages: 0,
    })
  })

  it("creates a product with JSON payload", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        id: "prod-1",
        name: "Olio EVO",
        imageUrl: "https://img.test/1.png",
      },
    })

    const result = await productsApi.create(workspaceId, {
      name: "Olio EVO",
      price: 12,
    })

    expect(api.post).toHaveBeenCalledWith(
      "/workspaces/workspace-123/products",
      {
        name: "Olio EVO",
        price: 12,
      },
      { headers: undefined }
    )
    expect(result.imageUrl).toEqual(["https://img.test/1.png"])
  })

  it("creates a product with FormData and multipart headers", async () => {
    const formData = new FormData()
    formData.append("name", "Pasta")
    formData.append("price", "5")

    vi.mocked(api.post).mockResolvedValueOnce({
      data: { id: "prod-2", name: "Pasta" },
    })

    await productsApi.create(workspaceId, formData)

    expect(api.post).toHaveBeenCalledWith(
      "/workspaces/workspace-123/products",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    )
  })

  it("updates and deletes a product", async () => {
    vi.mocked(api.put).mockResolvedValueOnce({
      data: { id: "prod-3", name: "Updated" },
    })
    vi.mocked(api.delete).mockResolvedValueOnce({ data: undefined })

    await productsApi.update("prod-3", workspaceId, { name: "Updated" })
    await productsApi.delete("prod-3", workspaceId)

    expect(api.put).toHaveBeenCalledWith(
      "/workspaces/workspace-123/products/prod-3",
      { name: "Updated" },
      { headers: undefined }
    )
    expect(api.delete).toHaveBeenCalledWith(
      "/workspaces/workspace-123/products/prod-3"
    )
  })
})
