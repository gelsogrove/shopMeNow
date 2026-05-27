// approved-by-andrea: REFACTOR ONLY — file split of utils/intent.ts per
// iron rule #3. Body moved verbatim. Iron rule #5 not applicable (depth-2
// file). Coverage in trouble-switch-during-flow.test.ts.
//
// detectTroubleSwitchDuringFlow is data-driven via the JSON pattern
// `topicMachineTrouble` (json/nlu-patterns.json) — rule #6 compliant.

import type { Runtime } from '../../models/index.js'
import { matchPattern } from '../nlu.js'

export function detectTroubleSwitchDuringFlow(
  runtime: Runtime,
  message: string,
): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  return matchPattern(runtime, 'topicMachineTrouble', trimmed)
}
