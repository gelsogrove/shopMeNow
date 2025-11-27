import { teamMemberApi, type WorkspaceRole } from "@/services/teamApi"
import { useCallback, useEffect, useState, useRef } from "react"

interface UseWorkspaceRoleResult {
  role: 'SUPER_ADMIN' | 'ADMIN' | null
  isSuperAdmin: boolean
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

// 🔒 Global cache to prevent duplicate API calls for same workspaceId
const roleCache = new Map<string, { data: WorkspaceRole | null; timestamp: number }>()
const pendingRequests = new Map<string, Promise<WorkspaceRole>>()
const CACHE_TTL = 60000 // 1 minute cache

/**
 * Hook to get the current user's role in a workspace
 * Uses global cache to prevent duplicate API calls across components
 * 
 * @param workspaceId - The ID of the workspace to check role for
 * @returns Object containing role info, loading state, and error
 */
export function useWorkspaceRole(workspaceId: string | null | undefined): UseWorkspaceRoleResult {
  const [roleData, setRoleData] = useState<WorkspaceRole | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)

  const fetchRole = useCallback(async () => {
    if (!workspaceId) {
      setRoleData(null)
      setError(null)
      return
    }

    // Check cache first
    const cached = roleCache.get(workspaceId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setRoleData(cached.data)
      setError(null)
      return
    }

    // Check if there's already a pending request for this workspaceId
    const pending = pendingRequests.get(workspaceId)
    if (pending) {
      try {
        const data = await pending
        if (mountedRef.current) {
          setRoleData(data)
          setError(null)
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error('Failed to fetch role'))
          setRoleData(null)
        }
      }
      return
    }

    setIsLoading(true)
    setError(null)

    // Create new request and store in pending
    const request = teamMemberApi.getRole(workspaceId)
    pendingRequests.set(workspaceId, request)

    try {
      const data = await request
      // Cache the result
      roleCache.set(workspaceId, { data, timestamp: Date.now() })
      if (mountedRef.current) {
        setRoleData(data)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch role'))
        setRoleData(null)
      }
    } finally {
      pendingRequests.delete(workspaceId)
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [workspaceId])

  useEffect(() => {
    mountedRef.current = true
    fetchRole()
    return () => {
      mountedRef.current = false
    }
  }, [fetchRole])

  const refetch = useCallback(async () => {
    // Clear cache before refetching
    if (workspaceId) {
      roleCache.delete(workspaceId)
    }
    await fetchRole()
  }, [workspaceId, fetchRole])

  return {
    role: roleData?.role ?? null,
    isSuperAdmin: roleData?.isSuperAdmin ?? false,
    isLoading,
    error,
    refetch,
  }
}
