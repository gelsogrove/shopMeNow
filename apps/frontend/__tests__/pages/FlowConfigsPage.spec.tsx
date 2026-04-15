/**
 * FlowConfigsPage Unit Tests — E6
 *
 * WHAT: Tests that FlowConfigsPage correctly renders the flow configs table,
 *       shows the delete confirmation dialog, and uses English-only text.
 *
 * SCENARIOS COVERED:
 *   1. Renders table with mock data (flowLabel, flowKey, isActive badge, actions)
 *   2. Delete button shows confirmation dialog before deleting
 *   3. All visible UI text is in English (no Italian, Spanish, other languages)
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { FlowConfigsPage } from "@/pages/FlowConfigsPage"

// MOCK: flowConfigApi - returns mock flow configs
const mockGetAll = vi.fn()
const mockRemove = vi.fn()

vi.mock("@/services/flowConfigApi", () => ({
  flowConfigApi: {
    getAllForWorkspace: (...args: any[]) => mockGetAll(...args),
    remove: (...args: any[]) => mockRemove(...args),
  },
  FlowConfig: {},
}))

// MOCK: WorkspaceContext - active workspace is FLOW mode
vi.mock("@/hooks/use-workspace", () => ({
  useWorkspace: () => ({
    workspace: { id: "ws-flow-001", name: "Ecolaundry", channelMode: "FLOW" },
    loading: false,
  }),
}))

// MOCK: react-router-dom - not used directly in page, but PageLayout may need it
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    NavLink: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
    useLocation: () => ({ pathname: "/flow-configs" }),
  }
})

// MOCK: PageLayout - render children directly to avoid layout complexity
vi.mock("@/components/layout/PageLayout", () => ({
  PageLayout: ({ children }: any) => <div data-testid="page-layout">{children}</div>,
}))

// MOCK: toast
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// MOCK: logger
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

const MOCK_CONFIGS = [
  {
    id: "fc-1",
    workspaceId: "ws-flow-001",
    flowKey: "washer_hs60xx",
    flowLabel: "Washer HS-60XX",
    model: "openai/gpt-4o-mini",
    flows: { step_1: {}, step_2: {} },
    isActive: true,
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
  },
  {
    id: "fc-2",
    workspaceId: "ws-flow-001",
    flowKey: "dryer_ed340",
    flowLabel: "Dryer ED-340",
    model: "openai/gpt-4o-mini",
    flows: { step_1: {} },
    isActive: false,
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
  },
]

describe("FlowConfigsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAll.mockResolvedValue(MOCK_CONFIGS)
  })

  // ── Test 1: Renders table with mock data ──────────────────────────────────

  it("renders table with mock flow configs data", async () => {
    // SCENARIO: FLOW workspace has 2 configs — page loads and shows them in a table
    render(<FlowConfigsPage />)

    // Wait for async data load
    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledWith("ws-flow-001")
    })

    // RULE: flowLabel shown in table
    expect(await screen.findByText("Washer HS-60XX")).toBeInTheDocument()
    expect(await screen.findByText("Dryer ED-340")).toBeInTheDocument()

    // RULE: flowKey shown in monospace column
    expect(screen.getByText("washer_hs60xx")).toBeInTheDocument()
    expect(screen.getByText("dryer_ed340")).toBeInTheDocument()

    // RULE: isActive shown as badge — "Active" / "Inactive"
    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(screen.getByText("Inactive")).toBeInTheDocument()
  })

  // ── Test 2: Delete shows confirmation dialog ───────────────────────────────

  it("clicking delete opens confirmation dialog before deleting", async () => {
    // SCENARIO: User clicks delete icon on "Washer HS-60XX" row
    render(<FlowConfigsPage />)

    // Wait for data to load
    await screen.findByText("Washer HS-60XX")

    // RULE: Delete buttons have title="Delete"
    const deleteButtons = screen.getAllByTitle("Delete")
    expect(deleteButtons.length).toBeGreaterThan(0)

    // Click the first delete button
    fireEvent.click(deleteButtons[0])

    // RULE: Confirmation dialog must appear before deletion
    await waitFor(() => {
      expect(screen.getByText("Delete Flow Config")).toBeInTheDocument()
    })

    // RULE: API remove NOT called yet (dialog not confirmed)
    expect(mockRemove).not.toHaveBeenCalled()
  })

  // ── Test 3: All UI text is in English ─────────────────────────────────────

  it("all visible text is in English (no Italian or Spanish)", async () => {
    // RULE: English-only UI — no Italian/Spanish words in buttons, labels, or headings
    render(<FlowConfigsPage />)

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalled()
    })

    // Get the rendered HTML text
    const bodyText = document.body.innerText || document.body.textContent || ""

    // RULE: No Italian words in UI
    const italianWords = ["Aggiungi", "Modifica", "Elimina", "Salva", "Annulla", "Configurazione"]
    for (const word of italianWords) {
      expect(bodyText).not.toContain(word)
    }

    // RULE: No Spanish words in UI
    const spanishWords = ["Agregar", "Editar", "Eliminar", "Guardar", "Cancelar", "Configuración"]
    for (const word of spanishWords) {
      expect(bodyText).not.toContain(word)
    }

    // RULE: English headings are present
    expect(screen.getByText("Flow Configs")).toBeInTheDocument()
    expect(screen.getByText("Add Flow Config")).toBeInTheDocument()
  })
})
