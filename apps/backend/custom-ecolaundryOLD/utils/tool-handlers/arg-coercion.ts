// Strict arg coercion helpers for tool-handlers. The LLM is "trusted but
// validated": these helpers reject anything that isn't the expected type
// and return null / the typed value. Callers convert null into a
// rejectInvalidArg() ToolResult with a human-readable error.

import type { ToolResult } from './types.js'
import { logger } from '../logger.js'

/**
 * Coerce an LLM-provided value to a trimmed non-empty string, or `null` if
 * the value is not a primitive scalar. Numbers / booleans are stringified
 * (LLMs occasionally emit `17` instead of `"17"`); objects, arrays, null
 * and undefined are rejected so a malicious payload like `{nested: "evil"}`
 * cannot slip through `String(v)` as `"[object Object]"`.
 */
export function asTrimmedString(value: unknown): string | null {
  if (typeof value === 'string') {
    const t = value.trim()
    return t || null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value === 'boolean') {
    return String(value)
  }
  return null
}

/** Strictly-typed boolean check; rejects truthy strings, numbers, etc. */
export function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

/** Returns `value` only when it equals one of `allowed`; null otherwise. */
export function asEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  if (typeof value !== 'string') return null
  return (allowed as readonly string[]).includes(value) ? (value as T) : null
}

/**
 * Log + return helper: surfaces validation rejects without flooding `info`.
 * Use when an LLM-supplied arg fails coercion / shape validation.
 */
export function rejectInvalidArg(
  tool: string,
  field: string,
  value: unknown,
  expected: string,
): ToolResult {
  logger.warn('Tool argument failed validation; rejecting', {
    tool,
    field,
    expected,
    receivedType: Array.isArray(value)
      ? 'array'
      : value === null
        ? 'null'
        : typeof value,
  })
  return { ok: false, error: `${field} must be ${expected}` }
}
