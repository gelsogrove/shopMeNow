/**
 * Unit Tests for StickyHeader - isEcommerce prop pass-through
 *
 * WHAT: Tests that StickyHeader correctly passes isEcommerce to MobileMenu
 *
 * WHY: StickyHeader is the intermediary between page components and MobileMenu.
 *      If isEcommerce is not forwarded, informational workspaces would still
 *      show the cart menu item, leading to broken UX.
 *
 * SCENARIOS COVERED:
 *   1. E-commerce: Passes isEcommerce=true to MobileMenu
 *   2. Informational: Passes isEcommerce=false to MobileMenu
 *   3. Default: isEcommerce defaults to true when not provided
 *   4. showMenu=false: No MobileMenu rendered at all
 *
 * CRITICAL RULES:
 *   - Tests define behavior - code must follow tests
 *   - isEcommerce MUST be forwarded to MobileMenu
 *   - Default is true for backward compatibility
 */

import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { StickyHeader } from "@/components/public/StickyHeader"

// Track props passed to MobileMenu
let capturedMobileMenuProps: any = null

// MOCK: MobileMenu - capture props to verify isEcommerce is passed through
vi.mock("@/components/public/MobileMenu", () => ({
  MobileMenu: (props: any) => {
    capturedMobileMenuProps = props
    if (!props.isOpen) return null
    return <div data-testid="mobile-menu" data-is-ecommerce={props.isEcommerce} />
  },
}))

// MOCK: designSystem - provides styling constants
vi.mock("@/styles/designSystem", () => ({
  default: {
    colors: {
      background: { card: "#fff", hover: "#f5f5f5" },
      border: { light: "#e5e5e5" },
      text: { primary: "#1a1a1a", secondary: "#666", inverse: "#fff" },
      primary: { 500: "#3b82f6" },
      secondary: { 500: "#8b5cf6" },
    },
    typography: {
      fontSize: { sm: "14px", lg: "18px" },
      fontWeight: { bold: 700 },
    },
    spacing: {},
    borderRadius: { lg: "8px" },
    shadow: { md: "0 4px 6px rgba(0,0,0,0.1)" },
    transition: { all: "all 150ms ease", colors: "color 150ms ease" },
    zIndex: { sticky: 30 },
    components: {
      header: { height: "64px", padding: "0 16px" },
    },
  },
}))

describe("StickyHeader - isEcommerce prop pass-through", () => {
  // SCENARIO: StickyHeader receives isEcommerce=true and forwards to MobileMenu
  it("should pass isEcommerce=true to MobileMenu for e-commerce workspaces", () => {
    capturedMobileMenuProps = null

    render(
      <StickyHeader
        title="Test Store"
        token="test-token-123"
        currentPage="profile"
        isEcommerce={true}
      />
    )

    // RULE: MobileMenu receives isEcommerce=true
    expect(capturedMobileMenuProps).not.toBeNull()
    expect(capturedMobileMenuProps.isEcommerce).toBe(true)
  })

  // SCENARIO: StickyHeader receives isEcommerce=false and forwards to MobileMenu
  it("should pass isEcommerce=false to MobileMenu for informational workspaces", () => {
    capturedMobileMenuProps = null

    render(
      <StickyHeader
        title="Info Service"
        token="test-token-456"
        currentPage="profile"
        isEcommerce={false}
      />
    )

    // RULE: MobileMenu receives isEcommerce=false
    expect(capturedMobileMenuProps).not.toBeNull()
    expect(capturedMobileMenuProps.isEcommerce).toBe(false)
  })

  // SCENARIO: Without isEcommerce prop, should default to true
  // RULE: Backward compatibility - existing callers see e-commerce behavior
  it("should default isEcommerce to true when not provided", () => {
    capturedMobileMenuProps = null

    render(
      <StickyHeader
        title="Legacy Page"
        token="test-token-789"
        currentPage="cart"
      />
    )

    // RULE: Default = e-commerce mode
    expect(capturedMobileMenuProps).not.toBeNull()
    expect(capturedMobileMenuProps.isEcommerce).toBe(true)
  })

  // SCENARIO: showMenu=false means no MobileMenu at all
  it("should not render MobileMenu when showMenu=false", () => {
    capturedMobileMenuProps = null

    render(
      <StickyHeader
        title="No Menu Page"
        showMenu={false}
        isEcommerce={false}
      />
    )

    // RULE: MobileMenu not rendered means props never captured
    expect(capturedMobileMenuProps).toBeNull()
  })

  // SCENARIO: Verify other props also forwarded to MobileMenu
  it("should forward token and currentPage alongside isEcommerce", () => {
    capturedMobileMenuProps = null

    render(
      <StickyHeader
        title="Full Props Test"
        token="my-token"
        currentPage="profile"
        customerLanguage="es"
        isEcommerce={false}
      />
    )

    // RULE: All navigation-related props forwarded
    expect(capturedMobileMenuProps.token).toBe("my-token")
    expect(capturedMobileMenuProps.currentPage).toBe("profile")
    expect(capturedMobileMenuProps.customerLanguage).toBe("es")
    expect(capturedMobileMenuProps.isEcommerce).toBe(false)
  })
})
