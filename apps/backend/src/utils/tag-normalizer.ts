export function normalizeTags(input?: string[] | string | null): string[] {
  if (!input) return []

  const rawTags = Array.isArray(input) ? input : input.split(",")

  const cleaned = rawTags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.toLowerCase())

  return Array.from(new Set(cleaned))
}
