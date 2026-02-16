/**
 * Unit Tests for MobileMenu - isEcommerce cart filtering
 *
 * WHAT: Tests that MobileMenu correctly shows/hides cart menu item
 *       based on workspace type (e-commerce vs informational)
 *
 * WHY: Informational workspaces don't have products/cart, so showing
 *      a "Cart" menu item would confuse users and lead to broken pages.
 *      Cart must only appear for e-commerce workspaces.
 *
 * SCENARIOS COVERED:
 *   1. E-commerce (default): Shows both Cart and Profile menu items
 *   2. Informational: Hides Cart menu item, shows only Profile
 *   3. Default behavior: isEcommerce defaults to true (backward compat)
 *   4. Menu not rendered when isOpen=false
 *   5. E-commerce: Cart and Profile both clickable
 *   6. Informational: Only Profile menu item rendered in DOM
 *
 * CRITICAL RULES:
 *   - Tests define behavior - code must follow tests
 *   - Cart item must be completely absent from DOM for informational (not just hidden)
 *   - isEcommerce defaults to true for backward compatibility
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { MobileMenu } from "@/components/public/MobileMenu"

// MOCK: react-router-dom - MobileMenu uses useNavigate
const mockNavigate = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// MOCK: designSystem - provides styling constants
vi.mock("@/styles/designSystem", () => ({
  default: {
    colors: {
      background: { card: "#fff", hover: "#f5f5f5" },
      border: { light: "#e5e5e5" },
      text: { primary: "#1a1a1a", secondary: "#666", tertiary: "#999", inverse: "#fff" },
      primary: { 50: "#f0f7ff", 500: "#3b82f6", 700: "#1d4ed8" },
      secondary: { 50: "#f5f3ff", 500: "#8b5cf6" },
    },
    typography: {
      fontSize: { base: "16px", sm: "14px", xl: "20px" },
      fontWeight: { normal: 400, semibold: 600, bold: 700 },
    },
    spacing: { 2: "8px", 3: "12px", 4: "16px" },
    borderRadius: { lg: "8px" },
    shadow: { "2xl": "0 25px 50px rgba(0,0,0,0.25)" },
    transition: { all: "all 150ms ease", colors: "color 150ms ease" },
    zIndex: { modalBackdrop: 40, modal: 50 },
  },
}))

// MOCK: publicPageTranslations - MobileMenu uses these for menu labels
vi.mock("@/utils/publicPageTranslations", () => ({
  publicPageTranslations: {
    IT: {
      cart: "Carrello",
      profile: "Profilo",
      menuTitle: "Menu",
    },
    EN: {
      cart: "Cart",
      profile: "Profile",
      menuTitle: "Menu",
    },
  },
}))

describe("MobileMenu - isEcommerce cart filtering", () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  describe("E-commerce workspace (isEcommerce=true)", () => {
    // SCENARIO: E-commerce workspace should show both Cart and Profile menu items
    it("should show Cart menu item", () => {
      render(
        <MobileMenu
          isOpen={true}
          onClose={vi.fn()}
          token="test-token-123"
          currentPage="profile"
          customerLanguage="it"
          isEcommerce={true}
        />
      )

      // RULE: Cart must be visible for e-commerce workspaces
      expect(screen.getByText("Carrello")).toBeInTheDocument()
    })

    // SCENARIO: Both Cart and Profile visible in e-commerce
    it("should show both Cart and Profile menu items", () => {
      render(
        <MobileMenu
          isOpen={true}
          onClose={vi.fn()}
          token="test-token-123"
          currentPage="profile"
          customerLanguage="it"
          isEcommerce={true}
        />
      )

      // RULE: Both menu items must be present
      expect(screen.getByText("Carrello")).toBeInTheDocument()
      expect(screen.getByText("Profilo")).toBeInTheDocument()
    })
  })

  describe("Informational workspace (isEcommerce=false)", () => {
    // SCENARIO: Informational workspace must NOT show cart - no products to buy
    it("should HIDE Cart menu item entirely", () => {
      render(
        <MobileMenu
          isOpen={true}
          onClose={vi.fn()}
          token="test-token-123"
          currentPage="profile"
          customerLanguage="it"
          isEcommerce={false}
        />
      )

      // RULE: Cart item must NOT be in the DOM (not just visually hidden)
      expect(screen.queryByText("Carrello")).not.toBeInTheDocument()
    })

    // SCENARIO: Profile menu item must still be visible for informational
    it("should still show Profile menu item", () => {
      render(
        <MobileMenu
          isOpen={true}
          onClose={vi.fn()}
          token="test-token-123"
          currentPage="profile"
          customerLanguage="it"
          isEcommerce={false}
        />
      )

      // RULE: Profile is always available regardless of workspace type
      expect(screen.getByText("Profilo")).toBeInTheDocument()
    })

    // SCENARIO: Only 1 menu item rendered (Profile) for informational
    it("should render exactly 1 menu item (only Profile)", () => {
      render(
        <MobileMenu
          isOpen={true}
          onClose={vi.fn()}
          token="test-token-123"
          currentPage="profile"
          customerLanguage="it"
          isEcommerce={false}
        />
      )

      // RULE: Only Profile button in the nav (exclude close button)
      // Cart icon 🛒 should NOT be in DOM
      expect(screen.queryByText("🛒")).not.toBeInTheDocument()
      // Profile icon 👤 SHOULD be in DOM
      expect(screen.getByText("👤")).toBeInTheDocument()
    })
  })

  describe("Default behavior (backward compatibility)", () => {
    // SCENARIO: Without isEcommerce prop, defaults to true
    // RULE: Existing callers that don't pass isEcommerce see e-commerce layout
    it("should default to e-commerce mode showing Cart", () => {
      render(
        <MobileMenu
          isOpen={true}
          onClose={vi.fn()}
          token="test-token-123"
          currentPage="profile"
          customerLanguage="it"
        />
      )

      // RULE: Default behavior shows cart (backward compatible)
      expect(screen.getByText("Carrello")).toBeInTheDocument()
      expect(screen.getByText("Profilo")).toBeInTheDocument()
    })
  })

  describe("Menu closed state", () => {
    // SCENARIO: Menu should render nothing when isOpen=false
    it("should render nothing when isOpen is false", () => {
      const { container } = render(
        <MobileMenu
          isOpen={false}
          onClose={vi.fn()}
          token="test-token-123"
          isEcommerce={true}
        />
      )

      // RULE: Closed menu has no rendered content
      expect(container.innerHTML).toBe("")
    })
  })

  describe("English language", () => {
    // SCENARIO: Menu items should use English translations when language is EN
    it("should show English menu labels for EN language", () => {
      render(
        <MobileMenu
          isOpen={true}
          onClose={vi.fn()}
          token="test-token-123"
          currentPage="cart"
          customerLanguage="en"
          isEcommerce={true}
        />
      )

      // RULE: Menu uses publicPageTranslations[EN]
      expect(screen.getByText("Cart")).toBeInTheDocument()
      expect(screen.getByText("Profile")).toBeInTheDocument()
    })

    // SCENARIO: Informational + English - Cart hidden, Profile in English
    it("should hide Cart but show English Profile for informational EN", () => {
      render(
        <MobileMenu
          isOpen={true}
          onClose={vi.fn()}
          token="test-token-123"
          currentPage="profile"
          customerLanguage="en"
          isEcommerce={false}
        />
      )

      expect(screen.queryByText("Cart")).not.toBeInTheDocument()
      expect(screen.getByText("Profile")).toBeInTheDocument()
    })
  })
})
