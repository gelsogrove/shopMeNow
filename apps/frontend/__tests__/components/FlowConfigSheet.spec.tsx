/**
 * FlowConfigSheet Unit Tests — E6
 *
 * WHAT: Tests the slide panel editor for flow configs.
 *
 * SCENARIOS COVERED:
 *   1. Invalid JSON in flows field → shows error and blocks save button
 *   2. Valid data → calls flowConfigApi.create on submit
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { FlowConfigSheet } from "@/components/shared/FlowConfigSheet"

// MOCK: Monaco Editor — replace with simple textarea for testing
vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange }: any) => (
    <textarea
      data-testid="monaco-editor"
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder='{ "step_id": {...} }'
    />
  ),
}))

// MOCK: flowConfigApi
const mockCreate = vi.fn()
const mockUpdate = vi.fn()

vi.mock("@/services/flowConfigApi", () => ({
  flowConfigApi: {
    create: (...args: any[]) => mockCreate(...args),
    update: (...args: any[]) => mockUpdate(...args),
  },
}))

// MOCK: callingFunctionsApi
vi.mock("@/services/callingFunctionsApi", () => ({
  callingFunctionsApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}))

// MOCK: toast
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// MOCK: logger
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

describe("FlowConfigSheet", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    workspaceId: "ws-flow-001",
    config: null,
    onSaved: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({ id: "fc-new", flowKey: "test_key", flowLabel: "Test" })
  })

  // ── Test 4: Invalid JSON in flows field blocks save ───────────────────────

  it("shows validation error and disables save when flows JSON is invalid", async () => {
    // SCENARIO: User types bad JSON in the flows textarea → error message appears + save disabled
    render(<FlowConfigSheet {...defaultProps} />)

    // Navigate to Flow tab (editor is on the "flow" tab)
    const flowTab = screen.getByRole("tab", { name: /flow/i })
    fireEvent.click(flowTab)

    // Find the flows textarea (Monaco Editor is mocked as textarea with testid)
    const flowsTextarea = await screen.findByTestId("monaco-editor")
    expect(flowsTextarea).toBeInTheDocument()

    // Type invalid JSON
    fireEvent.change(flowsTextarea, { target: { value: "{ invalid json" } })

    // RULE: Validation error message appears
    await waitFor(() => {
      expect(
        screen.getByText("Invalid JSON — please fix before saving")
      ).toBeInTheDocument()
    })

    // RULE: Save/Create button disabled when JSON is invalid
    const saveButton = screen.getByRole("button", { name: /create/i })
    expect(saveButton).toBeDisabled()
  })

  // ── Test 5: Valid data → calls API on save ────────────────────────────────

  it("calls flowConfigApi.create with correct data when form submitted with valid values", async () => {
    // SCENARIO: User fills in flowKey, flowLabel, valid JSON → submits → API called
    render(<FlowConfigSheet {...defaultProps} />)

    // Fill in flowKey
    const flowKeyInput = screen.getByPlaceholderText("e.g. washer_hs60xx")
    fireEvent.change(flowKeyInput, { target: { value: "my_machine" } })

    // Fill in flowLabel
    const flowLabelInput = screen.getByPlaceholderText("e.g. Washer HS-60XX")
    fireEvent.change(flowLabelInput, { target: { value: "My Machine" } })

    // Navigate to Flow tab
    const flowTab = screen.getByRole("tab", { name: /flow/i })
    fireEvent.click(flowTab)

    // Ensure flows has valid JSON (default is "{}")
    const flowsTextarea = await screen.findByTestId("monaco-editor")
    fireEvent.change(flowsTextarea, {
      target: { value: '{ "step_1": { "type": "INFO" } }' },
    })

    // Submit the form
    const saveButton = screen.getByRole("button", { name: /create/i })
    fireEvent.click(saveButton)

    // RULE: API called with correct workspaceId and data
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        "ws-flow-001",
        expect.objectContaining({
          flowKey: "my_machine",
          flowLabel: "My Machine",
          flows: { step_1: { type: "INFO" } },
        })
      )
    })
  })
})
