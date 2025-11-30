import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { BrowserRouter } from "react-router-dom"
import { WorkspaceSelectionPage } from "@/pages/WorkspaceSelectionPage"
import * as workspaceApi from "@/services/workspaceApi"

// Mock services
vi.mock("@/services/workspaceApi", () => ({
  getWorkspaces: vi.fn(),
  createWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  workspaceApi: {
    getBadgeStats: vi.fn().mockResolvedValue({}),
  },
}))

// Mock useWorkspace hook
vi.mock("@/hooks/use-workspace", () => ({
  useWorkspace: () => ({
    setCurrentWorkspace: vi.fn(),
  }),
}))

// Mock useWorkspaceRole hook
vi.mock("@/hooks/useWorkspaceRole", () => ({
  useWorkspaceRole: (workspaceId: string | null) => ({
    isSuperAdmin: workspaceId !== null, // If there's a workspace, assume SUPER_ADMIN for existing workspaces
    isLoading: false,
    role: workspaceId ? "SUPER_ADMIN" : null,
  }),
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock child components
vi.mock("@/components/workspace/TeamMembersTable", () => ({
  TeamMembersTable: () => <div data-testid="team-members-table">Team Members</div>,
}))

vi.mock("@/components/billing/BillingSection", () => ({
  BillingSection: () => <div data-testid="billing-section">Billing</div>,
}))

vi.mock("@/components/billing/UsageLimitsCard", () => ({
  UsageLimitsCard: () => <div data-testid="usage-limits-card">Usage Limits</div>,
}))

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Set token in localStorage before tests
beforeEach(() => {
  localStorage.setItem("token", "mock-jwt-token.eyJzdWIiOiIxMjM0NTY3ODkwIn0.mock")
  vi.clearAllMocks()
})

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe("WorkspaceSelectionPage", () => {
  describe("Add new channel button visibility", () => {
    it("should show 'Add new channel' button when user has NO workspaces (first-time owner)", async () => {
      // User was removed from workspace, has no workspaces
      vi.mocked(workspaceApi.getWorkspaces).mockResolvedValue([])

      renderWithRouter(<WorkspaceSelectionPage />)

      // Wait for loading to complete
      await waitFor(() => {
        expect(workspaceApi.getWorkspaces).toHaveBeenCalled()
      })

      // When there are no workspaces, show "Create My Channel" button in welcome form
      await waitFor(() => {
        expect(screen.getByText(/Create My Channel/)).toBeInTheDocument()
      })
    })

    it("should show 'Add new channel' button when user is SUPER_ADMIN with existing workspaces", async () => {
      // User is SUPER_ADMIN with workspaces
      vi.mocked(workspaceApi.getWorkspaces).mockResolvedValue([
        {
          id: "ws-1",
          name: "My Shop",
          isActive: true,
          isDelete: false,
          whatsappPhoneNumber: "+123456789",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ])

      renderWithRouter(<WorkspaceSelectionPage />)

      await waitFor(() => {
        expect(workspaceApi.getWorkspaces).toHaveBeenCalled()
      })

      // The "Add Channel" button should be visible for SUPER_ADMIN
      await waitFor(() => {
        expect(screen.getByText("Add Channel")).toBeInTheDocument()
      })
    })

    it("should display existing workspace cards", async () => {
      vi.mocked(workspaceApi.getWorkspaces).mockResolvedValue([
        {
          id: "ws-1",
          name: "Shop One",
          isActive: true,
          isDelete: false,
          whatsappPhoneNumber: "+111111111",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
        {
          id: "ws-2",
          name: "Shop Two",
          isActive: false,
          isDelete: false,
          whatsappPhoneNumber: "+222222222",
          createdAt: "2024-02-01",
          updatedAt: "2024-02-01",
        },
      ])

      renderWithRouter(<WorkspaceSelectionPage />)

      await waitFor(() => {
        expect(screen.getByText("Shop One")).toBeInTheDocument()
        expect(screen.getByText("Shop Two")).toBeInTheDocument()
      })
    })

    it("should show empty state message when user has no workspaces", async () => {
      vi.mocked(workspaceApi.getWorkspaces).mockResolvedValue([])

      renderWithRouter(<WorkspaceSelectionPage />)

      await waitFor(() => {
        expect(workspaceApi.getWorkspaces).toHaveBeenCalled()
      })

      // When no workspaces, show welcome message
      await waitFor(() => {
        expect(screen.getByText(/Welcome to ShopME/)).toBeInTheDocument()
      })
      expect(screen.getByText(/Create your first WhatsApp channel/)).toBeInTheDocument()
    })
  })

  describe("User removed from workspace scenario", () => {
    it("should allow removed user to create new workspace (first-time owner flow)", async () => {
      // Simulate: user was ADMIN, got removed, now has 0 workspaces
      // Backend would return canCreate: true, isFirstTimeOwner: true
      vi.mocked(workspaceApi.getWorkspaces).mockResolvedValue([])

      renderWithRouter(<WorkspaceSelectionPage />)

      await waitFor(() => {
        expect(workspaceApi.getWorkspaces).toHaveBeenCalled()
      })

      // User should see welcome form with "Create My Channel" button
      // (because workspaces.length === 0)
      const createButton = await screen.findByText(/Create My Channel/)
      expect(createButton).toBeInTheDocument()
    })
  })

  describe("Navigation", () => {
    it("should have logout button", async () => {
      vi.mocked(workspaceApi.getWorkspaces).mockResolvedValue([])

      renderWithRouter(<WorkspaceSelectionPage />)

      await waitFor(() => {
        expect(screen.getByText("Logout")).toBeInTheDocument()
      })
    })
  })
})
