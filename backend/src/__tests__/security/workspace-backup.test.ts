/**
 * WORKSPACE BACKUP SECURITY TESTS
 *
 * Tests for workspace-specific backup/restore endpoints to ensure:
 * 1. SessionID validation required
 * 2. WorkspaceID filtering enforced
 * 3. Admin-only access
 * 4. No cross-workspace data leakage
 */

import { PrismaClient } from "@prisma/client"
import request from "supertest"
import app from "../../src/app"

const prisma = new PrismaClient()

describe("Workspace Backup Security", () => {
  let adminToken: string
  let userToken: string
  let workspaceId: string
  let sessionId: string

  beforeAll(async () => {
    // Setup: Create test workspace and users
    const workspace = await prisma.workspace.create({
      data: {
        name: "Test Workspace",
        slug: "test-workspace",
        whatsappPhoneNumber: "+1234567890",
      },
    })
    workspaceId = workspace.id

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: "admin@test.com",
        password: "hashed-password",
        role: "ADMIN",
        firstName: "Admin",
        lastName: "User",
      },
    })

    // Create regular user
    const regularUser = await prisma.user.create({
      data: {
        email: "user@test.com",
        password: "hashed-password",
        role: "USER",
        firstName: "Regular",
        lastName: "User",
      },
    })

    // Get admin token
    const adminLoginRes = await request(app).post("/api/auth/login").send({
      email: "admin@test.com",
      password: "hashed-password",
    })
    adminToken = adminLoginRes.body.token
    sessionId = adminLoginRes.body.sessionId

    // Get user token
    const userLoginRes = await request(app).post("/api/auth/login").send({
      email: "user@test.com",
      password: "hashed-password",
    })
    userToken = userLoginRes.body.token
  })

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({
      where: {
        email: { in: ["admin@test.com", "user@test.com"] },
      },
    })
    await prisma.workspace.delete({ where: { id: workspaceId } })
    await prisma.$disconnect()
  })

  describe("POST /api/workspaces/:workspaceId/database/export", () => {
    it("❌ should reject request without sessionId", async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/database/export`)
        .set("Authorization", `Bearer ${adminToken}`)
      // NO sessionId header

      expect(res.status).toBe(401)
      expect(res.body.error).toContain("sessionId")
    })

    it("❌ should reject request without workspaceId", async () => {
      const res = await request(app)
        .post("/api/workspaces//database/export") // Empty workspaceId
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-session-id", sessionId)

      expect(res.status).toBe(404)
    })

    it("❌ should reject non-admin users", async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/database/export`)
        .set("Authorization", `Bearer ${userToken}`)
        .set("x-session-id", sessionId)

      expect(res.status).toBe(403)
      expect(res.body.error).toContain("admin")
    })

    it("❌ should reject invalid workspaceId", async () => {
      const res = await request(app)
        .post("/api/workspaces/invalid-workspace-id/database/export")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-session-id", sessionId)

      expect(res.status).toBe(404)
    })

    it("✅ should allow admin with valid sessionId and workspaceId", async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/database/export`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-session-id", sessionId)
        .set("x-workspace-id", workspaceId)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toContain("backed up successfully")
    })
  })

  describe("POST /api/workspaces/:workspaceId/database/import", () => {
    it("❌ should reject request without sessionId", async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/database/import`)
        .set("Authorization", `Bearer ${adminToken}`)
      // NO sessionId header

      expect(res.status).toBe(401)
      expect(res.body.error).toContain("sessionId")
    })

    it("❌ should reject request without workspaceId", async () => {
      const res = await request(app)
        .post("/api/workspaces//database/import") // Empty workspaceId
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-session-id", sessionId)

      expect(res.status).toBe(404)
    })

    it("❌ should reject non-admin users", async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/database/import`)
        .set("Authorization", `Bearer ${userToken}`)
        .set("x-session-id", sessionId)

      expect(res.status).toBe(403)
      expect(res.body.error).toContain("admin")
    })

    it("❌ should reject invalid workspaceId", async () => {
      const res = await request(app)
        .post("/api/workspaces/invalid-workspace-id/database/import")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-session-id", sessionId)

      expect(res.status).toBe(404)
    })

    it("❌ should reject if no backup exists for workspace", async () => {
      // Create a workspace without backup
      const newWorkspace = await prisma.workspace.create({
        data: {
          name: "No Backup Workspace",
          slug: "no-backup",
          whatsappPhoneNumber: "+9999999999",
        },
      })

      const res = await request(app)
        .post(`/api/workspaces/${newWorkspace.id}/database/import`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-session-id", sessionId)
        .set("x-workspace-id", newWorkspace.id)

      expect(res.status).toBe(404)
      expect(res.body.error).toContain("backup")

      await prisma.workspace.delete({ where: { id: newWorkspace.id } })
    })

    it("✅ should allow admin with valid sessionId and workspaceId", async () => {
      // First create a backup
      await request(app)
        .post(`/api/workspaces/${workspaceId}/database/export`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-session-id", sessionId)
        .set("x-workspace-id", workspaceId)

      // Then try to import
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/database/import`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-session-id", sessionId)
        .set("x-workspace-id", workspaceId)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toContain("restored successfully")
    })
  })

  describe("Workspace Isolation", () => {
    it("❌ should NOT allow importing workspace A backup into workspace B", async () => {
      // Create two workspaces
      const workspaceA = await prisma.workspace.create({
        data: {
          name: "Workspace A",
          slug: "workspace-a",
          whatsappPhoneNumber: "+1111111111",
        },
      })

      const workspaceB = await prisma.workspace.create({
        data: {
          name: "Workspace B",
          slug: "workspace-b",
          whatsappPhoneNumber: "+2222222222",
        },
      })

      // Create backup for workspace A
      await request(app)
        .post(`/api/workspaces/${workspaceA.id}/database/export`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-session-id", sessionId)
        .set("x-workspace-id", workspaceA.id)

      // Try to import workspace A backup into workspace B (should fail)
      const res = await request(app)
        .post(`/api/workspaces/${workspaceB.id}/database/import`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-session-id", sessionId)
        .set("x-workspace-id", workspaceB.id)

      // Should fail because backup validation checks workspaceId mismatch
      expect(res.status).toBe(500)
      expect(res.body.error).toContain("workspace")

      // Cleanup
      await prisma.workspace.deleteMany({
        where: {
          id: { in: [workspaceA.id, workspaceB.id] },
        },
      })
    })
  })
})
