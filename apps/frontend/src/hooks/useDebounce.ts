import { useState, useEffect } from "react"

/**
 * useDebounce - Ritarda il valore per validazione real-time
 * @param value - Il valore da debounce
 * @param delay - Delay in ms (default 500ms per settings.md)
 */
export function useDebounce<T>(value: T, delay = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
