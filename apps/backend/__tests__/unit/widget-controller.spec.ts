/**
 * Widget Controller - Unit Tests
 *
 * Tests the web widget API security features:
 * - Origin/Referer validation against allowedExternalLinks
 * - Workspace isolation
 */

import { prisma } from "@echatbot/database"

// Mock prisma
jest.mock("@echatbot/database", () => ({
  prisma: {
    workspace: {
      findUnique: jest.fn(),
    },
    chatSession: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}))

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

describe("Widget Controller - Security Tests", () => {
  const WORKSPACE_ID = "test-workspace-id"
  const VISITOR_ID = "webvisitor-abc123"

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Origin Validation", () => {
    beforeEach(() => {
      // Default: workspace with allowed links
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: WORKSPACE_ID,
        allowedExternalLinks: ["example.com", "mysite.com"],
      })
    })

    it("should allow requests from allowed origin", async () => {
      const { validateWidgetAccess } = await import("./helpers/widget-test-helpers")

      const result = await validateWidgetAccess(WORKSPACE_ID, "https://example.com")

      expect(result.isValid).toBe(true)
    })

    it("should block requests from non-allowed origin", async () => {
      const { validateWidgetAccess } = await import("./helpers/widget-test-helpers")

      const result = await validateWidgetAccess(WORKSPACE_ID, "https://malicious-site.com")

      expect(result.isValid).toBe(false)
      expect(result.error).toContain("not allowed")
    })

    it("should block requests when allowedExternalLinks is empty", async () => {
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: WORKSPACE_ID,
        allowedExternalLinks: [],
      })

      const { validateWidgetAccess } = await import("./helpers/widget-test-helpers")

      const result = await validateWidgetAccess(WORKSPACE_ID, "https://example.com")

      expect(result.isValid).toBe(false)
      expect(result.error).toContain("not configured")
    })

    it("should allow localhost when in allowed list", async () => {
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: WORKSPACE_ID,
        allowedExternalLinks: ["localhost", "example.com"],
      })

      const { validateWidgetAccess } = await import("./helpers/widget-test-helpers")

      const result = await validateWidgetAccess(WORKSPACE_ID, "http://localhost:3000")

      expect(result.isValid).toBe(true)
    })
  })

  describe("Workspace Isolation", () => {
    it("should return error for non-existent workspace", async () => {
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue(null)

      const { validateWidgetAccess } = await import("./helpers/widget-test-helpers")

      const result = await validateWidgetAccess("non-existent-workspace", "https://example.com")

      expect(result.isValid).toBe(false)
      expect(result.error).toContain("not found")
    })

    it("should use correct workspaceId for validation", async () => {
      const workspaceA = "workspace-a"
      const workspaceB = "workspace-b"

      // Workspace A allows example.com
      ;(prisma.workspace.findUnique as jest.Mock).mockImplementation(({ where }) => {
        if (where.id === workspaceA) {
          return Promise.resolve({
            id: workspaceA,
            allowedExternalLinks: ["example.com"],
          })
        }
        if (where.id === workspaceB) {
          return Promise.resolve({
            id: workspaceB,
            allowedExternalLinks: ["other-site.com"],
          })
        }
        return Promise.resolve(null)
      })

      const { validateWidgetAccess } = await import("./helpers/widget-test-helpers")

      // example.com should work for workspace A
      const resultA = await validateWidgetAccess(workspaceA, "https://example.com")
      expect(resultA.isValid).toBe(true)

      // example.com should NOT work for workspace B
      const resultB = await validateWidgetAccess(workspaceB, "https://example.com")
      expect(resultB.isValid).toBe(false)
    })
  })
})
