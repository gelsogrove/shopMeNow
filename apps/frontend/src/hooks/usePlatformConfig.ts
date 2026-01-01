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

const REQUIRED_PRICE_KEYS = [
  "FREE_MONTHLY",
  "BASIC_MONTHLY",
  "PREMIUM_MONTHLY",
  "ENTERPRISE_MONTHLY",
  "MESSAGE",
  "PUSH_CAMPAIGN",
]

const REQUIRED_FLAG_KEYS = ["canLogin", "canRegister"]

const findMissingKeys = (source: Record<string, unknown>, keys: string[]) =>
  keys.filter((key) => source[key] === undefined)

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
      const missingPrices = findMissingKeys(cachedData.prices || {}, REQUIRED_PRICE_KEYS)
      const missingFlags = findMissingKeys(cachedData.flags || {}, REQUIRED_FLAG_KEYS)
      if (!missingPrices.length && !missingFlags.length) {
      setState({
        data: cachedData,
        isLoading: false,
        error: null,
        lastFetch: lastFetchTime,
      })
      return
      }
      cachedData = null
      lastFetchTime = null
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await api.get("/platform-config")

      if (response.data.success) {
        const nextData = response.data.data as PlatformConfigData
        const missingPrices = findMissingKeys(nextData.prices || {}, REQUIRED_PRICE_KEYS)
        const missingFlags = findMissingKeys(nextData.flags || {}, REQUIRED_FLAG_KEYS)

        if (missingPrices.length || missingFlags.length) {
          throw new Error(
            `Missing platform config keys: ${
              missingPrices.length ? `prices=[${missingPrices.join(", ")}]` : ""
            }${missingPrices.length && missingFlags.length ? " " : ""}${
              missingFlags.length ? `flags=[${missingFlags.join(", ")}]` : ""
            }`
          )
        }

        cachedData = nextData
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
      setState({
        data: null,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch platform configuration",
        lastFetch: null,
      })
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // Helper to get price with fallback
  const getPrice = useCallback(
    (key: string): number | null => {
      return state.data?.prices[key]?.current ?? null
    },
    [state.data]
  )

  // Helper to get price with original (for strikethrough)
  const getPriceWithOriginal = useCallback(
    (key: string): PriceInfo | null => {
      return state.data?.prices[key] ?? null
    },
    [state.data]
  )

  // Helper to get flag with fallback
  const getFlag = useCallback(
    (key: string): boolean | null => {
      return state.data?.flags[key] ?? null
    },
    [state.data]
  )

  // Helper to get limit with fallback
  const getLimit = useCallback(
    (key: string): number | null => {
      return state.data?.limits[key] ?? null
    },
    [state.data]
  )

  // Convenience accessors for common flags
  const canLogin = state.data?.flags.canLogin ?? false
  const canRegister = state.data?.flags.canRegister ?? false
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
    
  }
}

/**
 * Hook specifically for feature flags check
 * Use this in login/register forms for quick access
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState({
    canLogin: false,
    canRegister: false,
    isLoading: true,
    error: null as string | null,
  })

  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const response = await api.get("/platform-config/flags/check")

        if (response.data.success) {
          const data = response.data.data || {}
          const missingFlags = findMissingKeys(data, REQUIRED_FLAG_KEYS)
          if (missingFlags.length) {
            throw new Error(
              `Missing platform flag keys: ${missingFlags.join(", ")}`
            )
          }
          setFlags({
            ...data,
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
