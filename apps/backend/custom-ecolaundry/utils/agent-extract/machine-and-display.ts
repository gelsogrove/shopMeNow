// approved-by-andrea: REFACTOR ONLY — extracted from utils/agent-extract.ts
// as part of the iron rule #3 split. Zero behavioural change. Iron rule #5
// not applicable (depth-2 file).
//
// Iron rule #4 alignment: mutates state.machineType, state.machineNumber,
// state.displayState, state.displayLabel, state.displayHistory. None of
// these are in rule #4's protected set. Moved verbatim from source.
//
// Step 6 of autoExtractFacts. The machine-number snapshot
// (machineNumberWasAlreadySet) MUST be captured BEFORE the number extraction
// block; the display block then reads it to distinguish "bare digit answer
// to number ask" from "bare digit display code on a later turn". Keeping
// machine + display in the same module preserves this coupling.

import type { AgentRuntime } from '../../models/index.js'
import {
  extractDisplayState,
  extractDisplayLabel,
  normalizeMachineType,
} from '../intent.js'
import { REPORT_VERB_RE } from '../patterns.js'
import { shouldAcceptAsDisplay, isDisplayContextCode } from './helpers.js'

export function extractMachineAndDisplay(ar: AgentRuntime, trimmed: string): void {
  const state = ar.state

  // 6.1 — Machine type. F55: narrow FAQ-context override (first-set-wins
  // by default; allow flip only when no active flow and last intent was FAQ).
  const newType = normalizeMachineType(trimmed)
  const inActiveFlow = state.pendingFlow || state.activeFlowId
  const cameFromFaq = state.lastResolvedIntent === 'faq'
  if (state.machineType && newType && newType !== state.machineType && !inActiveFlow && cameFromFaq) {
    state.machineType = newType
  } else if (!state.machineType && newType) {
    state.machineType = newType
  }

  // 6.2 — Machine number. Snapshot the BEFORE state for the display block
  // below: a digit reply to the number ask must NOT then be reinterpreted
  // as the display code by isDisplayContextCode.
  const machineNumberWasAlreadySet = !!state.machineNumber
  if (!state.machineNumber) {
    if (state.location) {
      const whole = trimmed.match(/^\s*(?:la\s+|n\.?\s*|num(?:ero)?\s*[:.#]?\s*)?(\d{1,3})\s*$/i)
      if (whole) state.machineNumber = whole[1]
    }
    if (!state.machineNumber) {
      const inline = trimmed.match(/\b(?:lavadora|secadora|lavatrice|asciugatrice|washer|dryer|rentadora|assecadora)\s+(?:n[º°.]?\s*|num(?:ero)?\s*[:.#]?\s*)?(\d{1,3})\b/i)
      if (inline) state.machineNumber = inline[1]
    }
    if (!state.machineNumber && state.machineType) {
      const fuzzyNum = trimmed.match(/\b(\d{1,3})\b/)
      if (fuzzyNum) state.machineNumber = fuzzyNum[1]
    }
  }

  // 6.3 — Display state. F27 — every assignment also pushes the customer-
  // facing label onto state.displayHistory for the operator handover.
  const recordDisplay = (canonical: string, label: string): void => {
    state.displayState = canonical
    state.displayLabel = label
    if (label && state.displayHistory[state.displayHistory.length - 1] !== label) {
      state.displayHistory.push(label)
    }
  }

  const newDisplay = extractDisplayState(trimmed)
  const messageMentionsType = !!normalizeMachineType(trimmed)
  const messageReportsDisplay = REPORT_VERB_RE.test(trimmed)
  const canCaptureDisplay =
    !!state.machineType ||
    !!state.displayState ||
    !!state.pendingFlow ||
    messageMentionsType ||
    messageReportsDisplay
  if (newDisplay && newDisplay !== state.displayState && canCaptureDisplay) {
    recordDisplay(newDisplay, extractDisplayLabel(trimmed, newDisplay))
  } else if (!state.displayState && state.machineType && shouldAcceptAsDisplay(ar.runtime, trimmed)) {
    const captured = trimmed.replace(/[.,!?¿¡:;"'()]/g, '').trim().toUpperCase()
    recordDisplay(captured, captured)
  } else if (
    !state.displayState &&
    state.location &&
    state.machineType &&
    machineNumberWasAlreadySet &&
    isDisplayContextCode(ar.runtime, trimmed)
  ) {
    const captured = trimmed.replace(/[.,!?¿¡:;"'()]/g, '').trim().toUpperCase()
    recordDisplay(captured, captured)
  }
}
