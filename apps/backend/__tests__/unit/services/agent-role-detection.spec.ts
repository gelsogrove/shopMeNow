/**
 * Unit tests for Agent role detection in workspace members
 * 
 * Business Rule: When listing workspace members, if a member's email
 * exists in the Sales table for that workspace, their displayed role
 * should be "AGENT" instead of their database role (ADMIN/SUPER_ADMIN)
 */

import { WorkspaceMemberService } from "../../../src/application/services/workspace-member.service"

// Mock PrismaClient
const mockPrisma = {
  userWorkspace: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  sales: {
    findMany: jest.fn(),
  },
  workspace: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
}

describe("WorkspaceMemberService - Agent Role Detection", () => {
  let service: WorkspaceMemberService
  const testWorkspaceId = "workspace-123"

  beforeEach(() => {
    jest.clearAllMocks()
    service = new WorkspaceMemberService(mockPrisma as any)
  })

  describe("getMembers with Sales check", () => {
    it("should return AGENT role when member email exists in Sales table", async () => {
      // Arrange: User is ADMIN in UserWorkspace but their email is in Sales
      const memberEmail = "agent@example.com"
      
      mockPrisma.userWorkspace.findMany.mockResolvedValue([
        {
          role: "ADMIN",
          createdAt: new Date("2025-01-01"),
          user: {
            id: "user-1",
            email: memberEmail,
            firstName: "John",
            lastName: "Agent",
          },
        },
      ])

      // This email exists in Sales table
      mockPrisma.sales.findMany.mockResolvedValue([
        { email: memberEmail },
      ])

      // Act
      const members = await service.getMembers(testWorkspaceId)

      // Assert
      expect(members).toHaveLength(1)
      expect(members[0].email).toBe(memberEmail)
      expect(members[0].role).toBe("AGENT") // Should be AGENT, not ADMIN
    })

    it("should return original role when member email does NOT exist in Sales table", async () => {
      // Arrange: User is ADMIN and email is NOT in Sales
      const adminEmail = "admin@example.com"
      
      mockPrisma.userWorkspace.findMany.mockResolvedValue([
        {
          role: "ADMIN",
          createdAt: new Date("2025-01-01"),
          user: {
            id: "user-2",
            email: adminEmail,
            firstName: "Jane",
            lastName: "Admin",
          },
        },
      ])

      // No matching email in Sales
      mockPrisma.sales.findMany.mockResolvedValue([])

      // Act
      const members = await service.getMembers(testWorkspaceId)

      // Assert
      expect(members).toHaveLength(1)
      expect(members[0].email).toBe(adminEmail)
      expect(members[0].role).toBe("ADMIN") // Should remain ADMIN
    })

    it("should return SUPER_ADMIN role unchanged (owner cannot be agent)", async () => {
      // Arrange: Owner (SUPER_ADMIN) should never become AGENT even if in Sales
      const ownerEmail = "owner@example.com"
      
      mockPrisma.userWorkspace.findMany.mockResolvedValue([
        {
          role: "SUPER_ADMIN",
          createdAt: new Date("2025-01-01"),
          user: {
            id: "user-owner",
            email: ownerEmail,
            firstName: "Owner",
            lastName: "Boss",
          },
        },
      ])

      // Even if owner email is in Sales, they should stay SUPER_ADMIN
      mockPrisma.sales.findMany.mockResolvedValue([
        { email: ownerEmail },
      ])

      // Act
      const members = await service.getMembers(testWorkspaceId)

      // Assert
      expect(members).toHaveLength(1)
      expect(members[0].role).toBe("SUPER_ADMIN") // Owner stays SUPER_ADMIN
    })

    it("should handle mixed members (some agents, some admins)", async () => {
      // Arrange: Multiple members with different scenarios
      const agentEmail = "sales-person@example.com"
      const adminEmail = "admin@example.com"
      const ownerEmail = "owner@example.com"
      
      mockPrisma.userWorkspace.findMany.mockResolvedValue([
        {
          role: "SUPER_ADMIN",
          createdAt: new Date("2025-01-01"),
          user: { id: "user-1", email: ownerEmail, firstName: "Owner", lastName: "Boss" },
        },
        {
          role: "ADMIN",
          createdAt: new Date("2025-01-02"),
          user: { id: "user-2", email: agentEmail, firstName: "Sales", lastName: "Person" },
        },
        {
          role: "ADMIN",
          createdAt: new Date("2025-01-03"),
          user: { id: "user-3", email: adminEmail, firstName: "Regular", lastName: "Admin" },
        },
      ])

      // Only agentEmail is in Sales
      mockPrisma.sales.findMany.mockResolvedValue([
        { email: agentEmail },
      ])

      // Act
      const members = await service.getMembers(testWorkspaceId)

      // Assert
      expect(members).toHaveLength(3)
      
      const owner = members.find(m => m.email === ownerEmail)
      const agent = members.find(m => m.email === agentEmail)
      const admin = members.find(m => m.email === adminEmail)
      
      expect(owner?.role).toBe("SUPER_ADMIN") // Owner unchanged
      expect(agent?.role).toBe("AGENT")       // Sales person becomes AGENT
      expect(admin?.role).toBe("ADMIN")       // Regular admin unchanged
    })

    it("should query Sales table with correct workspaceId filter", async () => {
      // Arrange
      mockPrisma.userWorkspace.findMany.mockResolvedValue([
        {
          role: "ADMIN",
          createdAt: new Date(),
          user: { id: "user-1", email: "test@example.com", firstName: "Test", lastName: "User" },
        },
      ])
      mockPrisma.sales.findMany.mockResolvedValue([])

      // Act
      await service.getMembers(testWorkspaceId)

      // Assert: Sales query should filter by workspaceId
      expect(mockPrisma.sales.findMany).toHaveBeenCalledWith({
        where: { workspaceId: testWorkspaceId },
        select: { email: true },
      })
    })

    it("should handle case-insensitive email matching", async () => {
      // Arrange: Email in different cases
      const memberEmail = "Agent@Example.COM"
      const salesEmail = "agent@example.com"
      
      mockPrisma.userWorkspace.findMany.mockResolvedValue([
        {
          role: "ADMIN",
          createdAt: new Date(),
          user: { id: "user-1", email: memberEmail, firstName: "Agent", lastName: "User" },
        },
      ])

      mockPrisma.sales.findMany.mockResolvedValue([
        { email: salesEmail },
      ])

      // Act
      const members = await service.getMembers(testWorkspaceId)

      // Assert: Should match despite case difference
      expect(members[0].role).toBe("AGENT")
    })

    it("should handle empty members list", async () => {
      // Arrange
      mockPrisma.userWorkspace.findMany.mockResolvedValue([])
      mockPrisma.sales.findMany.mockResolvedValue([])

      // Act
      const members = await service.getMembers(testWorkspaceId)

      // Assert
      expect(members).toHaveLength(0)
    })

    it("should handle Sales query error gracefully", async () => {
      // Arrange: Members exist but Sales query fails
      mockPrisma.userWorkspace.findMany.mockResolvedValue([
        {
          role: "ADMIN",
          createdAt: new Date(),
          user: { id: "user-1", email: "test@example.com", firstName: "Test", lastName: "User" },
        },
      ])
      mockPrisma.sales.findMany.mockRejectedValue(new Error("Database error"))

      // Act
      const members = await service.getMembers(testWorkspaceId)

      // Assert: Should return members with original roles (graceful degradation)
      expect(members).toHaveLength(1)
      expect(members[0].role).toBe("ADMIN") // Original role preserved on error
    })
  })
})
