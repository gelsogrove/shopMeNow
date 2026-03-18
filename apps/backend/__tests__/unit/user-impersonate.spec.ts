let prismaMock: any
let authedUser: any = null
let createSessionMock: jest.Mock
let impersonateHandler: any

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

    jest.isolateModules(() => {
      impersonateHandler = require("../../src/interfaces/http/routes/admin/admin-user-security.routes").impersonateHandler
    })

  })

  const buildRes = () => {
    const res: any = {}
    res.statusCode = 200
    res.status = (code: number) => {
      res.statusCode = code
      return res
    }
    res.json = (payload: any) => {
      res.body = payload
      return res
    }
    return res
  }

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

    const req: any = {
      params: { userId: targetUser.id },
      user: authedUser,
      ip: "127.0.0.1",
      headers: { "user-agent": "jest-test" },
    }
    const res = buildRes()

    await impersonateHandler(req, res as any)

    expect(res.statusCode).toBe(200)
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

    const req: any = {
      params: { userId: inactiveUser.id },
      user: authedUser,
      ip: "127.0.0.1",
      headers: { "user-agent": "jest-test" },
    }
    const res = buildRes()

    await impersonateHandler(req, res as any)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain("Cannot impersonate inactive users")
    expect(createSessionMock).not.toHaveBeenCalled()
  })
})
