export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CHF: "CHF",
  CAD: "CA$",
  AUD: "A$",
  JPY: "¥",
  SEK: "SEK",
  NOK: "NOK",
  DKK: "DKK",
  PLN: "PLN",
  CZK: "CZK",
  HUF: "HUF",
  RON: "RON",
}

export const getCurrencySymbol = (currencyCode: string = "USD"): string => {
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode
}

export const formatCurrencyValue = (
  amount: number,
  currencyCode: string = "USD",
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
): string => {
  const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = options
  const symbol = getCurrencySymbol(currencyCode)
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits,
    maximumFractionDigits,
  })

  return `${symbol}${formatter.format(amount)}`
}
