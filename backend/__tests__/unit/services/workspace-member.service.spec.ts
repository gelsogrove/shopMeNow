import { PrismaClient } from "@prisma/client"
import { WorkspaceMemberService } from "../../../src/application/services/workspace-member.service"

// Mock Prisma
const mockPrisma = {
  userWorkspace: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
}

describe("WorkspaceMemberService", () => {
  let service: WorkspaceMemberService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new WorkspaceMemberService(mockPrisma as unknown as PrismaClient)
  })

  describe("getMembers", () => {
    it("should return all members with their roles", async () => {
      mockPrisma.userWorkspace.findMany.mockResolvedValue([
        {
          userId: "user-1",
          role: "SUPER_ADMIN",
          createdAt: new Date("2025-01-01"),
          user: {
            id: "user-1",
            email: "admin@test.com",
            firstName: "John",
            lastName: "Doe",
          },
        },
        {
          userId: "user-2",
          role: "ADMIN",
          createdAt: new Date("2025-01-15"),
          user: {
            id: "user-2",
            email: "member@test.com",
            firstName: "Jane",
            lastName: "Smith",
          },
        },
      ])

      const result = await service.getMembers("ws-123")

      expect(result).toHaveLength(2)
      expect(result[0].role).toBe("SUPER_ADMIN")
      expect(result[0].email).toBe("admin@test.com")
      expect(result[1].role).toBe("ADMIN")
    })

    it("should order members by role and createdAt", async () => {
      mockPrisma.userWorkspace.findMany.mockResolvedValue([])

      await service.getMembers("ws-123")

      expect(mockPrisma.userWorkspace.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "ws-123" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      })
    })
  })

  describe("getAdminsByOwnerId", () => {
    it("should return all unique ADMINs for owner's workspaces", async () => {
      mockPrisma.workspace.findMany.mockResolvedValue([
        { id: "ws-1" },
        { id: "ws-2" },
      ])

      mockPrisma.userWorkspace.findMany.mockResolvedValue([
        { user: { id: "admin-1", email: "admin1@test.com" } },
        { user: { id: "admin-2", email: "admin2@test.com" } },
      ])

      const result = await service.getAdminsByOwnerId("owner-123")

      expect(result).toHaveLength(2)
      expect(result[0].email).toBe("admin1@test.com")
    })

    it("should query only ADMIN role", async () => {
      mockPrisma.workspace.findMany.mockResolvedValue([{ id: "ws-1" }])
      mockPrisma.userWorkspace.findMany.mockResolvedValue([])

      await service.getAdminsByOwnerId("owner-123")

      expect(mockPrisma.userWorkspace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: "ADMIN",
          }),
        })
      )
    })
  })

  describe("addMemberToAllOwnerChannels", () => {
    it("should add member to all owner's workspaces", async () => {
      mockPrisma.workspace.findMany.mockResolvedValue([
        { id: "ws-1" },
        { id: "ws-2" },
        { id: "ws-3" },
      ])

      mockPrisma.userWorkspace.findUnique.mockResolvedValue(null) // not existing
      mockPrisma.userWorkspace.create.mockResolvedValue({})

      const result = await service.addMemberToAllOwnerChannels(
        "new-user",
        "owner-123",
        "ADMIN"
      )

      expect(result.success).toBe(true)
      expect(result.workspacesAdded).toBe(3)
      expect(mockPrisma.userWorkspace.create).toHaveBeenCalledTimes(3)
    })

    it("should skip workspaces where user is already member", async () => {
      mockPrisma.workspace.findMany.mockResolvedValue([
        { id: "ws-1" },
        { id: "ws-2" },
      ])

      mockPrisma.userWorkspace.findUnique
        .mockResolvedValueOnce({ userId: "new-user" }) // already exists
        .mockResolvedValueOnce(null) // doesn't exist

      mockPrisma.userWorkspace.create.mockResolvedValue({})

      const result = await service.addMemberToAllOwnerChannels(
        "new-user",
        "owner-123"
      )

      expect(result.workspacesAdded).toBe(1)
      expect(mockPrisma.userWorkspace.create).toHaveBeenCalledTimes(1)
    })
  })

  describe("removeMember", () => {
    it("should remove member from all owner's workspaces", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ ownerId: "owner-123" })
      mockPrisma.workspace.findMany.mockResolvedValue([
        { id: "ws-1" },
        { id: "ws-2" },
      ])
      mockPrisma.userWorkspace.deleteMany.mockResolvedValue({ count: 2 })

      const result = await service.removeMember(
        "ws-1",
        "user-to-remove",
        "owner-123"
      )

      expect(result.success).toBe(true)
      expect(result.workspacesRemoved).toBe(2)
    })

    it("should reject if workspace not found", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null)

      const result = await service.removeMember("invalid", "user", "owner")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Workspace not found")
    })

    it("should reject if requester is not owner", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ ownerId: "owner-123" })

      const result = await service.removeMember(
        "ws-1",
        "user-to-remove",
        "not-owner"
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe("Only workspace owner can remove members")
    })

    it("should reject self-removal", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ ownerId: "owner-123" })

      const result = await service.removeMember("ws-1", "owner-123", "owner-123")

      expect(result.success).toBe(false)
      expect(result.error).toBe("Cannot remove yourself from the workspace")
    })
  })

  describe("isUserMember", () => {
    it("should return true if user is member", async () => {
      mockPrisma.userWorkspace.findUnique.mockResolvedValue({
        userId: "user-123",
        role: "ADMIN",
      })

      const result = await service.isUserMember("ws-123", "user-123")

      expect(result.isMember).toBe(true)
      expect(result.role).toBe("ADMIN")
    })

    it("should return false if user is not member", async () => {
      mockPrisma.userWorkspace.findUnique.mockResolvedValue(null)

      const result = await service.isUserMember("ws-123", "user-123")

      expect(result.isMember).toBe(false)
      expect(result.role).toBeNull()
    })
  })

  describe("isSuperAdmin", () => {
    it("should return true if user is workspace owner", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ ownerId: "user-123" })

      const result = await service.isSuperAdmin("ws-123", "user-123")

      expect(result).toBe(true)
    })

    it("should return false if user is not owner", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ ownerId: "other-user" })

      const result = await service.isSuperAdmin("ws-123", "user-123")

      expect(result).toBe(false)
    })

    it("should return false if workspace not found", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null)

      const result = await service.isSuperAdmin("invalid", "user-123")

      expect(result).toBe(false)
    })
  })

  describe("getUserRole", () => {
    it("should return user role", async () => {
      mockPrisma.userWorkspace.findUnique.mockResolvedValue({
        role: "SUPER_ADMIN",
      })

      const result = await service.getUserRole("ws-123", "user-123")

      expect(result).toBe("SUPER_ADMIN")
    })

    it("should return null if not member", async () => {
      mockPrisma.userWorkspace.findUnique.mockResolvedValue(null)

      const result = await service.getUserRole("ws-123", "user-123")

      expect(result).toBeNull()
    })
  })

  describe("addExistingAdminsToNewWorkspace", () => {
    it("should add all existing ADMINs to new workspace", async () => {
      // Mock getAdminsByOwnerId
      mockPrisma.workspace.findMany.mockResolvedValue([{ id: "old-ws" }])
      mockPrisma.userWorkspace.findMany.mockResolvedValue([
        { user: { id: "admin-1", email: "admin1@test.com" } },
        { user: { id: "admin-2", email: "admin2@test.com" } },
      ])

      mockPrisma.userWorkspace.findUnique.mockResolvedValue(null)
      mockPrisma.userWorkspace.create.mockResolvedValue({})

      const result = await service.addExistingAdminsToNewWorkspace(
        "new-ws",
        "owner-123"
      )

      expect(result.success).toBe(true)
      expect(result.adminsAdded).toBe(2)
    })

    it("should skip ADMINs already in the workspace", async () => {
      mockPrisma.workspace.findMany.mockResolvedValue([{ id: "old-ws" }])
      mockPrisma.userWorkspace.findMany.mockResolvedValue([
        { user: { id: "admin-1", email: "admin1@test.com" } },
      ])

      mockPrisma.userWorkspace.findUnique.mockResolvedValue({ userId: "admin-1" })

      const result = await service.addExistingAdminsToNewWorkspace(
        "new-ws",
        "owner-123"
      )

      expect(result.adminsAdded).toBe(0)
      expect(mockPrisma.userWorkspace.create).not.toHaveBeenCalled()
    })
  })
})
