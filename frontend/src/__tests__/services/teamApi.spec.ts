import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { api } from "@/services/api"
import { teamMemberApi, invitationApi } from "@/services/teamApi"

// Mock the api service
vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

describe("teamApi", () => {
  const mockWorkspaceId = "workspace-123"

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ============================================================================
  // teamMemberApi tests
  // ============================================================================

  describe("teamMemberApi", () => {
    describe("getMembers", () => {
      it("should fetch all members of a workspace", async () => {
        const mockMembers = [
          {
            userId: "user-1",
            email: "owner@test.com",
            firstName: "Owner",
            lastName: "User",
            role: "SUPER_ADMIN",
            createdAt: "2024-01-01T00:00:00Z",
          },
          {
            userId: "user-2",
            email: "admin@test.com",
            firstName: null,
            lastName: null,
            role: "ADMIN",
            createdAt: "2024-01-02T00:00:00Z",
          },
        ]
        // API returns { success: true, members: [...] }
        vi.mocked(api.get).mockResolvedValueOnce({ data: { success: true, members: mockMembers } })

        const result = await teamMemberApi.getMembers(mockWorkspaceId)

        expect(api.get).toHaveBeenCalledWith(
          `/workspaces/${mockWorkspaceId}/members`,
          { headers: { 'x-workspace-id': mockWorkspaceId } }
        )
        expect(result).toEqual(mockMembers)
      })

      it("should return empty array when no members", async () => {
        vi.mocked(api.get).mockResolvedValueOnce({ data: { success: true, members: [] } })

        const result = await teamMemberApi.getMembers(mockWorkspaceId)

        expect(result).toEqual([])
      })

      it("should handle legacy response format (direct array)", async () => {
        const mockMembers = [{ userId: "user-1", email: "test@test.com", role: "ADMIN" }]
        vi.mocked(api.get).mockResolvedValueOnce({ data: mockMembers })

        const result = await teamMemberApi.getMembers(mockWorkspaceId)

        expect(result).toEqual(mockMembers)
      })
    })

    describe("removeMember", () => {
      it("should remove a member from the workspace", async () => {
        const userId = "user-123"
        vi.mocked(api.delete).mockResolvedValueOnce({ data: undefined })

        await teamMemberApi.removeMember(mockWorkspaceId, userId)

        expect(api.delete).toHaveBeenCalledWith(
          `/workspaces/${mockWorkspaceId}/members/${userId}`,
          { headers: { 'x-workspace-id': mockWorkspaceId } }
        )
      })

      it("should throw error when removal fails", async () => {
        const userId = "user-123"
        vi.mocked(api.delete).mockRejectedValueOnce(new Error("Cannot remove owner"))

        await expect(teamMemberApi.removeMember(mockWorkspaceId, userId))
          .rejects.toThrow("Cannot remove owner")
      })
    })

    describe("getRole", () => {
      it("should fetch current user role in workspace", async () => {
        const mockRole = { role: "SUPER_ADMIN", isSuperAdmin: true }
        vi.mocked(api.get).mockResolvedValueOnce({ data: mockRole })

        const result = await teamMemberApi.getRole(mockWorkspaceId)

        expect(api.get).toHaveBeenCalledWith(
          `/workspaces/${mockWorkspaceId}/members/me/role`,
          { headers: { 'x-workspace-id': mockWorkspaceId } }
        )
        expect(result).toEqual(mockRole)
      })

      it("should return ADMIN role correctly", async () => {
        const mockRole = { role: "ADMIN", isSuperAdmin: false }
        vi.mocked(api.get).mockResolvedValueOnce({ data: mockRole })

        const result = await teamMemberApi.getRole(mockWorkspaceId)

        expect(result.role).toBe("ADMIN")
        expect(result.isSuperAdmin).toBe(false)
      })
    })
  })

  // ============================================================================
  // invitationApi tests
  // ============================================================================

  describe("invitationApi", () => {
    describe("create", () => {
      it("should create a new invitation", async () => {
        const mockResponse = { invitationId: "inv-123", message: "Invitation sent" }
        vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

        const result = await invitationApi.create(mockWorkspaceId, { email: "new@test.com" })

        expect(api.post).toHaveBeenCalledWith(
          `/workspaces/${mockWorkspaceId}/invitations`,
          { email: "new@test.com" },
          { headers: { 'x-workspace-id': mockWorkspaceId } }
        )
        expect(result).toEqual(mockResponse)
      })

      it("should throw error for invalid email", async () => {
        vi.mocked(api.post).mockRejectedValueOnce({
          response: { data: { error: "Invalid email format" } }
        })

        await expect(invitationApi.create(mockWorkspaceId, { email: "invalid" }))
          .rejects.toMatchObject({
            response: { data: { error: "Invalid email format" } }
          })
      })

      it("should throw error when user already a member", async () => {
        vi.mocked(api.post).mockRejectedValueOnce({
          response: { data: { error: "User is already a member of this workspace" } }
        })

        await expect(invitationApi.create(mockWorkspaceId, { email: "existing@test.com" }))
          .rejects.toMatchObject({
            response: { data: { error: "User is already a member of this workspace" } }
          })
      })
    })

    describe("getPending", () => {
      it("should fetch all pending invitations", async () => {
        const mockInvitations = [
          {
            id: "inv-1",
            email: "pending1@test.com",
            status: "PENDING",
            expiresAt: "2024-12-31T00:00:00Z",
            createdAt: "2024-01-01T00:00:00Z",
            invitedBy: { id: "user-1", email: "owner@test.com" },
          },
          {
            id: "inv-2",
            email: "pending2@test.com",
            status: "PENDING",
            expiresAt: "2024-12-31T00:00:00Z",
            createdAt: "2024-01-02T00:00:00Z",
            invitedBy: { id: "user-1", email: "owner@test.com" },
          },
        ]
        // API returns { success: true, invitations: [...] }
        vi.mocked(api.get).mockResolvedValueOnce({ data: { success: true, invitations: mockInvitations } })

        const result = await invitationApi.getPending(mockWorkspaceId)

        expect(api.get).toHaveBeenCalledWith(
          `/workspaces/${mockWorkspaceId}/invitations`,
          { headers: { 'x-workspace-id': mockWorkspaceId } }
        )
        expect(result).toEqual(mockInvitations)
        expect(result).toHaveLength(2)
      })

      it("should return empty array when no pending invitations", async () => {
        vi.mocked(api.get).mockResolvedValueOnce({ data: { success: true, invitations: [] } })

        const result = await invitationApi.getPending(mockWorkspaceId)

        expect(result).toEqual([])
      })

      it("should handle legacy response format (direct array)", async () => {
        const mockInvitations = [{ id: "inv-1", email: "test@test.com", status: "PENDING" }]
        vi.mocked(api.get).mockResolvedValueOnce({ data: mockInvitations })

        const result = await invitationApi.getPending(mockWorkspaceId)

        expect(result).toEqual(mockInvitations)
      })
    })

    describe("cancel", () => {
      it("should cancel a pending invitation", async () => {
        const invitationId = "inv-123"
        vi.mocked(api.delete).mockResolvedValueOnce({ data: undefined })

        await invitationApi.cancel(mockWorkspaceId, invitationId)

        expect(api.delete).toHaveBeenCalledWith(
          `/workspaces/${mockWorkspaceId}/invitations/${invitationId}`,
          { headers: { 'x-workspace-id': mockWorkspaceId } }
        )
      })

      it("should throw error when cancelling non-existent invitation", async () => {
        vi.mocked(api.delete).mockRejectedValueOnce({
          response: { data: { error: "Invitation not found" } }
        })

        await expect(invitationApi.cancel(mockWorkspaceId, "non-existent"))
          .rejects.toMatchObject({
            response: { data: { error: "Invitation not found" } }
          })
      })
    })

    describe("resend", () => {
      it("should resend an expired invitation", async () => {
        const invitationId = "inv-123"
        const mockResponse = { message: "Invitation resent successfully" }
        vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

        const result = await invitationApi.resend(mockWorkspaceId, invitationId)

        expect(api.post).toHaveBeenCalledWith(
          `/workspaces/${mockWorkspaceId}/invitations/${invitationId}/resend`,
          {},
          { headers: { 'x-workspace-id': mockWorkspaceId } }
        )
        expect(result).toEqual(mockResponse)
      })

      it("should throw error when resending non-expired invitation", async () => {
        vi.mocked(api.post).mockRejectedValueOnce({
          response: { data: { error: "Cannot resend non-expired invitation" } }
        })

        await expect(invitationApi.resend(mockWorkspaceId, "inv-123"))
          .rejects.toMatchObject({
            response: { data: { error: "Cannot resend non-expired invitation" } }
          })
      })
    })

    describe("validate", () => {
      it("should validate an invitation token and map response correctly", async () => {
        const token = "valid-token-123"
        // Backend returns this structure
        const backendResponse = {
          success: true,
          invitation: {
            id: "inv-1",
            email: "invited@test.com",
            workspaceId: mockWorkspaceId,
            workspaceName: "Test Workspace",
            invitedByName: "Owner",
            isExpired: false,
            status: "PENDING",
            existingUser: true,
          }
        }
        vi.mocked(api.get).mockResolvedValueOnce({ data: backendResponse })

        const result = await invitationApi.validate(token)

        expect(api.get).toHaveBeenCalledWith(`/invitations/validate/${token}`)
        expect(result.valid).toBe(true)
        expect(result.email).toBe("invited@test.com")
        expect(result.workspaceName).toBe("Test Workspace")
        expect(result.invitedByName).toBe("Owner")
        expect(result.status).toBe("PENDING")
      })

      it("should return valid=false for expired invitation", async () => {
        const token = "expired-token"
        const backendResponse = {
          success: true,
          invitation: {
            id: "inv-1",
            email: "invited@test.com",
            workspaceId: mockWorkspaceId,
            workspaceName: "Test Workspace",
            invitedByName: "Owner",
            isExpired: true,
            status: "EXPIRED",
            existingUser: true,
          }
        }
        vi.mocked(api.get).mockResolvedValueOnce({ data: backendResponse })

        const result = await invitationApi.validate(token)

        expect(result.valid).toBe(false)
        expect(result.isExpired).toBe(true)
        expect(result.status).toBe("EXPIRED")
      })

      it("should throw error for invalid token", async () => {
        const token = "invalid-token"
        vi.mocked(api.get).mockRejectedValueOnce({
          response: { status: 404, data: { error: "Invalid invitation token" } }
        })

        await expect(invitationApi.validate(token))
          .rejects.toMatchObject({
            response: { data: { error: "Invalid invitation token" } }
          })
      })
    })

    describe("accept", () => {
      it("should accept an invitation", async () => {
        const token = "valid-token-123"
        const mockResponse = {
          message: "Invitation accepted successfully",
          workspaceId: mockWorkspaceId,
        }
        vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

        const result = await invitationApi.accept(token)

        expect(api.post).toHaveBeenCalledWith("/invitations/accept", { token })
        expect(result).toEqual(mockResponse)
      })

      it("should throw error for already accepted invitation", async () => {
        vi.mocked(api.post).mockRejectedValueOnce({
          response: { data: { error: "Invitation already accepted" } }
        })

        await expect(invitationApi.accept("already-used-token"))
          .rejects.toMatchObject({
            response: { data: { error: "Invitation already accepted" } }
          })
      })

      it("should throw error for cancelled invitation", async () => {
        vi.mocked(api.post).mockRejectedValueOnce({
          response: { data: { error: "This invitation has been cancelled" } }
        })

        await expect(invitationApi.accept("cancelled-token"))
          .rejects.toMatchObject({
            response: { data: { error: "This invitation has been cancelled" } }
          })
      })
    })
  })
})
