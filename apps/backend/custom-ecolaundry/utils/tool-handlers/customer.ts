// Customer-info tool handler — capture_customer_name. Validation is
// delegated to the shared `validateCustomerName` helper so the deterministic
// guards (e.g. guardDiscountCodeAwaitName) and this LLM-driven path apply the same
// rules: reject confirmation words, numeric tokens, < 2 chars, etc.
//
// F46 — pass the tenant discount-code prefix from settings so the validator
// also refuses code-shaped tokens as a name (real chat: customer typed
// "SAU2904266" when asked for their name).

import { validateCustomerName } from '../customer-name.js'
import { captureCustomerName as captureCustomerNameTransition } from '../state-transitions.js'
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
  const validation = validateCustomerName(raw, {
    discountCodePrefix: ar.runtime.settings.discountCodePrefix,
  })
  if (validation.valid === false) {
    return { ok: false, error: validation.reason }
  }
  captureCustomerNameTransition(ar, validation.name)
  return { ok: true, data: { name: validation.name } }
}
