import { PeriodPreset } from "@/components/analytics/DateRangeSelector"
import { logger } from "@/lib/logger"
import { useEffect, useState } from "react"

const STORAGE_KEY = "analytics_period"
const DEFAULT_PERIOD: PeriodPreset = "today" // Changed from "6months" to show current day by default

/**
 * Custom hook for managing analytics period with sessionStorage persistence
 * Automatically saves and loads the selected period from sessionStorage
 */
export function useAnalyticsPeriod() {
  const [selectedPeriod, setSelectedPeriod] =
    useState<PeriodPreset>(DEFAULT_PERIOD)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load period from sessionStorage on mount
  useEffect(() => {
    try {
      const storedPeriod = sessionStorage.getItem(STORAGE_KEY)
      if (storedPeriod && isValidPeriod(storedPeriod)) {
        setSelectedPeriod(storedPeriod as PeriodPreset)
      }
    } catch (error) {
      logger.warn("Failed to load analytics period from sessionStorage:", error)
    } finally {
      setIsInitialized(true)
    }
  }, [])

  // Save period to sessionStorage when it changes
  const updatePeriod = (period: PeriodPreset) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, period)
      setSelectedPeriod(period)
    } catch (error) {
      logger.warn("Failed to save analytics period to sessionStorage:", error)
      // Still update the state even if storage fails
      setSelectedPeriod(period)
    }
  }

  return {
    selectedPeriod,
    setSelectedPeriod: updatePeriod,
    isInitialized,
  }
}

/**
 * Type guard to validate if a string is a valid PeriodPreset
 */
function isValidPeriod(period: string): period is PeriodPreset {
  const validPeriods: PeriodPreset[] = [
    "week",
    "30days",
    "3months",
    "6months",
    "1year",
  ]
  return validPeriods.includes(period as PeriodPreset)
}
