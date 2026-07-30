import {
  cosineSimilarity,
  findRelevantFlows,
  isPlausibleSerialNumber,
  selectBestFlow,
} from '../../../application/demorobot/flow-retrieval.service'
import { RetrievableFlow } from '../../../application/demorobot/flow-retrieval.types'
import { matchSerialNumberToModel } from '../../../application/demorobot/robot-model-lookup.service'

describe('isPlausibleSerialNumber (step 0)', () => {
  it('rejects serial numbers shorter than 12 characters', () => {
    expect(isPlausibleSerialNumber('123')).toBe(false)
    expect(isPlausibleSerialNumber('12345678901')).toBe(false) // 11 chars
  })

  it('accepts serial numbers of 12 or more characters', () => {
    expect(isPlausibleSerialNumber('123456789012')).toBe(true) // 12 chars
    expect(isPlausibleSerialNumber('RC-X200-000123456')).toBe(true)
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

describe('matchSerialNumberToModel (pluggable lookup placeholder)', () => {
  const candidates = [
    { id: 'model_1', slug: 'rocut-x200', lookupRules: { prefix: 'RCX200' } },
    { id: 'model_2', slug: 'rocut-x400', lookupRules: {} },
  ]

  it('returns serial_absent for an implausible serial, never unknown_model', () => {
    expect(matchSerialNumberToModel('123', candidates)).toEqual({ status: 'serial_absent' })
  })

  it('resolves via prefix rule', () => {
    expect(matchSerialNumberToModel('RCX200-00099999', candidates)).toEqual({
      status: 'resolved',
      robotModelId: 'model_1',
    })
  })

  it('resolves via exact slug match as a fallback', () => {
    // 12+ chars so it clears the step-0 plausibility check.
    expect(matchSerialNumberToModel('rocut-x400ab', candidates)).toEqual({
      status: 'not_found', // slug 'rocut-x400' !== 'rocut-x400ab', exact match only
    })
    const candidatesWithLongSlug = [{ id: 'model_2', slug: 'rocut-x400ab', lookupRules: {} }]
    expect(matchSerialNumberToModel('rocut-x400ab', candidatesWithLongSlug)).toEqual({
      status: 'resolved',
      robotModelId: 'model_2',
    })
  })

  it('returns not_found for a plausible serial matching no candidate', () => {
    expect(matchSerialNumberToModel('ZZZZZZZZZZZZ', candidates)).toEqual({ status: 'not_found' })
  })
})
