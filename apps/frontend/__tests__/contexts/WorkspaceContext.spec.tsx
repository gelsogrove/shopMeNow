import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext"
import { storage } from "@/lib/storage"

const oldWorkspace = {
  id: "workspace-old",
  name: "Old Workspace",
  isActive: true,
  isDelete: false,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
}

const newWorkspace = {
  id: "workspace-new",
  name: "New Workspace",
  isActive: true,
  isDelete: false,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
}

function SwitchWorkspaceButton() {
  const { setCurrentWorkspace } = useWorkspace()
  return (
    <button onClick={() => setCurrentWorkspace(newWorkspace)}>
      Switch Workspace
    </button>
  )
}

describe("WorkspaceContext - workspace change", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    storage.setWorkspace(oldWorkspace)
    sessionStorage.setItem("selectedChatId", "chat-123")
    sessionStorage.setItem("currentChatSessionId", "session-456")
  })

  it("dispatches workspace-changed and clears chat cache on workspace switch", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent")
    const user = userEvent.setup()

    render(
      <WorkspaceProvider initialWorkspace={oldWorkspace}>
        <SwitchWorkspaceButton />
      </WorkspaceProvider>
    )

    await user.click(screen.getByRole("button", { name: "Switch Workspace" }))

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "workspace-changed" })
    )
    expect(sessionStorage.getItem("selectedChatId")).toBeNull()
    expect(sessionStorage.getItem("currentChatSessionId")).toBeNull()
    expect(localStorage.getItem("workspace-changed")).not.toBeNull()

    dispatchSpy.mockRestore()
  })
})
