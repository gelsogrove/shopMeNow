import { logger } from "@/lib/logger"
import axios from "axios"
import { toast } from "../lib/toast"

// Create an axios instance with custom config
export const api = axios.create({
  baseURL: "/api", // Set standard /api prefix for all API calls
  withCredentials: true, // Importante: invia i cookie con le richieste
})

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

    // 🆕 ADD AUTHORIZATION HEADER (JWT token from localStorage - proxy-safe)
    const token = localStorage.getItem("token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      logger.info(`🔐 Added Authorization header with JWT token`)
      logger.info(`🔍 [DEBUG] Token preview: ${token.substring(0, 50)}...`)
      
      // 🔍 DEBUG: Decode token to see content
      try {
        const base64Url = token.split('.')[1]
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
        const jsonPayload = decodeURIComponent(atob(base64).split('').map((c: string) => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        }).join(''))
        const decoded = JSON.parse(jsonPayload)
        logger.info(`🔍 [DEBUG] Token decoded:`, decoded)
      } catch (e) {
        logger.error('Failed to decode token for debug:', e)
      }
    } else {
      logger.warn(`⚠️ No JWT token in localStorage - request may fail authentication`)
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

      // Clear workspace data immediately
      localStorage.removeItem("currentWorkspace")
      sessionStorage.removeItem("currentWorkspace")

      // Show appropriate toast message
      toast.error("Sessione scaduta. Effettua nuovamente il login.")
      logger.warn("🔐 JWT token expired - redirecting to login")

      // Redirect immediately to prevent retry loops
      window.location.href = "/auth/login"

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
    localStorage.removeItem("currentWorkspace")
    sessionStorage.removeItem("currentWorkspace")

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
