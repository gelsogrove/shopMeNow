/**
 * Phone utilities
 */
export function normalizePhoneNumber(phone?: string | null): string | null {
  if (!phone) return null

  let digits = phone.replace(/\D+/g, "")
  if (!digits) return null

  // Strip international dialing prefixes (00, +) and country codes like 39
  if (digits.startsWith("00")) {
    digits = digits.replace(/^00+/, "")
  }
  if (digits.startsWith("39") && digits.length > 10) {
    digits = digits.substring(2)
  }

  // Trim extra leading zeros for safety
  digits = digits.replace(/^0+/, "")

  return digits || null
}

/**
 * Build a set of comparable phone variants for lookups.
 * Returns unique values in priority order:
 * 1) trimmed original if present
 * 2) +digits
 * 3) digits only
 */
export function buildPhoneVariants(phone?: string | null): string[] {
  if (!phone) return []
  const variants = new Set<string>()
  const trimmed = phone.trim()
  if (trimmed) variants.add(trimmed)

  const digits = trimmed.replace(/\D+/g, "")
  if (digits) {
    variants.add(`+${digits}`)
    variants.add(digits)
  }

  return Array.from(variants)
}
