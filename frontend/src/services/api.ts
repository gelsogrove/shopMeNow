import { logger } from "@/lib/logger"
import axios from "axios"
import { toast } from "../lib/toast"

// Create an axios instance with custom config
export const api = axios.create({
  baseURL: "/api", // Set standard /api prefix for all API calls
  withCredentials: true, // Importante: invia i cookie con le richieste
})

// 🆕 SESSION ID HELPERS (localStorage management)
// NOTE: Using localStorage to persist session across page reloads
export const getSessionId = (): string | null => {
  return localStorage.getItem("sessionId")
}

export const setSessionId = (sessionId: string): void => {
  localStorage.setItem("sessionId", sessionId)
  logger.info(
    `✅ SessionID saved to localStorage: ${sessionId.substring(0, 8)}...`
  )
}

export const clearSessionId = (): void => {
  localStorage.removeItem("sessionId")
  logger.info("🗑️ SessionID cleared from localStorage")
}

// Helper function to get current workspace ID from local storage
const getCurrentWorkspaceId = (): string | null => {
  const workspaceData = localStorage.getItem("currentWorkspace")
  if (workspaceData) {
    try {
      const workspace = JSON.parse(workspaceData)
      return workspace.id
    } catch (e) {
      logger.error("Error parsing workspace data:", e)
    }
  }
  return null
}

// 🔒 SESSION ID EXEMPT ROUTES (no sessionId required)
// NOTE: These are RELATIVE paths (without /api prefix) because axios uses baseURL
const SESSION_EXEMPT_ROUTES = [
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/register",
  "/health",
  "/session/validate", // 🔑 CRITICAL: Used by LoginPage checkExistingSession
]

// Add a request interceptor to handle authentication
api.interceptors.request.use(
  (config) => {
    logger.info(
      `📤 API Request: ${config.method?.toUpperCase()} ${config.url}`,
      {
        data: config.data || {},
        headers: config.headers,
        baseURL: config.baseURL,
      }
    )

    // Note: JWT token is sent automatically via HTTP-only cookies
    // No need to manually add Authorization header
    logger.info(`🔐 Using HTTP-only cookie for authentication`)

    // 🆕 ADD X-SESSION-ID HEADER (except for exempt routes)
    const url = config.url || ""
    const isExemptRoute = SESSION_EXEMPT_ROUTES.some((route) =>
      url.startsWith(route)
    )

    if (!isExemptRoute) {
      const sessionId = getSessionId()
      logger.info(
        `🔍 [INTERCEPTOR] URL: ${url}, sessionId from localStorage: ${
          sessionId || "NULL"
        }`
      )

      if (sessionId) {
        config.headers["X-Session-Id"] = sessionId
        logger.info(
          `🔒 Added X-Session-Id header: ${sessionId.substring(0, 8)}...`
        )
      } else {
        logger.error(
          `❌ CRITICAL: No sessionId in localStorage for URL: ${url}`
        )
        logger.error(
          `❌ localStorage contents: ${JSON.stringify(localStorage)}`
        )
      }
    } else {
      logger.debug(`🔓 SessionID skipped for exempt route: ${url}`)
    }

    // Add x-workspace-id header if not already present and we have a workspace ID
    if (!config.headers["x-workspace-id"]) {
      const workspaceId = getCurrentWorkspaceId()
      if (workspaceId) {
        logger.info(`🔧 Adding x-workspace-id header: ${workspaceId}`)
        config.headers["x-workspace-id"] = workspaceId
      } else {
        logger.warn(
          `⚠️ No workspace ID found in localStorage for request to ${config.url}`
        )
      }
    }

    logger.info(`📋 Final request headers:`, config.headers)
    return config
  },
  (error) => {
    logger.error("❌ API Request Error:", error)
    return Promise.reject(error)
  }
)

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    logger.info(
      `📥 API Response: ${
        response.status
      } ${response.config.method?.toUpperCase()} ${response.config.url}`,
      {
        data: response.data,
        status: response.status,
        headers: response.headers,
      }
    )
    return response
  },
  (error) => {
    logger.error("❌ API Response Error:", {
      error: error.response || error,
      status: error.response?.status,
      data: error.response?.data,
      config: error.config,
      message: error.message,
    })

    // Handle authentication errors (401) - includes INVALID SESSION
    if (error.response && error.response.status === 401) {
      // Skip if already on login page to avoid loops
      if (window.location.pathname === "/auth/login") {
        return Promise.reject(error)
      }

      // 🆕 CHECK IF IT'S A SESSION ERROR (vs JWT error)
      const errorMessage = error.response?.data?.error || ""
      const isSessionError = errorMessage.toLowerCase().includes("session")

      // Clear workspace data immediately
      localStorage.removeItem("currentWorkspace")
      sessionStorage.removeItem("currentWorkspace")

      // 🆕 CLEAR SESSION ID
      clearSessionId()

      // Show appropriate toast message
      if (isSessionError) {
        toast.error(
          "Sessione scaduta o invalida. Effettua nuovamente il login."
        )
        logger.warn("🔒 Session expired or invalid - redirecting to login")
      } else {
        toast.error("Sessione scaduta. Effettua nuovamente il login.")
        logger.warn("🔐 JWT token expired - redirecting to login")
      }

      // Redirect immediately to prevent retry loops
      window.location.href = "/auth/login"

      // Prevent further retries by throwing an error that won't be retried
      throw new Error("Authentication expired")
    }

    // 🆕 HANDLE SESSION ID MISSING (400)
    if (error.response && error.response.status === 400) {
      const errorMessage = error.response?.data?.error || ""
      if (errorMessage.toLowerCase().includes("sessionid")) {
        logger.error(
          "❌ SessionID is missing - clearing and redirecting to login"
        )

        // Clear all auth data
        localStorage.removeItem("currentWorkspace")
        sessionStorage.removeItem("currentWorkspace")
        clearSessionId()

        toast.error("SessionID mancante. Effettua nuovamente il login.")
        window.location.href = "/auth/login"

        throw new Error("SessionID required")
      }
    }

    // 🔥 HANDLE SESSION VALIDATION ERRORS (500)
    if (error.response && error.response.status === 500) {
      const errorMessage = error.response?.data?.error || ""
      const isSessionError = 
        errorMessage.toLowerCase().includes("session") ||
        errorMessage.toLowerCase().includes("validation failed")

      if (isSessionError) {
        logger.error(
          "❌ Session validation failed (500) - clearing and redirecting to login"
        )

        // Clear all auth data IMMEDIATELY to stop the loop
        localStorage.removeItem("currentWorkspace")
        sessionStorage.removeItem("currentWorkspace")
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        clearSessionId()

        toast.error("Sessione non valida. Effettua nuovamente il login.")
        
        // IMMEDIATE redirect to stop retry loop
        window.location.href = "/auth/login"

        throw new Error("Session validation failed")
      }
    }

    return Promise.reject(error)
  }
)

// API endpoints
export const auth = {
  login: async (credentials: { email: string; password: string }) => {
    // Pulisci la localStorage prima del login
    localStorage.removeItem("currentWorkspace")
    sessionStorage.removeItem("currentWorkspace")
    clearSessionId() // 🆕 Clear old sessionId

    // Ora tenta il login con stato pulito
    return api.post("/auth/login", credentials)
  },
  logout: () => {
    // 🆕 Clear sessionId before logout
    clearSessionId()
    return api.post("/auth/logout")
  },
}

export const workspaces = {
  list: () => api.get("/workspaces"),
  get: (id: string) => api.get(`/workspaces/${id}`),
  create: (data: any) => api.post("/workspaces", data),
  update: (id: string, data: any) => api.put(`/workspaces/${id}`, data),
  delete: (id: string) => api.delete(`/workspaces/${id}`),
}

export const products = {
  list: (workspaceId: string) =>
    api.get(`/workspaces/${workspaceId}/products?workspaceId=${workspaceId}`),
  get: (workspaceId: string, id: string) =>
    api.get(
      `/workspaces/${workspaceId}/products/${id}?workspaceId=${workspaceId}`
    ),
  create: (workspaceId: string, data: any) =>
    api.post(
      `/workspaces/${workspaceId}/products?workspaceId=${workspaceId}`,
      data
    ),
  update: (workspaceId: string, id: string, data: any) =>
    api.put(
      `/workspaces/${workspaceId}/products/${id}?workspaceId=${workspaceId}`,
      data
    ),
  delete: (workspaceId: string, id: string) =>
    api.delete(
      `/workspaces/${workspaceId}/products/${id}?workspaceId=${workspaceId}`
    ),
}
