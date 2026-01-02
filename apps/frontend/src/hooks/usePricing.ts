/**
 * usePricing Hook
 *
 * React hook per ottenere i prezzi dal backend.
 * I prezzi vengono fetchati una sola volta e cachati.
 *
 * Usage:
 * ```tsx
 * const { plans, usage, thresholds, isLoading, error } = usePricing()
 *
 * if (isLoading) return <div>Loading prices...</div>
 * if (error) return <div>Error loading prices</div>
 *
 * return <div>Message cost: ${usage.MESSAGE}</div>
 * ```
 */

import { useEffect, useState } from "react"
import { api } from "../services/api"

export interface PricingConfig {
  plans: Record<string, number>
  usage: Record<string, number>
  thresholds: Record<string, number>
}

interface UsePricingReturn extends PricingConfig {
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// Global cache to avoid multiple fetches
let cachedPricing: PricingConfig | null = null
let fetchPromise: Promise<PricingConfig> | null = null

async function fetchPricing(): Promise<PricingConfig> {
  // If already fetching, return the same promise
  if (fetchPromise) {
    return fetchPromise
  }

  // If cached, return immediately
  if (cachedPricing) {
    return cachedPricing
  }

  // Start new fetch
  fetchPromise = api
    .get<PricingConfig>("/pricing/config")
    .then((response) => {
      cachedPricing = response.data
      fetchPromise = null
      return response.data
    })
    .catch((error) => {
      fetchPromise = null
      throw error
    })

  return fetchPromise
}

export function usePricing(): UsePricingReturn {
  const [pricing, setPricing] = useState<PricingConfig>(
    cachedPricing || {
      plans: {},
      usage: {},
      thresholds: {},
    }
  )
  const [isLoading, setIsLoading] = useState(!cachedPricing)
  const [error, setError] = useState<string | null>(null)

  const loadPricing = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await fetchPricing()
      setPricing(data)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load pricing"
      setError(errorMessage)
      console.error("Error loading pricing:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPricing()
  }, [])

  return {
    ...pricing,
    isLoading,
    error,
    refetch: loadPricing,
  }
}

/**
 * Helper function to clear pricing cache
 * Useful for testing or when pricing is updated
 */
export function clearPricingCache() {
  cachedPricing = null
  fetchPromise = null
}
