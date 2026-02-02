import { logger } from "@/lib/logger"
import axios from "axios"

// ========================================
// 🎫 TOKEN API CLIENT
// ========================================
// Purpose: Token-based public pages (NO sessionId)
// Authentication: Token in URL query params
// Used by: Register, Checkout, OrdersPublic, CustomerProfile
// ========================================

/**
 * Token API Client - For token-based public pages
 *
 * Features:
 * - NO sessionId header (uses token in URL)
 * - NO authentication cookies
 * - baseURL: /api/token
 * - withCredentials: false
 */
export const tokenApi = axios.create({
  baseURL: "/api/token",
  withCredentials: false, // No cookies for token endpoints
})

// Request interceptor - Log only, NO sessionId
tokenApi.interceptors.request.use(
  (config) => {
    logger.info(
      `📤 [TOKEN API] Request: ${config.method?.toUpperCase()} ${config.url}`,
      {
        params: config.params,
        baseURL: config.baseURL,
      }
    )
    return config
  },
  (error) => {
    logger.error("❌ [TOKEN API] Request Error:", error)
    return Promise.reject(error)
  }
)

// Response interceptor - Log responses and errors
tokenApi.interceptors.response.use(
  (response) => {
    logger.info(
      `📥 [TOKEN API] Response: ${
        response.status
      } ${response.config.method?.toUpperCase()} ${response.config.url}`,
      {
        status: response.status,
      }
    )
    return response
  },
  (error) => {
    if (error.response) {
      logger.error(
        `❌ [TOKEN API] Response Error: ${
          error.response.status
        } ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        {
          status: error.response.status,
          data: error.response.data,
        }
      )
    } else if (error.request) {
      logger.error("❌ [TOKEN API] No Response:", error.request)
    } else {
      logger.error("❌ [TOKEN API] Error:", error.message)
    }
    return Promise.reject(error)
  }
)
