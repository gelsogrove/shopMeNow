/**
 * WhatsApp Message Formatter Utilities (Scheduler)
 *
 * NOTE: Keep in sync with apps/backend/src/utils/whatsapp-formatter.ts
 */

const MARKDOWN_HINT_REGEX = /(\*\*[^*]+\*\*|~~[^~]+~~|\[[^\]]+\]\([^\)]+\)|<img\s+src=|^#{1,6}\s+|^\s*-\s+|`[^`]+`)/m

export function shouldFormatToWhatsApp(text: string): boolean {
  if (!text) return false
  return MARKDOWN_HINT_REGEX.test(text)
}

export function markdownToWhatsApp(text: string): string {
  if (!text) return ""

  let formatted = text

  // 0. HTML IMG tags: <img src="URL" alt="NAME" /> → 📷 [NAME]
  // WhatsApp does NOT support HTML - convert images to text placeholder
  formatted = formatted.replace(
    /<img\s+src="([^"]+)"\s+alt="([^"]*)"\s*\/>/g,
    "📷 [$2]"
  )

  // 1. Bold: **text** → *text* (use placeholder to avoid italic conversion)
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "⚡BOLD⚡$1⚡BOLD⚡")

  // 2. Italic: *text* → _text_
  formatted = formatted.replace(/\*([^*]+)\*/g, "_$1_")

  // 3. Replace bold placeholders with actual WhatsApp bold
  formatted = formatted.replace(/⚡BOLD⚡([^⚡]+)⚡BOLD⚡/g, "*$1*")

  // 4. Strikethrough: ~~text~~ → ~text~
  formatted = formatted.replace(/~~([^~]+)~~/g, "~$1~")

  // 5. Code: `code` → ```code```
  formatted = formatted.replace(/`([^`]+)`/g, "```$1```")

  // 6. Links: [text](url) → text: url
  formatted = formatted.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, "$1: $2")

  // 7. Lists: - item → • item
  formatted = formatted.replace(/^[\s]*-[\s]+/gm, "• ")

  // 8. Headings: # Title → *Title*
  formatted = formatted.replace(/^#{1,6}\s+(.+)$/gm, "*$1*")

  return formatted.trim()
}

export function formatForWhatsApp(text: string): string {
  return shouldFormatToWhatsApp(text) ? markdownToWhatsApp(text) : text
}
