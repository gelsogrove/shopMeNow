/**
 * Security Tests - Debug Mode Owner-Only Access
 * Verifies that only workspace owner can modify debugMode
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals"
import request from "supertest"
import { app } from "../../src/app"
import { prisma } from "../../src/lib/prisma"
import { signToken } from "../../src/utils/jwt"

describe("Security: Debug Mode - Owner Only", () => {
  let ownerToken: string
  let adminToken: string
  let workspaceId: string
  let ownerId: string
  let adminId: string

  beforeAll(async () => {
    // Clean up before tests
    await prisma.userWorkspace.deleteMany({})
    await prisma.workspace.deleteMany({})
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ["owner-debugtest@test.com", "admin-debugtest@test.com"],
        },
      },
    })

    // Create owner user
    const owner = await prisma.user.create({
      data: {
        email: "owner-debugtest@test.com",
        password: "hashedpassword",
        firstName: "Owner",
        lastName: "User",
      },
    })
    ownerId = owner.id
    ownerToken = signToken({ userId: owner.id, email: owner.email })

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: "admin-debugtest@test.com",
        password: "hashedpassword",
        firstName: "Admin",
        lastName: "User",
      },
    })
    adminId = admin.id
    adminToken = signToken({ userId: admin.id, email: admin.email })

    // Create workspace owned by owner
    const workspace = await prisma.workspace.create({
      data: {
        name: "Test Workspace Debug",
        ownerId: owner.id,
        debugMode: false, // Start with debug mode OFF
      },
    })
    workspaceId = workspace.id

    // Add admin as ADMIN (not SUPER_ADMIN) to workspace
    await prisma.userWorkspace.create({
      data: {
        userId: admin.id,
        workspaceId: workspace.id,
        role: "ADMIN", // Regular admin, NOT owner
      },
    })

    // Add owner as SUPER_ADMIN
    await prisma.userWorkspace.create({
      data: {
        userId: owner.id,
        workspaceId: workspace.id,
        role: "SUPER_ADMIN",
      },
    })
  })

  afterAll(async () => {
    // Cleanup
    await prisma.userWorkspace.deleteMany({
      where: { workspaceId },
    })
    await prisma.workspace.delete({
      where: { id: workspaceId },
    })
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, adminId] } },
    })
  })

  it("✅ Owner CAN enable debug mode", async () => {
    const response = await request(app)
      .put(`/api/v1/workspaces/${workspaceId}/whatsapp-queue/debug-mode`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("x-workspace-id", workspaceId)
      .send({ debugMode: true })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)

    // Verify in database
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { debugMode: true },
    })
    expect(workspace?.debugMode).toBe(true)
  })

  it("✅ Owner CAN disable debug mode", async () => {
    const response = await request(app)
      .put(`/api/v1/workspaces/${workspaceId}/whatsapp-queue/debug-mode`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("x-workspace-id", workspaceId)
      .send({ debugMode: false })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)

    // Verify in database
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { debugMode: true },
    })
    expect(workspace?.debugMode).toBe(false)
  })

  it("❌ Admin CANNOT enable debug mode (403 Forbidden)", async () => {
    const response = await request(app)
      .put(`/api/v1/workspaces/${workspaceId}/whatsapp-queue/debug-mode`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-workspace-id", workspaceId)
      .send({ debugMode: true })

    expect(response.status).toBe(403)
    expect(response.body.error).toBe("FORBIDDEN")
    expect(response.body.message).toContain("Only the workspace owner")
  })

  it("❌ Admin CANNOT disable debug mode (403 Forbidden)", async () => {
    // First, owner enables debug mode
    await request(app)
      .put(`/api/v1/workspaces/${workspaceId}/whatsapp-queue/debug-mode`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("x-workspace-id", workspaceId)
      .send({ debugMode: true })

    // Then admin tries to disable it
    const response = await request(app)
      .put(`/api/v1/workspaces/${workspaceId}/whatsapp-queue/debug-mode`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-workspace-id", workspaceId)
      .send({ debugMode: false })

    expect(response.status).toBe(403)
    expect(response.body.error).toBe("FORBIDDEN")

    // Verify debug mode is still ON (admin couldn't change it)
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { debugMode: true },
    })
    expect(workspace?.debugMode).toBe(true) // Still ON
  })

  it("❌ Unauthenticated user CANNOT modify debug mode (401 Unauthorized)", async () => {
    const response = await request(app)
      .put(`/api/v1/workspaces/${workspaceId}/whatsapp-queue/debug-mode`)
      .send({ debugMode: true })

    expect(response.status).toBe(401)
  })

  it("❌ Invalid debugMode value rejected (400 Bad Request)", async () => {
    const response = await request(app)
      .put(`/api/v1/workspaces/${workspaceId}/whatsapp-queue/debug-mode`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("x-workspace-id", workspaceId)
      .send({ debugMode: "invalid" }) // Should be boolean

    expect(response.status).toBe(400)
    expect(response.body.error).toBe("Invalid request")
  })
})
