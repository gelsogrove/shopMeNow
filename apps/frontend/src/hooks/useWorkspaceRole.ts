import { teamMemberApi, type WorkspaceRole } from "@/services/teamApi"
import { useCallback, useEffect, useState, useRef } from "react"

interface UseWorkspaceRoleResult {
  role: 'SUPER_ADMIN' | 'ADMIN' | null
  isSuperAdmin: boolean
  isOwner: boolean
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook to get the current user's role in a workspace
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

    setIsLoading(true)
    setError(null)

    try {
      const data = await teamMemberApi.getRole(workspaceId)
      if (mountedRef.current) {
        console.log('🔍 [useWorkspaceRole] API response:', {
          workspaceId,
          role: data.role,
          isSuperAdmin: data.isSuperAdmin,
          isOwner: data.isOwner,
        })
        setRoleData(data)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch role'))
        setRoleData(null)
      }
    } finally {
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
    await fetchRole()
  }, [fetchRole])

  return {
    role: roleData?.role ?? null,
    isSuperAdmin: roleData?.isSuperAdmin ?? false,
    isOwner: roleData?.isOwner ?? false,
    isLoading,
    error,
    refetch,
  }
}
