import request from "supertest"
import app from "../../src/app"

describe("Protected endpoints require JWT", () => {
  it("should reject /api/v1/workspaces without token", async () => {
    const response = await request(app).get("/api/v1/workspaces")
    expect(response.status).toBe(401)
  })

  it("should reject /api/v1/users/admin/list without token", async () => {
    const response = await request(app).get("/api/v1/users/admin/list")
    expect(response.status).toBe(401)
  })
})
