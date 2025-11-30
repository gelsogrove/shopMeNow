import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { InviteMemberModal } from "@/components/workspace/InviteMemberModal"
import { invitationApi } from "@/services/teamApi"
import { toast } from "@/lib/toast"

// Mock services
vi.mock("@/services/teamApi", () => ({
  invitationApi: {
    create: vi.fn(),
  },
}))

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe("InviteMemberModal", () => {
  const mockWorkspaceId = "workspace-123"
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    workspaceId: mockWorkspaceId,
    onSuccess: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("should render modal when open", () => {
    render(<InviteMemberModal {...defaultProps} />)

    expect(screen.getByText("Invite Team Member")).toBeInTheDocument()
    expect(screen.getByLabelText(/Email Address/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /send invitation/i })).toBeInTheDocument()
  })

  it("should not render modal when closed", () => {
    render(<InviteMemberModal {...defaultProps} open={false} />)

    expect(screen.queryByText("Invite Team Member")).not.toBeInTheDocument()
  })

  it("should have disabled submit button when email is empty", () => {
    render(<InviteMemberModal {...defaultProps} />)

    const submitButton = screen.getByRole("button", { name: /send invitation/i })
    expect(submitButton).toBeDisabled()
  })

  it("should enable submit button when email is entered", async () => {
    const user = userEvent.setup()
    render(<InviteMemberModal {...defaultProps} />)

    const emailInput = screen.getByLabelText(/Email Address/)
    await user.type(emailInput, "test@example.com")

    const submitButton = screen.getByRole("button", { name: /send invitation/i })
    expect(submitButton).not.toBeDisabled()
  })

  it("should show error for invalid email format", async () => {
    const user = userEvent.setup()
    render(<InviteMemberModal {...defaultProps} />)

    const emailInput = screen.getByLabelText(/Email Address/)
    await user.type(emailInput, "invalid-email")

    const form = emailInput.closest("form")!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument()
    })
    expect(invitationApi.create).not.toHaveBeenCalled()
  })

  it("should call API and show success on valid submission", async () => {
    const user = userEvent.setup()
    vi.mocked(invitationApi.create).mockResolvedValueOnce({
      invitationId: "inv-123",
      message: "Invitation sent",
    })

    render(<InviteMemberModal {...defaultProps} />)

    const emailInput = screen.getByLabelText(/Email Address/)
    await user.type(emailInput, "colleague@company.com")

    const form = emailInput.closest("form")!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(invitationApi.create).toHaveBeenCalledWith(mockWorkspaceId, {
        email: "colleague@company.com",
        firstName: undefined,
        lastName: undefined,
      })
    })

    expect(toast.success).toHaveBeenCalledWith("Invitation sent to colleague@company.com")
    expect(defaultProps.onSuccess).toHaveBeenCalled()
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })

  it("should trim email before validation", async () => {
    const user = userEvent.setup()
    vi.mocked(invitationApi.create).mockResolvedValueOnce({
      invitationId: "inv-123",
      message: "Invitation sent",
    })

    render(<InviteMemberModal {...defaultProps} />)

    const emailInput = screen.getByLabelText(/Email Address/)
    await user.type(emailInput, "  test@example.com  ")

    const form = emailInput.closest("form")!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(invitationApi.create).toHaveBeenCalledWith(mockWorkspaceId, {
        email: "test@example.com",
        firstName: undefined,
        lastName: undefined,
      })
    })
  })

  it("should show error on API failure", async () => {
    const user = userEvent.setup()
    vi.mocked(invitationApi.create).mockRejectedValueOnce({
      response: { data: { error: "User is already a member" } },
    })

    render(<InviteMemberModal {...defaultProps} />)

    const emailInput = screen.getByLabelText(/Email Address/)
    await user.type(emailInput, "existing@company.com")

    const form = emailInput.closest("form")!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText("User is already a member")).toBeInTheDocument()
    })
    expect(toast.error).toHaveBeenCalledWith("User is already a member")
    expect(defaultProps.onSuccess).not.toHaveBeenCalled()
    expect(defaultProps.onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it("should handle generic API error", async () => {
    const user = userEvent.setup()
    vi.mocked(invitationApi.create).mockRejectedValueOnce(new Error("Network error"))

    render(<InviteMemberModal {...defaultProps} />)

    const emailInput = screen.getByLabelText(/Email Address/)
    await user.type(emailInput, "test@example.com")

    const form = emailInput.closest("form")!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument()
    })
  })

  it("should show loading state during submission", async () => {
    const user = userEvent.setup()
    let resolvePromise: (value: any) => void
    vi.mocked(invitationApi.create).mockImplementationOnce(
      () => new Promise((resolve) => { resolvePromise = resolve })
    )

    render(<InviteMemberModal {...defaultProps} />)

    const emailInput = screen.getByLabelText(/Email Address/)
    await user.type(emailInput, "test@example.com")

    const form = emailInput.closest("form")!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText("Sending...")).toBeInTheDocument()
    })

    // Inputs should be disabled during loading
    expect(emailInput).toBeDisabled()
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled()

    // Resolve the promise
    resolvePromise!({ invitationId: "inv-123", message: "Sent" })

    await waitFor(() => {
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("should clear form when modal is closed", async () => {
    const user = userEvent.setup()
    render(<InviteMemberModal {...defaultProps} />)

    const emailInput = screen.getByLabelText(/Email Address/)
    await user.type(emailInput, "test@example.com")

    const cancelButton = screen.getByRole("button", { name: /cancel/i })
    await user.click(cancelButton)

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })

  it("should not close modal when loading", async () => {
    const user = userEvent.setup()
    vi.mocked(invitationApi.create).mockImplementationOnce(
      () => new Promise(() => {}) // Never resolves
    )

    render(<InviteMemberModal {...defaultProps} />)

    const emailInput = screen.getByLabelText(/Email Address/)
    await user.type(emailInput, "test@example.com")

    const form = emailInput.closest("form")!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText("Sending...")).toBeInTheDocument()
    })

    // Try to close - should not work
    const cancelButton = screen.getByRole("button", { name: /cancel/i })
    expect(cancelButton).toBeDisabled()
  })

  it("should display description text", () => {
    render(<InviteMemberModal {...defaultProps} />)

    expect(
      screen.getByText(/send an invitation email to add a new team member/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/they will have access to all your channels/i)
    ).toBeInTheDocument()
  })
})
