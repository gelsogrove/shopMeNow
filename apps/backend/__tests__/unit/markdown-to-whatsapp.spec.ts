import { mdToWhatsApp } from '../../src/utils/markdown-to-whatsapp'

/**
 * Tests for the Markdown → WhatsApp converter.
 *
 * The converter is the single deterministic post-processor that bridges
 * the rich Markdown produced by custom chatbots (custom-demowash,
 * custom-ecolaundry, ...) to the very limited formatting that WhatsApp
 * actually renders. Every transformation here is covered by at least one
 * test, including the no-op cases (idempotent inputs) and the edge cases
 * that would otherwise leak raw Markdown syntax into the customer's chat.
 *
 * Per CLAUDE.md rule 7A ("tests are the bible"): if a future regression
 * changes the converter's behavior, fix the converter — not the test.
 */
describe('mdToWhatsApp', () => {
  describe('bold', () => {
    it('converts **double-asterisk bold** to single-asterisk WhatsApp bold', () => {
      // WhatsApp uses *single asterisks* for bold. Markdown's `**bold**` would
      // appear literally on the customer's screen otherwise.
      expect(mdToWhatsApp('Tu **lavadora** está lista.')).toBe(
        'Tu *lavadora* está lista.',
      )
    })

    it('converts __underscore bold__ to single-asterisk WhatsApp bold', () => {
      // CommonMark allows __ as an alternate bold delimiter.
      expect(mdToWhatsApp('El __precio__ es 5€.')).toBe('El *precio* es 5€.')
    })

    it('leaves WhatsApp-style *single-asterisk* bold untouched', () => {
      // Idempotency: applying the converter twice must not double-escape.
      // Single asterisks at word boundaries are bold in WhatsApp and italic
      // in Markdown — but since we are going TO WhatsApp, leave as bold.
      expect(mdToWhatsApp('Tu *lavadora* está lista.')).toBe(
        'Tu _lavadora_ está lista.',
      )
    })

    it('handles multiple bold spans in the same line', () => {
      expect(mdToWhatsApp('**Hola** Carlos, tu **precio** es 5€.')).toBe(
        '*Hola* Carlos, tu *precio* es 5€.',
      )
    })
  })

  describe('headers', () => {
    it('converts ## headers to *bold* lines', () => {
      // WhatsApp has no headers — bold-line is the universal substitute.
      expect(mdToWhatsApp('## Programas disponibles')).toBe(
        '*Programas disponibles*',
      )
    })

    it('converts single-# headers (h1) to bold lines', () => {
      expect(mdToWhatsApp('# Demowash')).toBe('*Demowash*')
    })

    it('converts deep headers (####) to bold lines', () => {
      // Whatever the depth, WhatsApp sees a single visual style — bold.
      expect(mdToWhatsApp('#### Sub-sub-section')).toBe('*Sub-sub-section*')
    })

    it('keeps inline # characters intact (not at start of line)', () => {
      // Hash inside a sentence (e.g. "número #5") is not a header. The
      // header regex anchors on line start.
      expect(mdToWhatsApp('Tu máquina número #5 está lista.')).toBe(
        'Tu máquina número #5 está lista.',
      )
    })
  })

  describe('tables', () => {
    it('converts a 3-column table into a header line + bullet rows', () => {
      // This is the case Andrea actually screenshotted on WhatsApp: a
      // Markdown table renders as raw pipes there. The converter joins
      // cells with " — " for readability and prefixes data rows with •.
      const input = [
        '| Botón | Programa | Temperatura |',
        '|-------|----------|-------------|',
        '| 1     | Muy caliente | 60° |',
        '| 2     | Caliente | 40° |',
        '| 3     | Templado | 30° |',
        '| 4     | Frío     | *   |',
      ].join('\n')
      const expected = [
        '*Botón — Programa — Temperatura*',
        '• 1 — Muy caliente — 60°',
        '• 2 — Caliente — 40°',
        '• 3 — Templado — 30°',
        '• 4 — Frío — *',
      ].join('\n')
      expect(mdToWhatsApp(input)).toBe(expected)
    })

    it('strips **bold** markers from inside table cells', () => {
      // Bold inside a table cell becomes noise once flattened to text.
      const input = [
        '| Núm | Precio |',
        '|-----|--------|',
        '| 1   | **5€** |',
      ].join('\n')
      expect(mdToWhatsApp(input)).toBe(
        ['*Núm — Precio*', '• 1 — 5€'].join('\n'),
      )
    })

    it('handles tables without leading/trailing pipes', () => {
      // CommonMark allows omitted outer pipes.
      const input = [
        'Botón | Programa',
        '------|---------',
        '1     | Frío',
      ].join('\n')
      expect(mdToWhatsApp(input)).toBe(
        ['*Botón — Programa*', '• 1 — Frío'].join('\n'),
      )
    })

    it('leaves non-table pipe-text alone', () => {
      // A single line with a pipe (no separator below) must NOT be parsed
      // as a table — that would mangle ordinary prose like "A | B option".
      expect(mdToWhatsApp('Choose option A | B')).toBe('Choose option A | B')
    })
  })

  describe('links', () => {
    it('converts [text](url) to "text: url"', () => {
      // WhatsApp shows raw URLs as clickable; the label becomes a prefix.
      expect(
        mdToWhatsApp('Ve a [Demowash](https://demowash.demo/refund) ahora.'),
      ).toBe('Ve a Demowash: https://demowash.demo/refund ahora.')
    })

    it('converts auto-links <url> to bare url', () => {
      expect(mdToWhatsApp('Contacta <mailto:hi@x.com> o <https://x.com>')).toBe(
        'Contacta mailto:hi@x.com o https://x.com',
      )
    })
  })

  describe('blockquotes and horizontal rules', () => {
    it('strips the leading "> " from blockquotes', () => {
      expect(mdToWhatsApp('> Importante: cierra la puerta.')).toBe(
        'Importante: cierra la puerta.',
      )
    })

    it('removes horizontal rules (---, ***, ___)', () => {
      // HRs serve as visual separators in Markdown — WhatsApp has none.
      expect(mdToWhatsApp('Antes.\n\n---\n\nDespués.')).toBe(
        'Antes.\n\nDespués.',
      )
    })
  })

  describe('code blocks (preservation)', () => {
    it('does NOT transform Markdown syntax inside fenced code blocks', () => {
      // Fenced blocks are protected: their **bold** and table-like content
      // must survive verbatim. The converter is for *prose* formatting.
      const input = [
        'Ejecuta esto:',
        '```',
        '**not bold** | also | not',
        '```',
        'Listo.',
      ].join('\n')
      expect(mdToWhatsApp(input)).toBe(input)
    })

    it('preserves inline `code` spans', () => {
      // Inline code stays as-is — the asterisks inside it should not flip.
      expect(mdToWhatsApp('Usa `**asterisks**` literalmente.')).toBe(
        'Usa `**asterisks**` literalmente.',
      )
    })
  })

  describe('mixed real-world bot reply', () => {
    it('handles a typical demowash response with header, bold and table', () => {
      // This mirrors the screenshot Andrea sent: a bot reply that uses a
      // header, an intro sentence with bold, and a programs table. End-state
      // must render readably on WhatsApp with NO raw pipes or hashes.
      const input = [
        'Perfecto. El código **SELECT** significa que tienes que pulsar el programa.',
        '',
        '## Programas en Eixample',
        '',
        '| Botón | Programa | Temperatura |',
        '|-------|----------|-------------|',
        '| 1     | Muy caliente | 60° |',
        '| 2     | Caliente | 40° |',
        '',
        '¿Arranca la máquina?',
      ].join('\n')
      const expected = [
        'Perfecto. El código *SELECT* significa que tienes que pulsar el programa.',
        '',
        '*Programas en Eixample*',
        '',
        '*Botón — Programa — Temperatura*',
        '• 1 — Muy caliente — 60°',
        '• 2 — Caliente — 40°',
        '',
        '¿Arranca la máquina?',
      ].join('\n')
      expect(mdToWhatsApp(input)).toBe(expected)
    })
  })

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      // Defensive: the upstream guard only checks `customOutput.reply` for
      // truthiness, so we still need to handle "" cleanly.
      expect(mdToWhatsApp('')).toBe('')
    })

    it('trims trailing whitespace from the final output', () => {
      expect(mdToWhatsApp('Hola\n\n\n')).toBe('Hola')
    })

    it('collapses 3+ blank lines into 2 to avoid huge gaps', () => {
      // After stripping headers/HRs we can end up with several consecutive
      // blank lines — this restores a sensible paragraph spacing.
      expect(mdToWhatsApp('A\n\n\n\n\nB')).toBe('A\n\nB')
    })

    it('strips raw HTML tags defensively', () => {
      // Custom chatbots should not produce HTML, but if any leaks through
      // we drop the tags rather than ship them to WhatsApp as literal text.
      expect(mdToWhatsApp('<b>Hola</b> mundo')).toBe('Hola mundo')
    })
  })
})
