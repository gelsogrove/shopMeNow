// 0.01 = cent precision. Widget messages cost €0.005 each — a coarser step
// (e.g. 0.1) rounds a handful of them down to €0.00, hiding real charges.
export const MONEY_ROUNDING_STEP = 0.01

export const roundMoney = (value: number, step: number = MONEY_ROUNDING_STEP): number => {
  if (!Number.isFinite(value)) return 0
  return Math.round(value / step) * step
}
