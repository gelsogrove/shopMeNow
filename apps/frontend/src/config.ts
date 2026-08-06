// API URL configuration
// In production, use current origin; in dev use localhost
export const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? `${window.location.origin}/api`
    : "http://localhost:3001/api")

// Images base path
export const IMG_BASE_URL =
  import.meta.env.VITE_PATH_IMG ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? window.location.origin
    : "http://localhost:3001")

// Workspace logo paths are stored relative to the backend (e.g. "/uploads/x.png")
export function resolveLogoUrl(value?: string): string | undefined {
  if (!value) return undefined
  if (/^https?:\/\//i.test(value)) return value
  const path = value.startsWith("/") ? value : `/${value}`
  return `${IMG_BASE_URL}${path}`
}
