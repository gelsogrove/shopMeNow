// Display state parsing and inference logic
export function normalizeDisplayState(displayState: string): string {
  const normalized = displayState.trim().toUpperCase().replace(/\s+/g, ' ')
  if (normalized === 'BLANK') return 'BLANK'
  if (/^PUSH(?:\s+PROG)?$/.test(normalized)) return 'PUSH'
  if (/END.*BAL|BAL.*END/.test(normalized)) return 'END_BAL'
  if (/^ALM\/?A$/.test(normalized)) return 'ALM/A'
  if (/^ALM\/?E$/.test(normalized)) return 'ALM/E'
  if (/^ALM\/?DOOR$/.test(normalized)) return 'ALM/DOOR'
  if (/^ALM\/?VAR$/.test(normalized)) return 'ALM/VAr'
  if (/^ALM\s*0*01$/.test(normalized.replace(/ /g, '')) || normalized === 'AL001') {
    return 'AL001'
  }
  if (/^\d{1,2}[.,]\d{2}$/.test(normalized)) return 'PRICE'
  return normalized
}

export function inferPaymentCompletedFromDisplayState(
  machineType: string | '',
  displayState: string,
): boolean | null {
  if (machineType !== 'washer') return null

  const normalized = normalizeDisplayState(displayState)
  if (normalized === 'PUSH' || normalized === 'PR') return true
  if (normalized === 'SEL' || normalized === 'PRICE') return false

  return null
}

export function isWasherPaymentPendingDisplay(displayState: string): boolean {
  return inferPaymentCompletedFromDisplayState('washer', displayState) === false
}

export function doesDryerDisplayNeedIdentityDetails(displayState: string): boolean {
  const normalized = normalizeDisplayState(displayState)
  return ['ALM', 'AL001', 'BLANK', 'FILTRO', 'FALLO DE ROTACION', 'FALLO DE ASPIRACION'].includes(normalized)
}
