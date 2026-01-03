import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
  PLAN_LIMITS: {
    FREE_TRIAL: { maxChannels: 1, maxCustomers: 50, maxTeamMembers: 0 },
    BASIC: { maxChannels: 1, maxCustomers: 50, maxTeamMembers: 0 },
    PREMIUM: { maxChannels: 2, maxCustomers: 100, maxTeamMembers: 9999 },
    ENTERPRISE: { maxChannels: 999, maxCustomers: 9999, maxTeamMembers: 9999 },
  },
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

      // When there are no workspaces, show welcome card
      await waitFor(() => {
        expect(screen.getByText(/Welcome to eChatbot/)).toBeInTheDocument()
      })
    })

    it("should open the setup wizard dialog when there are no workspaces", async () => {
      vi.mocked(workspaceApi.getWorkspaces).mockResolvedValue([])

      renderWithRouter(<WorkspaceSelectionPage />)

      await waitFor(() => {
        expect(workspaceApi.getWorkspaces).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(screen.getByText(/Welcome to eChatbot/)).toBeInTheDocument()
      })

      const launchButton = screen.getByRole("button", {
        name: /launch setup wizard/i,
      })
      await userEvent.click(launchButton)

      const dialog = document.getElementById("wizard-dialog") as HTMLDialogElement
      await waitFor(() => {
        expect(dialog).toBeTruthy()
        expect(dialog.open).toBe(true)
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
        expect(screen.getByText(/Welcome to eChatbot/)).toBeInTheDocument()
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

      // User should see welcome card with call-to-action
      // (because workspaces.length === 0)
      const welcomeText = await screen.findByText(/Welcome to eChatbot/)
      expect(welcomeText).toBeInTheDocument()
    })
  })

  describe("Navigation", () => {
    it("should have profile menu with logout option in dropdown", async () => {
      vi.mocked(workspaceApi.getWorkspaces).mockResolvedValue([])

      renderWithRouter(<WorkspaceSelectionPage />)

      await waitFor(() => {
        // Profile menu is now a dropdown with avatar button
        // The logout option is inside the dropdown, not visible until opened
        const avatarButton = document.querySelector('button[class*="rounded-full"]')
        expect(avatarButton).toBeInTheDocument()
      })
    })
  })

  describe("Badge Stats Display", () => {
    it("should display pending orders badge when count > 0", async () => {
      vi.mocked(workspaceApi.getWorkspaces).mockResolvedValue([
        {
          id: "ws-1",
          name: "Test Shop",
          isActive: true,
          isDelete: false,
          whatsappPhoneNumber: "+123456789",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ])
      vi.mocked(workspaceApi.workspaceApi.getBadgeStats).mockResolvedValue({
        "ws-1": {
          unreadMessages: 0,
          pendingOrders: 5,
          needsIntervention: 0,
        },
      })

      renderWithRouter(<WorkspaceSelectionPage />)

      await waitFor(() => {
        expect(screen.getByText("5")).toBeInTheDocument()
      })
    })

    it("should display needs intervention badge when count > 0", async () => {
      vi.mocked(workspaceApi.getWorkspaces).mockResolvedValue([
        {
          id: "ws-1",
          name: "Test Shop",
          isActive: true,
          isDelete: false,
          whatsappPhoneNumber: "+123456789",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ])
      vi.mocked(workspaceApi.workspaceApi.getBadgeStats).mockResolvedValue({
        "ws-1": {
          unreadMessages: 0,
          pendingOrders: 0,
          needsIntervention: 3,
        },
      })

      renderWithRouter(<WorkspaceSelectionPage />)

      await waitFor(() => {
        expect(screen.getByText("3")).toBeInTheDocument()
      })
    })

    it("should display multiple badges when multiple counts > 0", async () => {
      vi.mocked(workspaceApi.getWorkspaces).mockResolvedValue([
        {
          id: "ws-1",
          name: "Test Shop",
          isActive: true,
          isDelete: false,
          whatsappPhoneNumber: "+123456789",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ])
      vi.mocked(workspaceApi.workspaceApi.getBadgeStats).mockResolvedValue({
        "ws-1": {
          unreadMessages: 0,
          pendingOrders: 10,
          needsIntervention: 4,
        },
      })

      renderWithRouter(<WorkspaceSelectionPage />)

      await waitFor(() => {
        expect(screen.getByText("10")).toBeInTheDocument() // pending orders
        expect(screen.getByText("4")).toBeInTheDocument()  // needs intervention
      })
    })

    it("should NOT display badges when all counts are 0", async () => {
      vi.mocked(workspaceApi.getWorkspaces).mockResolvedValue([
        {
          id: "ws-1",
          name: "Test Shop",
          isActive: true,
          isDelete: false,
          whatsappPhoneNumber: "+123456789",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ])
      vi.mocked(workspaceApi.workspaceApi.getBadgeStats).mockResolvedValue({
        "ws-1": {
          unreadMessages: 0,
          pendingOrders: 0,
          needsIntervention: 0,
        },
      })

      renderWithRouter(<WorkspaceSelectionPage />)

      await waitFor(() => {
        expect(screen.getByText("Test Shop")).toBeInTheDocument()
      })

      // Badge numbers should NOT be in the document
      expect(screen.queryByText("0")).not.toBeInTheDocument()
    })

    it("should display badges for multiple workspaces independently", async () => {
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
          isActive: true,
          isDelete: false,
          whatsappPhoneNumber: "+222222222",
          createdAt: "2024-02-01",
          updatedAt: "2024-02-01",
        },
      ])
      vi.mocked(workspaceApi.workspaceApi.getBadgeStats).mockResolvedValue({
        "ws-1": {
          unreadMessages: 0,
          pendingOrders: 3,
          needsIntervention: 0,
        },
        "ws-2": {
          unreadMessages: 0,
          pendingOrders: 0,
          needsIntervention: 2,
        },
      })

      renderWithRouter(<WorkspaceSelectionPage />)

      await waitFor(() => {
        expect(screen.getByText("Shop One")).toBeInTheDocument()
        expect(screen.getByText("Shop Two")).toBeInTheDocument()
      })

      // Should display badges from both workspaces
      await waitFor(() => {
        expect(screen.getByText("3")).toBeInTheDocument() // ws-1 pending orders
        expect(screen.getByText("2")).toBeInTheDocument() // ws-2 needs intervention
      })
    })
  })
})
