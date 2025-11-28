import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import { teamMemberApi } from "@/services/teamApi"

// Mock the teamApi service
vi.mock("@/services/teamApi", () => ({
  teamMemberApi: {
    getRole: vi.fn(),
  },
}))

describe("useWorkspaceRole", () => {
  const mockWorkspaceId = "workspace-123"

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("should return null values when workspaceId is null", async () => {
    const { result } = renderHook(() => useWorkspaceRole(null))

    expect(result.current.role).toBeNull()
    expect(result.current.isSuperAdmin).toBe(false)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(teamMemberApi.getRole).not.toHaveBeenCalled()
  })

  it("should return null values when workspaceId is undefined", async () => {
    const { result } = renderHook(() => useWorkspaceRole(undefined))

    expect(result.current.role).toBeNull()
    expect(result.current.isSuperAdmin).toBe(false)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(teamMemberApi.getRole).not.toHaveBeenCalled()
  })

  it("should fetch role when workspaceId is provided", async () => {
    const mockRoleData = { role: "SUPER_ADMIN" as const, isSuperAdmin: true }
    vi.mocked(teamMemberApi.getRole).mockResolvedValueOnce(mockRoleData)

    const { result } = renderHook(() => useWorkspaceRole(mockWorkspaceId))

    // Initially loading
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.role).toBe("SUPER_ADMIN")
    expect(result.current.isSuperAdmin).toBe(true)
    expect(result.current.error).toBeNull()
    expect(teamMemberApi.getRole).toHaveBeenCalledWith(mockWorkspaceId)
  })

  it("should return ADMIN role correctly", async () => {
    const mockRoleData = { role: "ADMIN" as const, isSuperAdmin: false }
    vi.mocked(teamMemberApi.getRole).mockResolvedValueOnce(mockRoleData)

    const { result } = renderHook(() => useWorkspaceRole(mockWorkspaceId))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.role).toBe("ADMIN")
    expect(result.current.isSuperAdmin).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("should handle API errors", async () => {
    const mockError = new Error("Network error")
    vi.mocked(teamMemberApi.getRole).mockRejectedValueOnce(mockError)

    const { result } = renderHook(() => useWorkspaceRole(mockWorkspaceId))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.role).toBeNull()
    expect(result.current.isSuperAdmin).toBe(false)
    expect(result.current.error).toEqual(mockError)
  })

  it("should handle non-Error exceptions", async () => {
    vi.mocked(teamMemberApi.getRole).mockRejectedValueOnce("String error")

    const { result } = renderHook(() => useWorkspaceRole(mockWorkspaceId))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe("Failed to fetch role")
  })

  it("should refetch when workspaceId changes", async () => {
    const mockRoleData1 = { role: "SUPER_ADMIN" as const, isSuperAdmin: true }
    const mockRoleData2 = { role: "ADMIN" as const, isSuperAdmin: false }
    
    vi.mocked(teamMemberApi.getRole)
      .mockResolvedValueOnce(mockRoleData1)
      .mockResolvedValueOnce(mockRoleData2)

    const { result, rerender } = renderHook(
      ({ wsId }) => useWorkspaceRole(wsId),
      { initialProps: { wsId: "workspace-1" } }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.role).toBe("SUPER_ADMIN")

    // Change workspaceId
    rerender({ wsId: "workspace-2" })

    await waitFor(() => {
      expect(result.current.role).toBe("ADMIN")
    })

    expect(teamMemberApi.getRole).toHaveBeenCalledTimes(2)
  })

  it("should provide refetch function", async () => {
    const mockRoleData = { role: "ADMIN" as const, isSuperAdmin: false }
    vi.mocked(teamMemberApi.getRole).mockResolvedValue(mockRoleData)

    const { result } = renderHook(() => useWorkspaceRole(mockWorkspaceId))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Call refetch
    await result.current.refetch()

    expect(teamMemberApi.getRole).toHaveBeenCalledTimes(2)
  })

  it("should reset data when workspaceId becomes null", async () => {
    const mockRoleData = { role: "SUPER_ADMIN" as const, isSuperAdmin: true }
    vi.mocked(teamMemberApi.getRole).mockResolvedValue(mockRoleData)

    const { result, rerender } = renderHook(
      ({ wsId }) => useWorkspaceRole(wsId),
      { initialProps: { wsId: mockWorkspaceId as string | null } }
    )

    await waitFor(() => {
      expect(result.current.role).toBe("SUPER_ADMIN")
    })

    // Change to null
    rerender({ wsId: null })

    expect(result.current.role).toBeNull()
    expect(result.current.isSuperAdmin).toBe(false)
    expect(result.current.isLoading).toBe(false)
  })
})
