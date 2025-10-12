/**
 * WhatsApp Message Formatter Utilities
 * 
 * Single Responsibility: Convert between Markdown and WhatsApp formatting
 * 
 * WhatsApp Format Rules:
 * - Bold: *text*
 * - Italic: _text_
 * - Strikethrough: ~text~
 * - Code: ```text```
 * - Lists: • item
 * 
 * Markdown Format Rules:
 * - Bold: **text**
 * - Italic: *text*
 * - Strikethrough: ~~text~~
 * - Code: `text`
 * - Lists: - item
 */

/**
 * Convert Markdown format to WhatsApp format
 * Used when SENDING messages (outbound)
 * 
 * @param text - Text in Markdown format
 * @returns Text in WhatsApp format
 * 
 * @example
 * markdownToWhatsApp('**Bold** *italic*')
 * // Returns: '*Bold* _italic_'
 */
export function markdownToWhatsApp(text: string): string {
  if (!text) return ''
  
  let formatted = text
  
  // 1. Bold: **text** → *text*
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '*$1*')
  
  // 2. Italic: *text* → _text_ (negative lookbehind/lookahead per evitare bold)
  formatted = formatted.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '_$1_')
  
  // 3. Strikethrough: ~~text~~ → ~text~
  formatted = formatted.replace(/~~([^~]+)~~/g, '~$1~')
  
  // 4. Code: `code` → ```code```
  formatted = formatted.replace(/`([^`]+)`/g, '```$1```')
  
  // 5. Links: [text](url) → text: url
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2')
  
  // 6. Lists: - item → • item
  formatted = formatted.replace(/^[\s]*-[\s]+/gm, '• ')
  
  // 7. Headings: # Title → *Title*
  formatted = formatted.replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
  
  return formatted.trim()
}

/**
 * Convert WhatsApp format to Markdown format
 * Used when RECEIVING messages (inbound)
 * 
 * @param text - Text in WhatsApp format
 * @returns Text in Markdown format
 * 
 * @example
 * whatsAppToMarkdown('*Bold* _italic_')
 * // Returns: '**Bold** *italic*'
 */
export function whatsAppToMarkdown(text: string): string {
  if (!text) return ''
  
  let formatted = text
  
  // 1. Bold: *text* → **text**
  formatted = formatted.replace(/\*([^*]+)\*/g, '**$1**')
  
  // 2. Italic: _text_ → *text*
  formatted = formatted.replace(/_([^_]+)_/g, '*$1*')
  
  // 3. Strikethrough: ~text~ → ~~text~~
  formatted = formatted.replace(/~([^~]+)~/g, '~~$1~~')
  
  // 4. Code: ```code``` → `code`
  formatted = formatted.replace(/```([^`]+)```/g, '`$1`')
  
  // 5. Lists: • item → - item
  formatted = formatted.replace(/^[\s]*•[\s]+/gm, '- ')
  
  return formatted.trim()
}
