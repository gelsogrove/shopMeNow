/**
 * 🚀 USE PLATFORM CONFIG HOOK
 *
 * React hook for accessing platform configuration.
 * Fetches prices, flags, and limits from the backend.
 *
 * Features:
 * - Auto-refresh on mount
 * - Caching with configurable TTL
 * - Type-safe access to prices, flags, limits
 * - Loading and error states
 *
 * Usage:
 * ```tsx
 * const { prices, flags, limits, isLoading, error, refresh } = usePlatformConfig()
 *
 * // Access prices with strikethrough support
 * const basicPrice = prices.BASIC_MONTHLY // { current: 19, original: 29 }
 *
 * // Check feature flags
 * if (!flags.canLogin) {
 *   return <WIPModal />
 * }
 *
 * // Check limits
 * const maxProducts = limits.BASIC_PRODUCTS // 50
 * ```
 *
 * @author Andrea Gelso - eChatbot Platform
 */

import { useState, useEffect, useCallback } from "react"
import { api } from "../services/api"

// Types for platform config
export interface PriceInfo {
  current: number
  original: number | null
}

export interface PlatformConfigData {
  prices: Record<string, PriceInfo>
  flags: Record<string, boolean>
  limits: Record<string, number>
}

interface PlatformConfigState {
  data: PlatformConfigData | null
  isLoading: boolean
  error: string | null
  lastFetch: Date | null
}

// Cache TTL (5 minutes to match backend)
const CACHE_TTL_MS = 5 * 60 * 1000

// In-memory cache
let cachedData: PlatformConfigData | null = null
let lastFetchTime: Date | null = null

export function usePlatformConfig() {
  const [state, setState] = useState<PlatformConfigState>({
    data: cachedData,
    isLoading: !cachedData,
    error: null,
    lastFetch: lastFetchTime,
  })

  const fetchConfig = useCallback(async (force = false) => {
    // Check if cache is still valid
    if (
      !force &&
      cachedData &&
      lastFetchTime &&
      Date.now() - lastFetchTime.getTime() < CACHE_TTL_MS
    ) {
      setState({
        data: cachedData,
        isLoading: false,
        error: null,
        lastFetch: lastFetchTime,
      })
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await api.get("/platform-config")

      if (response.data.success) {
        cachedData = response.data.data
        lastFetchTime = new Date()

        setState({
          data: cachedData,
          isLoading: false,
          error: null,
          lastFetch: lastFetchTime,
        })
      } else {
        throw new Error(response.data.error || "Failed to fetch config")
      }
    } catch (error) {
      console.error("[usePlatformConfig] Error fetching config:", error)
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch platform configuration",
      }))
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // Helper to get price with fallback
  const getPrice = useCallback(
    (key: string, fallback = 0): number => {
      return state.data?.prices[key]?.current ?? fallback
    },
    [state.data]
  )

  // Helper to get price with original (for strikethrough)
  const getPriceWithOriginal = useCallback(
    (key: string): PriceInfo => {
      return state.data?.prices[key] ?? { current: 0, original: null }
    },
    [state.data]
  )

  // Helper to get flag with fallback
  const getFlag = useCallback(
    (key: string, fallback = true): boolean => {
      return state.data?.flags[key] ?? fallback
    },
    [state.data]
  )

  // Helper to get limit with fallback
  const getLimit = useCallback(
    (key: string, fallback = 0): number => {
      return state.data?.limits[key] ?? fallback
    },
    [state.data]
  )

  // Convenience accessors for common flags
  const canLogin = state.data?.flags.canLogin ?? true
  const canRegister = state.data?.flags.canRegister ?? true
  const landingPageEnabled = state.data?.flags.landingPageEnabled ?? true

  return {
    // Raw data
    prices: state.data?.prices ?? {},
    flags: state.data?.flags ?? {},
    limits: state.data?.limits ?? {},

    // State
    isLoading: state.isLoading,
    error: state.error,
    lastFetch: state.lastFetch,

    // Actions
    refresh: () => fetchConfig(true),

    // Helpers
    getPrice,
    getPriceWithOriginal,
    getFlag,
    getLimit,

    // Convenience flags
    canLogin,
    canRegister,
    landingPageEnabled,
  }
}

/**
 * Hook specifically for feature flags check
 * Use this in login/register forms for quick access
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState({
    canLogin: true,
    canRegister: true,
    landingPageEnabled: true,
    isLoading: true,
    error: null as string | null,
  })

  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const response = await api.get("/platform-config/flags/check")

        if (response.data.success) {
          setFlags({
            ...response.data.data,
            isLoading: false,
            error: null,
          })
        }
      } catch (error) {
        console.error("[useFeatureFlags] Error:", error)
        setFlags((prev) => ({
          ...prev,
          isLoading: false,
          error: "Failed to check feature flags",
        }))
      }
    }

    fetchFlags()
  }, [])

  return flags
}
