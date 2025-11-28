/**
 * Route Mounting Order Security Tests
 *
 * CRITICAL: These tests verify that public routes are mounted BEFORE
 * routes with global authMiddleware to prevent auth interception.
 *
 * Background:
 * - customersRouter uses router.use(authMiddleware) globally
 * - This means ALL requests passing through it trigger authMiddleware
 * - If public routes are mounted AFTER customersRouter, they get blocked
 *
 * The fix was to move public invitation routes BEFORE customersRouter in index.ts
 */

import * as fs from "fs"
import * as path from "path"

describe("Route Mounting Order (Critical Security)", () => {
  let indexTsContent: string

  beforeAll(() => {
    const indexPath = path.join(__dirname, "../../../src/routes/index.ts")
    indexTsContent = fs.readFileSync(indexPath, "utf-8")
  })

  describe("Public Invitation Routes", () => {
    it("should mount /invitations BEFORE customersRouter", () => {
      // Find the line numbers for each mount
      const lines = indexTsContent.split("\n")

      let publicInvitationsLine = -1
      let customersRouterLine = -1

      lines.forEach((line, index) => {
        // Look for public invitations mount
        if (
          line.includes('router.use("/invitations"') &&
          line.includes("publicInvitationRoutes")
        ) {
          publicInvitationsLine = index
        }

        // Look for customersRouter mount (the one with global authMiddleware)
        if (
          line.includes("customersRouter(customersController)") &&
          !line.includes("workspace")
        ) {
          customersRouterLine = index
        }
      })

      // Both should be found
      expect(publicInvitationsLine).toBeGreaterThan(-1)
      expect(customersRouterLine).toBeGreaterThan(-1)

      // Public invitations should come BEFORE customersRouter
      expect(publicInvitationsLine).toBeLessThan(customersRouterLine)
    })

    it("should have a comment explaining the critical mounting order", () => {
      expect(indexTsContent).toContain(
        "MUST be mounted BEFORE"
      )
    })
  })

  describe("Protected Invitation Routes", () => {
    it("should mount workspace-scoped invitations separately", () => {
      expect(indexTsContent).toContain(
        'router.use("/workspaces/:workspaceId/invitations", invitationRoutes)'
      )
    })
  })

  describe("customersRouter Global Auth", () => {
    it("should verify customersRouter has global authMiddleware (source of the bug)", () => {
      const customersRoutesPath = path.join(
        __dirname,
        "../../../src/interfaces/http/routes/customers.routes.ts"
      )
      const customersContent = fs.readFileSync(customersRoutesPath, "utf-8")

      // Verify customersRouter uses global authMiddleware
      expect(customersContent).toContain("router.use(authMiddleware)")
    })

    it("should have a security comment about global authMiddleware", () => {
      const customersRoutesPath = path.join(
        __dirname,
        "../../../src/interfaces/http/routes/customers.routes.ts"
      )
      const customersContent = fs.readFileSync(customersRoutesPath, "utf-8")

      // Should have a comment about security
      expect(customersContent).toContain("SECURITY")
    })
  })

  describe("Other Public Routes Order", () => {
    it("should mount /pricing before customersRouter", () => {
      const lines = indexTsContent.split("\n")

      let pricingLine = -1
      let customersRouterLine = -1

      lines.forEach((line, index) => {
        if (line.includes('router.use("/pricing"')) {
          pricingLine = index
        }
        if (
          line.includes("customersRouter(customersController)") &&
          !line.includes("workspace")
        ) {
          customersRouterLine = index
        }
      })

      expect(pricingLine).toBeGreaterThan(-1)
      expect(customersRouterLine).toBeGreaterThan(-1)
      expect(pricingLine).toBeLessThan(customersRouterLine)
    })

    it("should mount /auth before customersRouter", () => {
      const lines = indexTsContent.split("\n")

      let authLine = -1
      let customersRouterLine = -1

      lines.forEach((line, index) => {
        if (line.includes('router.use("/auth"')) {
          authLine = index
        }
        if (
          line.includes("customersRouter(customersController)") &&
          !line.includes("workspace")
        ) {
          customersRouterLine = index
        }
      })

      expect(authLine).toBeGreaterThan(-1)
      expect(customersRouterLine).toBeGreaterThan(-1)
      expect(authLine).toBeLessThan(customersRouterLine)
    })
  })
})
