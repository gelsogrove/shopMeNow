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
