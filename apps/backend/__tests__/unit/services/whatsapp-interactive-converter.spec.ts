/**
 * WhatsApp Interactive Messages Converter Tests
 * 
 * Testa conversione automatica:
 * - ✅ Liste numerate (1. 2. 3.) → Reply Buttons (max 3) o List Message (4-10 items)
 * - ✅ Immagini Cloudinary → WhatsApp Media Messages
 * - ✅ Link carrello/ordini → CTA URL Buttons
 * 
 * RULE: "la logica e' nei test" - i test descrivono il comportamento atteso
 */

import { WhatsAppInteractiveConverter } from '../../../src/services/whatsapp-interactive-converter'

describe('WhatsApp Interactive Messages Converter', () => {
  let converter: WhatsAppInteractiveConverter

  beforeEach(() => {
    converter = new WhatsAppInteractiveConverter()
  })

  describe('Numbered Lists → Reply Buttons (1-3 items)', () => {
    it('should convert 2-item numbered list to Reply Buttons', () => {
      // SCENARIO: LLM risponde con 2 opzioni numerate
      // INPUT: "Scegli categoria:\n1. Formaggi\n2. Salumi"
      // OUTPUT: WhatsApp Reply Buttons message (type: interactive)
      
      const input = `Scegli una categoria:
1. Formaggi
2. Salumi`

      const result = converter.convert(input)

      expect(result.type).toBe('interactive')
      expect(result.interactive.type).toBe('button')
      expect(result.interactive.body.text).toBe('Scegli una categoria:')
      expect(result.interactive.action.buttons).toHaveLength(2)
      expect(result.interactive.action.buttons[0]).toEqual({
        type: 'reply',
        reply: {
          id: 'option_1',
          title: 'Formaggi'
        }
      })
      expect(result.interactive.action.buttons[1]).toEqual({
        type: 'reply',
        reply: {
          id: 'option_2',
          title: 'Salumi'
        }
      })
    })

    it('should convert 3-item list to Reply Buttons (max limit)', () => {
      // SCENARIO: LLM risponde con 3 opzioni (limite massimo bottoni)
      // RULE: WhatsApp Reply Buttons max = 3
      
      const input = `Cosa vuoi fare?
1. Vedere prodotti
2. Vedere offerte
3. Contattare assistenza`

      const result = converter.convert(input)

      expect(result.type).toBe('interactive')
      expect(result.interactive.action.buttons).toHaveLength(3)
      // Title truncated to 20 chars max
      expect(result.interactive.action.buttons[2].reply.title).toBe('Contattare')
    })

    it('should handle numbered lists with extra text', () => {
      // SCENARIO: Lista con testo aggiuntivo dopo numero
      // INPUT: "1. Parmigiano Reggiano - DOP 24 mesi - €18.50"
      // EXPECTED: Estrae solo il testo rilevante (troncato se > 20 char)
      
      const input = `Prodotti disponibili:
1. Parmigiano Reggiano - DOP 24 mesi - €18.50
2. Grana Padano - DOP - €15.00
3. Pecorino Romano - DOP - €12.00`

      const result = converter.convert(input)

      expect(result.interactive.action.buttons).toHaveLength(3)
      // WhatsApp button title max = 20 chars
      expect(result.interactive.action.buttons[0].reply.title.length).toBeLessThanOrEqual(20)
      // Should contain product name
      expect(result.interactive.action.buttons[0].reply.title).toContain('Parmigiano')
    })

    it('should preserve text before and after numbered list', () => {
      // SCENARIO: Messaggio complesso con testo prima/dopo lista
      // RULE: Body contiene tutto tranne liste numerate
      
      const input = `Ecco i formaggi disponibili!

Scegli uno:
1. Parmigiano
2. Grana

Oppure scrivi "altro" per vedere tutto.`

      const result = converter.convert(input)

      expect(result.interactive.body.text).toContain('Ecco i formaggi disponibili!')
      expect(result.interactive.body.text).toContain('Oppure scrivi "altro"')
      // Numbered list should be removed from body
      expect(result.interactive.body.text).not.toMatch(/^\d+\.\s/m)
    })
  })

  describe('Numbered Lists → List Messages (4-10 items)', () => {
    it('should convert 4-item list to List Message', () => {
      // SCENARIO: LLM risponde con 4+ opzioni (troppi per bottoni)
      // RULE: Reply Buttons max = 3, se > 3 usa List Message
      
      const input = `Categorie disponibili:
1. Formaggi
2. Salumi
3. Pasta
4. Vino`

      const result = converter.convert(input)

      expect(result.type).toBe('interactive')
      expect(result.interactive.type).toBe('list')
      expect(result.interactive.action.button).toBe('Scegli') // Default button text
      expect(result.interactive.action.sections).toHaveLength(1)
      expect(result.interactive.action.sections[0].rows).toHaveLength(4)
      expect(result.interactive.action.sections[0].rows[0]).toEqual({
        id: 'option_1',
        title: 'Formaggi',
        description: '' // Optional
      })
    })

    it('should handle 10-item list (max limit)', () => {
      // SCENARIO: Lista con 10 elementi (limite max WhatsApp)
      // RULE: WhatsApp List Message max = 10 rows
      
      const input = `Prodotti:
1. Item 1
2. Item 2
3. Item 3
4. Item 4
5. Item 5
6. Item 6
7. Item 7
8. Item 8
9. Item 9
10. Item 10`

      const result = converter.convert(input)

      expect(result.interactive.action.sections[0].rows).toHaveLength(10)
    })

    it('should truncate lists with more than 10 items', () => {
      // SCENARIO: LLM genera lista troppo lunga (> 10 elementi)
      // RULE: Tronca a 10 items + messaggio warning
      
      const input = Array.from({ length: 15 }, (_, i) => `${i + 1}. Item ${i + 1}`).join('\n')

      const result = converter.convert(input)

      expect(result.interactive.action.sections[0].rows).toHaveLength(10)
      // Body should contain warning
      expect(result.interactive.body.text).toContain('(primi 10 risultati)')
    })

    it('should group list items by section if headers present', () => {
      // SCENARIO: Lista con headers/sezioni (es. "## Formaggi")
      // RULE: Crea sezioni multiple se trova headers Markdown
      
      const input = `Prodotti per categoria:

## Formaggi
1. Parmigiano
2. Grana

## Salumi
3. Prosciutto
4. Salame`

      const result = converter.convert(input)

      expect(result.interactive.action.sections).toHaveLength(2)
      expect(result.interactive.action.sections[0].title).toBe('Formaggi')
      expect(result.interactive.action.sections[0].rows).toHaveLength(2)
      expect(result.interactive.action.sections[1].title).toBe('Salumi')
      expect(result.interactive.action.sections[1].rows).toHaveLength(2)
    })
  })

  describe('Cloudinary Images → WhatsApp Media Messages', () => {
    it('should extract Cloudinary image URL and create media message', () => {
      // SCENARIO: LLM risponde con immagine Cloudinary
      // INPUT: "Parmigiano Reggiano\nhttps://res.cloudinary.com/.../parmigiano.jpg"
      // OUTPUT: WhatsApp Media Message (type: image)
      
      const input = `Parmigiano Reggiano - DOP 24 mesi

https://res.cloudinary.com/dpagtnf1i/image/upload/v123/products/parmigiano.jpg

Prezzo: €18.50 / kg`

      const result = converter.convert(input)

      expect(result.type).toBe('image')
      expect(result.image.link).toBe('https://res.cloudinary.com/dpagtnf1i/image/upload/v123/products/parmigiano.jpg')
      // Caption may have extra newlines from URL removal
      expect(result.image.caption?.trim()).toContain('Parmigiano Reggiano - DOP 24 mesi')
      expect(result.image.caption?.trim()).toContain('Prezzo: €18.50 / kg')
    })

    it('should handle multiple images (send separately)', () => {
      // SCENARIO: LLM risponde con 2+ immagini
      // RULE: WhatsApp non supporta multiple images in un messaggio
      // EXPECTED: Array di messaggi separati
      
      const input = `Ecco i formaggi:

Parmigiano:
https://res.cloudinary.com/dpagtnf1i/image/upload/v123/parmigiano.jpg

Grana:
https://res.cloudinary.com/dpagtnf1i/image/upload/v123/grana.jpg`

      const result = converter.convert(input)

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)
      expect(result[0].type).toBe('image')
      expect(result[1].type).toBe('image')
    })

    it('should NOT convert non-Cloudinary image URLs', () => {
      // SCENARIO: LLM include link immagine esterna (non Cloudinary)
      // RULE: Solo Cloudinary URLs vengono convertite in media
      // EXPECTED: Messaggio text con URL normale
      
      const input = `Vedi qui: https://example.com/image.jpg`

      const result = converter.convert(input)

      expect(result.type).toBe('text')
      expect(result.text.body).toContain('https://example.com/image.jpg')
    })

    it('should handle emoji placeholder images', () => {
      // SCENARIO: Messaggio contiene 📷 [Product Name] (da whatsapp-formatter)
      // RULE: Se c'è Cloudinary URL, usa quella; altrimenti ignora emoji
      
      const input = `📷 [Parmigiano Reggiano]
https://res.cloudinary.com/dpagtnf1i/image/upload/v123/parmigiano.jpg
Prezzo: €18.50`

      const result = converter.convert(input)

      expect(result.type).toBe('image')
      // Emoji placeholder should be removed from caption
      expect(result.image.caption).not.toContain('📷')
      expect(result.image.caption).toContain('Parmigiano Reggiano')
    })
  })

  describe('CTA URL Buttons (Cart/Orders)', () => {
    it('should detect cart link and create CTA button', () => {
      // SCENARIO: LLM risponde con link carrello
      // INPUT: "Vedi carrello: https://echatbot.ai/cart?token=xxx"
      // OUTPUT: WhatsApp CTA Button message
      
      const input = `Il tuo carrello contiene 3 prodotti.

Clicca qui per vedere i dettagli:
https://echatbot.ai/cart?token=abc123xyz`

      const result = converter.convert(input)

      expect(result.type).toBe('interactive')
      expect(result.interactive.type).toBe('cta_url')
      expect(result.interactive.action.name).toBe('cta_url')
      expect(result.interactive.action.parameters.display_text).toBe('Vedi Carrello')
      expect(result.interactive.action.parameters.url).toBe('https://echatbot.ai/cart?token=abc123xyz')
      // Body text may have extra newlines from URL removal
      expect(result.interactive.body.text.trim()).toContain('Il tuo carrello contiene 3 prodotti.')
    })

    it('should detect order link and create CTA button', () => {
      // SCENARIO: LLM risponde con link ordine
      // INPUT: "Ordine ORD-123: https://echatbot.ai/orders-public/ORD-123?token=xxx"
      
      const input = `Il tuo ordine ORD-123 è stato creato!

Traccia stato ordine:
https://echatbot.ai/orders-public/ORD-123?token=xyz789`

      const result = converter.convert(input)

      expect(result.type).toBe('interactive')
      expect(result.interactive.type).toBe('cta_url')
      expect(result.interactive.action.parameters.display_text).toBe('Traccia Ordine')
      expect(result.interactive.action.parameters.url).toContain('orders-public/ORD-123')
    })

    it('should handle multiple links (prioritize cart/order)', () => {
      // SCENARIO: Messaggio con link misti (cart + external)
      // RULE: Priorità a cart/order links, altri link ignorati
      
      const input = `Puoi vedere:
- Carrello: https://echatbot.ai/cart?token=abc
- Sito: https://example.com

Cosa vuoi fare?`

      const result = converter.convert(input)

      expect(result.type).toBe('interactive')
      expect(result.interactive.action.parameters.url).toContain('echatbot.ai/cart')
      // Generic link should be in body text
      expect(result.interactive.body.text).toContain('https://example.com')
    })

    it('should NOT create CTA for generic links', () => {
      // SCENARIO: Messaggio con link generico (non cart/order)
      // EXPECTED: Messaggio text normale (no CTA button)
      
      const input = `Visita il nostro sito: https://example.com`

      const result = converter.convert(input)

      expect(result.type).toBe('text')
      expect(result.text.body).toBe('Visita il nostro sito: https://example.com')
    })
  })

  describe('Combined Scenarios', () => {
    it('should prioritize interactive over media if both present', () => {
      // SCENARIO: Messaggio con lista numerata + immagine
      // RULE: Interactive (buttons/list) ha priorità, immagine diventa secondo messaggio
      
      const input = `Scegli formato:
1. 250g - €8.50
2. 500g - €15.00

https://res.cloudinary.com/dpagtnf1i/image/upload/v123/product.jpg`

      const result = converter.convert(input)

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)
      expect(result[0].type).toBe('interactive') // Buttons first
      expect(result[1].type).toBe('image') // Image second
    })

    it('should prioritize CTA button over reply buttons', () => {
      // SCENARIO: Messaggio con lista + link carrello
      // RULE: CTA URL button ha priorità (più importante per conversione)
      
      const input = `Aggiunti al carrello!

Cosa vuoi fare?
1. Continuare acquisti
2. Procedere al checkout

Vedi carrello: https://echatbot.ai/cart?token=abc`

      const result = converter.convert(input)

      expect(result.type).toBe('interactive')
      expect(result.interactive.type).toBe('cta_url') // CTA wins
      // Numbered list should be in body text
      expect(result.interactive.body.text).toContain('Continuare acquisti')
    })

    it('should handle plain text without any interactive elements', () => {
      // SCENARIO: LLM risponde con testo normale (no buttons, images, links)
      // EXPECTED: Standard text message
      
      const input = `Ciao! Come posso aiutarti oggi?`

      const result = converter.convert(input)

      expect(result.type).toBe('text')
      expect(result.text.body).toBe('Ciao! Come posso aiutarti oggi?')
    })
  })

  describe('Edge Cases & Validation', () => {
    it('should handle empty string', () => {
      const result = converter.convert('')
      expect(result.type).toBe('text')
      expect(result.text.body).toBe('')
    })

    it('should handle numbered list with invalid format', () => {
      // SCENARIO: Lista malformed (es. "1) Item" invece di "1. Item")
      // EXPECTED: Tenta parsing con regex flessibile
      
      const input = `Scegli:
1) Opzione A
2) Opzione B`

      const result = converter.convert(input)

      // Should still detect as list (flexible regex)
      expect(result.type).toBe('interactive')
      expect(result.interactive.action.buttons).toHaveLength(2)
    })

    it('should truncate button titles longer than 20 chars', () => {
      // SCENARIO: Item lista troppo lungo per bottone WhatsApp
      // RULE: WhatsApp button title max = 20 chars
      
      const input = `1. Questo è un titolo molto molto lungo che supera 20 caratteri`

      const result = converter.convert(input)

      expect(result.interactive.action.buttons[0].reply.title.length).toBeLessThanOrEqual(20)
      expect(result.interactive.action.buttons[0].reply.title).toBe('Questo è un titolo')
    })

    it('should handle malformed Cloudinary URLs', () => {
      // SCENARIO: URL Cloudinary incompleto/malformed
      // EXPECTED: Ignora e usa text message
      
      const input = `Immagine: https://res.cloudinary.com/incomplete`

      const result = converter.convert(input)

      expect(result.type).toBe('text')
      expect(result.text.body).toContain('https://res.cloudinary.com/incomplete')
    })
  })
})
