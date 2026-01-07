import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import axios from "axios"
import { toast } from "../lib/toast"

// Create an axios instance with custom config
export const api = axios.create({
  baseURL: "/api/v1", // Versioned API base URL
  withCredentials: true, // Importante: invia i cookie con le richieste
})

// Helper function to get current workspace ID from local storage
const getCurrentWorkspaceId = (): string | null => {
  const workspace = storage.getWorkspace<{ id?: string }>()
  return workspace?.id || null
}

// Add a request interceptor to handle authentication
api.interceptors.request.use(
  (config) => {
    logger.debug(
      `📤 API Request: ${config.method?.toUpperCase()} ${config.url}`,
      {
        data: config.data || {},
        baseURL: config.baseURL,
      }
    )

    // 🆕 ADD AUTHORIZATION HEADER (JWT token from localStorage - proxy-safe)
    const token = storage.getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      logger.debug(`🔐 Added Authorization header with JWT token`)
    } else {
      logger.debug(`⚠️ No JWT token available - request may fail authentication`)
    }

    // Add x-session-id header if present
    const sessionId = storage.getSessionId()
    if (sessionId) {
      config.headers["x-session-id"] = sessionId
      logger.debug(`🔐 Added x-session-id header`)
    }

    // Add x-workspace-id header if not already present and we have a workspace ID
    if (!config.headers["x-workspace-id"]) {
      const workspaceId = getCurrentWorkspaceId()
      if (workspaceId) {
        logger.debug(`🔧 Adding x-workspace-id header: ${workspaceId}`)
        config.headers["x-workspace-id"] = workspaceId
      } else {
        logger.debug(
          `⚠️ No workspace ID found for request to ${config.url}`
        )
      }
    }

    logger.debug(`📋 Final request headers ready`)
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
    logger.debug(
      `📥 API Response: ${
        response.status
      } ${response.config.method?.toUpperCase()} ${response.config.url}`,
      {
        data: response.data,
        status: response.status,
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
      if (window.location.pathname === "/") {
        return Promise.reject(error)
      }

      // 🆕 SKIP REDIRECT for 2FA verification pages (invalid code should show error, not redirect)
      const is2FAPage = window.location.pathname === "/auth/verify-2fa" || 
                        window.location.pathname === "/auth/verify-2fa-setup" ||
                        window.location.pathname === "/auth/setup-2fa"
      
      if (is2FAPage) {
        // Let the page handle the 401 error (invalid code)
        return Promise.reject(error)
      }

      // 🆕 CHECK IF IT'S A SESSION ERROR (vs JWT error)
      const errorMessage = error.response?.data?.error || ""
      const isSessionError = errorMessage.toLowerCase().includes("session")

      // 🛡️ CRITICAL: Clear ALL auth data to prevent stale token issues
      storage.clearAuth()

      // Show appropriate toast message
      toast.error("Sessione scaduta. Effettua nuovamente il login.")
      logger.warn("🔐 Auth error (401) - cleared all tokens, redirecting to login")

      // Redirect immediately to prevent retry loops
      window.location.href = "/"

      // Prevent further retries by throwing an error that won't be retried
      throw new Error("Authentication expired")
    }

    return Promise.reject(error)
  }
)

// API endpoints
export const auth = {
  login: async (credentials: { email: string; password: string }) => {
    // Pulisci la localStorage prima del login
    storage.clearWorkspace()

    // Ora tenta il login con stato pulito
    return api.post("/auth/login", credentials)
  },
  logout: () => {
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
