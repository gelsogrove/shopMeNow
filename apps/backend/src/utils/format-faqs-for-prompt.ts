/**
 * Formats FAQs into the text block injected into the chatbot prompt
 * ({{faqs}} variable).
 *
 * FAQs are grouped by their optional category so the LLM can navigate the
 * knowledge base by topic:
 * - FAQs without a category come first, as plain Q/A pairs (no invented
 *   "General" label — category names are tenant data, never hardcoded).
 * - Categorized FAQs follow, one block per category, preserving the order
 *   in which categories first appear in the input (which is already sorted
 *   by the FAQ `order` field upstream).
 */
export function formatFaqsForPrompt(
  faqs: Array<{ question: string; answer: string; category?: string | null }>
): string {
  const toQA = (faq: { question: string; answer: string }): string =>
    `Q: ${faq.question}\nA: ${faq.answer}`

  const uncategorized = faqs.filter((faq) => !faq.category?.trim())
  const categorized = faqs.filter((faq) => faq.category?.trim())

  const blocks: string[] = []

  if (uncategorized.length > 0) {
    blocks.push(uncategorized.map(toQA).join("\n\n"))
  }

  const byCategory = new Map<string, string[]>()
  for (const faq of categorized) {
    const category = (faq.category as string).trim()
    if (!byCategory.has(category)) {
      byCategory.set(category, [])
    }
    byCategory.get(category)!.push(toQA(faq))
  }

  for (const [category, entries] of byCategory) {
    blocks.push(`[${category}]\n${entries.join("\n\n")}`)
  }

  return blocks.join("\n\n")
}
