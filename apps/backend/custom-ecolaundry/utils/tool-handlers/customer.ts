// Customer-info tool handler — capture_customer_name. Validation is
// delegated to the shared `validateCustomerName` helper so the deterministic
// guards (e.g. guardCaso8AwaitName) and this LLM-driven path apply the same
// rules: reject confirmation words, numeric tokens, < 2 chars, etc.

import { validateCustomerName } from '../customer-name.js'
import { asTrimmedString, rejectInvalidArg } from './arg-coercion.js'
import type { ToolHandler } from './types.js'

export const captureCustomerName: ToolHandler = async (ar, args) => {
  const raw = asTrimmedString(args.name)
  if (!raw) {
    return rejectInvalidArg(
      'capture_customer_name',
      'name',
      args.name,
      'a non-empty string',
    )
  }
  const validation = validateCustomerName(raw)
  if (validation.valid === false) {
    return { ok: false, error: validation.reason }
  }
  ar.state.customerName = validation.name
  ar.state.customerNameRequested = false
  return { ok: true, data: { name: validation.name } }
}
