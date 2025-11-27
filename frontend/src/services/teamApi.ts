import { api } from "./api"

// ============================================================================
// Types
// ============================================================================

export interface TeamMember {
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  role: 'SUPER_ADMIN' | 'ADMIN'
  createdAt: string
}

export interface PendingInvitation {
  id: string
  email: string
  status: 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'EXPIRED'
  expiresAt: string
  createdAt: string
  invitedBy: {
    id: string
    email: string
    name?: string
  }
}

export interface WorkspaceRole {
  role: 'SUPER_ADMIN' | 'ADMIN'
  isSuperAdmin: boolean
}

export interface CreateInvitationData {
  email: string
}

export interface InvitationValidation {
  valid: boolean
  email: string
  workspaceId: string
  workspaceName: string
  invitedByName: string
  isExpired: boolean
  status: 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'EXPIRED'
  existingUser: boolean
}

// ============================================================================
// Team Members API
// ============================================================================

/**
 * Helper to create headers with workspace ID
 * Required because workspace selection page doesn't have workspace in localStorage
 */
const withWorkspaceHeader = (workspaceId: string) => ({
  headers: { 'x-workspace-id': workspaceId }
})

export const teamMemberApi = {
  /**
   * Get all members of a workspace
   */
  async getMembers(workspaceId: string): Promise<TeamMember[]> {
    const response = await api.get(`/workspaces/${workspaceId}/members`, withWorkspaceHeader(workspaceId))
    return response.data.members || response.data
  },

  /**
   * Remove a member from the workspace (and all owner's workspaces)
   */
  async removeMember(workspaceId: string, userId: string): Promise<void> {
    await api.delete(`/workspaces/${workspaceId}/members/${userId}`, withWorkspaceHeader(workspaceId))
  },

  /**
   * Get current user's role in the workspace
   */
  async getRole(workspaceId: string): Promise<WorkspaceRole> {
    const response = await api.get(`/workspaces/${workspaceId}/members/me/role`, withWorkspaceHeader(workspaceId))
    return response.data
  },
}

// ============================================================================
// Invitations API
// ============================================================================

export const invitationApi = {
  /**
   * Create a new invitation
   */
  async create(workspaceId: string, data: CreateInvitationData): Promise<{ invitationId: string; message: string }> {
    const response = await api.post(`/workspaces/${workspaceId}/invitations`, data, withWorkspaceHeader(workspaceId))
    return response.data
  },

  /**
   * Get all pending invitations for a workspace
   */
  async getPending(workspaceId: string): Promise<PendingInvitation[]> {
    const response = await api.get(`/workspaces/${workspaceId}/invitations`, withWorkspaceHeader(workspaceId))
    // API returns { success: true, invitations: [...] }
    return response.data.invitations || response.data
  },

  /**
   * Cancel a pending invitation
   */
  async cancel(workspaceId: string, invitationId: string): Promise<void> {
    await api.delete(`/workspaces/${workspaceId}/invitations/${invitationId}`, withWorkspaceHeader(workspaceId))
  },

  /**
   * Resend an expired invitation
   */
  async resend(workspaceId: string, invitationId: string): Promise<{ message: string }> {
    const response = await api.post(`/workspaces/${workspaceId}/invitations/${invitationId}/resend`, {}, withWorkspaceHeader(workspaceId))
    return response.data
  },

  /**
   * Validate an invitation token (public endpoint, no auth required)
   */
  async validate(token: string): Promise<InvitationValidation> {
    const response = await api.get(`/invitations/validate/${token}`)
    // Backend returns { success: true, invitation: { ... } }
    const invitation = response.data.invitation || response.data
    return {
      valid: invitation.status === 'PENDING' && !invitation.isExpired,
      email: invitation.email,
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspaceName,
      invitedByName: invitation.invitedByName,
      isExpired: invitation.isExpired,
      status: invitation.status,
      existingUser: invitation.existingUser,
    }
  },

  /**
   * Accept an invitation (requires auth)
   */
  async accept(token: string): Promise<{ message: string; workspaceId: string }> {
    const response = await api.post(`/invitations/accept`, { token })
    return response.data
  },
}
