export const DEFAULT_ROUNDING_STEP = 0.05

/**
 * Round a numeric value to the closest multiple of the provided step.
 * Used to snap price decimals to 0 / 5 / 10 cents for a more retail-friendly experience.
 */
export const smartRoundPrice = (value: number, step: number = DEFAULT_ROUNDING_STEP): number => {
  if (typeof value !== "number" || !isFinite(value)) {
    return 0
  }

  const safeStep = Math.max(Math.abs(step), 0.01)
  const rounded = Math.round(value / safeStep) * safeStep

  // Keep just two decimals to avoid floating point artifacts
  const result = Number(rounded.toFixed(2))
  return result < 0 ? 0 : result
}

/**
 * Format a rounded price with currency symbol and optional locale.
 */
export const formatRoundedCurrency = (
  value: number,
  options: {
    currencySymbol?: string
    locale?: string
    step?: number
    minimumFractionDigits?: number
    maximumFractionDigits?: number
    useSmartRound?: boolean
  } = {}
): string => {
  const {
    currencySymbol = "€",
    locale = "en-US",
    step = DEFAULT_ROUNDING_STEP,
    minimumFractionDigits = 0,
    maximumFractionDigits = 0,
    useSmartRound = false,
  } = options

  const rounded = useSmartRound ? smartRoundPrice(value, step) : value

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  })

  return `${currencySymbol}${formatter.format(rounded)}`
}
