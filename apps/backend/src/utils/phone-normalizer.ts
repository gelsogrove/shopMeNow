// Centralized phone normalizer
export function normalizePhone(phone: string): string {
  if (!phone) return ""
  // Remove all non-digit chars, keep leading + if present
  let normalized = phone.trim().replace(/\s+/g, "")
  if (normalized.startsWith("+")) {
    normalized = "+" + normalized.slice(1).replace(/\D/g, "")
  } else {
    normalized = normalized.replace(/\D/g, "")
  }
  // Remove leading 00 (international prefix)
  if (normalized.startsWith("00")) {
    normalized = "+" + normalized.slice(2)
  }
  // Remove leading +39 for Italian numbers
  if (normalized.startsWith("+39")) {
    normalized = normalized.replace("+39", "")
  }
  // Remove leading zeros
  normalized = normalized.replace(/^0+/, "")
  return normalized
}
