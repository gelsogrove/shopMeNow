// Display state parsing and inference logic
export function normalizeDisplayState(displayState: string): string {
  const normalized = displayState.trim().toUpperCase().replace(/\s+/g, ' ')
  if (normalized === 'BLANK') return 'BLANK'
  if (/^PUSH(?:\s+PROG)?$/.test(normalized)) return 'PUSH'
  if (/END.*BAL|BAL.*END/.test(normalized)) return 'END_BAL'
  // Accept ALM separated from the sub-code by either "/", a space, or nothing
  // (so "ALM DOOR", "ALM/DOOR", "ALMDOOR" all normalize to the same token).
  if (/^ALM[\/\s]?A$/.test(normalized)) return 'ALM/A'
  if (/^ALM[\/\s]?E$/.test(normalized)) return 'ALM/E'
  if (/^ALM[\/\s]?DOOR$/.test(normalized)) return 'ALM/DOOR'
  if (/^ALM[\/\s]?VAR$/.test(normalized)) return 'ALM/VAr'
  // ALN family (ALN, ALN A, ALN N, etc.) is an alarm code that's not in our documented
  // troubleshooting list — normalize to a single token so the flow engine can route it
  // to case_alm_unknown for immediate escalation (per Caso 16).
  if (/^ALN(\s*[AN])?$/.test(normalized)) return 'ALN'
  if (/^ALM\s*0*01$/.test(normalized.replace(/ /g, '')) || normalized === 'AL001') {
    return 'AL001'
  }
  if (/^\d{1,2}[.,]\d{2}$/.test(normalized)) return 'PRICE'
  return normalized
}

