import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { TeamMembersTable } from "@/components/workspace/TeamMembersTable"
import { teamMemberApi, invitationApi } from "@/services/teamApi"
import { toast } from "@/lib/toast"
import { useBilling } from "@/contexts/BillingContext"

// Mock services
vi.mock("@/services/teamApi", () => ({
  teamMemberApi: {
    getMembers: vi.fn(),
    removeMember: vi.fn(),
  },
  invitationApi: {
    getPending: vi.fn(),
    cancel: vi.fn(),
    resend: vi.fn(),
  },
}))

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/contexts/BillingContext", () => ({
  useBilling: vi.fn(),
}))

// Mock InviteMemberModal to avoid complexity
vi.mock("@/components/workspace/InviteMemberModal", () => ({
  InviteMemberModal: ({ open, onOpenChange, onSuccess }: any) => (
    open ? (
      <div data-testid="invite-modal">
        <button onClick={() => { onSuccess(); onOpenChange(false); }}>
          Mock Submit
        </button>
      </div>
    ) : null
  ),
}))

describe("TeamMembersTable", () => {
  const mockWorkspaceId = "workspace-123"
  
  const mockMembers = [
    {
      userId: "user-1",
      email: "owner@test.com",
      firstName: "Owner",
      lastName: null,
      role: "SUPER_ADMIN" as const,
      createdAt: "2024-01-01T00:00:00Z",
    },
    {
      userId: "user-2",
      email: "admin@test.com",
      firstName: null,
      lastName: null,
      role: "ADMIN" as const,
      createdAt: "2024-01-15T00:00:00Z",
    },
  ]

  const mockInvitations = [
    {
      id: "inv-1",
      email: "pending@test.com",
      status: "PENDING" as const,
      expiresAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      createdAt: "2024-01-01T00:00:00Z",
      invitedBy: { id: "user-1", email: "owner@test.com" },
    },
  ]

  const expiredInvitation = {
    id: "inv-2",
    email: "expired@test.com",
    status: "PENDING" as const,
    expiresAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    createdAt: "2024-01-01T00:00:00Z",
    invitedBy: { id: "user-1", email: "owner@test.com" },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(teamMemberApi.getMembers).mockResolvedValue(mockMembers)
    vi.mocked(invitationApi.getPending).mockResolvedValue(mockInvitations)
    vi.mocked(useBilling).mockReturnValue({
      billingOverview: {
        limits: { maxTeamMembers: 10 },
      },
    } as any)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ============================================================================
  // Loading and Error States
  // ============================================================================

  it("should show loading state initially", async () => {
    vi.mocked(teamMemberApi.getMembers).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    // Look for the loading spinner (Loader2 component with animate-spin class)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it("should show error state and retry button on failure", async () => {
    vi.mocked(teamMemberApi.getMembers).mockRejectedValueOnce(new Error("Network error"))

    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
  })

  it("should retry on clicking retry button", async () => {
    const user = userEvent.setup()
    vi.mocked(teamMemberApi.getMembers)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(mockMembers)

    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /retry/i }))

    await waitFor(() => {
      expect(screen.getByText("owner@test.com")).toBeInTheDocument()
    })
  })

  // ============================================================================
  // Members Tab Tests
  // ============================================================================

  it("should display team members correctly", async () => {
    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByText("owner@test.com")).toBeInTheDocument()
    })
    expect(screen.getByText("(Owner)")).toBeInTheDocument()
    expect(screen.getByText("admin@test.com")).toBeInTheDocument()
  })

  it("should show Owner badge for SUPER_ADMIN", async () => {
    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    await waitFor(() => {
      // Use getAllByText since "Owner" appears multiple times in the UI
      const ownerElements = screen.getAllByText("Owner")
      expect(ownerElements.length).toBeGreaterThan(0)
    })
    expect(screen.getByText("Admin")).toBeInTheDocument()
  })

  it("should show empty state when no members", async () => {
    vi.mocked(teamMemberApi.getMembers).mockResolvedValueOnce([])
    vi.mocked(invitationApi.getPending).mockResolvedValueOnce([])

    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByText("No team members yet")).toBeInTheDocument()
    })
  })

  it("should show remove button for ADMIN users when SUPER_ADMIN", async () => {
    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByText("admin@test.com")).toBeInTheDocument()
    })

    // There should be a remove button (UserMinus icon) for the ADMIN user
    const removeButtons = screen.getAllByRole("button").filter(
      btn => btn.querySelector('[class*="h-4 w-4"]') // Icon size class
    )
    expect(removeButtons.length).toBeGreaterThan(0)
  })

  it("should not show remove button for SUPER_ADMIN user", async () => {
    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    await waitFor(() => {
      // The owner row should show "Owner" text instead of a remove button
      const ownerRow = screen.getByText("owner@test.com").closest("tr")
      expect(ownerRow).toContainHTML("Owner")
    })
  })

  it("should confirm before removing member", async () => {
    const user = userEvent.setup()
    vi.mocked(teamMemberApi.removeMember).mockResolvedValueOnce(undefined)

    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByText("admin@test.com")).toBeInTheDocument()
    })

    // Find and click the remove button for admin user
    const adminRow = screen.getByText("admin@test.com").closest("tr")!
    const removeButton = adminRow.querySelector('button[class*="text-red"]')!
    await user.click(removeButton)

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText("Remove Team Member")).toBeInTheDocument()
    })
    expect(screen.getByText(/are you sure you want to remove admin@test.com/i)).toBeInTheDocument()
  })

  it("should remove member on confirmation", async () => {
    const user = userEvent.setup()
    vi.mocked(teamMemberApi.removeMember).mockResolvedValueOnce(undefined)
    vi.mocked(teamMemberApi.getMembers)
      .mockResolvedValueOnce(mockMembers)
      .mockResolvedValueOnce([mockMembers[0]]) // After removal

    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByText("admin@test.com")).toBeInTheDocument()
    })

    // Click remove button (Trash icon in the actions column)
    const adminRow = screen.getByText("admin@test.com").closest("tr")!
    const removeButton = adminRow.querySelector('button.text-red-600')!
    await user.click(removeButton)

    // Click confirm in dialog
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^remove$/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole("button", { name: /^remove$/i }))

    await waitFor(() => {
      expect(teamMemberApi.removeMember).toHaveBeenCalledWith(mockWorkspaceId, "user-2")
    })
    expect(toast.success).toHaveBeenCalledWith("admin@test.com has been removed from the team")
  })

  // ============================================================================
  // Invitations Tab Tests
  // ============================================================================

  it("should switch to invitations tab", async () => {
    const user = userEvent.setup()
    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    // Wait for loading to complete first
    await waitFor(() => {
      expect(screen.getByText("owner@test.com")).toBeInTheDocument()
    })

    // Find the pending invites tab button
    const pendingInvitesTab = screen.getByRole("button", { name: /pending invites/i })
    await user.click(pendingInvitesTab)

    await waitFor(() => {
      expect(screen.getByText("pending@test.com")).toBeInTheDocument()
    })
  })

  it("should show pending badge for non-expired invitations", async () => {
    const user = userEvent.setup()
    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    // Wait for loading to complete first
    await waitFor(() => {
      expect(screen.getByText("owner@test.com")).toBeInTheDocument()
    })

    const pendingInvitesTab = screen.getByRole("button", { name: /pending invites/i })
    await user.click(pendingInvitesTab)

    await waitFor(() => {
      expect(screen.getByText("Pending")).toBeInTheDocument()
    })
  })

  it("should show expired badge for expired invitations", async () => {
    const user = userEvent.setup()
    vi.mocked(invitationApi.getPending).mockResolvedValueOnce([expiredInvitation])

    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    // Wait for loading to complete first
    await waitFor(() => {
      expect(screen.getByText("owner@test.com")).toBeInTheDocument()
    })

    const pendingInvitesTab = screen.getByRole("button", { name: /pending invites/i })
    await user.click(pendingInvitesTab)

    await waitFor(() => {
      expect(screen.getByText("Expired")).toBeInTheDocument()
    })
  })

  it("should show empty state in invitations tab", async () => {
    const user = userEvent.setup()
    vi.mocked(invitationApi.getPending).mockResolvedValueOnce([])

    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    // Wait for loading to complete first
    await waitFor(() => {
      expect(screen.getByText("owner@test.com")).toBeInTheDocument()
    })

    const pendingInvitesTab = screen.getByRole("button", { name: /pending invites/i })
    await user.click(pendingInvitesTab)

    await waitFor(() => {
      expect(screen.getByText("No pending invitations")).toBeInTheDocument()
    })
  })

  it("should cancel invitation on confirmation", async () => {
    const user = userEvent.setup()
    vi.mocked(invitationApi.cancel).mockResolvedValueOnce(undefined)

    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    // Wait for loading to complete first
    await waitFor(() => {
      expect(screen.getByText("owner@test.com")).toBeInTheDocument()
    })

    const pendingInvitesTab = screen.getByRole("button", { name: /pending invites/i })
    await user.click(pendingInvitesTab)

    await waitFor(() => {
      expect(screen.getByText("pending@test.com")).toBeInTheDocument()
    })

    // Find and click cancel button (X icon)
    const invitationRow = screen.getByText("pending@test.com").closest("tr")!
    const cancelButton = invitationRow.querySelector('button[class*="text-red"]')!
    await user.click(cancelButton)

    // Confirm - find the dialog title first (h2 element), then click the button
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Cancel Invitation" })).toBeInTheDocument()
    })
    await user.click(screen.getByRole("button", { name: /cancel invitation/i }))

    await waitFor(() => {
      expect(invitationApi.cancel).toHaveBeenCalledWith(mockWorkspaceId, "inv-1")
    })
    expect(toast.success).toHaveBeenCalled()
  })

  it("should resend expired invitation", async () => {
    const user = userEvent.setup()
    vi.mocked(invitationApi.getPending).mockResolvedValueOnce([expiredInvitation])
    vi.mocked(invitationApi.resend).mockResolvedValueOnce({ message: "Resent" })

    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    // Wait for loading to complete first
    await waitFor(() => {
      expect(screen.getByText("owner@test.com")).toBeInTheDocument()
    })

    const pendingInvitesTab = screen.getByRole("button", { name: /pending invites/i })
    await user.click(pendingInvitesTab)

    await waitFor(() => {
      expect(screen.getByText("expired@test.com")).toBeInTheDocument()
    })

    // Find and click resend button (RefreshCw icon)
    const invitationRow = screen.getByText("expired@test.com").closest("tr")!
    const resendButton = invitationRow.querySelector('button[class*="text-blue"]')!
    await user.click(resendButton)

    await waitFor(() => {
      expect(invitationApi.resend).toHaveBeenCalledWith(mockWorkspaceId, "inv-2")
    })
    expect(toast.success).toHaveBeenCalledWith("Invitation resent to expired@test.com")
  })

  // ============================================================================
  // ADMIN User Permissions
  // ============================================================================

  it("should show disabled invite button for ADMIN users", async () => {
    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={false} />)

    await waitFor(() => {
      expect(screen.getByText("owner@test.com")).toBeInTheDocument()
    })

    // The invite button should be disabled
    const inviteButton = screen.getByRole("button", { name: /invite member/i })
    expect(inviteButton).toBeDisabled()
    expect(inviteButton).toHaveClass("opacity-50")
  })

  it("should not fetch invitations for ADMIN users", async () => {
    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={false} />)

    await waitFor(() => {
      expect(teamMemberApi.getMembers).toHaveBeenCalled()
    })

    // invitationApi.getPending should not be called for non-SUPER_ADMIN
    expect(invitationApi.getPending).not.toHaveBeenCalled()
  })

  it("should not show remove buttons for ADMIN users (no Actions column)", async () => {
    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={false} />)

    await waitFor(() => {
      expect(screen.getByText("admin@test.com")).toBeInTheDocument()
    })

    // ADMIN users should not see the Actions column at all
    // So there should be no Trash button in the member rows
    const adminRow = screen.getByText("admin@test.com").closest("tr")!
    const trashButtons = adminRow.querySelectorAll('button')
    expect(trashButtons.length).toBe(0)
  })

  // ============================================================================
  // Invite Modal Integration
  // ============================================================================

  it("should open invite modal when clicking invite button", async () => {
    const user = userEvent.setup()
    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /invite member/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /invite member/i }))

    await waitFor(() => {
      expect(screen.getByTestId("invite-modal")).toBeInTheDocument()
    })
  })

  it("should reload data when invite is successful", async () => {
    const user = userEvent.setup()
    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /invite member/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /invite member/i }))

    await waitFor(() => {
      expect(screen.getByTestId("invite-modal")).toBeInTheDocument()
    })

    // Click mock submit
    await user.click(screen.getByText("Mock Submit"))

    // Should reload data (getMembers called again)
    await waitFor(() => {
      expect(teamMemberApi.getMembers).toHaveBeenCalledTimes(2)
    })
  })

  // ============================================================================
  // Tab Counts
  // ============================================================================

  it("should show correct member count in tab", async () => {
    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByText(/members \(2\)/i)).toBeInTheDocument()
    })
  })

  it("should show correct invitation count in tab", async () => {
    render(<TeamMembersTable workspaceId={mockWorkspaceId} isSuperAdmin={true} />)

    await waitFor(() => {
      expect(screen.getByText(/pending invites \(1\)/i)).toBeInTheDocument()
    })
  })
})
