// 3-strikes retry+escalate ladder — single source of truth.
//
// CLAUDE.md regla #10 corollary: every gather step has a 3-strikes ladder
//   counter == 0 → first canonical ask
//   counter == 1 → guidance reask
//   counter >= 2 → escalate to operator + reset counter
//
// Without this helper the same shape was duplicated across 4+ guards
// (force-display, force-machine-number, double-charge-ask-type,
// double-charge-ask-number). If the strike count ever changes (e.g. to 4)
// it has to change in one place here.
//
// REGRESSION (Andrea, 2026-05-09 audit): each duplicated copy is small
// (~5 lines) so the LOC saving is modest. The real win is **consistency**:
// every retry path goes through `nextRetryLadderStep()` so we can never
// accidentally diverge on the strike count or the reset rule.

/**
 * Advance the retry ladder counter by one step. Returns the ladder state
 * the caller should emit:
 *   - `'first-ask'`  → emit canonical question (counter goes 0 → 1)
 *   - `'reask'`      → emit guidance reask    (counter goes 1 → 2)
 *   - `'escalate'`   → counter reset to 0; caller MUST call
 *                       `escalate(ar, reason)` + `requireCustomerName(ar)`
 *                       and emit the operator-handover reply.
 *
 * The helper does NOT call `escalate()` itself — that's the caller's job
 * because each ladder has its own escalate reason string.
 */
export function nextRetryLadderStep(
  attempts: number,
  setAttempts: (n: number) => void,
): 'first-ask' | 'reask' | 'escalate' {
  if (attempts >= 2) {
    setAttempts(0)
    return 'escalate'
  }
  setAttempts(attempts + 1)
  return attempts === 0 ? 'first-ask' : 'reask'
}
