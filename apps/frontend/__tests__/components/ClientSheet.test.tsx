import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter } from "react-router-dom"
import { ClientSheet } from "@/components/shared/ClientSheet"
import { WorkspaceProvider } from "@/contexts/WorkspaceContext"
import { storage } from "@/lib/storage"
import { api } from "@/services/api"

// Mock storage module
vi.mock("@/lib/storage", () => ({
  storage: {
    getWorkspace: vi.fn(),
    setWorkspace: vi.fn(),
  },
}))

// Mock API
vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}))

// Mock salesApi
vi.mock("@/services/salesApi", () => ({
  salesApi: {
    getAll: vi.fn().mockResolvedValue([]),
    getAllForWorkspace: vi.fn().mockResolvedValue([]),
  },
}))

// Mock toast
vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Helper to render with providers
function renderWithProviders(
  component: React.ReactElement,
  workspace?: any
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const mockWorkspace = workspace || {
    id: "workspace-1",
    name: "Test Workspace",
    sellsProductsAndServices: true,
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <WorkspaceProvider initialWorkspace={mockWorkspace}>
          {component}
        </WorkspaceProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe("ClientSheet - Shipping Address Visibility", () => {
  const mockClient = {
    id: "test-client-id",
    name: "Test Client",
    email: "test@example.com",
    phone: "+1234567890",
    language: "IT",
    discount: 10,
    notes: "Test notes",
    company: "Test Company",
    shippingAddress: {
      street: "123 Test St",
      city: "Test City",
      zip: "12345",
      country: "Test Country",
    },
    invoiceAddress: {
      firstName: "John",
      lastName: "Doe",
      address: "456 Invoice St",
      city: "Invoice City",
      postalCode: "54321",
      country: "Invoice Country",
    },
  }

  const defaultProps = {
    client: mockClient,
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    mode: "edit" as const,
    availableLanguages: ["IT", "ENG", "ESP", "PRT"],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(storage.getWorkspace).mockReturnValue({
      id: "workspace-1",
      sellsProductsAndServices: true,
    })
    vi.mocked(api.get).mockResolvedValue({ data: mockClient })
  })

  it("should show Shipping Address section for e-commerce channels (sellsProductsAndServices = true)", async () => {
    // Mock workspace as e-commerce channel
    const workspace = {
      id: "workspace-1",
      name: "Test Workspace",
      sellsProductsAndServices: true,
    }

    renderWithProviders(<ClientSheet {...defaultProps} />, workspace)

    // Shipping Address should be visible
    expect(await screen.findByRole("heading", { name: /shipping address/i })).toBeInTheDocument()
  })

  it("should NOT show Shipping Address section for info channels (sellsProductsAndServices = false)", async () => {
    // Mock workspace as info channel
    const workspace = {
      id: "workspace-1",
      name: "Test Workspace",
      sellsProductsAndServices: false,
    }

    renderWithProviders(<ClientSheet {...defaultProps} />, workspace)

    // Shipping Address should NOT be visible
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /shipping address/i })).not.toBeInTheDocument()
    })
  })

  it("should NOT show Shipping Address when workspace has no sellsProductsAndServices property", async () => {
    // Mock workspace without sellsProductsAndServices (defaults to false)
    const workspace = {
      id: "workspace-1",
      name: "Test Workspace",
      // sellsProductsAndServices property omitted - should default to false
    }

    renderWithProviders(<ClientSheet {...defaultProps} />, workspace)

    // Shipping Address should NOT be visible (defaults to false)
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /shipping address/i })).not.toBeInTheDocument()
    })
  })

  it("should always show Invoice Address regardless of channel type", async () => {
    // Test with e-commerce channel
    const workspaceEcommerce = {
      id: "workspace-1",
      name: "Test Workspace",
      sellsProductsAndServices: true,
    }

    const { unmount } = renderWithProviders(<ClientSheet {...defaultProps} />, workspaceEcommerce)

    // Invoice Address should be visible
    expect(await screen.findByRole("heading", { name: /invoice address/i })).toBeInTheDocument()

    unmount()

    // Test with info channel
    const workspaceInfo = {
      id: "workspace-1",
      name: "Test Workspace",
      sellsProductsAndServices: false,
    }

    renderWithProviders(<ClientSheet {...defaultProps} />, workspaceInfo)

    // Invoice Address should still be visible
    expect(await screen.findByRole("heading", { name: /invoice address/i })).toBeInTheDocument()
  })

  it("should show shipping fields (Street, City, ZIP, Country) only for e-commerce channels", async () => {
    // E-commerce channel
    const workspaceEcommerce = {
      id: "workspace-1",
      name: "Test Workspace",
      sellsProductsAndServices: true,
    }

    const { unmount } = renderWithProviders(<ClientSheet {...defaultProps} />, workspaceEcommerce)

    // Shipping fields should be present
    expect(await screen.findByLabelText("Street Address")).toBeInTheDocument()
    expect(screen.getByLabelText("City", { selector: "input#city" })).toBeInTheDocument()
    expect(screen.getByLabelText("ZIP Code")).toBeInTheDocument()
    expect(screen.getByLabelText("Country", { selector: "input#country" })).toBeInTheDocument()

    unmount()

    // Info channel
    const workspaceInfo = {
      id: "workspace-1",
      name: "Test Workspace",
      sellsProductsAndServices: false,
    }

    renderWithProviders(<ClientSheet {...defaultProps} />, workspaceInfo)

    // Shipping fields should NOT be present
    await waitFor(() => {
      expect(screen.queryByLabelText("Street Address")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("City", { selector: "input#city" })).not.toBeInTheDocument()
      expect(screen.queryByLabelText("ZIP Code")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Country", { selector: "input#country" })).not.toBeInTheDocument()
    })
  })
})
