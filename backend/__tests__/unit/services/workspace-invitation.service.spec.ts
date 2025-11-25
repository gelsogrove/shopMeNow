import { PrismaClient, InvitationStatus } from "@prisma/client"
import crypto from "crypto"
import {
  WorkspaceInvitationService,
  CreateInvitationInput,
} from "../../../src/application/services/workspace-invitation.service"

// Mock Prisma
const mockPrisma = {
  $transaction: jest.fn(),
  workspaceInvitation: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  userWorkspace: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}

// Mock nodemailer
jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: "test-id" }),
  }),
}))

describe("WorkspaceInvitationService", () => {
  let service: WorkspaceInvitationService
  const mockEmailService = {
    sendPasswordResetEmail: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    service = new WorkspaceInvitationService(
      mockPrisma as unknown as PrismaClient,
      mockEmailService as any
    )
  })

  describe("createInvitation", () => {
    const validInput: CreateInvitationInput = {
      workspaceId: "ws-123",
      email: "invitee@test.com",
      invitedById: "user-123",
    }

    it("should create invitation successfully", async () => {
      const mockInvitation = {
        id: "inv-123",
        email: "invitee@test.com",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          workspaceInvitation: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockInvitation),
          },
          workspace: {
            findUnique: jest.fn().mockResolvedValue({
              ownerId: "owner-123",
              name: "Test Workspace",
            }),
          },
          user: {
            findUnique: jest
              .fn()
              .mockResolvedValueOnce(null) // invitee not found
              .mockResolvedValueOnce({
                firstName: "John",
                lastName: "Doe",
                email: "inviter@test.com",
              }),
          },
          userWorkspace: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        }
        return callback(tx)
      })

      const result = await service.createInvitation(validInput)

      expect(result.success).toBe(true)
      expect(result.invitation).toBeDefined()
      expect(result.invitation?.email).toBe("invitee@test.com")
    })

    it("should reject duplicate pending invitation", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          workspaceInvitation: {
            findFirst: jest.fn().mockResolvedValue({
              id: "existing-inv",
              status: "PENDING",
            }),
          },
        }
        return callback(tx)
      })

      const result = await service.createInvitation(validInput)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Invite already pending for this email")
    })

    it("should reject if user is already a member", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          workspaceInvitation: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          workspace: {
            findUnique: jest.fn().mockResolvedValue({
              ownerId: "owner-123",
              name: "Test Workspace",
            }),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({ id: "existing-user" }),
          },
          userWorkspace: {
            findFirst: jest.fn().mockResolvedValue({ userId: "existing-user" }),
          },
        }
        return callback(tx)
      })

      const result = await service.createInvitation(validInput)

      expect(result.success).toBe(false)
      expect(result.error).toBe("User is already a member of this workspace")
    })

    it("should reject if workspace not found", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          workspaceInvitation: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          workspace: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        }
        return callback(tx)
      })

      const result = await service.createInvitation(validInput)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Workspace not found or has no owner")
    })

    it("should normalize email to lowercase", async () => {
      const inputWithUppercase = {
        ...validInput,
        email: "INVITEE@TEST.COM",
      }

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          workspaceInvitation: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((data) => ({
              id: "inv-123",
              email: data.data.email,
              expiresAt: data.data.expiresAt,
            })),
          },
          workspace: {
            findUnique: jest.fn().mockResolvedValue({
              ownerId: "owner-123",
              name: "Test Workspace",
            }),
          },
          user: {
            findUnique: jest
              .fn()
              .mockResolvedValueOnce(null)
              .mockResolvedValueOnce({
                firstName: "John",
                lastName: "Doe",
                email: "inviter@test.com",
              }),
          },
          userWorkspace: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        }
        return callback(tx)
      })

      const result = await service.createInvitation(inputWithUppercase)

      expect(result.success).toBe(true)
      expect(result.invitation?.email).toBe("invitee@test.com")
    })
  })

  describe("validateToken", () => {
    it("should return invitation info for valid token", async () => {
      const token = "valid-token-123"
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

      mockPrisma.workspaceInvitation.findFirst.mockResolvedValue({
        id: "inv-123",
        email: "invitee@test.com",
        workspaceId: "ws-123",
        tokenHash,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day in future
        workspace: { id: "ws-123", name: "Test Workspace" },
        invitedBy: { firstName: "John", lastName: "Doe" },
      })

      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await service.validateToken(token)

      expect(result).not.toBeNull()
      expect(result?.email).toBe("invitee@test.com")
      expect(result?.isExpired).toBe(false)
      expect(result?.existingUser).toBe(false)
    })

    it("should return null for invalid token", async () => {
      mockPrisma.workspaceInvitation.findFirst.mockResolvedValue(null)

      const result = await service.validateToken("invalid-token")

      expect(result).toBeNull()
    })

    it("should mark expired invitation and return isExpired true", async () => {
      const token = "expired-token"
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

      mockPrisma.workspaceInvitation.findFirst.mockResolvedValue({
        id: "inv-123",
        email: "invitee@test.com",
        workspaceId: "ws-123",
        tokenHash,
        status: "PENDING",
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        workspace: { id: "ws-123", name: "Test Workspace" },
        invitedBy: { firstName: "John", lastName: "Doe" },
      })

      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.workspaceInvitation.update.mockResolvedValue({})

      const result = await service.validateToken(token)

      expect(result).not.toBeNull()
      expect(result?.isExpired).toBe(true)
      expect(result?.status).toBe("EXPIRED")
      expect(mockPrisma.workspaceInvitation.update).toHaveBeenCalled()
    })

    it("should detect existing user", async () => {
      const token = "valid-token"
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

      mockPrisma.workspaceInvitation.findFirst.mockResolvedValue({
        id: "inv-123",
        email: "existing@test.com",
        workspaceId: "ws-123",
        tokenHash,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        workspace: { id: "ws-123", name: "Test Workspace" },
        invitedBy: { firstName: "John", lastName: "Doe" },
      })

      mockPrisma.user.findUnique.mockResolvedValue({ id: "user-exists" })

      const result = await service.validateToken(token)

      expect(result?.existingUser).toBe(true)
    })
  })

  describe("acceptInvitation", () => {
    it("should accept valid invitation for existing user", async () => {
      const token = "valid-token"
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          workspaceInvitation: {
            findFirst: jest.fn().mockResolvedValue({
              id: "inv-123",
              email: "user@test.com",
              workspaceId: "ws-123",
              tokenHash,
              status: "PENDING",
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              workspace: { id: "ws-123", ownerId: "owner-123" },
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({ id: "user-123" }),
          },
          workspace: {
            findMany: jest
              .fn()
              .mockResolvedValue([{ id: "ws-123" }, { id: "ws-456" }]),
          },
          userWorkspace: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
        }
        return callback(tx)
      })

      const result = await service.acceptInvitation({ token })

      expect(result.success).toBe(true)
      expect(result.workspaceId).toBe("ws-123")
    })

    it("should reject invalid token", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          workspaceInvitation: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        }
        return callback(tx)
      })

      const result = await service.acceptInvitation({ token: "invalid" })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Invalid invitation token")
    })

    it("should reject cancelled invitation", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          workspaceInvitation: {
            findFirst: jest.fn().mockResolvedValue({
              id: "inv-123",
              status: "CANCELLED",
            }),
          },
        }
        return callback(tx)
      })

      const result = await service.acceptInvitation({ token: "cancelled" })

      expect(result.success).toBe(false)
      expect(result.error).toBe("This invitation has been cancelled")
    })

    it("should reject already accepted invitation", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          workspaceInvitation: {
            findFirst: jest.fn().mockResolvedValue({
              id: "inv-123",
              status: "ACCEPTED",
            }),
          },
        }
        return callback(tx)
      })

      const result = await service.acceptInvitation({ token: "accepted" })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Invitation already accepted")
    })

    it("should reject expired invitation", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          workspaceInvitation: {
            findFirst: jest.fn().mockResolvedValue({
              id: "inv-123",
              status: "PENDING",
              expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            }),
            update: jest.fn().mockResolvedValue({}),
          },
        }
        return callback(tx)
      })

      const result = await service.acceptInvitation({ token: "expired" })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Invitation has expired")
    })

    it("should reject if user not found", async () => {
      const token = "valid-token"
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          workspaceInvitation: {
            findFirst: jest.fn().mockResolvedValue({
              id: "inv-123",
              email: "nouser@test.com",
              status: "PENDING",
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              workspace: { id: "ws-123", ownerId: "owner-123" },
            }),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        }
        return callback(tx)
      })

      const result = await service.acceptInvitation({ token })

      expect(result.success).toBe(false)
      expect(result.error).toBe("User not found. Please register first.")
    })
  })

  describe("getPendingInvitations", () => {
    it("should return only PENDING and EXPIRED invitations for workspace", async () => {
      mockPrisma.workspaceInvitation.findMany.mockResolvedValue([
        {
          id: "inv-1",
          email: "user1@test.com",
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: "PENDING",
          invitedBy: { firstName: "John", lastName: "Doe", email: "john@test.com" },
        },
        {
          id: "inv-2",
          email: "user2@test.com",
          createdAt: new Date(),
          expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // expired
          status: "PENDING",
          invitedBy: { firstName: "Jane", lastName: "Doe", email: "jane@test.com" },
        },
      ])
      mockPrisma.workspaceInvitation.update.mockResolvedValue({})

      const result = await service.getPendingInvitations("ws-123")

      // Verify the query filters by status
      expect(mockPrisma.workspaceInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId: "ws-123",
            status: { in: ["PENDING", "EXPIRED"] }
          }
        })
      )
      expect(result).toHaveLength(2)
      expect(result[1].status).toBe("EXPIRED") // expired one should be marked
    })
  })

  describe("cancelInvitation", () => {
    it("should cancel pending invitation", async () => {
      mockPrisma.workspaceInvitation.findFirst.mockResolvedValue({
        id: "inv-123",
        email: "user@test.com",
        status: "PENDING",
      })
      mockPrisma.workspaceInvitation.update.mockResolvedValue({})

      const result = await service.cancelInvitation("inv-123", "ws-123")

      expect(result.success).toBe(true)
      expect(mockPrisma.workspaceInvitation.update).toHaveBeenCalledWith({
        where: { id: "inv-123" },
        data: { status: "CANCELLED" },
      })
    })

    it("should reject if invitation not found", async () => {
      mockPrisma.workspaceInvitation.findFirst.mockResolvedValue(null)

      const result = await service.cancelInvitation("invalid", "ws-123")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Invitation not found or already processed")
    })
  })

  describe("resendInvitation", () => {
    it("should resend expired invitation with new token", async () => {
      mockPrisma.workspaceInvitation.findFirst.mockResolvedValue({
        id: "inv-123",
        email: "user@test.com",
        status: "EXPIRED",
        workspace: { name: "Test Workspace" },
        invitedBy: { firstName: "John", lastName: "Doe", email: "john@test.com" },
      })
      mockPrisma.user.findUnique.mockResolvedValue({
        firstName: "John",
        lastName: "Doe",
        email: "john@test.com",
      })
      mockPrisma.workspaceInvitation.update.mockResolvedValue({})

      const result = await service.resendInvitation("inv-123", "ws-123", "user-123")

      expect(result.success).toBe(true)
      expect(mockPrisma.workspaceInvitation.update).toHaveBeenCalled()
    })

    it("should reject if invitation not found", async () => {
      mockPrisma.workspaceInvitation.findFirst.mockResolvedValue(null)

      const result = await service.resendInvitation("invalid", "ws-123", "user-123")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Invitation not found")
    })

    it("should reject if invitation already accepted", async () => {
      mockPrisma.workspaceInvitation.findFirst.mockResolvedValue({
        id: "inv-123",
        status: "ACCEPTED",
      })

      const result = await service.resendInvitation("inv-123", "ws-123", "user-123")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Invitation already accepted")
    })
  })
})
