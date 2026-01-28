/**
 * WhatsApp Formatter Tests
 * 
 * Tests HTML → WhatsApp text conversion
 * Critical for Feature 122: Product images must NOT be sent as HTML tags to WhatsApp
 */

import { markdownToWhatsApp, whatsAppToMarkdown } from '../../src/utils/whatsapp-formatter'

describe('WhatsApp Formatter', () => {
  describe('markdownToWhatsApp - HTML Image Tags', () => {
    it('should convert <img> tags to emoji placeholder', () => {
      const input = '<img src="https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/products/amaretti.jpg" alt="Amaretti di Saronno" />'
      const output = markdownToWhatsApp(input)
      
      expect(output).toBe('📷 [Amaretti di Saronno]')
      // CRITICAL: No HTML should remain
      expect(output).not.toContain('<img')
      expect(output).not.toContain('src=')
    })

    it('should handle product detail messages with HTML img tags', () => {
      const input = `Amaretti di Saronno: Biscotti tradizionali
<img src="https://res.cloudinary.com/dpagtnf1i/image/upload/v1234/products/amaretti.jpg" alt="Amaretti di Saronno" />
- Formato: 250g
- Prezzo: 6.80 Euro`

      const output = markdownToWhatsApp(input)
      
      // Image converted to emoji
      expect(output).toContain('📷 [Amaretti di Saronno]')
      // No HTML remains
      expect(output).not.toContain('<img')
      expect(output).not.toContain('src=')
    })

    it('should handle multiple images in one message', () => {
      const input = `Prodotti disponibili:
<img src="https://example.com/img1.jpg" alt="Prodotto 1" />
<img src="https://example.com/img2.jpg" alt="Prodotto 2" />`

      const output = markdownToWhatsApp(input)
      
      expect(output).toContain('📷 [Prodotto 1]')
      expect(output).toContain('📷 [Prodotto 2]')
      expect(output).not.toContain('<img')
    })

    it('should handle images with empty alt text', () => {
      const input = '<img src="https://example.com/img.jpg" alt="" />'
      const output = markdownToWhatsApp(input)
      
      expect(output).toBe('📷 []')
    })
  })

  describe('markdownToWhatsApp - Markdown Formatting', () => {
    it('should convert bold: **text** → *text*', () => {
      // Test with standalone bold (no surrounding text that would trigger italic regex)
      const input = '**Bold**'
      const output = markdownToWhatsApp(input)
      expect(output).toBe('*Bold*')
    })

    it('should convert italic: *text* → _text_', () => {
      const input = 'This is *Italic* text'
      const output = markdownToWhatsApp(input)
      expect(output).toContain('_Italic_')
    })

    it('should convert lists: - item → • item', () => {
      const input = '- Item 1\n- Item 2'
      const output = markdownToWhatsApp(input)
      expect(output).toContain('• Item 1')
      expect(output).toContain('• Item 2')
    })

    it('should convert links: [text](url) → text: url', () => {
      const input = '[Click here](https://example.com)'
      const output = markdownToWhatsApp(input)
      expect(output).toBe('Click here: https://example.com')
    })

    it('should handle mixed bold and italic', () => {
      const input = 'This has **bold** and *italic* text'
      const output = markdownToWhatsApp(input)
      expect(output).toContain('*bold*')
      expect(output).toContain('_italic_')
    })
  })

  describe('whatsAppToMarkdown', () => {
    it('should convert bold: *text* → **text**', () => {
      expect(whatsAppToMarkdown('*Bold*')).toBe('**Bold**')
    })

    it('should convert italic: _text_ → *text*', () => {
      expect(whatsAppToMarkdown('_Italic_')).toBe('*Italic*')
    })

    it('should convert lists: • item → - item', () => {
      const input = '• Item 1\n• Item 2'
      const output = whatsAppToMarkdown(input)
      expect(output).toContain('- Item 1')
      expect(output).toContain('- Item 2')
    })
  })

  describe('Round-trip conversion', () => {
    it('should NOT preserve HTML img tags (they get converted to emoji)', () => {
      const original = '<img src="https://example.com/img.jpg" alt="Test" />'
      const toWhatsApp = markdownToWhatsApp(original)
      
      // HTML should be gone - converted to plain text emoji
      expect(toWhatsApp).toBe('📷 [Test]')
      expect(toWhatsApp).not.toContain('<img')
    })
  })
})
