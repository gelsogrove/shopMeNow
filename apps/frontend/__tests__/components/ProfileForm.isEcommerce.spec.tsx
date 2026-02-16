/**
 * Unit Tests for ProfileForm - isEcommerce conditional rendering
 *
 * WHAT: Tests that ProfileForm correctly renders/hides sections based on workspace type
 *
 * WHY: Informational workspaces don't sell products, so:
 *   - Shipping Address section must be HIDDEN
 *   - "Billing Address" must become "Company"
 *   - "If different from the shipping address" subtitle must be HIDDEN
 *   For ecommerce workspaces, all sections must show normally.
 *
 * SCENARIOS COVERED:
 *   1. E-commerce (default): Shows Shipping Address card
 *   2. E-commerce: Shows "Billing Address" title
 *   3. E-commerce: Shows "If different from the shipping address" subtitle
 *   4. Informational: Hides Shipping Address card entirely
 *   5. Informational: Shows "Company" instead of "Billing Address"
 *   6. Informational: Hides "If different from the shipping address" subtitle
 *   7. Default behavior: isEcommerce defaults to true (backward compatibility)
 *   8. Language select: Uses lowercase codes (en, it, es, pt) matching DB format
 *   9. Both modes: Personal Information card always visible
 *   10. Both modes: Push Notifications card always visible
 *   11. Both modes: Company fields always visible in billing/company card
 *
 * CRITICAL RULES:
 *   - Tests define behavior - code must follow tests
 *   - Language codes MUST be lowercase (en/it/es/pt) to match database format
 *   - isEcommerce=false must hide shipping, rename billing
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ProfileForm } from "@/components/profile/ProfileForm"

// MOCK: toast (sonner) to prevent import errors
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// MOCK: format utility for SUPPORTED_CURRENCIES
vi.mock("@/utils/format", () => ({
  SUPPORTED_CURRENCIES: [
    { code: "USD", symbol: "$", label: "US Dollar ($)" },
    { code: "EUR", symbol: "€", label: "Euro (€)" },
  ],
}))

// MOCK: storage to avoid localStorage issues
vi.mock("@/lib/storage", () => ({
  storage: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
}))

// Shared test profile data
const baseProfileData = {
  id: "customer-123",
  name: "Andrea Test",
  email: "andrea@test.com",
  phone: "+39123456789",
  company: "Test Company",
  address: "",
  language: "it",
  currency: "EUR",
  discount: 0,
  invoiceAddress: null,
  push_notifications_consent: false,
  push_notifications_consent_at: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
}

const mockOnSave = vi.fn()

describe("ProfileForm - isEcommerce conditional rendering", () => {
  describe("E-commerce workspace (isEcommerce=true)", () => {
    // SCENARIO: E-commerce workspace should show all sections including shipping
    it("should show Shipping Address card", () => {
      render(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
          isEcommerce={true}
        />
      )

      // RULE: Shipping Address section must be visible for e-commerce
      expect(screen.getByText("🚚 Shipping Address")).toBeInTheDocument()
    })

    // SCENARIO: E-commerce workspace shows "Billing Address" title
    it("should show 'Billing Address' title (not 'Company')", () => {
      render(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
          isEcommerce={true}
        />
      )

      // RULE: E-commerce billing card title is "Billing Address"
      expect(screen.getByText("🧾 Billing Address")).toBeInTheDocument()
      expect(screen.queryByText("🏢 Company")).not.toBeInTheDocument()
    })

    // SCENARIO: E-commerce shows the subtitle about shipping difference
    it("should show 'If different from the shipping address' subtitle", () => {
      render(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
          isEcommerce={true}
        />
      )

      // RULE: Subtitle helps user understand billing vs shipping
      expect(
        screen.getByText("If different from the shipping address")
      ).toBeInTheDocument()
    })

    // SCENARIO: E-commerce shows all shipping fields
    it("should render all shipping address fields", () => {
      render(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
          isEcommerce={true}
        />
      )

      // RULE: All 5 shipping fields must be present
      expect(screen.getByLabelText("Full Name")).toBeInTheDocument()
      expect(screen.getByLabelText("Street Address")).toBeInTheDocument()
      // City appears in both shipping and billing, so check by placeholder
      expect(screen.getByPlaceholderText("Full name")).toBeInTheDocument()
      expect(screen.getByPlaceholderText("Street, number")).toBeInTheDocument()
    })
  })

  describe("Informational workspace (isEcommerce=false)", () => {
    // SCENARIO: Informational workspace does NOT sell products - no shipping needed
    it("should HIDE Shipping Address card entirely", () => {
      render(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
          isEcommerce={false}
        />
      )

      // RULE: Shipping Address card must NOT be in the DOM for informational
      expect(screen.queryByText("🚚 Shipping Address")).not.toBeInTheDocument()
    })

    // SCENARIO: Informational workspace shows "Company" instead of "Billing Address"
    it("should show 'Company' title instead of 'Billing Address'", () => {
      render(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
          isEcommerce={false}
        />
      )

      // RULE: Informational billing card is renamed to "Company"
      expect(screen.getByText("🏢 Company")).toBeInTheDocument()
      expect(screen.queryByText("🧾 Billing Address")).not.toBeInTheDocument()
    })

    // SCENARIO: Informational workspace hides the shipping-related subtitle
    it("should HIDE 'If different from the shipping address' subtitle", () => {
      render(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
          isEcommerce={false}
        />
      )

      // RULE: No reference to shipping address in informational mode
      expect(
        screen.queryByText("If different from the shipping address")
      ).not.toBeInTheDocument()
    })

    // SCENARIO: Shipping fields should not exist in DOM
    it("should NOT render shipping address fields", () => {
      render(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
          isEcommerce={false}
        />
      )

      // RULE: No shipping-specific placeholders in the DOM
      expect(screen.queryByPlaceholderText("Full name")).not.toBeInTheDocument()
      expect(
        screen.queryByPlaceholderText("Street, number")
      ).not.toBeInTheDocument()
    })

    // SCENARIO: Company/billing fields must still exist for informational workspaces
    it("should still render company/billing fields (invoice data)", () => {
      render(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
          isEcommerce={false}
        />
      )

      // RULE: Company card still has all invoice fields
      expect(screen.getByLabelText("First Name")).toBeInTheDocument()
      expect(screen.getByLabelText("Last Name")).toBeInTheDocument()
      expect(screen.getByLabelText("VAT Number")).toBeInTheDocument()
    })
  })

  describe("Default behavior (backward compatibility)", () => {
    // SCENARIO: Without isEcommerce prop, defaults to true (e-commerce mode)
    // RULE: Backward compatibility - existing callers without the prop see e-commerce layout
    it("should default to e-commerce mode when isEcommerce is not provided", () => {
      render(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
        />
      )

      // RULE: Default = show shipping + billing address
      expect(screen.getByText("🚚 Shipping Address")).toBeInTheDocument()
      expect(screen.getByText("🧾 Billing Address")).toBeInTheDocument()
    })
  })

  describe("Sections always visible in both modes", () => {
    // SCENARIO: Personal Information card must always be visible regardless of workspace type
    it("should always show Personal Information card", () => {
      const { rerender } = render(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
          isEcommerce={true}
        />
      )

      // E-commerce: Personal info visible
      expect(screen.getByLabelText("Full Name *")).toBeInTheDocument()
      expect(screen.getByLabelText("Email *")).toBeInTheDocument()

      // Informational: Personal info still visible
      rerender(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
          isEcommerce={false}
        />
      )

      expect(screen.getByLabelText("Full Name *")).toBeInTheDocument()
      expect(screen.getByLabelText("Email *")).toBeInTheDocument()
    })

    // SCENARIO: Push Notifications card must always be visible
    it("should always show Push Notifications card", () => {
      const { rerender } = render(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
          isEcommerce={true}
        />
      )

      expect(screen.getByText("Push Notifications")).toBeInTheDocument()

      rerender(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
          isEcommerce={false}
        />
      )

      expect(screen.getByText("Push Notifications")).toBeInTheDocument()
    })

    // SCENARIO: Save button always visible
    it("should always show Save Changes button", () => {
      const { rerender } = render(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
          isEcommerce={true}
        />
      )

      expect(
        screen.getByRole("button", { name: "Save Changes" })
      ).toBeInTheDocument()

      rerender(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
          isEcommerce={false}
        />
      )

      expect(
        screen.getByRole("button", { name: "Save Changes" })
      ).toBeInTheDocument()
    })
  })

  describe("Language select codes (DB format)", () => {
    // SCENARIO: Language select option values must use lowercase codes matching DB format
    // RULE: DB stores 'en', 'it', 'es', 'pt' - NOT 'ENG', 'IT', 'ES', 'PT'
    it("should use lowercase language codes (en, it, es, pt) in select options", () => {
      render(
        <ProfileForm
          profileData={baseProfileData}
          onSave={mockOnSave}
          saving={false}
        />
      )

      const languageSelect = screen.getByDisplayValue("Italiano") as HTMLSelectElement

      // RULE: All option values must be lowercase to match DB format
      const options = Array.from(languageSelect.querySelectorAll("option"))
      const values = options.map((opt) => opt.value)

      expect(values).toContain("en")
      expect(values).toContain("it")
      expect(values).toContain("es")
      expect(values).toContain("pt")

      // RULE: Old uppercase codes must NOT be present
      expect(values).not.toContain("ENG")
      expect(values).not.toContain("IT")
      expect(values).not.toContain("ES")
      expect(values).not.toContain("PT")
    })

    // SCENARIO: Profile with language "it" should show "Italiano" selected
    it("should display correct language for 'it' code", () => {
      render(
        <ProfileForm
          profileData={{ ...baseProfileData, language: "it" }}
          onSave={mockOnSave}
          saving={false}
        />
      )

      // RULE: lowercase 'it' maps to "Italiano" display
      expect(screen.getByDisplayValue("Italiano")).toBeInTheDocument()
    })

    // SCENARIO: Profile with language "en" should show "English" selected
    it("should display correct language for 'en' code", () => {
      render(
        <ProfileForm
          profileData={{ ...baseProfileData, language: "en" }}
          onSave={mockOnSave}
          saving={false}
        />
      )

      expect(screen.getByDisplayValue("English")).toBeInTheDocument()
    })
  })
})
