// Machine-related tool handlers.
//   - set_machine_facts: machineType (washer/dryer) + machineNumber
//   - set_payment_facts: paymentCompleted + paymentMethod
//   - set_display_state: displayState (normalised through extractDisplayState)

import {
  asBoolean,
  asEnum,
  asTrimmedString,
  rejectInvalidArg,
} from './arg-coercion.js'
import type { ToolHandler } from './types.js'

export const setMachineFacts: ToolHandler = async (ar, args) => {
  const machineType = asEnum(args.machineType, ['washer', 'dryer'] as const)
  const machineNumber = asTrimmedString(args.machineNumber)
  if (args.machineType !== undefined && machineType === null) {
    return rejectInvalidArg(
      'set_machine_facts',
      'machineType',
      args.machineType,
      '"washer" or "dryer"',
    )
  }
  if (args.machineNumber !== undefined && machineNumber === null) {
    return rejectInvalidArg(
      'set_machine_facts',
      'machineNumber',
      args.machineNumber,
      'a non-empty string',
    )
  }
  if (machineType) ar.state.machineType = machineType
  if (machineNumber) ar.state.machineNumber = machineNumber
  return {
    ok: true,
    data: {
      machineType: ar.state.machineType,
      machineNumber: ar.state.machineNumber,
    },
  }
}

export const setPaymentFacts: ToolHandler = async (ar, args) => {
  const paymentCompleted = asBoolean(args.paymentCompleted)
  const paymentMethod = asTrimmedString(args.paymentMethod)
  if (args.paymentCompleted !== undefined && paymentCompleted === null) {
    return rejectInvalidArg(
      'set_payment_facts',
      'paymentCompleted',
      args.paymentCompleted,
      'a boolean',
    )
  }
  if (args.paymentMethod !== undefined && paymentMethod === null) {
    return rejectInvalidArg(
      'set_payment_facts',
      'paymentMethod',
      args.paymentMethod,
      'a non-empty string',
    )
  }
  if (paymentCompleted !== null) ar.state.paymentCompleted = paymentCompleted
  if (paymentMethod) ar.state.paymentMethod = paymentMethod
  return {
    ok: true,
    data: {
      paymentCompleted: ar.state.paymentCompleted,
      paymentMethod: ar.state.paymentMethod,
    },
  }
}

export const setDisplayState: ToolHandler = async (ar, args) => {
  const raw = asTrimmedString(args.displayState)
  if (!raw) {
    return rejectInvalidArg(
      'set_display_state',
      'displayState',
      args.displayState,
      'a non-empty string',
    )
  }
  // Normalise through extractDisplayState so the LLM cannot bypass our
  // canonical token mapping (e.g. it must not record '001' when the
  // canonical token is 'C001' — caso 15).
  const { extractDisplayState } = await import('../intent.js')
  const canonical = extractDisplayState(raw) || raw
  ar.state.displayState = canonical
  return { ok: true, data: { displayState: canonical } }
}
