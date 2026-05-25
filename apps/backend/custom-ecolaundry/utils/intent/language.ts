// approved-by-andrea: REFACTOR ONLY — file split of utils/intent.ts per
// iron rule #3. Zero behavioural change. detectLanguageHeuristic moved
// verbatim from utils/intent.ts. The function remains the tracked-exemption
// language detector listed in CLAUDE.md ("Language detection. detectLanguage-
// Heuristic uses scoring-based phrase matching to identify customer language
// before LLM routing"). Same status applies post-move. Coverage in
// intent.test.ts.

import type { SessionState } from '../../models/index.js'
import {
  LANG_ES_PUNCT_RE,
  LANG_ES_VOCAB_RE,
  LANG_ES_DISTINGUISHER_RE,
  LANG_CA_STRONG_RE,
  LANG_CA_QUINA_RE,
  LANG_CA_VOCAB_RE,
  LANG_EN_MARKERS_RE,
  LANG_IT_MARKERS_RE,
  LANG_PT_MARKERS_RE,
  LANG_FR_MARKERS_RE,
} from '../patterns.js'

export function detectLanguageHeuristic(message: string): SessionState['language'] | null {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return null

  let esScore = 0, caScore = 0, enScore = 0, itScore = 0, ptScore = 0, frScore = 0

  if (LANG_ES_PUNCT_RE.test(normalized)) esScore += 20
  if (LANG_ES_VOCAB_RE.test(normalized)) esScore += 8
  if (LANG_ES_DISTINGUISHER_RE.test(normalized)) esScore += 5

  if (LANG_CA_STRONG_RE.test(normalized)) caScore += 20
  if (LANG_CA_QUINA_RE.test(normalized)) caScore += 20
  if (LANG_CA_VOCAB_RE.test(normalized)) caScore += 8

  if (LANG_EN_MARKERS_RE.test(normalized)) enScore += 5
  if (LANG_IT_MARKERS_RE.test(normalized)) itScore += 5
  if (LANG_PT_MARKERS_RE.test(normalized)) ptScore += 5
  if (LANG_FR_MARKERS_RE.test(normalized)) frScore += 5

  const scores = { es: esScore, ca: caScore, en: enScore, it: itScore, pt: ptScore, fr: frScore }
  const maxScore = Math.max(...Object.values(scores))
  if (maxScore === 0) return null

  // Priority order on tie: ES, CA, EN, IT, PT, FR.
  if (scores.es === maxScore) return 'es'
  if (scores.ca === maxScore) return 'ca'
  if (scores.en === maxScore) return 'en'
  if (scores.it === maxScore) return 'it'
  if (scores.pt === maxScore) return 'pt'
  if (scores.fr === maxScore) return 'fr'

  return null
}
