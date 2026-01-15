import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { ClientSheet } from "@/components/shared/ClientSheet"
import { storage } from "@/lib/storage"

// Mock storage module
vi.mock("@/lib/storage", () => ({
  storage: {
    getWorkspace: vi.fn(),
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
  },
}))

// Mock toast
vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe("ClientSheet - Shipping Address Visibility", () => {
  const mockClient = {
    id: "test-client-id",
    name: "Test Client",
    email: "test@example.com",
    phone: "+1234567890",
    language: "IT",
    discount: 10,
    notes: "Test notes",
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
  })

  it("should show Shipping Address section for e-commerce channels (sellsProductsAndServices = true)", () => {
    // Mock workspace as e-commerce channel
    vi.mocked(storage.getWorkspace).mockReturnValue({
      id: "workspace-1",
      sellsProductsAndServices: true,
    })

    render(<ClientSheet {...defaultProps} />)

    // Shipping Address should be visible
    expect(screen.getByText("🚚 Shipping Address")).toBeInTheDocument()
  })

  it("should NOT show Shipping Address section for info channels (sellsProductsAndServices = false)", () => {
    // Mock workspace as info channel
    vi.mocked(storage.getWorkspace).mockReturnValue({
      id: "workspace-1",
      sellsProductsAndServices: false,
    })

    render(<ClientSheet {...defaultProps} />)

    // Shipping Address should NOT be visible
    expect(screen.queryByText("🚚 Shipping Address")).not.toBeInTheDocument()
  })

  it("should NOT show Shipping Address when workspace has no sellsProductsAndServices property", () => {
    // Mock workspace without sellsProductsAndServices (defaults to false)
    vi.mocked(storage.getWorkspace).mockReturnValue({
      id: "workspace-1",
    })

    render(<ClientSheet {...defaultProps} />)

    // Shipping Address should NOT be visible (defaults to false)
    expect(screen.queryByText("🚚 Shipping Address")).not.toBeInTheDocument()
  })

  it("should always show Invoice Address regardless of channel type", () => {
    // Test with e-commerce channel
    vi.mocked(storage.getWorkspace).mockReturnValue({
      id: "workspace-1",
      sellsProductsAndServices: true,
    })

    const { rerender } = render(<ClientSheet {...defaultProps} />)

    // Invoice Address should be visible
    expect(screen.getByText("📧 Invoice Address")).toBeInTheDocument()

    // Test with info channel
    vi.mocked(storage.getWorkspace).mockReturnValue({
      id: "workspace-1",
      sellsProductsAndServices: false,
    })

    rerender(<ClientSheet {...defaultProps} />)

    // Invoice Address should still be visible
    expect(screen.getByText("📧 Invoice Address")).toBeInTheDocument()
  })

  it("should show shipping fields (Street, City, ZIP, Country) only for e-commerce channels", () => {
    // E-commerce channel
    vi.mocked(storage.getWorkspace).mockReturnValue({
      id: "workspace-1",
      sellsProductsAndServices: true,
    })

    const { rerender } = render(<ClientSheet {...defaultProps} />)

    // Shipping fields should be present
    expect(screen.getByLabelText("Street Address")).toBeInTheDocument()
    expect(screen.getByLabelText("City")).toBeInTheDocument()
    expect(screen.getByLabelText("ZIP Code")).toBeInTheDocument()
    expect(screen.getByLabelText("Country")).toBeInTheDocument()

    // Info channel
    vi.mocked(storage.getWorkspace).mockReturnValue({
      id: "workspace-1",
      sellsProductsAndServices: false,
    })

    rerender(<ClientSheet {...defaultProps} />)

    // Shipping fields should NOT be present
    expect(screen.queryByLabelText("Street Address")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("ZIP Code")).not.toBeInTheDocument()
  })
})
