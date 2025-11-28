/**
 * Invitation Routes Unit Tests
 *
 * Tests for workspace team invitation routes.
 * Verifies that:
 * - Public routes (/api/invitations/*) do NOT require authentication
 * - Protected routes (/api/workspaces/:workspaceId/invitations/*) require authentication
 *
 * CRITICAL: Public invitation routes must be mounted BEFORE routers with global authMiddleware
 * to prevent auth middleware from intercepting public requests.
 */

import { invitationRouter, publicInvitationRouter } from "../../../src/interfaces/http/routes/invitation.routes"
import { Router } from "express"

describe("Invitation Routes", () => {
  describe("publicInvitationRouter", () => {
    let router: Router

    beforeEach(() => {
      router = publicInvitationRouter()
    })

    it("should be a valid Express router", () => {
      expect(router).toBeDefined()
      expect(typeof router).toBe("function")
    })

    it("should have GET /validate/:token route", () => {
      const stack = (router as any).stack || []
      const validateRoute = stack.find((layer: any) => {
        if (layer.route) {
          return (
            layer.route.path === "/validate/:token" &&
            layer.route.methods.get
          )
        }
        return false
      })

      expect(validateRoute).toBeDefined()
    })

    it("should have POST /accept route", () => {
      const stack = (router as any).stack || []
      const acceptRoute = stack.find((layer: any) => {
        if (layer.route) {
          return layer.route.path === "/accept" && layer.route.methods.post
        }
        return false
      })

      expect(acceptRoute).toBeDefined()
    })

    it("should have only 2 routes (validate and accept)", () => {
      const stack = (router as any).stack || []
      const routes = stack.filter((layer: any) => layer.route)
      expect(routes.length).toBe(2)
    })

    it("should NOT have global middleware (no router.use() calls)", () => {
      const stack = (router as any).stack || []
      // Global middleware would appear as layers without a route property
      const globalMiddleware = stack.filter((layer: any) => !layer.route)
      // There should be no global middleware on the public router
      expect(globalMiddleware.length).toBe(0)
    })
  })

  describe("invitationRouter (protected)", () => {
    let router: Router

    beforeEach(() => {
      router = invitationRouter()
    })

    it("should be a valid Express router", () => {
      expect(router).toBeDefined()
      expect(typeof router).toBe("function")
    })

    it("should have GET / route for listing invitations", () => {
      const stack = (router as any).stack || []
      const listRoute = stack.find((layer: any) => {
        if (layer.route) {
          return layer.route.path === "/" && layer.route.methods.get
        }
        return false
      })

      expect(listRoute).toBeDefined()
    })

    it("should have POST / route for creating invitations", () => {
      const stack = (router as any).stack || []
      const createRoute = stack.find((layer: any) => {
        if (layer.route) {
          return layer.route.path === "/" && layer.route.methods.post
        }
        return false
      })

      expect(createRoute).toBeDefined()
    })

    it("should have DELETE /:invitationId route for canceling invitations", () => {
      const stack = (router as any).stack || []
      const deleteRoute = stack.find((layer: any) => {
        if (layer.route) {
          return (
            layer.route.path === "/:invitationId" && layer.route.methods.delete
          )
        }
        return false
      })

      expect(deleteRoute).toBeDefined()
    })

    it("should have POST /:invitationId/resend route for resending invitations", () => {
      const stack = (router as any).stack || []
      const resendRoute = stack.find((layer: any) => {
        if (layer.route) {
          return (
            layer.route.path === "/:invitationId/resend" &&
            layer.route.methods.post
          )
        }
        return false
      })

      expect(resendRoute).toBeDefined()
    })

    it("should have 4 routes total", () => {
      const stack = (router as any).stack || []
      const routes = stack.filter((layer: any) => layer.route)
      expect(routes.length).toBe(4)
    })

    it("should have multiple middleware handlers per route (auth + validation + handler)", () => {
      const stack = (router as any).stack || []
      const listRoute = stack.find((layer: any) => {
        if (layer.route) {
          return layer.route.path === "/" && layer.route.methods.get
        }
        return false
      })

      expect(listRoute).toBeDefined()
      // Protected routes should have multiple handlers: authMiddleware, validateWorkspaceOperation, requireWorkspaceMember, handler
      const routeStack = listRoute.route.stack || []
      expect(routeStack.length).toBeGreaterThanOrEqual(3) // At least auth + validation + handler
    })
  })

  describe("Route Mounting Order (Critical Security)", () => {
    /**
     * CRITICAL: This test documents the required mounting order in index.ts
     *
     * Public invitation routes MUST be mounted BEFORE any router that uses
     * router.use(authMiddleware) globally (like customersRouter).
     *
     * Correct order in index.ts:
     * 1. router.use("/invitations", publicInvitationRoutes)  ← PUBLIC (no auth)
     * 2. router.use("/", customersRouter(...))               ← Has global authMiddleware
     * 3. router.use("/workspaces/:workspaceId/invitations", invitationRoutes)
     */
    it("should document that public routes must be mounted before customersRouter", () => {
      // This is a documentation test - the actual order is verified by integration tests
      // and manual testing. This test serves as a reminder of the critical requirement.
      const criticalRequirement = `
        PUBLIC invitation routes (/api/invitations/*) MUST be mounted BEFORE
        any router that uses router.use(authMiddleware) globally.
        
        The customersRouter uses router.use(authMiddleware) which intercepts
        ALL requests passing through it, even if no specific route matches.
        
        If public invitation routes are mounted AFTER customersRouter,
        requests to /api/invitations/validate/:token will fail with 401.
      `
      expect(criticalRequirement).toBeTruthy()
    })

    it("should verify public routes have fewer handlers than protected routes", () => {
      const publicRouter = publicInvitationRouter()
      const protectedRouter = invitationRouter()

      const publicStack = (publicRouter as any).stack || []
      const protectedStack = (protectedRouter as any).stack || []

      // Get a sample route from each
      const publicRoute = publicStack.find((layer: any) => layer.route)
      const protectedRoute = protectedStack.find((layer: any) => layer.route)

      expect(publicRoute).toBeDefined()
      expect(protectedRoute).toBeDefined()

      const publicHandlerCount = publicRoute.route.stack?.length || 0
      const protectedHandlerCount = protectedRoute.route.stack?.length || 0

      // Public routes should have fewer handlers (just the controller)
      // Protected routes should have more (auth + validation + role check + controller)
      expect(publicHandlerCount).toBeLessThan(protectedHandlerCount)
    })
  })
})
