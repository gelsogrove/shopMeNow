// Deterministic auto-start of the washer/dryer machine flow.
//
// PROBLEM: PUSH / SEL / DOOR / ALM-family / END_BAL / etc. live in the
// LLM-tool-driven flow engine (`json/washer_hs60xx.json` and
// `json/dryer_ed340.json`). The canonical instruction (e.g. "Pulsa un
// botón de programa..." with the 4 programs and the loopback question)
// is the `prompt` field of the `case_push` node. The LLM is supposed to
// call `start_machine_flow(flowId="non_parte")` once it has location +
// machineType + machineNumber + displayState. In practice the LLM
// occasionally skips the tool and writes a paraphrased one-liner
// instead, dropping the multi-paragraph format and the markdown bold
// on programs. The customer ends up with a degraded reply.
//
// FIX: a deterministic guard that auto-starts the flow when:
//   - location + machineType + machineNumber + displayState all set
//   - displayState matches a recoverable code
//   - no flow is currently active
//   - no escalation is in progress
//
// Architectural note: this is NOT a duplicate of the JSON-driven
// `guardDisplayFlowStart` (which handles AL001 / ALM-DOOR / C001 from
// `json/display-flows.json`). The two systems coexist:
//
//   - `display-flows.json` (declarative) → `guardDisplayFlowStart`
//   - `washer_hs60xx.json` / `dryer_ed340.json` (tool-driven) → this guard
//
// The fact that there are two systems is an organic consequence of an
// older codebase; merging them is tracked in TODO.md but out of scope here.

import type { Guard } from '../../models/index.js'
import { startFlow } from '../flow-engine.js'
import { t } from '../localization.js'
import type { TranslationKey } from '../localization.js'
import { lang, RECOVERABLE_DISPLAYS, notInActiveSubFlow } from './helpers.js'
import { buildPushProgList } from '../faq-location-formatter.js'

/**
 * Auto-start the machine-incident flow when gather is complete and the
 * display matches a recoverable code. Returns the canonical first-step
 * prompt as the reply; subsequent turns are handled by the flow engine.
 */
export const guardAutoStartMachineFlow: Guard = (ar) => {
  if (
    !ar.state.location ||
    !ar.state.machineType ||
    !ar.state.machineNumber ||
    !ar.state.displayState ||
    ar.state.activeFlowId ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested ||
    ar.state.customerName ||
    !notInActiveSubFlow(ar) ||
    ar.state.nonTroubleshootingIncident
  ) {
    return null
  }
  // Only auto-start when the display is recoverable. Unknown displays
  // (ERR 52, etc.) escalate via `guardEscalateUnknownDisplay`; alarm
  // codes already covered by display-flows.json escalate via that path.
  const display = String(ar.state.displayState).toUpperCase()
  if (!RECOVERABLE_DISPLAYS.has(display)) return null

  try {
    const translateFn = (key: string) => t(key as TranslationKey, lang(ar))
    const result = startFlow(ar.runtime, ar.state, 'non_parte', translateFn)

    // F81 — PUSH PROG dynamic program list.
    // When the flow starts at case_push, replace the hardcoded program list
    // in the prompt with the per-location list from locations.json:metadata.programs.
    // Falls back to the original prompt if no programs data is available.
    let prompt = result.prompt
    if (display === 'PUSH' && ar.state.location) {
      const dynamicList = buildPushProgList(ar.state.location, ar.runtime, translateFn)
      if (dynamicList) {
        // Replace the hardcoded bullet list block (lines starting with "- **")
        // with the dynamic list. The surrounding intro + closing question are kept.
        prompt = prompt.replace(/(?:^|\n)(- \*\*[^\n]+\n?)(?:- \*\*[^\n]+\n?)*/m, '\n\n' + dynamicList + '\n\n')
        // Clean up any double blank lines introduced by the replacement
        prompt = prompt.replace(/\n{3,}/g, '\n\n').trim()
      }
    }

    return {
      reply: prompt,
      reason: 'auto-start-machine-flow',
    }
  } catch {
    // Flow not loaded for this machine type, or no matching node — let
    // the rest of the pipeline (gather guards / LLM) handle it.
    return null
  }
}

