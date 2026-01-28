/**
 * WhatsApp Interactive Messages Converter
 * 
 * Converte automaticamente:
 * - Liste numerate (1-3 items) → Reply Buttons
 * - Liste numerate (4-10 items) → List Messages
 * - Cloudinary image URLs → Media Messages
 * - Cart/Order links → CTA URL Buttons
 * 
 * LOGIC: "la logica e' nei test" - vedi whatsapp-interactive-converter.spec.ts
 */

export interface WhatsAppTextMessage {
  type: 'text'
  text: {
    body: string
  }
}

export interface WhatsAppImageMessage {
  type: 'image'
  image: {
    link: string
    caption?: string
  }
}

export interface WhatsAppButtonMessage {
  type: 'interactive'
  interactive: {
    type: 'button'
    body: {
      text: string
    }
    action: {
      buttons: Array<{
        type: 'reply'
        reply: {
          id: string
          title: string
        }
      }>
    }
  }
}

export interface WhatsAppListMessage {
  type: 'interactive'
  interactive: {
    type: 'list'
    body: {
      text: string
    }
    action: {
      button: string
      sections: Array<{
        title?: string
        rows: Array<{
          id: string
          title: string
          description?: string
        }>
      }>
    }
  }
}

export interface WhatsAppCTAMessage {
  type: 'interactive'
  interactive: {
    type: 'cta_url'
    body: {
      text: string
    }
    action: {
      name: 'cta_url'
      parameters: {
        display_text: string
        url: string
      }
    }
  }
}

export type WhatsAppMessage =
  | WhatsAppTextMessage
  | WhatsAppImageMessage
  | WhatsAppButtonMessage
  | WhatsAppListMessage
  | WhatsAppCTAMessage

export class WhatsAppInteractiveConverter {
  // Regex patterns
  private readonly NUMBERED_LIST_REGEX = /^(\d+)[.)]\s+(.+)$/gm
  private readonly CLOUDINARY_REGEX = /https:\/\/res\.cloudinary\.com\/[^\s]+\.(jpg|jpeg|png|gif|webp)/gi
  private readonly CART_LINK_REGEX = /https:\/\/[^\s]+\/cart\?token=[^\s]+/i
  private readonly ORDER_LINK_REGEX = /https:\/\/[^\s]+\/orders-public\/[^\s]+\?token=[^\s]+/i
  private readonly SECTION_HEADER_REGEX = /^##\s+(.+)$/gm

  /**
   * Converte testo LLM in uno o più messaggi WhatsApp
   */
  convert(text: string): WhatsAppMessage | WhatsAppMessage[] {
    if (!text || text.trim() === '') {
      return { type: 'text', text: { body: '' } }
    }

    // Priority 1: CTA URL Button (cart/order links)
    const ctaMessage = this.extractCTAButton(text)
    if (ctaMessage) return ctaMessage

    // Priority 2: Interactive Buttons/Lists (numbered lists)
    const interactiveMessage = this.extractInteractiveMessage(text)
    const imageMessages = this.extractImageMessages(text)

    // If both interactive and images: return array [interactive, ...images]
    if (interactiveMessage && imageMessages.length > 0) {
      return [interactiveMessage, ...imageMessages]
    }

    // Priority 3: Only interactive
    if (interactiveMessage) return interactiveMessage

    // Priority 4: Only images
    if (imageMessages.length > 0) {
      return imageMessages.length === 1 ? imageMessages[0] : imageMessages
    }

    // Default: plain text
    return { type: 'text', text: { body: text } }
  }

  /**
   * Estrae CTA URL Button per cart/order links
   */
  private extractCTAButton(text: string): WhatsAppCTAMessage | null {
    let url: string | null = null
    let displayText = 'Apri'

    // Check for cart link
    const cartMatch = text.match(this.CART_LINK_REGEX)
    if (cartMatch) {
      url = cartMatch[0]
      displayText = 'Vedi Carrello'
    }

    // Check for order link (priority over cart)
    const orderMatch = text.match(this.ORDER_LINK_REGEX)
    if (orderMatch) {
      url = orderMatch[0]
      displayText = 'Traccia Ordine'
    }

    if (!url) return null

    // Remove URL from body text
    const bodyText = text.replace(url, '').trim()

    return {
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text: bodyText || 'Clicca il pulsante qui sotto:' },
        action: {
          name: 'cta_url',
          parameters: {
            display_text: displayText,
            url: url,
          },
        },
      },
    }
  }

  /**
   * Estrae Reply Buttons (1-3 items) o List Message (4-10 items)
   */
  private extractInteractiveMessage(text: string): WhatsAppButtonMessage | WhatsAppListMessage | null {
    const items = this.extractNumberedList(text)
    if (items.length === 0) return null

    // Remove numbered list from body text
    const bodyText = text.replace(this.NUMBERED_LIST_REGEX, '').trim()

    // 1-3 items → Reply Buttons
    if (items.length <= 3) {
      return {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText || 'Scegli un\'opzione:' },
          action: {
            buttons: items.slice(0, 3).map((item, index) => ({
              type: 'reply',
              reply: {
                id: `option_${index + 1}`,
                title: this.truncateButtonTitle(item),
              },
            })),
          },
        },
      }
    }

    // 4-10 items → List Message
    const sections = this.groupItemsBySections(text, items)
    const limitedItems = items.slice(0, 10) // Max 10 items

    return {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: {
          text: bodyText || 'Scegli dalla lista:' + (items.length > 10 ? ' (primi 10 risultati)' : ''),
        },
        action: {
          button: 'Scegli',
          sections: sections.length > 0 ? sections : [
            {
              rows: limitedItems.map((item, index) => ({
                id: `option_${index + 1}`,
                title: this.truncateButtonTitle(item),
                description: '',
              })),
            },
          ],
        },
      },
    }
  }

  /**
   * Estrae lista numerata dal testo
   */
  private extractNumberedList(text: string): string[] {
    const matches = Array.from(text.matchAll(this.NUMBERED_LIST_REGEX))
    return matches.map(match => match[2].trim())
  }

  /**
   * Raggruppa items per sezioni (se headers ## presenti)
   */
  private groupItemsBySections(text: string, items: string[]): Array<{
    title?: string
    rows: Array<{ id: string; title: string; description: string }>
  }> {
    const lines = text.split('\n')
    const sections: Array<{
      title?: string
      rows: Array<{ id: string; title: string; description: string }>
    }> = []
    
    let currentSection: string | undefined = undefined
    let itemIndex = 0

    for (const line of lines) {
      // Check for section header
      const headerMatch = line.match(/^##\s+(.+)$/)
      if (headerMatch) {
        currentSection = headerMatch[1].trim()
        continue
      }

      // Check for numbered item
      const itemMatch = line.match(/^(\d+)[.)]\s+(.+)$/)
      if (itemMatch && itemIndex < items.length) {
        const sectionIndex = sections.findIndex(s => s.title === currentSection)
        
        if (sectionIndex === -1) {
          sections.push({
            title: currentSection,
            rows: [{
              id: `option_${itemIndex + 1}`,
              title: this.truncateButtonTitle(items[itemIndex]),
              description: '',
            }],
          })
        } else {
          sections[sectionIndex].rows.push({
            id: `option_${itemIndex + 1}`,
            title: this.truncateButtonTitle(items[itemIndex]),
            description: '',
          })
        }
        
        itemIndex++
      }
    }

    return sections.length > 0 && sections.some(s => s.title) ? sections : []
  }

  /**
   * Estrae messaggi immagine Cloudinary
   */
  private extractImageMessages(text: string): WhatsAppImageMessage[] {
    const matches = Array.from(text.matchAll(this.CLOUDINARY_REGEX))
    if (matches.length === 0) return []

    return matches.map(match => {
      const imageUrl = match[0]
      // Extract caption (text before/after image, without emoji placeholder)
      let caption = text
        .replace(imageUrl, '')
        .replace(/📷\s*\[([^\]]+)\]/g, '$1') // Remove 📷 [Name] but keep Name
        .trim()

      return {
        type: 'image',
        image: {
          link: imageUrl,
          caption: caption || undefined,
        },
      }
    })
  }

  /**
   * Tronca titolo bottone a max 20 caratteri
   */
  private truncateButtonTitle(title: string): string {
    const MAX_LENGTH = 20
    if (title.length <= MAX_LENGTH) return title

    // Try to truncate at word boundary
    const truncated = title.substring(0, MAX_LENGTH)
    const lastSpace = truncated.lastIndexOf(' ')
    
    return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated
  }
}
