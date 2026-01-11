/**
 * Widget Test Helpers
 * 
 * Helper functions for testing widget controller security
 */

import { prisma } from "@echatbot/database"

export interface WidgetAccessResult {
  isValid: boolean
  origin: string | null
  error?: string
}

/**
 * Simulate the origin validation logic from widget.controller.ts
 */
export async function validateWidgetAccess(
  workspaceId: string,
  origin: string | null
): Promise<WidgetAccessResult> {
  // Get workspace with allowedExternalLinks
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { allowedExternalLinks: true },
  })

  if (!workspace) {
    return { isValid: false, origin, error: "Workspace not found" }
  }

  // If no allowed URLs configured, deny all (security by default)
  if (!workspace.allowedExternalLinks || workspace.allowedExternalLinks.length === 0) {
    return {
      isValid: false,
      origin,
      error: "Widget not configured. Add allowed URLs in Settings → Allowed External Links",
    }
  }

  // Get allowed URLs (already an array)
  const allowedUrls = workspace.allowedExternalLinks
    .map((url: string) => url.trim().toLowerCase())
    .filter((url: string) => url.length > 0)

  // If origin is missing, check if localhost is allowed (for development)
  if (!origin) {
    const allowsLocalhost = allowedUrls.some(
      (url: string) => url.includes("localhost") || url.includes("127.0.0.1")
    )
    if (allowsLocalhost) {
      return { isValid: true, origin: "localhost" }
    }
    return { isValid: false, origin: null, error: "Origin header required" }
  }

  // Normalize origin for comparison
  const normalizedOrigin = origin.toLowerCase().replace(/\/$/, "")

  // Check if origin matches any allowed URL
  const isAllowed = allowedUrls.some((allowedUrl: string) => {
    // Remove protocol for flexible matching
    const cleanAllowed = allowedUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
    const cleanOrigin = normalizedOrigin.replace(/^https?:\/\//, "")
    
    // Check exact match or domain match
    return cleanOrigin === cleanAllowed || 
           cleanOrigin.startsWith(cleanAllowed) ||
           cleanOrigin.endsWith(cleanAllowed)
  })

  if (isAllowed) {
    return { isValid: true, origin }
  }

  return {
    isValid: false,
    origin,
    error: `Origin not allowed. Add ${origin} to Settings → Allowed External Links`,
  }
}
