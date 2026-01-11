export const MONEY_ROUNDING_STEP = 0.1

export const roundMoney = (value: number, step: number = MONEY_ROUNDING_STEP): number => {
  if (!Number.isFinite(value)) return 0
  return Math.round(value / step) * step
}
