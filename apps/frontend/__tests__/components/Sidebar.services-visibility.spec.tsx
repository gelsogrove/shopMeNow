/**
 * Unit Tests for Sidebar - Services menu item visibility
 *
 * WHAT: Tests that Sidebar correctly shows/hides the "Services" menu item
 *       based on workspace type and calendar booking configuration.
 *
 * WHY: There was a deadlock bug:
 *   - Services was only shown when enableCalendarBooking === true
 *   - But you need to create Services BEFORE you can enable calendar booking
 *   - Result: impossible to reach the Services page on informational workspaces
 *
 * SCENARIOS COVERED:
 *   1. INFORMATIONAL + calendar enabled → Services visible (standalone)
 *   2. INFORMATIONAL + calendar disabled → Services visible (deadlock fix!)
 *   3. ECOMMERCE + calendar disabled → Services visible inside E-commerce submenu
 *   4. ECOMMERCE + calendar enabled → Services visible as standalone (not in E-commerce submenu)
 *   5. INFORMATIONAL + calendar enabled → Appointments menu visible
 *   6. INFORMATIONAL + calendar disabled → Appointments menu NOT visible
 *
 * CRITICAL RULE:
 *   For INFORMATIONAL workspaces, Services MUST always be reachable
 *   regardless of enableCalendarBooking - it's the prerequisite for enabling booking.
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { Sidebar } from "@/components/layout/Sidebar"

// MOCK: WorkspaceContext - controls what workspace is "active"
const mockWorkspace: Record<string, any> = {}
vi.mock("@/contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspace: mockWorkspace }),
}))

// MOCK: LanguageContext - returns key as-is so labels are predictable
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}))

// MOCK: react-router-dom - Sidebar uses NavLink and useLocation
const mockLocation = { pathname: "/" }
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    NavLink: ({ to, children, ...props }: any) => (
      <a href={to} {...props}>{children}</a>
    ),
    useLocation: () => mockLocation,
  }
})

// MOCK: storage - used for impersonation flag
vi.mock("@/lib/storage", () => ({
  storage: {
    getImpersonationFlags: vi.fn(() => ({ isImpersonating: false })),
    getWorkspace: vi.fn(() => null),
  },
}))

// MOCK: useSupportUnreadCount
vi.mock("@/hooks/useSupportUnreadCount", () => ({
  useSupportUnreadCount: () => 0,
}))

// MOCK: @/config - IMG_BASE_URL
vi.mock("@/config", () => ({
  IMG_BASE_URL: "",
}))

// Helper: set workspace data before each test
function setWorkspace(data: Record<string, any>) {
  Object.keys(mockWorkspace).forEach((k) => delete mockWorkspace[k])
  Object.assign(mockWorkspace, data)
}

// Helper: renders Sidebar with open=true so all links are visible
function renderSidebar() {
  return render(<Sidebar isOpen={true} />)
}

// ============================================================
// INFORMATIONAL WORKSPACE SCENARIOS
// ============================================================

describe("Sidebar - Services visibility: INFORMATIONAL workspace", () => {

  it("SCENARIO 1: shows Services when calendar booking is ENABLED (informational)", () => {
    // RULE: Even with booking enabled, Services must be visible (standalone item)
    setWorkspace({
      id: "ws-1",
      channelMode: 'INFORMATIONAL' as any,
      enableCalendarBooking: true,
    })
    renderSidebar()
    expect(screen.getByRole("link", { name: /nav\.services/i })).toBeInTheDocument()
  })

  it("SCENARIO 2: shows Services when calendar booking is DISABLED (informational) - DEADLOCK FIX", () => {
    // RULE: This is the deadlock fix - Services must be visible BEFORE calendar is enabled
    // so the user can create services (prerequisite for enabling calendar booking)
    setWorkspace({
      id: "ws-2",
      channelMode: 'INFORMATIONAL' as any,
      enableCalendarBooking: false,
    })
    renderSidebar()
    expect(screen.getByRole("link", { name: /nav\.services/i })).toBeInTheDocument()
  })

  it("SCENARIO 3: shows Services when enableCalendarBooking is undefined (informational)", () => {
    // RULE: Missing flag should NOT hide Services for informational workspaces
    setWorkspace({
      id: "ws-3",
      channelMode: 'INFORMATIONAL' as any,
      // enableCalendarBooking not set
    })
    renderSidebar()
    expect(screen.getByRole("link", { name: /nav\.services/i })).toBeInTheDocument()
  })

  it("SCENARIO 4: shows Appointments menu when calendar booking is ENABLED", () => {
    // RULE: Appointments submenu only appears if enableCalendarBooking is true
    setWorkspace({
      id: "ws-4",
      channelMode: 'INFORMATIONAL' as any,
      enableCalendarBooking: true,
    })
    renderSidebar()
    expect(screen.getByText("Appointments")).toBeInTheDocument()
  })

  it("SCENARIO 5: hides Appointments menu when calendar booking is DISABLED", () => {
    // RULE: Appointments submenu must not appear if booking is disabled
    setWorkspace({
      id: "ws-5",
      channelMode: 'INFORMATIONAL' as any,
      enableCalendarBooking: false,
    })
    renderSidebar()
    expect(screen.queryByText("Appointments")).not.toBeInTheDocument()
  })
})

// ============================================================
// E-COMMERCE WORKSPACE SCENARIOS
// ============================================================

describe("Sidebar - Services visibility: ECOMMERCE workspace", () => {

  it("SCENARIO 6: Services is inside E-commerce submenu (collapsed) when calendar booking is DISABLED", () => {
    // RULE: For e-commerce WITHOUT booking, Services lives inside the collapsible E-commerce submenu.
    // The submenu is collapsed by default so the Services link is NOT in the DOM,
    // only the "nav.ecommerce" toggle button is visible.
    // The standalone Services link must NOT appear at the top level (no duplicate).
    setWorkspace({
      id: "ws-6",
      channelMode: 'ECOMMERCE' as any,
      enableCalendarBooking: false,
    })
    renderSidebar()
    // E-commerce toggle button is visible
    expect(screen.getByText("nav.ecommerce")).toBeInTheDocument()
    // Services link is NOT at the top level (it's hidden inside the collapsed submenu)
    expect(screen.queryByRole("link", { name: /nav\.services/i })).not.toBeInTheDocument()
  })

  it("SCENARIO 7: Services shows as standalone when calendar booking is ENABLED (e-commerce)", () => {
    // RULE: When booking is enabled for e-commerce, Services moves out of submenu
    // so it's accessible for calendar setup
    setWorkspace({
      id: "ws-7",
      channelMode: 'ECOMMERCE' as any,
      enableCalendarBooking: true,
    })
    renderSidebar()
    expect(screen.getByRole("link", { name: /nav\.services/i })).toBeInTheDocument()
  })

  it("SCENARIO 8: E-commerce menu is visible for e-commerce workspaces", () => {
    // RULE: E-commerce label only appears for channelMode=true
    setWorkspace({
      id: "ws-8",
      channelMode: 'ECOMMERCE' as any,
      enableCalendarBooking: false,
    })
    renderSidebar()
    expect(screen.getByText("nav.ecommerce")).toBeInTheDocument()
  })

  it("SCENARIO 9: E-commerce menu is NOT visible for informational workspaces", () => {
    // RULE: Informational workspaces must not show the E-commerce submenu
    setWorkspace({
      id: "ws-9",
      channelMode: 'INFORMATIONAL' as any,
      enableCalendarBooking: false,
    })
    renderSidebar()
    expect(screen.queryByText("nav.ecommerce")).not.toBeInTheDocument()
  })
})
