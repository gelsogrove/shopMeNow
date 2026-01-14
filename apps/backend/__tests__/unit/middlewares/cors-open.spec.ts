import request from "supertest"
import app from "../../../src/app"
import { prisma } from "@echatbot/database"

describe("CORS middleware", () => {
  it("should allow origin from workspace websiteUrl", async () => {
    const slug = `cors-test-${Date.now()}`
    const origin = "https://cors-test.example"

    const workspace = await prisma.workspace.create({
      data: {
        name: "CORS Test Workspace",
        slug,
        websiteUrl: origin,
      },
    })

    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", origin)

    expect(response.status).toBe(200)
    expect(response.headers["access-control-allow-origin"]).toBe(origin)

    await prisma.workspace.delete({ where: { id: workspace.id } })
  })

  it("should not allow unknown origin", async () => {
    const origin = "https://not-allowed.example"

    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", origin)

    expect(response.status).toBe(200)
    expect(response.headers["access-control-allow-origin"]).toBeUndefined()
  })
})
