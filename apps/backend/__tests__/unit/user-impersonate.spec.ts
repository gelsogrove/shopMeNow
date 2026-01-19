import request from "supertest"
import express from "express"

let app: any
let prismaMock: any
let authedUser: any = null
let createSessionMock: jest.Mock

describe("POST /api/v1/users/admin/:userId/impersonate", () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()

    // Fresh mocks for every test
    authedUser = {
      id: "admin-123",
      email: "admin@test.com",
      isPlatformAdmin: true,
    }
    createSessionMock = jest.fn().mockResolvedValue("session-123")
    prismaMock = {
      user: {
        findUnique: jest.fn(),
      },
      workspace: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }

    jest.doMock("@echatbot/database", () => ({
      prisma: prismaMock,
      UserStatus: {
        ACTIVE: "ACTIVE",
        DISABLED: "DISABLED",
      },
      InvoiceStatus: {},
      TransactionType: {},
      PayPalTransactionStatus: {},
      PayPalStatus: {},
    }))

    jest.doMock("../../src/config", () => ({
      config: {
        jwtSecret: "test-secret-key",
      },
    }))

    jest.doMock("../../src/application/services/admin-session.service", () => ({
      AdminSessionService: jest.fn(() => ({
        createSession: createSessionMock,
      })),
    }))

    jest.doMock("../../src/interfaces/http/middlewares/auth.middleware", () => ({
      authMiddleware: (req: any, _res: any, next: any) => {
        ;(req as any).user = authedUser
        next()
      },
    }))

    jest.doMock("../../src/interfaces/http/middlewares/platform-admin.middleware", () => ({
      platformAdminMiddleware: (_req: any, _res: any, next: any) => next(),
    }))

    // Build a lightweight app with only the user admin routes
    const userAdminRoutes = require("../../src/interfaces/http/routes/user-admin.routes").default
    app = express()
    app.use(express.json())
    app.use("/api/v1/users", userAdminRoutes)
  })

  it("allows impersonating another platform admin (no 400 anymore)", async () => {
    const targetUser = {
      id: "platform-admin-456",
      email: "platform@test.com",
      firstName: "Platform",
      lastName: "Admin",
      isPlatformAdmin: true,
      status: "ACTIVE",
    }

    prismaMock.user.findUnique.mockResolvedValue(targetUser)

    const res = await request(app)
      .post(`/api/v1/users/admin/${targetUser.id}/impersonate`)
      .set("User-Agent", "jest-test")

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.targetUser.id).toBe(targetUser.id)
    expect(createSessionMock).toHaveBeenCalledWith(
      targetUser.id,
      null,
      expect.any(String),
      expect.anything()
    )
  })

  it("still blocks impersonation of inactive users", async () => {
    const inactiveUser = {
      id: "inactive-789",
      email: "inactive@test.com",
      firstName: "Inactive",
      lastName: "User",
      isPlatformAdmin: true,
      status: "DISABLED",
    }

    prismaMock.user.findUnique.mockResolvedValue(inactiveUser)

    const res = await request(app)
      .post(`/api/v1/users/admin/${inactiveUser.id}/impersonate`)
      .set("User-Agent", "jest-test")

    expect(res.status).toBe(400)
    expect(res.body.error).toContain("Cannot impersonate inactive users")
    expect(createSessionMock).not.toHaveBeenCalled()
  })
})
