import {
  generateFlowDescription,
  normalizeDescription,
} from '../../../application/flow-builder/flow-description-generator.service'

// WHAT: the sanitiser applied to whatever the LLM returns before the text is
// stored and embedded.
// WHY it is tested rather than trusted: this string goes verbatim into the
// retrieval embedding. Wrapping quotes, a stray bullet or a runaway paragraph
// are not cosmetic problems — they are tokens that dilute the vector and make
// the flow harder to match, which is the exact opposite of why the field
// exists.
describe('normalizeDescription', () => {
  it('collapses newlines and repeated whitespace into a single line', () => {
    expect(normalizeDescription('Il robot lampeggia rosso\n\ne  non parte.')).toBe(
      'Il robot lampeggia rosso e non parte.',
    )
  })

  it('strips a leading bullet marker the model added despite the instructions', () => {
    expect(normalizeDescription('- Il robot non parte.')).toBe('Il robot non parte.')
    expect(normalizeDescription('• Il robot non parte.')).toBe('Il robot non parte.')
  })

  it('removes quotes that wrap the entire description', () => {
    expect(normalizeDescription('"Il robot non parte."')).toBe('Il robot non parte.')
    expect(normalizeDescription('«Il robot non parte.»')).toBe('Il robot non parte.')
  })

  // Guards against an over-eager strip: quotes INSIDE the sentence are content
  // (an error label the customer reads on the display), not wrapping.
  it('keeps quotes that are part of the sentence', () => {
    const text = 'Il display mostra "ERROR 001" e il robot non parte.'
    expect(normalizeDescription(text)).toBe(text)
  })

  it('truncates an over-long description at a word boundary', () => {
    // 500 chars of real words, above the 400-char cap.
    const long = 'parola '.repeat(80).trim()
    const result = normalizeDescription(long)

    expect(result.length).toBeLessThanOrEqual(401) // 400 + the ellipsis
    expect(result.endsWith('…')).toBe(true)
    // Cut at a space, so the last word is never left mangled.
    expect(result).not.toMatch(/paro…$/)
  })

  it('leaves a well-formed description untouched', () => {
    const text = 'Il robot lampeggia rosso e non parte dalla base. Succede dopo un temporale.'
    expect(normalizeDescription(text)).toBe(text)
  })
})

describe('generateFlowDescription', () => {
  // WHY: with no questions there are no symptoms to infer from. Calling the LLM
  // anyway would make it elaborate on the title alone and invent a case that
  // does not exist in the graph — the failure mode the whole "generate, don't
  // ask" approach is meant to avoid.
  it('refuses to generate from an empty graph instead of inventing a case', async () => {
    const result = await generateFlowDescription({ compiledPrompt: '   ', flowTitle: 'ERROR 001' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('no questions yet')
    }
  })
})
