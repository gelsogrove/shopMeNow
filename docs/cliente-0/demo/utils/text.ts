// Text utility helpers shared across multiple modules.

/** Normalizes text for case-insensitive, accent-insensitive comparison. */
export function normalizeForRegression(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
