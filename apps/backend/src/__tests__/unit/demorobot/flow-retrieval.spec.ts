import {
  cosineSimilarity,
  findRelevantFlows,
  isPlausibleSerialNumber,
  normalizeSerialNumber,
  selectBestFlow,
} from '../../../application/demorobot/flow-retrieval.service'
import { RetrievableFlow } from '../../../application/demorobot/flow-retrieval.types'
import { matchSerialNumberToModel } from '../../../application/demorobot/robot-model-lookup.service'

// Real serial numbers confirmed by the client: 19 chars, HKX prefix for
// 2025 models, HKA for 2026 models.
const REAL_SERIAL_2025 = 'HKX3EB100JD25070076'
const REAL_SERIAL_2026 = 'HKA4OB100LQ26050197'

describe('normalizeSerialNumber (0/O typo correction)', () => {
  it('leaves an already-correct serial unchanged (aside from case)', () => {
    expect(normalizeSerialNumber(REAL_SERIAL_2025)).toBe(REAL_SERIAL_2025)
    expect(normalizeSerialNumber(REAL_SERIAL_2026)).toBe(REAL_SERIAL_2026)
  })

  it('fixes a 0 typed instead of O in a letter position', () => {
    // Position 5 expects a letter ('B' in "EB") — corrupt "OB" -> "0B" and
    // confirm normalization restores it, using the HKA example's "OB" segment.
    const withTypo = 'HKA4' + '0' + 'B100LQ26050197' // "0B" instead of "OB" at positions 4-5
    expect(normalizeSerialNumber(withTypo)).toBe(REAL_SERIAL_2026)
  })

  it('does not corrupt real digits (e.g. the encoded year) by treating O as 0 in digit positions', () => {
    // If a user mistakenly typed O where a digit was expected, normalize
    // converts it back to 0 — digit positions never end up as letters.
    const withTypo = 'HKX3EB1OOJD25070076' // "1OO" instead of "100" at positions 6-8
    expect(normalizeSerialNumber(withTypo)).toBe(REAL_SERIAL_2025)
  })
})

describe('isPlausibleSerialNumber (step 0)', () => {
  it('accepts a real 19-char HKX/HKA serial', () => {
    expect(isPlausibleSerialNumber(REAL_SERIAL_2025)).toBe(true)
    expect(isPlausibleSerialNumber(REAL_SERIAL_2026)).toBe(true)
  })

  it('accepts a serial with the common 0/O typo (normalized before checking)', () => {
    expect(isPlausibleSerialNumber('HKA40B100LQ26050197')).toBe(true) // "0B" instead of "OB"
  })

  it('rejects a serial that is not exactly 19 characters', () => {
    expect(isPlausibleSerialNumber('HKX3EB100JD2507007')).toBe(false) // 18 chars
    expect(isPlausibleSerialNumber('HKX3EB100JD250700766')).toBe(false) // 20 chars
    expect(isPlausibleSerialNumber('123')).toBe(false)
  })

  it('rejects a 19-char string without the HKX/HKA prefix', () => {
    expect(isPlausibleSerialNumber('XXX3EB100JD25070076')).toBe(false)
  })

  it('treats absent/empty serial numbers as implausible, not an error', () => {
    expect(isPlausibleSerialNumber(undefined)).toBe(false)
    expect(isPlausibleSerialNumber(null)).toBe(false)
    expect(isPlausibleSerialNumber('')).toBe(false)
  })
})

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('returns 0 for mismatched or empty vectors instead of throwing', () => {
    expect(cosineSimilarity([], [1, 2])).toBe(0)
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0)
  })
})

describe('findRelevantFlows (step 2)', () => {
  const flows: RetrievableFlow[] = [
    { id: 'flow_model_a', robotModelId: 'model_a', embedding: [1, 0, 0] },
    { id: 'flow_model_b', robotModelId: 'model_b', embedding: [1, 0, 0] }, // same vector, wrong model
    { id: 'flow_generic', robotModelId: null, embedding: [0.9, 0.1, 0] }, // workspace-generic fallback
  ]

  it('scopes candidates to the resolved robotModelId plus workspace-generic flows', () => {
    const result = findRelevantFlows({
      robotModelId: 'model_a',
      queryEmbedding: [1, 0, 0],
      candidateFlows: flows,
      k: 3,
    })
    const ids = result.map((r) => r.flowId)
    expect(ids).toContain('flow_model_a')
    expect(ids).toContain('flow_generic')
    expect(ids).not.toContain('flow_model_b')
  })

  it('sorts candidates by descending similarity and caps at k', () => {
    const result = findRelevantFlows({
      robotModelId: 'model_a',
      queryEmbedding: [1, 0, 0],
      candidateFlows: flows,
      k: 1,
    })
    expect(result).toHaveLength(1)
    expect(result[0].flowId).toBe('flow_model_a') // exact match beats the 0.9-similarity generic flow
  })
})

describe('selectBestFlow (single best-match attachment)', () => {
  it('attaches only the top candidate when it is above threshold', () => {
    const candidates = [
      { flowId: 'a', similarity: 0.84 },
      { flowId: 'b', similarity: 0.81 },
      { flowId: 'c', similarity: 0.78 },
    ]
    const result = selectBestFlow(candidates, 0.7)
    expect(result).toEqual({ flowId: 'a', similarity: 0.84 })
  })

  it('returns null (no match) when the best candidate is below threshold', () => {
    const candidates = [{ flowId: 'a', similarity: 0.5 }]
    expect(selectBestFlow(candidates, 0.7)).toBeNull()
  })

  it('returns null when there are no candidates at all', () => {
    expect(selectBestFlow([], 0.7)).toBeNull()
  })
})

describe('matchSerialNumberToModel (HKX/HKA prefix lookup)', () => {
  const candidates = [
    { id: 'model_2025', slug: 'robocut-2025', lookupRules: { prefix: 'HKX3EB100' } },
    { id: 'model_2026', slug: 'robocut-2026', lookupRules: { prefix: 'HKA4OB100' } },
  ]

  it('returns serial_absent for an implausible serial, never unknown_model', () => {
    expect(matchSerialNumberToModel('123', candidates)).toEqual({ status: 'serial_absent' })
  })

  it('resolves the 2025 model via its HKX prefix rule', () => {
    expect(matchSerialNumberToModel(REAL_SERIAL_2025, candidates)).toEqual({
      status: 'resolved',
      robotModelId: 'model_2025',
    })
  })

  it('resolves the 2026 model via its HKA prefix rule', () => {
    expect(matchSerialNumberToModel(REAL_SERIAL_2026, candidates)).toEqual({
      status: 'resolved',
      robotModelId: 'model_2026',
    })
  })

  it('resolves correctly even with the common 0/O typo, via normalization', () => {
    expect(matchSerialNumberToModel('HKA40B100LQ26050197', candidates)).toEqual({
      status: 'resolved',
      robotModelId: 'model_2026',
    })
  })

  it('returns not_found for a plausible HKX/HKA serial matching no configured prefix', () => {
    const otherModel = 'HKX9ZZ999ZZ25010101' // valid shape, no candidate has this prefix
    expect(matchSerialNumberToModel(otherModel, candidates)).toEqual({ status: 'not_found' })
  })

  it('resolves via exact slug match as a fallback when no prefix rule matches', () => {
    const noPrefixCandidates = [{ id: 'model_3', slug: REAL_SERIAL_2025.toLowerCase(), lookupRules: {} }]
    expect(matchSerialNumberToModel(REAL_SERIAL_2025, noPrefixCandidates)).toEqual({
      status: 'resolved',
      robotModelId: 'model_3',
    })
  })
})
