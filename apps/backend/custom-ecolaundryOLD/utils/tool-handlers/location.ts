// Location / address tool handlers.
//   - set_location:        record the laundry pueblo (resolved against catalogue)
//   - set_location_street: record the specific street (Mataró disambiguation)

import { asTrimmedString, rejectInvalidArg } from './arg-coercion.js'
import type { ToolHandler } from './types.js'

export const setLocation: ToolHandler = async (ar, args) => {
  const v = asTrimmedString(args.location)
  if (!v) {
    return rejectInvalidArg('set_location', 'location', args.location, 'a non-empty string')
  }
  // Sentinel placeholders the LLM sometimes echoes back from the prompt.
  if (/^\(.*\)$/.test(v) || /^unknown$/i.test(v)) {
    return { ok: false, error: 'location placeholder rejected' }
  }
  const { resolveKnownLocation } = await import('../message-parsing.js')
  const known = resolveKnownLocation(v)
  if (!known) {
    ar.state.locationClarificationCount = (ar.state.locationClarificationCount || 0) + 1
    return { ok: false, error: `unknown location: ${v}` }
  }
  ar.state.location = known
  ar.state.locationClarificationCount = 0
  return { ok: true, data: { location: known } }
}

export const setLocationStreet: ToolHandler = async (ar, args) => {
  const v = asTrimmedString(args.street)
  if (!v) {
    return rejectInvalidArg('set_location_street', 'street', args.street, 'a non-empty string')
  }
  ar.state.locationStreet = v
  ar.state.locationStreetRequested = true
  return { ok: true, data: { street: v } }
}
