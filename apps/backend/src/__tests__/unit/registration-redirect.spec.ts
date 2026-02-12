/**
 * TEST: Registration Link Redirect (SPP-1032 Fix)
 * 
 * SCENARIO: Backend route /registration/:workspaceId must resolve slug→ID before redirect
 * 
 * RULES:
 * - /registration/{uuid} → redirects with real ID
 * - /registration/{slug} → resolves to ID, then redirects with real ID
 * - /registration/{invalid} → returns 404 with user-friendly message
 * - Only active workspaces (deletedAt=null) are resolved
 * 
 * WHY: Security templates were blocking registration links because slug wasn't resolved
 */

import { prisma } from "@echatbot/database"
import request from "supertest"
import app from "../../app"

// TODO Andrea: These tests need manual verification until Prisma test environment is fixed
describe.skip("Registration Link Redirect (SPP-1032)", () => {
  let testWorkspaceWithSlug: any
  let testWorkspaceWithoutSlug: any
  let deletedWorkspace: any

  beforeAll(async () => {
    // Create test workspaces with minimal required fields
    testWorkspaceWithSlug = await prisma.workspace.create({
      data: {
        name: "Test Workspace With Slug",
        slug: "test-workspace-slug",
      },
    })

    testWorkspaceWithoutSlug = await prisma.workspace.create({
      data: {
        name: "Test Workspace Without Slug",
        slug: null,
      },
    })

    deletedWorkspace = await prisma.workspace.create({
      data: {
        name: "Deleted Workspace",
        slug: "deleted-workspace",
        deletedAt: new Date(), // Soft-deleted
      },
    })
  })

  afterAll(async () => {
    // Cleanup
    await prisma.workspace.deleteMany({
      where: {
        id: {
          in: [
            testWorkspaceWithSlug.id,
            testWorkspaceWithoutSlug.id,
            deletedWorkspace.id,
          ],
        },
      },
    })
    await prisma.$disconnect()
  })

  it("should redirect /registration/{slug} to /registration?workspace={id}", async () => {
    // SCENARIO: User clicks link with slug (https://echatbot.ai/registration/test-workspace-slug?token=xxx)
    // RULE: Backend resolves slug → ID and redirects frontend with real ID
    
    const response = await request(app)
      .get(`/registration/${testWorkspaceWithSlug.slug}?token=abc123`)
      .expect(302)

    // Verify redirect URL contains real ID (not slug)
    expect(response.headers.location).toContain(`workspace=${testWorkspaceWithSlug.id}`)
    expect(response.headers.location).toContain("token=abc123")
    expect(response.headers.location).toMatch(/^http/)
  })

  it("should redirect /registration/{id} to /registration?workspace={id} (already ID)", async () => {
    // SCENARIO: User clicks link with UUID directly
    // RULE: Backend recognizes it's an ID and redirects normally
    
    const response = await request(app)
      .get(`/registration/${testWorkspaceWithSlug.id}?token=abc123`)
      .expect(302)

    // Verify redirect URL contains same ID
    expect(response.headers.location).toContain(`workspace=${testWorkspaceWithSlug.id}`)
    expect(response.headers.location).toContain("token=abc123")
  })

  it("should redirect workspace without slug using ID", async () => {
    // SCENARIO: Workspace has no slug, only ID works
    // RULE: Backend finds by ID and redirects
    
    const response = await request(app)
      .get(`/registration/${testWorkspaceWithoutSlug.id}?token=xyz789`)
      .expect(302)

    expect(response.headers.location).toContain(`workspace=${testWorkspaceWithoutSlug.id}`)
    expect(response.headers.location).toContain("token=xyz789")
  })

  it("should return 404 for invalid workspace ID/slug", async () => {
    // SCENARIO: User tries invalid workspace (typo, deleted, doesn't exist)
    // RULE: Backend returns 404 with user-friendly message
    
    const response = await request(app)
      .get("/registration/invalid-workspace-xyz?token=abc123")
      .expect(404)

    // Verify HTML error message
    expect(response.text).toContain("Workspace Not Found")
    expect(response.text).toContain("registration link")
  })

  it("should return 404 for deleted workspace (soft-deleted)", async () => {
    // SCENARIO: User tries to access deleted workspace
    // RULE: Backend ignores soft-deleted workspaces (deletedAt != null)
    
    const response = await request(app)
      .get(`/registration/${deletedWorkspace.slug}?token=abc123`)
      .expect(404)

    expect(response.text).toContain("Workspace Not Found")
  })

  it("should preserve query parameters in redirect", async () => {
    // SCENARIO: Registration link has multiple query params (token, lang, etc.)
    // RULE: Backend preserves all query params in redirect
    
    const response = await request(app)
      .get(`/registration/${testWorkspaceWithSlug.slug}?token=abc123&lang=it&ref=whatsapp`)
      .expect(302)

    expect(response.headers.location).toContain(`workspace=${testWorkspaceWithSlug.id}`)
    expect(response.headers.location).toContain("token=abc123")
    expect(response.headers.location).toContain("lang=it")
    expect(response.headers.location).toContain("ref=whatsapp")
  })
})
