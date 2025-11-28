/**
 * Workspace configuration
 * This allows for easier management of workspace IDs across the application
 */
import { logger } from "@/lib/logger"
import { api } from "../services/api"

interface Workspace {
  id: string
  name: string
  description?: string
  isActive: boolean
  currency?: string
  language?: string
  url?: string
  createdAt: string
  updatedAt: string
}

interface WorkspaceResponse {
  success: boolean
  data: Workspace[]
}

// Cache to store workspace data
let cachedWorkspaces: Record<string, Workspace> = {}
let cachedDefaultWorkspace: Workspace | null = null

/**
 * Get workspace ID without hardcoded fallbacks to prevent cross-workspace contamination
 * @param workspaceId Optional workspace ID to use
 * @returns A valid workspace ID or null if not available
 */
export const getWorkspaceId = (workspaceId?: string): string | null => {
  // If a valid workspaceId is provided, use it
  if (workspaceId && workspaceId.length > 0) {
    return workspaceId
  }

  // Check if we have a cached default workspace
  if (cachedDefaultWorkspace?.id) {
    return cachedDefaultWorkspace.id
  }

  // Check if environment variables are set (for production)
  if (import.meta.env.VITE_DEFAULT_WORKSPACE_ID) {
    return import.meta.env.VITE_DEFAULT_WORKSPACE_ID
  }

  // Return null instead of hardcoded fallback to prevent cross-workspace contamination
  return null
}

/**
 * Fetch a workspace by ID and cache it
 * @param workspaceId The workspace ID to fetch
 * @returns The workspace data or null if not found
 */
export const fetchWorkspace = async (
  workspaceId: string
): Promise<Workspace | null> => {
  try {
    // Check if we have it cached
    if (cachedWorkspaces[workspaceId]) {
      return cachedWorkspaces[workspaceId]
    }

    // Fetch from API
    const response = await api.get<{ data: Workspace }>(
      `/workspace/${workspaceId}`
    )

    if (response.data?.data) {
      // Cache it
      cachedWorkspaces[workspaceId] = response.data.data
      return response.data.data
    }

    return null
  } catch (error) {
    // Only log in development mode
    if (import.meta.env.DEV) {
      logger.error("Error fetching workspace:", error)
    }
    return null
  }
}

/**
 * Fetch the default active workspace
 * @returns The default active workspace data or null
 */
export const fetchDefaultWorkspace = async (): Promise<Workspace | null> => {
  try {
    // Check if we have it cached
    if (cachedDefaultWorkspace) {
      return cachedDefaultWorkspace
    }

    // Fetch from API
    const response = await api.get<WorkspaceResponse>("/workspaces/active")

    if (response.data?.success && response.data?.data?.length > 0) {
      // Cache the first active workspace
      cachedDefaultWorkspace = response.data.data[0]
      return cachedDefaultWorkspace
    }

    return null
  } catch (error) {
    // Only log in development mode
    if (import.meta.env.DEV) {
      logger.error("Error fetching default workspace:", error)
    }
    return null
  }
}

/**
 * Clear workspace cache
 */
export const clearWorkspaceCache = (): void => {
  cachedWorkspaces = {}
  cachedDefaultWorkspace = null
}

/**
 * Cache a workspace
 * @param workspace The workspace to cache
 */
export const cacheWorkspace = (workspace: Workspace): void => {
  cachedWorkspaces[workspace.id] = workspace

  // If this is the first active workspace we're caching, set it as default
  if (!cachedDefaultWorkspace && workspace.isActive) {
    cachedDefaultWorkspace = workspace
  }
}

export type { Workspace, WorkspaceResponse }
