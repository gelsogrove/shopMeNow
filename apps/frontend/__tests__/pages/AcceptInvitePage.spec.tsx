import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { AcceptInvitePage } from "@/pages/AcceptInvitePage"
import { invitationApi } from "@/services/teamApi"
import { toast } from "@/lib/toast"

// Mock services
vi.mock("@/services/teamApi", () => ({
  invitationApi: {
    validate: vi.fn(),
    accept: vi.fn(),
  },
}))

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(window, "localStorage", { value: localStorageMock })

describe("AcceptInvitePage", () => {
  const mockValidation = {
    valid: true,
    email: "invited@test.com",
    workspaceId: "workspace-123",
    workspaceName: "Test Workspace",
    invitedByName: "Owner",
    isExpired: false,
    status: "PENDING" as const,
    existingUser: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  const renderPage = (token: string = "test-token-123") => {
    return render(
      <MemoryRouter initialEntries={[`/accept-invite?token=${token}`]}>
        <Routes>
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/" element={<div>Login Page</div>} />
          <Route path="/workspace-selection" element={<div>Workspace Selection Page</div>} />
        </Routes>
      </MemoryRouter>
    )
  }

  const renderPageWithoutToken = () => {
    return render(
      <MemoryRouter initialEntries={["/accept-invite"]}>
        <Routes>
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/" element={<div>Login Page</div>} />
          <Route path="/workspace-selection" element={<div>Workspace Selection Page</div>} />
        </Routes>
      </MemoryRouter>
    )
  }

  // ============================================================================
  // Loading State
  // ============================================================================

  it("should show loading state while validating token", async () => {
    vi.mocked(invitationApi.validate).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    renderPage()

    expect(screen.getByText("Validating your invitation...")).toBeInTheDocument()
  })

  it("should validate the invitation token from query params", async () => {
    vi.mocked(invitationApi.validate).mockResolvedValueOnce(mockValidation)

    renderPage("token-456")

    await waitFor(() => {
      expect(invitationApi.validate).toHaveBeenCalledWith("token-456")
    })
  })

  // ============================================================================
  // Valid Invitation - Not Logged In
  // ============================================================================

  it("should show valid invitation with login prompt when not logged in", async () => {
    vi.mocked(invitationApi.validate).mockResolvedValueOnce(mockValidation)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("You're Invited!")).toBeInTheDocument()
    })

    expect(screen.getByText(/Owner has invited you/)).toBeInTheDocument()
    expect(screen.getByText("Test Workspace")).toBeInTheDocument()
    expect(screen.getByText(/invited@test.com/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /log in to accept/i })).toBeInTheDocument()
  })

  it("should navigate to login when clicking login button", async () => {
    const user = userEvent.setup()
    vi.mocked(invitationApi.validate).mockResolvedValueOnce(mockValidation)

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /log in to accept/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /log in to accept/i }))

    // Verify we navigated to login page
    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument()
    })
  })

  // ============================================================================
  // Valid Invitation - Logged In (AUTO-ACCEPT)
  // ============================================================================

  it("should auto-accept invitation when logged in with matching email", async () => {
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === "token") return "valid-jwt-token"
      if (key === "user") return JSON.stringify({ email: "invited@test.com" })
      return null
    })
    vi.mocked(invitationApi.validate).mockResolvedValueOnce(mockValidation)
    vi.mocked(invitationApi.accept).mockResolvedValueOnce({ message: "Success", workspaceId: "workspace-123" })

    renderPage()

    // Should call accept API automatically
    await waitFor(() => {
      expect(invitationApi.accept).toHaveBeenCalledWith("test-token-123")
    })
    
    expect(toast.success).toHaveBeenCalledWith("Welcome to the team!")
    
    // Should eventually redirect to workspace selection
    await waitFor(() => {
      expect(screen.getByText("Workspace Selection Page")).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it("should show error for email mismatch", async () => {
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === "token") return "valid-jwt-token"
      if (key === "user") return JSON.stringify({ email: "different@test.com" })
      return null
    })
    vi.mocked(invitationApi.validate).mockResolvedValueOnce(mockValidation)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/This invitation was sent to invited@test.com/)).toBeInTheDocument()
    })
  })

  it("should show error when auto-accept fails", async () => {
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === "token") return "valid-jwt-token"
      if (key === "user") return JSON.stringify({ email: "invited@test.com" })
      return null
    })
    vi.mocked(invitationApi.validate).mockResolvedValueOnce(mockValidation)
    vi.mocked(invitationApi.accept).mockRejectedValueOnce({
      response: { data: { error: "Failed to accept" } },
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Invalid Invitation")).toBeInTheDocument()
    })
    expect(toast.error).toHaveBeenCalledWith("Failed to accept")
  })

  // ============================================================================
  // Invalid/Expired States
  // ============================================================================

  it("should show expired state for expired invitation", async () => {
    vi.mocked(invitationApi.validate).mockRejectedValueOnce({
      response: { data: { error: "Invitation has expired" } },
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Invitation Expired")).toBeInTheDocument()
    })
    expect(screen.getByText(/Please ask the team administrator/)).toBeInTheDocument()
  })

  it("should show already-accepted state", async () => {
    vi.mocked(invitationApi.validate).mockRejectedValueOnce({
      response: { data: { error: "Invitation already accepted" } },
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Already Accepted")).toBeInTheDocument()
    })
    expect(screen.getByText(/You should already have access/)).toBeInTheDocument()
  })

  it("should show invalid state for invalid token", async () => {
    vi.mocked(invitationApi.validate).mockRejectedValueOnce({
      response: { data: { error: "Invalid token" } },
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Invalid Invitation")).toBeInTheDocument()
    })
  })

  it("should show invalid state when no token provided", async () => {
    renderPageWithoutToken()

    await waitFor(() => {
      expect(screen.getByText("Invalid Invitation")).toBeInTheDocument()
    })
    expect(screen.getByText("No invitation token provided")).toBeInTheDocument()
  })

  // ============================================================================
  // Loading State During Auto-Accept
  // ============================================================================

  it("should show loading state during auto-accept", async () => {
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === "token") return "valid-jwt-token"
      if (key === "user") return JSON.stringify({ email: "invited@test.com" })
      return null
    })
    vi.mocked(invitationApi.validate).mockResolvedValueOnce(mockValidation)
    
    // Never resolves to keep loading state
    vi.mocked(invitationApi.accept).mockImplementationOnce(
      () => new Promise(() => {})
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Joining the team...")).toBeInTheDocument()
    })
  })

  // ============================================================================
  // Navigation
  // ============================================================================

  it("should navigate to login from invalid state", async () => {
    const user = userEvent.setup()
    vi.mocked(invitationApi.validate).mockRejectedValueOnce({
      response: { data: { error: "Invalid token" } },
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /go to login/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /go to login/i }))

    // Verify navigation to login
    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument()
    })
  })

  it("should navigate to workspace selection from already-accepted state", async () => {
    const user = userEvent.setup()
    vi.mocked(invitationApi.validate).mockRejectedValueOnce({
      response: { data: { error: "Invitation already accepted" } },
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /go to workspace selection/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /go to workspace selection/i }))

    // Verify navigation to workspace selection
    await waitFor(() => {
      expect(screen.getByText("Workspace Selection Page")).toBeInTheDocument()
    })
  })
})
